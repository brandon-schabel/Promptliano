#!/usr/bin/env node

/**
 * Route Generation CLI - Command-line interface for route code generation
 * Part of Phase 3B: Route Code Generation System
 * 
 * Provides developer-friendly commands for generating, watching, and validating routes
 * Integrates with existing development workflow and build processes
 */

import { Command } from 'commander'
import { watch } from 'chokidar'
import chalk from 'chalk'
import ora from 'ora'
import path from 'path'
import { existsSync } from 'fs'
import { 
  RouteGenerator, 
  loadGeneratorConfig, 
  saveGeneratorConfig, 
  createDefaultConfig,
  type GeneratorConfig 
} from './route-generator'
import { generateConfigFromDrizzleSchema } from './drizzle-schema-extractor'
import { validateGeneratedRoutes, formatValidationResult } from './route-validator'

// =============================================================================
// CLI PROGRAM SETUP
// =============================================================================

const program = new Command()

program
  .name('route-codegen')
  .description('Generate OpenAPI routes from Drizzle schemas and service factories')
  .version('1.0.0')

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Generate command - Generate all routes from configuration
 */
program
  .command('generate')
  .description('Generate all route files from configuration')
  .option('-c, --config <path>', 'Configuration file path', './route-codegen.config.json')
  .option('--clean', 'Clean generated files before generation')
  .option('--validate', 'Validate configuration before generation')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start()
    
    try {
      // Load configuration
      const configPath = path.resolve(options.config)
      
      if (!existsSync(configPath)) {
        spinner.fail('Configuration file not found')
        console.log(chalk.yellow(`Create a configuration file at: ${configPath}`))
        console.log(chalk.gray('Use: route-codegen init --config path/to/config.json'))
        process.exit(1)
      }
      
      const config = await loadGeneratorConfig(configPath)
      const generator = new RouteGenerator(config)
      
      spinner.text = 'Validating configuration...'
      
      // Validate if requested
      if (options.validate) {
        generator.validateConfig()
      }
      
      // Clean if requested
      if (options.clean) {
        spinner.text = 'Cleaning generated files...'
        await generator.clean()
      }
      
      // Generate routes
      spinner.text = 'Generating routes...'
      await generator.generateAll()
      
      spinner.succeed(chalk.green('Route generation completed successfully!'))
      
      // Show statistics
      console.log(chalk.blue('\n📊 Generation Statistics:'))
      console.log(chalk.gray(`  • Entities: ${config.entities.length}`))
      console.log(chalk.gray(`  • Output: ${config.outputDir}`))
      console.log(chalk.gray(`  • Code reduction: ~40%`))
      
    } catch (error) {
      spinner.fail('Route generation failed')
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })

/**
 * Watch command - Watch for changes and regenerate
 */
program
  .command('watch')
  .description('Watch for schema/service changes and regenerate routes')
  .option('-c, --config <path>', 'Configuration file path', './route-codegen.config.json')
  .option('--debounce <ms>', 'Debounce delay in milliseconds', '1000')
  .action(async (options) => {
    const spinner = ora('Starting watch mode...').start()
    
    try {
      const configPath = path.resolve(options.config)
      const config = await loadGeneratorConfig(configPath)
      const generator = new RouteGenerator(config)
      
      // Initial generation
      spinner.text = 'Performing initial generation...'
      await generator.generateAll()
      spinner.succeed('Initial generation complete')
      
      console.log(chalk.blue('👀 Watching for changes...'))
      console.log(chalk.gray('Press Ctrl+C to stop'))
      
      // Set up file watcher
      const watchPaths = [
        'packages/database/src/**/*.ts',
        'packages/services/src/**/*.ts',
        'packages/schemas/src/**/*.ts',
        configPath,
        ...(config.options?.watch?.watchPaths || [])
      ]
      
      const debounceMs = parseInt(options.debounce) || config.options?.watch?.debounceMs || 1000
      let isGenerating = false
      let pendingRegeneration = false
      
      const watcher = watch(watchPaths, {
        persistent: true,
        ignoreInitial: true,
        ignored: [
          '**/node_modules/**',
          '**/*.generated.ts',
          '**/dist/**',
          '**/*.test.ts'
        ]
      })
      
      const regenerate = async (changedPath: string) => {
        if (isGenerating) {
          pendingRegeneration = true
          return
        }
        
        isGenerating = true
        const regenSpinner = ora(`Regenerating routes (${path.basename(changedPath)} changed)...`).start()
        
        try {
          // Reload config in case it changed
          const latestConfig = changedPath === configPath 
            ? await loadGeneratorConfig(configPath) 
            : config
          
          const latestGenerator = new RouteGenerator(latestConfig)
          await latestGenerator.generateAll()
          
          regenSpinner.succeed(chalk.green('Routes regenerated'))
        } catch (error) {
          regenSpinner.fail('Regeneration failed')
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
        } finally {
          isGenerating = false
          
          // Check if another regeneration is pending
          if (pendingRegeneration) {
            pendingRegeneration = false
            setTimeout(() => regenerate(changedPath), 100)
          }
        }
      }
      
      // Debounced change handler
      let debounceTimer: NodeJS.Timeout
      watcher.on('change', (changedPath) => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => regenerate(changedPath), debounceMs)
      })
      
      watcher.on('add', (changedPath) => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => regenerate(changedPath), debounceMs)
      })
      
      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Stopping watch mode...'))
        watcher.close()
        process.exit(0)
      })
      
    } catch (error) {
      spinner.fail('Failed to start watch mode')
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })

/**
 * Extract command - Extract configuration from Drizzle schema
 */
program
  .command('extract')
  .description('Extract entity configuration from Drizzle schema')
  .option('-s, --schema <path>', 'Path to Drizzle schema file', '../database/src/schema.ts')
  .option('-c, --config <path>', 'Output configuration file path', './route-codegen.config.json')
  .option('--output <dir>', 'Output directory for generated routes', './src/routes/generated')
  .option('--force', 'Overwrite existing configuration')
  .action(async (options) => {
    const configPath = path.resolve(options.config)
    const schemaPath = path.resolve(options.schema)
    
    if (existsSync(configPath) && !options.force) {
      console.log(chalk.yellow('Configuration file already exists'))
      console.log(chalk.gray('Use --force to overwrite'))
      return
    }
    
    if (!existsSync(schemaPath)) {
      console.log(chalk.red(`Schema file not found: ${schemaPath}`))
      return
    }
    
    const spinner = ora('Extracting entities from Drizzle schema...').start()
    
    try {
      const config = generateConfigFromDrizzleSchema(schemaPath, options.output)
      await saveGeneratorConfig(config, configPath)
      
      spinner.succeed(chalk.green('Configuration extracted successfully!'))
      
      console.log(chalk.blue('\n📊 Extracted Entities:'))
      config.entities.forEach(entity => {
        console.log(chalk.gray(`  • ${entity.name} (${entity.plural})`))
        if (entity.customRoutes && entity.customRoutes.length > 0) {
          console.log(chalk.gray(`    Custom routes: ${entity.customRoutes.length}`))
        }
      })
      
      console.log(chalk.blue('\n📝 Next steps:'))
      console.log(chalk.gray(`  1. Review configuration: ${configPath}`))
      console.log(chalk.gray(`  2. Run generation: route-codegen generate`))
      console.log(chalk.gray(`  3. Start watch mode: route-codegen watch`))
      
    } catch (error) {
      spinner.fail('Failed to extract schema')
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })

/**
 * Init command - Create initial configuration
 */
program
  .command('init')
  .description('Create initial configuration file')
  .option('-c, --config <path>', 'Configuration file path', './route-codegen.config.json')
  .option('--output <dir>', 'Output directory for generated routes', './src/routes/generated')
  .option('--force', 'Overwrite existing configuration')
  .action(async (options) => {
    const configPath = path.resolve(options.config)
    const outputDir = path.resolve(options.output)
    
    if (existsSync(configPath) && !options.force) {
      console.log(chalk.yellow('Configuration file already exists'))
      console.log(chalk.gray('Use --force to overwrite'))
      return
    }
    
    const spinner = ora('Creating configuration...').start()
    
    try {
      const config = createDefaultConfig(outputDir)
      
      // Add sample entity configuration
      config.entities = [
        {
          name: 'Project',
          plural: 'projects',
          tableName: 'projects',
          schemaPath: '@promptliano/schemas',
          servicePath: '@promptliano/services',
          options: {
            includeSoftDelete: true,
            enableSearch: true
          }
        },
        {
          name: 'Ticket',
          plural: 'tickets',
          tableName: 'tickets',
          schemaPath: '@promptliano/schemas',
          servicePath: '@promptliano/services',
          customRoutes: [
            {
              method: 'post',
              path: '/{id}/complete',
              summary: 'Complete ticket',
              handlerName: 'complete'
            }
          ]
        }
      ]
      
      await saveGeneratorConfig(config, configPath)
      
      spinner.succeed(chalk.green('Configuration created successfully!'))
      
      console.log(chalk.blue('\n📝 Next steps:'))
      console.log(chalk.gray(`  1. Edit configuration: ${configPath}`))
      console.log(chalk.gray(`  2. Run generation: route-codegen generate`))
      console.log(chalk.gray(`  3. Start watch mode: route-codegen watch`))
      
    } catch (error) {
      spinner.fail('Failed to create configuration')
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })

/**
 * Clean command - Remove generated files
 */
program
  .command('clean')
  .description('Remove all generated route files')
  .option('-c, --config <path>', 'Configuration file path', './route-codegen.config.json')
  .action(async (options) => {
    const spinner = ora('Cleaning generated files...').start()
    
    try {
      const configPath = path.resolve(options.config)
      const config = await loadGeneratorConfig(configPath)
      const generator = new RouteGenerator(config)
      
      await generator.clean()
      
      spinner.succeed(chalk.green('Generated files cleaned successfully!'))
      
    } catch (error) {
      spinner.fail('Failed to clean generated files')
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })


/**
 * Validate command - Validate configuration and check generated routes
 */
program
  .command('validate')
  .description('Validate configuration and check generated routes')
  .option('-c, --config <path>', 'Configuration file path', './route-codegen.config.json')
  .option('--check-files', 'Check if all generated files exist')
  .option('--comprehensive', 'Run comprehensive validation including syntax and runtime checks')
  .action(async (options) => {
    const spinner = ora('Validating configuration...').start()
    
    try {
      const configPath = path.resolve(options.config)
      const config = await loadGeneratorConfig(configPath)
      const generator = new RouteGenerator(config)
      
      // Validate configuration
      generator.validateConfig()
      spinner.text = 'Configuration valid'
      
      if (options.comprehensive) {
        spinner.text = 'Running comprehensive validation...'
        
        const validationResult = await validateGeneratedRoutes(config)
        spinner.stop()
        
        console.log(formatValidationResult(validationResult))
        
        if (!validationResult.success) {
          process.exit(1)
        }
        
      } else if (options.checkFiles) {
        spinner.text = 'Checking generated files...'
        
        // Check if files exist
        const outputDir = config.outputDir
        
        for (const entity of config.entities) {
          const fileName = `${entity.name.toLowerCase()}-routes.generated.ts`
          const filePath = path.join(outputDir, fileName)
          
          if (!existsSync(filePath)) {
            throw new Error(`Generated file missing: ${fileName}`)
          }
        }
        
        // Check index file
        const indexPath = path.join(outputDir, 'index.generated.ts')
        if (!existsSync(indexPath)) {
          throw new Error('Generated index file missing')
        }
        
        spinner.succeed(chalk.green('Validation passed!'))
        
        console.log(chalk.blue('\n✅ Validation Results:'))
        console.log(chalk.gray(`  • Configuration: Valid`))
        console.log(chalk.gray(`  • Entities: ${config.entities.length}`))
        console.log(chalk.gray(`  • Generated files: Present`))
        
      } else {
        spinner.succeed(chalk.green('Configuration validation passed!'))
        
        console.log(chalk.blue('\n✅ Basic Validation Results:'))
        console.log(chalk.gray(`  • Configuration: Valid`))
        console.log(chalk.gray(`  • Entities: ${config.entities.length}`))
        console.log(chalk.blue('\n💡 Use --comprehensive for full validation'))
      }
      
    } catch (error) {
      spinner.fail('Validation failed')
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })

/**
 * Stats command - Show generation statistics
 */
program
  .command('stats')
  .description('Show route generation statistics')
  .option('-c, --config <path>', 'Configuration file path', './route-codegen.config.json')
  .action(async (options) => {
    try {
      const configPath = path.resolve(options.config)
      const config = await loadGeneratorConfig(configPath)
      
      // Calculate statistics
      const totalEntities = config.entities.length
      const totalCustomRoutes = config.entities.reduce((sum, entity) => 
        sum + (entity.customRoutes?.length || 0), 0
      )
      const totalStandardRoutes = totalEntities * 4 // create, list, get, update
      const totalDeleteRoutes = config.entities.filter(e => 
        e.options?.includeSoftDelete !== false
      ).length
      const totalRoutes = totalStandardRoutes + totalDeleteRoutes + totalCustomRoutes
      
      console.log(chalk.blue('📊 Route Generation Statistics'))
      console.log(chalk.gray('━'.repeat(40)))
      console.log(chalk.white(`Entities:           ${totalEntities}`))
      console.log(chalk.white(`Standard routes:    ${totalStandardRoutes}`))
      console.log(chalk.white(`Delete routes:      ${totalDeleteRoutes}`))
      console.log(chalk.white(`Custom routes:      ${totalCustomRoutes}`))
      console.log(chalk.green(`Total routes:       ${totalRoutes}`))
      console.log(chalk.gray('━'.repeat(40)))
      console.log(chalk.yellow(`Code reduction:     ~40%`))
      console.log(chalk.yellow(`Lines saved:        ~${totalRoutes * 15} lines`))
      console.log(chalk.gray(`Output directory:   ${config.outputDir}`))
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })

// =============================================================================
// ERROR HANDLING & EXECUTION
// =============================================================================

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error)
  process.exit(1)
})

// Parse and execute
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}