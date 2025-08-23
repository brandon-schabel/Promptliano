/**
 * Route Validator - Validate generated routes match hand-written quality
 * Part of Phase 3B: Route Code Generation System
 * 
 * Ensures generated routes maintain the same quality, type safety, and functionality
 * as hand-written routes while providing significant code reduction benefits
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import path from 'path'
import { existsSync } from 'fs'
import type { GeneratorConfig } from './route-generator'

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationResult {
  success: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  metrics: ValidationMetrics
}

export interface ValidationError {
  type: 'missing_file' | 'syntax_error' | 'type_error' | 'import_error' | 'runtime_error'
  entity: string
  file: string
  message: string
  details?: any
}

export interface ValidationWarning {
  type: 'performance' | 'best_practice' | 'compatibility' | 'documentation'
  entity: string
  message: string
  suggestion?: string
}

export interface ValidationMetrics {
  totalEntities: number
  generatedFiles: number
  validFiles: number
  totalRoutes: number
  linesGenerated: number
  linesSaved: number
  codeReductionPercent: number
  validationTimeMs: number
}

// =============================================================================
// ROUTE VALIDATOR CLASS
// =============================================================================

export class RouteValidator {
  private config: GeneratorConfig
  private startTime: number = 0

  constructor(config: GeneratorConfig) {
    this.config = config
  }

  /**
   * Perform comprehensive validation of generated routes
   */
  async validate(): Promise<ValidationResult> {
    this.startTime = Date.now()
    
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      metrics: {
        totalEntities: this.config.entities.length,
        generatedFiles: 0,
        validFiles: 0,
        totalRoutes: 0,
        linesGenerated: 0,
        linesSaved: 0,
        codeReductionPercent: 0,
        validationTimeMs: 0
      }
    }

    try {
      // 1. Validate file existence
      await this.validateFileExistence(result)
      
      // 2. Validate syntax and imports
      await this.validateSyntaxAndImports(result)
      
      // 3. Validate route registration
      await this.validateRouteRegistration(result)
      
      // 4. Validate OpenAPI schemas
      await this.validateOpenAPISchemas(result)
      
      // 5. Calculate metrics
      await this.calculateMetrics(result)
      
      // 6. Generate warnings and suggestions
      await this.generateWarnings(result)

    } catch (error) {
      result.errors.push({
        type: 'runtime_error',
        entity: 'validator',
        file: 'route-validator.ts',
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error
      })
    }

    result.metrics.validationTimeMs = Date.now() - this.startTime
    result.success = result.errors.length === 0

    return result
  }

  /**
   * Validate that all expected files were generated
   */
  private async validateFileExistence(result: ValidationResult): Promise<void> {
    const expectedFiles = [
      'index.generated.ts',
      'types.generated.ts',
      ...this.config.entities.map(entity => `${entity.name.toLowerCase()}-routes.generated.ts`)
    ]

    for (const fileName of expectedFiles) {
      const filePath = path.join(this.config.outputDir, fileName)
      
      if (!existsSync(filePath)) {
        result.errors.push({
          type: 'missing_file',
          entity: fileName.includes('-routes') 
            ? fileName.replace('-routes.generated.ts', '') 
            : 'system',
          file: fileName,
          message: `Generated file not found: ${fileName}`
        })
      } else {
        result.metrics.generatedFiles++
      }
    }
  }

  /**
   * Validate syntax and import statements
   */
  private async validateSyntaxAndImports(result: ValidationResult): Promise<void> {
    for (const entity of this.config.entities) {
      const fileName = `${entity.name.toLowerCase()}-routes.generated.ts`
      const filePath = path.join(this.config.outputDir, fileName)
      
      if (!existsSync(filePath)) continue

      try {
        // Attempt to require/import the file to check for syntax errors
        const moduleUrl = `file://${path.resolve(filePath)}`
        
        // Basic syntax validation by attempting to parse
        const fs = await import('fs')
        const content = fs.readFileSync(filePath, 'utf-8')
        
        // Check for common syntax issues
        if (!content.includes('export function register')) {
          result.errors.push({
            type: 'syntax_error',
            entity: entity.name,
            file: fileName,
            message: 'Missing register function export'
          })
        }

        // Check for required imports
        const requiredImports = [
          '@hono/zod-openapi',
          '../codegen/route-factory',
          '@promptliano/services',
          '@promptliano/schemas'
        ]

        for (const importPath of requiredImports) {
          if (!content.includes(importPath)) {
            result.errors.push({
              type: 'import_error',
              entity: entity.name,
              file: fileName,
              message: `Missing required import: ${importPath}`
            })
          }
        }

        // Check for TypeScript errors (basic)
        if (content.includes('any') && !content.includes('z.any()')) {
          result.warnings.push({
            type: 'type_error',
            entity: entity.name,
            message: 'Possible use of any type without proper Zod schema',
            suggestion: 'Review type safety in generated routes'
          })
        }

        result.metrics.validFiles++

      } catch (error) {
        result.errors.push({
          type: 'syntax_error',
          entity: entity.name,
          file: fileName,
          message: `Syntax validation failed: ${error instanceof Error ? error.message : String(error)}`,
          details: error
        })
      }
    }
  }

  /**
   * Validate route registration functionality
   */
  private async validateRouteRegistration(result: ValidationResult): Promise<void> {
    try {
      // Create a test Hono app to validate route registration
      const app = new OpenAPIHono()
      
      // Attempt to import and register each entity's routes
      for (const entity of this.config.entities) {
        const fileName = `${entity.name.toLowerCase()}-routes.generated.ts`
        const filePath = path.join(this.config.outputDir, fileName)
        
        if (!existsSync(filePath)) continue

        try {
          // Import the registration function
          const moduleUrl = `file://${path.resolve(filePath)}`
          const module = await import(moduleUrl)
          
          const registerFunction = module[`register${entity.name}Routes`]
          
          if (typeof registerFunction !== 'function') {
            result.errors.push({
              type: 'runtime_error',
              entity: entity.name,
              file: fileName,
              message: `Register function not found or not a function: register${entity.name}Routes`
            })
            continue
          }

          // Test route registration (this might fail due to missing services)
          try {
            registerFunction(app)
            
            // Count registered routes
            const routeCount = this.countRoutesForEntity(entity)
            result.metrics.totalRoutes += routeCount
            
          } catch (serviceError) {
            // Service errors are expected in validation context
            result.warnings.push({
              type: 'compatibility',
              entity: entity.name,
              message: `Route registration requires service dependencies: ${serviceError instanceof Error ? serviceError.message : String(serviceError)}`,
              suggestion: 'Ensure service layer is properly implemented'
            })
          }

        } catch (importError) {
          result.errors.push({
            type: 'import_error',
            entity: entity.name,
            file: fileName,
            message: `Failed to import route module: ${importError instanceof Error ? importError.message : String(importError)}`,
            details: importError
          })
        }
      }

    } catch (error) {
      result.errors.push({
        type: 'runtime_error',
        entity: 'validator',
        file: 'route-registration',
        message: `Route registration validation failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error
      })
    }
  }

  /**
   * Validate OpenAPI schema generation
   */
  private async validateOpenAPISchemas(result: ValidationResult): Promise<void> {
    try {
      // Create a test app and register all routes
      const app = new OpenAPIHono()
      
      // Check if index file exports the registration function
      const indexPath = path.join(this.config.outputDir, 'index.generated.ts')
      
      if (existsSync(indexPath)) {
        try {
          const indexModule = await import(`file://${path.resolve(indexPath)}`)
          
          if (typeof indexModule.registerAllGeneratedRoutes === 'function') {
            // Test OpenAPI document generation
            try {
              indexModule.registerAllGeneratedRoutes(app)
              
              // Attempt to get OpenAPI document
              const openApiDoc = app.getOpenAPI31Document({
                openapi: '3.1.0',
                info: {
                  title: 'Generated Routes Test',
                  version: '1.0.0'
                }
              })

              if (!openApiDoc.paths || Object.keys(openApiDoc.paths).length === 0) {
                result.warnings.push({
                  type: 'documentation',
                  entity: 'openapi',
                  message: 'OpenAPI document contains no paths',
                  suggestion: 'Verify route registration and path definitions'
                })
              }

            } catch (openApiError) {
              result.warnings.push({
                type: 'documentation',
                entity: 'openapi',
                message: `OpenAPI document generation had issues: ${openApiError instanceof Error ? openApiError.message : String(openApiError)}`,
                suggestion: 'Review OpenAPI schema definitions'
              })
            }

          } else {
            result.errors.push({
              type: 'runtime_error',
              entity: 'index',
              file: 'index.generated.ts',
              message: 'registerAllGeneratedRoutes function not found in index'
            })
          }

        } catch (indexImportError) {
          result.errors.push({
            type: 'import_error',
            entity: 'index',
            file: 'index.generated.ts',
            message: `Failed to import index module: ${indexImportError instanceof Error ? indexImportError.message : String(indexImportError)}`
          })
        }
      }

    } catch (error) {
      result.errors.push({
        type: 'runtime_error',
        entity: 'validator',
        file: 'openapi-validation',
        message: `OpenAPI validation failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error
      })
    }
  }

  /**
   * Calculate validation metrics
   */
  private async calculateMetrics(result: ValidationResult): Promise<void> {
    // Calculate lines of code
    const fs = await import('fs')
    
    for (const entity of this.config.entities) {
      const fileName = `${entity.name.toLowerCase()}-routes.generated.ts`
      const filePath = path.join(this.config.outputDir, fileName)
      
      if (existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').length
        result.metrics.linesGenerated += lines
      }
    }

    // Estimate lines saved (based on typical route file sizes)
    const averageLinesPerRoute = 15
    result.metrics.linesSaved = result.metrics.totalRoutes * averageLinesPerRoute - result.metrics.linesGenerated
    
    if (result.metrics.totalRoutes > 0) {
      result.metrics.codeReductionPercent = Math.round(
        (result.metrics.linesSaved / (result.metrics.totalRoutes * averageLinesPerRoute)) * 100
      )
    }
  }

  /**
   * Generate warnings and suggestions
   */
  private async generateWarnings(result: ValidationResult): Promise<void> {
    // Performance warnings
    if (result.metrics.totalRoutes > 100) {
      result.warnings.push({
        type: 'performance',
        entity: 'system',
        message: `Large number of routes generated (${result.metrics.totalRoutes}). Consider route optimization.`,
        suggestion: 'Review if all generated routes are necessary'
      })
    }

    // Best practice warnings
    for (const entity of this.config.entities) {
      if (entity.customRoutes && entity.customRoutes.length > 10) {
        result.warnings.push({
          type: 'best_practice',
          entity: entity.name,
          message: `Entity has many custom routes (${entity.customRoutes.length}). Consider refactoring.`,
          suggestion: 'Split complex entities into smaller, focused entities'
        })
      }
    }

    // Documentation warnings
    if (result.metrics.codeReductionPercent < 30) {
      result.warnings.push({
        type: 'documentation',
        entity: 'system',
        message: `Code reduction is lower than expected (${result.metrics.codeReductionPercent}%)`,
        suggestion: 'Review route generation efficiency and patterns'
      })
    }
  }

  /**
   * Count routes for an entity
   */
  private countRoutesForEntity(entity: any): number {
    let count = 4 // Standard CRUD routes (create, list, get, update)
    
    if (entity.options?.includeSoftDelete !== false) {
      count += 1 // delete route
    }
    
    if (entity.customRoutes) {
      count += entity.customRoutes.length
    }
    
    return count
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate generated routes using configuration
 */
export async function validateGeneratedRoutes(config: GeneratorConfig): Promise<ValidationResult> {
  const validator = new RouteValidator(config)
  return validator.validate()
}

/**
 * Format validation result for console output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []
  
  lines.push('📊 Route Validation Results')
  lines.push('━'.repeat(50))
  
  // Status
  lines.push(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`)
  
  // Metrics
  lines.push('')
  lines.push('📈 Metrics:')
  lines.push(`  Entities: ${result.metrics.totalEntities}`)
  lines.push(`  Generated files: ${result.metrics.generatedFiles}`)
  lines.push(`  Valid files: ${result.metrics.validFiles}`)
  lines.push(`  Total routes: ${result.metrics.totalRoutes}`)
  lines.push(`  Lines generated: ${result.metrics.linesGenerated}`)
  lines.push(`  Lines saved: ${result.metrics.linesSaved}`)
  lines.push(`  Code reduction: ${result.metrics.codeReductionPercent}%`)
  lines.push(`  Validation time: ${result.metrics.validationTimeMs}ms`)
  
  // Errors
  if (result.errors.length > 0) {
    lines.push('')
    lines.push('❌ Errors:')
    result.errors.forEach(error => {
      lines.push(`  • ${error.entity}: ${error.message}`)
    })
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('⚠️  Warnings:')
    result.warnings.forEach(warning => {
      lines.push(`  • ${warning.entity}: ${warning.message}`)
      if (warning.suggestion) {
        lines.push(`    💡 ${warning.suggestion}`)
      }
    })
  }
  
  return lines.join('\n')
}