/**
 * Schema Analyzer - Automatically discover entities from Drizzle schemas
 * Part of Phase 3B: Route Code Generation System
 * 
 * Analyzes Drizzle schemas to auto-generate entity configurations
 * Reduces manual configuration and keeps routes in sync with schema changes
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import type { EntityDefinition } from './route-generator'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface SchemaAnalysis {
  entities: EntityDefinition[]
  relationships: EntityRelationship[]
  suggestions: RouteSuggestion[]
  warnings: string[]
}

export interface EntityRelationship {
  fromEntity: string
  toEntity: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  foreignKey: string
  cascadeDelete?: boolean
}

export interface RouteSuggestion {
  entity: string
  route: {
    method: string
    path: string
    summary: string
    reason: string
  }
}

export interface SchemaField {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  foreignKey?: {
    table: string
    column: string
    onDelete?: string
  }
  defaultValue?: any
  enum?: string[]
}

export interface SchemaTable {
  name: string
  fields: SchemaField[]
  indexes: string[]
  relationships: EntityRelationship[]
}

// =============================================================================
// SCHEMA ANALYZER CLASS
// =============================================================================

export class SchemaAnalyzer {
  private schemaPath: string
  private serviceBasePath: string
  
  constructor(schemaPath: string, serviceBasePath: string) {
    this.schemaPath = schemaPath
    this.serviceBasePath = serviceBasePath
  }

  /**
   * Analyze Drizzle schema file and extract entity information
   */
  async analyzeSchema(): Promise<SchemaAnalysis> {
    if (!existsSync(this.schemaPath)) {
      throw new Error(`Schema file not found: ${this.schemaPath}`)
    }

    const schemaContent = readFileSync(this.schemaPath, 'utf-8')
    const tables = this.parseSchemaContent(schemaContent)
    
    const entities = this.generateEntityDefinitions(tables)
    const relationships = this.extractRelationships(tables)
    const suggestions = this.generateRouteSuggestions(tables, relationships)
    const warnings = this.generateWarnings(tables, entities)

    return {
      entities,
      relationships,
      suggestions,
      warnings
    }
  }

  /**
   * Parse Drizzle schema content to extract table definitions
   */
  private parseSchemaContent(content: string): SchemaTable[] {
    const tables: SchemaTable[] = []
    
    // Find all sqliteTable definitions
    const tableRegex = /export\s+const\s+(\w+)\s*=\s*sqliteTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+)\}/gs
    let tableMatch
    
    while ((tableMatch = tableRegex.exec(content)) !== null) {
      const [, tableName, dbTableName, fieldsContent] = tableMatch
      
      const fields = this.parseTableFields(fieldsContent)
      const indexes = this.parseTableIndexes(content, tableName)
      
      tables.push({
        name: dbTableName,
        fields,
        indexes,
        relationships: []
      })
    }

    // Parse relationships
    for (const table of tables) {
      table.relationships = this.parseTableRelationships(content, table.name)
    }

    return tables
  }

  /**
   * Parse table field definitions
   */
  private parseTableFields(fieldsContent: string): SchemaField[] {
    const fields: SchemaField[] = []
    
    // Extract field definitions
    const fieldRegex = /(\w+):\s*(\w+)\([^)]*\)([^,\n]*)/g
    let fieldMatch
    
    while ((fieldMatch = fieldRegex.exec(fieldsContent)) !== null) {
      const [, fieldName, fieldType, modifiers] = fieldMatch
      
      const field: SchemaField = {
        name: fieldName,
        type: this.mapDrizzleTypeToJS(fieldType),
        nullable: !modifiers.includes('.notNull()'),
        primaryKey: modifiers.includes('.primaryKey()'),
      }

      // Check for foreign key references
      const referencesMatch = modifiers.match(/\.references\(\(\)\s*=>\s*(\w+)\.(\w+)(?:,\s*\{[^}]*onDelete:\s*['"`]([^'"`]+)['"`][^}]*\})?/)
      if (referencesMatch) {
        const [, refTable, refColumn, onDelete] = referencesMatch
        field.foreignKey = {
          table: refTable,
          column: refColumn,
          onDelete
        }
      }

      // Check for enum values
      const enumMatch = modifiers.match(/\{\s*enum:\s*\[([^\]]+)\]\s*\}/)
      if (enumMatch) {
        field.enum = enumMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''))
      }

      // Check for default values
      const defaultMatch = modifiers.match(/\.default\(([^)]+)\)/)
      if (defaultMatch) {
        field.defaultValue = defaultMatch[1]
      }

      fields.push(field)
    }

    return fields
  }

  /**
   * Parse table indexes
   */
  private parseTableIndexes(content: string, tableName: string): string[] {
    const indexes: string[] = []
    
    // Find index definitions for this table
    const indexRegex = new RegExp(`${tableName}\\s*=\\s*sqliteTable[^}]+\\}\\),\\s*\\(table\\)\\s*=>\\s*\\(\\{([^}]+)\\}\\)`, 's')
    const indexMatch = content.match(indexRegex)
    
    if (indexMatch) {
      const indexContent = indexMatch[1]
      const indexEntryRegex = /(\w+):\s*index\([^)]+\)\.on\(([^)]+)\)/g
      let entryMatch
      
      while ((entryMatch = indexEntryRegex.exec(indexContent)) !== null) {
        const [, indexName, columns] = entryMatch
        indexes.push(indexName)
      }
    }

    return indexes
  }

  /**
   * Parse table relationships from relations definitions
   */
  private parseTableRelationships(content: string, tableName: string): EntityRelationship[] {
    const relationships: EntityRelationship[] = []
    
    // Find relations definitions
    const relationsRegex = new RegExp(`export\\s+const\\s+(\\w+)Relations\\s*=\\s*relations\\s*\\(\\s*(\\w+)\\s*,\\s*\\(\\{[^}]+\\}\\)\\s*=>\\s*\\(\\{([^}]+)\\}\\)\\)`, 'gs')
    let relMatch
    
    while ((relMatch = relationsRegex.exec(content)) !== null) {
      const [, relationsName, sourceTable, relationsContent] = relMatch
      
      if (sourceTable === tableName) {
        const relationRegex = /(\w+):\s*(one|many)\(([^)]+)\)/g
        let relationMatch
        
        while ((relationMatch = relationRegex.exec(relationsContent)) !== null) {
          const [, relationName, relationType, relationTarget] = relationMatch
          
          // Extract target table from relation definition
          const targetMatch = relationTarget.match(/(\w+)/)
          if (targetMatch) {
            relationships.push({
              fromEntity: tableName,
              toEntity: targetMatch[1],
              type: relationType === 'one' ? 'one-to-one' : 'one-to-many',
              foreignKey: relationName
            })
          }
        }
      }
    }

    return relationships
  }

  /**
   * Generate entity definitions from parsed tables
   */
  private generateEntityDefinitions(tables: SchemaTable[]): EntityDefinition[] {
    return tables.map(table => {
      const entityName = this.tableNameToEntityName(table.name)
      const plural = this.entityNameToPlural(entityName)
      
      const entity: EntityDefinition = {
        name: entityName,
        plural,
        tableName: table.name,
        schemaPath: '@promptliano/schemas',
        servicePath: '@promptliano/services',
        options: {
          includeSoftDelete: true,
          enableSearch: this.shouldEnableSearch(table),
          enableBatch: this.shouldEnableBatch(table)
        }
      }

      // Add custom routes based on table structure
      entity.customRoutes = this.generateCustomRoutes(table)

      return entity
    })
  }

  /**
   * Extract relationships between entities
   */
  private extractRelationships(tables: SchemaTable[]): EntityRelationship[] {
    const relationships: EntityRelationship[] = []
    
    for (const table of tables) {
      for (const field of table.fields) {
        if (field.foreignKey) {
          relationships.push({
            fromEntity: table.name,
            toEntity: field.foreignKey.table,
            type: 'one-to-many', // Default assumption
            foreignKey: field.name,
            cascadeDelete: field.foreignKey.onDelete === 'cascade'
          })
        }
      }
    }

    return relationships
  }

  /**
   * Generate route suggestions based on schema analysis
   */
  private generateRouteSuggestions(tables: SchemaTable[], relationships: EntityRelationship[]): RouteSuggestion[] {
    const suggestions: RouteSuggestion[] = []

    for (const table of tables) {
      const entityName = this.tableNameToEntityName(table.name)
      
      // Suggest search route if table has searchable fields
      const hasSearchableFields = table.fields.some(f => 
        f.type === 'string' && ['name', 'title', 'description', 'content'].includes(f.name)
      )
      
      if (hasSearchableFields) {
        suggestions.push({
          entity: entityName,
          route: {
            method: 'post',
            path: '/search',
            summary: `Search ${this.entityNameToPlural(entityName)}`,
            reason: 'Table has searchable text fields'
          }
        })
      }

      // Suggest status transition routes for entities with status fields
      const statusField = table.fields.find(f => f.name === 'status' && f.enum)
      if (statusField?.enum) {
        for (const status of statusField.enum) {
          if (status !== 'open') {
            suggestions.push({
              entity: entityName,
              route: {
                method: 'post',
                path: `/{id}/${status.replace('_', '-')}`,
                summary: `Mark ${entityName} as ${status}`,
                reason: `Status field supports '${status}' transition`
              }
            })
          }
        }
      }

      // Suggest relationship routes
      const relatedEntities = relationships.filter(r => r.fromEntity === table.name)
      for (const rel of relatedEntities) {
        const relatedEntityName = this.tableNameToEntityName(rel.toEntity)
        suggestions.push({
          entity: entityName,
          route: {
            method: 'get',
            path: `/{id}/${this.entityNameToPlural(relatedEntityName)}`,
            summary: `Get ${relatedEntityName} for ${entityName}`,
            reason: `Has relationship to ${relatedEntityName}`
          }
        })
      }
    }

    return suggestions
  }

  /**
   * Generate warnings for potential issues
   */
  private generateWarnings(tables: SchemaTable[], entities: EntityDefinition[]): string[] {
    const warnings: string[] = []

    for (const table of tables) {
      // Check for missing indexes on foreign keys
      const fkFields = table.fields.filter(f => f.foreignKey)
      for (const fkField of fkFields) {
        const hasIndex = table.indexes.some(idx => idx.includes(fkField.name))
        if (!hasIndex) {
          warnings.push(`Table '${table.name}' foreign key '${fkField.name}' is not indexed`)
        }
      }

      // Check for missing service files
      const entityName = this.tableNameToEntityName(table.name)
      const servicePath = path.join(this.serviceBasePath, `${entityName.toLowerCase()}-service-v2.ts`)
      if (!existsSync(servicePath)) {
        warnings.push(`Service file not found: ${servicePath}`)
      }
    }

    return warnings
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private tableNameToEntityName(tableName: string): string {
    // Convert snake_case or plural to PascalCase singular
    return tableName
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/s$/, '') // Remove trailing 's' for plural
      .charAt(0).toUpperCase() + tableName.slice(1)
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/s$/, '')
      .slice(1)
  }

  private entityNameToPlural(entityName: string): string {
    // Simple pluralization - can be enhanced
    if (entityName.endsWith('y')) {
      return entityName.slice(0, -1) + 'ies'
    }
    if (entityName.endsWith('s') || entityName.endsWith('sh') || entityName.endsWith('ch')) {
      return entityName + 'es'
    }
    return entityName.toLowerCase() + 's'
  }

  private mapDrizzleTypeToJS(drizzleType: string): string {
    const typeMap: Record<string, string> = {
      'integer': 'number',
      'text': 'string',
      'real': 'number',
      'blob': 'Buffer'
    }
    return typeMap[drizzleType] || 'unknown'
  }

  private shouldEnableSearch(table: SchemaTable): boolean {
    return table.fields.some(f => 
      f.type === 'string' && 
      ['name', 'title', 'description', 'content', 'summary'].includes(f.name)
    )
  }

  private shouldEnableBatch(table: SchemaTable): boolean {
    // Enable batch operations for tables that typically need bulk operations
    const batchTables = ['files', 'tasks', 'tickets', 'messages']
    return batchTables.some(name => table.name.includes(name))
  }

  private generateCustomRoutes(table: SchemaTable): any[] {
    const customRoutes = []
    
    // Generate status transition routes
    const statusField = table.fields.find(f => f.name === 'status' && f.enum)
    if (statusField?.enum) {
      for (const status of statusField.enum) {
        if (status !== 'open') {
          customRoutes.push({
            method: 'post',
            path: `/{id}/${status.replace('_', '-')}`,
            summary: `Mark as ${status}`,
            handlerName: status.replace('_', '')
          })
        }
      }
    }

    return customRoutes
  }
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Analyze schema and generate entity configurations
 */
export async function analyzeSchemaFile(schemaPath: string, serviceBasePath: string): Promise<SchemaAnalysis> {
  const analyzer = new SchemaAnalyzer(schemaPath, serviceBasePath)
  return analyzer.analyzeSchema()
}

/**
 * Generate entity configurations from Drizzle schema
 */
export async function generateEntityConfigsFromSchema(
  schemaPath: string,
  serviceBasePath: string
): Promise<EntityDefinition[]> {
  const analysis = await analyzeSchemaFile(schemaPath, serviceBasePath)
  
  if (analysis.warnings.length > 0) {
    console.warn('Schema analysis warnings:')
    analysis.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`))
  }

  return analysis.entities
}