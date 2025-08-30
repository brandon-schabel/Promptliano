/**
 * Drizzle Schema Extractor - Extract entity information from Drizzle schema file
 * Part of Phase 3B: Route Code Generation System
 *
 * Automatically extracts entity definitions from the Drizzle schema to generate
 * route configurations without manual configuration
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import type { EntityDefinition } from './route-generator'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface DrizzleEntity {
  tableName: string
  exportName: string
  entityName: string
  fields: DrizzleField[]
  indexes: string[]
  hasStatus: boolean
  hasTimestamps: boolean
  relationships: DrizzleRelationship[]
}

export interface DrizzleField {
  name: string
  type: 'integer' | 'text' | 'real' | 'blob'
  nullable: boolean
  primaryKey: boolean
  references?: {
    table: string
    column: string
    onDelete?: string
  }
  enum?: string[]
  defaultValue?: string
}

export interface DrizzleRelationship {
  name: string
  type: 'one' | 'many'
  targetTable: string
  foreignKey?: string
}

// =============================================================================
// DRIZZLE SCHEMA EXTRACTOR
// =============================================================================

export class DrizzleSchemaExtractor {
  private schemaPath: string

  constructor(schemaPath: string) {
    this.schemaPath = schemaPath
  }

  /**
   * Extract all entities from the Drizzle schema file
   */
  extractEntities(): DrizzleEntity[] {
    if (!existsSync(this.schemaPath)) {
      throw new Error(`Schema file not found: ${this.schemaPath}`)
    }

    const content = readFileSync(this.schemaPath, 'utf-8')
    const entities: DrizzleEntity[] = []

    // Extract table definitions
    const tableRegex =
      /export\s+const\s+(\w+)\s*=\s*sqliteTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+)\}(?:\s*,\s*\([^)]+\)\s*=>\s*\(\{([^}]+)\}\))?/gs

    let match
    while ((match = tableRegex.exec(content)) !== null) {
      const [, exportName, tableName, fieldsContent, indexesContent] = match

      const fields = this.parseFields(fieldsContent)
      const indexes = indexesContent ? this.parseIndexes(indexesContent) : []
      const relationships = this.parseRelationships(content, exportName)

      entities.push({
        tableName,
        exportName,
        entityName: this.tableNameToEntityName(tableName),
        fields,
        indexes,
        hasStatus: fields.some((f) => f.name === 'status'),
        hasTimestamps: fields.some((f) => f.name === 'createdAt' || f.name === 'created_at'),
        relationships
      })
    }

    return entities
  }

  /**
   * Convert Drizzle entities to route generator entity definitions
   */
  entitiesToDefinitions(entities: DrizzleEntity[]): EntityDefinition[] {
    return entities.map((entity) => {
      const definition: EntityDefinition = {
        name: entity.entityName,
        plural: this.pluralize(entity.entityName.toLowerCase()),
        tableName: entity.tableName,
        schemaPath: '@promptliano/schemas',
        servicePath: '@promptliano/services',
        options: {
          includeSoftDelete: true,
          enableSearch: this.shouldEnableSearch(entity),
          enableBatch: this.shouldEnableBatch(entity)
        }
      }

      // Add custom routes based on entity characteristics
      definition.customRoutes = this.generateCustomRoutes(entity)

      return definition
    })
  }

  /**
   * Parse field definitions from table content
   */
  private parseFields(fieldsContent: string): DrizzleField[] {
    const fields: DrizzleField[] = []

    // Clean up the content and split by lines
    const lines = fieldsContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'))

    for (const line of lines) {
      const fieldMatch = line.match(/(\w+):\s*(\w+)\([^)]*\)([^,]*),?/)
      if (!fieldMatch) continue

      const [, name, type, modifiers] = fieldMatch

      const field: DrizzleField = {
        name,
        type: type as DrizzleField['type'],
        nullable: !modifiers.includes('.notNull()'),
        primaryKey: modifiers.includes('.primaryKey()')
      }

      // Parse references
      const refMatch = modifiers.match(
        /\.references\(\(\)\s*=>\s*(\w+)\.(\w+)(?:,\s*\{[^}]*onDelete:\s*['"`]([^'"`]+)['"`][^}]*\})?/
      )
      if (refMatch) {
        const [, refTable, refColumn, onDelete] = refMatch
        field.references = {
          table: refTable,
          column: refColumn,
          onDelete
        }
      }

      // Parse enum values
      const enumMatch = modifiers.match(/\{\s*enum:\s*\[([^\]]+)\]\s*\}/)
      if (enumMatch) {
        field.enum = enumMatch[1].split(',').map((v) => v.trim().replace(/['"]/g, ''))
      }

      // Parse default values
      const defaultMatch = modifiers.match(/\.default\(([^)]+)\)/)
      if (defaultMatch) {
        field.defaultValue = defaultMatch[1]
      }

      fields.push(field)
    }

    return fields
  }

  /**
   * Parse index definitions
   */
  private parseIndexes(indexContent: string): string[] {
    const indexes: string[] = []
    const indexRegex = /(\w+):\s*index\([^)]+\)/g

    let match
    while ((match = indexRegex.exec(indexContent)) !== null) {
      indexes.push(match[1])
    }

    return indexes
  }

  /**
   * Parse relationship definitions
   */
  private parseRelationships(content: string, tableName: string): DrizzleRelationship[] {
    const relationships: DrizzleRelationship[] = []

    // Find relations for this table
    const relationsRegex = new RegExp(
      `export\\s+const\\s+${tableName}Relations\\s*=\\s*relations\\s*\\(\\s*${tableName}\\s*,\\s*\\([^)]+\\)\\s*=>\\s*\\(\\{([^}]+)\\}\\)\\)`,
      's'
    )

    const relMatch = content.match(relationsRegex)
    if (!relMatch) return relationships

    const relationsContent = relMatch[1]
    const relationRegex = /(\w+):\s*(one|many)\(([^)]+)\)/g

    let relationMatch
    while ((relationMatch = relationRegex.exec(relationsContent)) !== null) {
      const [, name, type, target] = relationMatch

      const targetMatch = target.match(/(\w+)/)
      if (targetMatch) {
        relationships.push({
          name,
          type: type as 'one' | 'many',
          targetTable: targetMatch[1]
        })
      }
    }

    return relationships
  }

  /**
   * Convert table name to entity name (PascalCase, singular)
   */
  private tableNameToEntityName(tableName: string): string {
    // Convert snake_case to PascalCase and make singular
    let entityName = tableName
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')

    // Handle common plural forms
    if (entityName.endsWith('ies')) {
      entityName = entityName.slice(0, -3) + 'y'
    } else if (entityName.endsWith('ses') || entityName.endsWith('ches') || entityName.endsWith('shes')) {
      entityName = entityName.slice(0, -2)
    } else if (entityName.endsWith('s') && !entityName.endsWith('ss')) {
      entityName = entityName.slice(0, -1)
    }

    return entityName
  }

  /**
   * Simple pluralization
   */
  private pluralize(word: string): string {
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies'
    }
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
      return word + 'es'
    }
    return word + 's'
  }

  /**
   * Determine if entity should have search enabled
   */
  private shouldEnableSearch(entity: DrizzleEntity): boolean {
    const searchableFields = ['name', 'title', 'description', 'content', 'summary', 'overview']
    return entity.fields.some((field) => field.type === 'text' && searchableFields.includes(field.name))
  }

  /**
   * Determine if entity should have batch operations enabled
   */
  private shouldEnableBatch(entity: DrizzleEntity): boolean {
    const batchEntities = ['file', 'task', 'ticket', 'message', 'prompt']
    return batchEntities.some(
      (name) => entity.entityName.toLowerCase().includes(name) || entity.tableName.includes(name)
    )
  }

  /**
   * Generate custom routes based on entity characteristics
   */
  private generateCustomRoutes(entity: DrizzleEntity): any[] {
    const customRoutes = []

    // Add status transition routes if entity has status field
    const statusField = entity.fields.find((f) => f.name === 'status' && f.enum)
    if (statusField?.enum) {
      for (const status of statusField.enum) {
        if (status !== 'open' && status !== 'pending') {
          customRoutes.push({
            method: 'post',
            path: `/{id}/${status.replace('_', '-')}`,
            summary: `Mark ${entity.entityName} as ${status}`,
            description: `Update ${entity.entityName} status to ${status}`,
            handlerName: status.replace('_', ''),
            responseSchema: 'OperationSuccessResponseSchema'
          })
        }
      }
    }

    // Add relationship routes
    for (const rel of entity.relationships) {
      if (rel.type === 'many') {
        const targetEntity = this.tableNameToEntityName(rel.targetTable)
        customRoutes.push({
          method: 'get',
          path: `/{id}/${this.pluralize(targetEntity.toLowerCase())}`,
          summary: `Get ${targetEntity} for ${entity.entityName}`,
          description: `Retrieve all ${targetEntity} associated with this ${entity.entityName}`,
          handlerName: `get${this.pluralize(targetEntity)}`,
          responseSchema: `${targetEntity}ListResponseSchema`
        })
      }
    }

    // Add special routes based on entity type
    switch (entity.entityName.toLowerCase()) {
      case 'project':
        customRoutes.push(
          {
            method: 'post',
            path: '/{id}/sync',
            summary: 'Sync project files',
            description: 'Trigger a manual sync of project files',
            handlerName: 'sync',
            responseSchema: 'OperationSuccessResponseSchema'
          },
          {
            method: 'get',
            path: '/{id}/files',
            summary: 'Get project files',
            description: 'Get all files in the project',
            handlerName: 'getFiles',
            responseSchema: 'FileListResponseSchema'
          },
          {
            method: 'get',
            path: '/{id}/summary',
            summary: 'Get project summary',
            description: 'Get AI-generated project summary',
            handlerName: 'getSummary',
            responseSchema: 'ProjectSummaryResponseSchema'
          }
        )
        break

      case 'ticket':
        customRoutes.push({
          method: 'post',
          path: '/{id}/tasks/generate',
          summary: 'Generate tasks',
          description: 'Auto-generate tasks for this ticket',
          handlerName: 'generateTasks',
          responseSchema: 'TaskListResponseSchema'
        })
        break

      case 'chat':
        customRoutes.push({
          method: 'post',
          path: '/{id}/messages',
          summary: 'Add message',
          description: 'Send a new message to the chat',
          handlerName: 'addMessage',
          requestSchema: {
            body: 'ChatMessageCreateSchema'
          },
          responseSchema: 'ChatMessageResponseSchema'
        })
        break

      case 'queue':
        customRoutes.push({
          method: 'post',
          path: '/{id}/process',
          summary: 'Process queue',
          description: 'Start processing items in the queue',
          handlerName: 'process',
          responseSchema: 'OperationSuccessResponseSchema'
        })
        break
    }

    return customRoutes
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract entities from Drizzle schema file
 */
export function extractDrizzleEntities(schemaPath: string): DrizzleEntity[] {
  const extractor = new DrizzleSchemaExtractor(schemaPath)
  return extractor.extractEntities()
}

/**
 * Convert Drizzle schema to route generator configurations
 */
export function drizzleSchemaToRouteConfig(schemaPath: string): EntityDefinition[] {
  const extractor = new DrizzleSchemaExtractor(schemaPath)
  const entities = extractor.extractEntities()
  return extractor.entitiesToDefinitions(entities)
}

/**
 * Generate configuration file from Drizzle schema
 */
export function generateConfigFromDrizzleSchema(schemaPath: string, outputDir: string = './src/routes/generated') {
  const entities = drizzleSchemaToRouteConfig(schemaPath)

  return {
    outputDir,
    imports: {
      schemas: '@promptliano/schemas',
      services: '@promptliano/services',
      shared: '@promptliano/shared'
    },
    entities,
    options: {
      generateTypes: true,
      generateDocs: true,
      formatCode: true,
      watch: {
        watchPaths: ['packages/database/src/**/*.ts', 'packages/services/src/**/*.ts', 'packages/schemas/src/**/*.ts'],
        debounceMs: 1000
      }
    }
  }
}
