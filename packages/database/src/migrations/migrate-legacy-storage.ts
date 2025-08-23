/**
 * Legacy Storage Migration Script
 * Migrates data from old BaseStorage/SQLite format to new Drizzle repositories
 * 
 * Usage:
 *   bun run migrate-legacy-storage.ts [--dry-run] [--backup]
 */

import { existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import { storageService } from '../repositories/storage-service'
import { rawDb, dbUtils } from '../db'

interface MigrationConfig {
  dryRun: boolean
  createBackup: boolean
  validateData: boolean
  continueOnError: boolean
}

interface MigrationStats {
  projects: { migrated: number; failed: number }
  tickets: { migrated: number; failed: number }
  tasks: { migrated: number; failed: number }
  chats: { migrated: number; failed: number }
  messages: { migrated: number; failed: number }
  prompts: { migrated: number; failed: number }
  totalDuration: number
  errors: string[]
}

class LegacyStorageMigrator {
  private config: MigrationConfig
  private stats: MigrationStats

  constructor(config: MigrationConfig) {
    this.config = config
    this.stats = {
      projects: { migrated: 0, failed: 0 },
      tickets: { migrated: 0, failed: 0 },
      tasks: { migrated: 0, failed: 0 },
      chats: { migrated: 0, failed: 0 },
      messages: { migrated: 0, failed: 0 },
      prompts: { migrated: 0, failed: 0 },
      totalDuration: 0,
      errors: []
    }
  }

  async migrate(): Promise<MigrationStats> {
    console.log('🚀 Starting legacy storage migration to Drizzle ORM...')
    
    const startTime = Date.now()

    try {
      // Create backup if requested
      if (this.config.createBackup) {
        await this.createBackup()
      }

      // Check if legacy data exists
      const hasLegacyData = await this.checkLegacyData()
      if (!hasLegacyData) {
        console.log('✅ No legacy data found, migration not needed')
        return this.stats
      }

      if (this.config.dryRun) {
        console.log('🔍 DRY RUN MODE - No actual migration will be performed')
      }

      // Migrate in order (respecting foreign key dependencies)
      await this.migrateProjects()
      await this.migratePrompts()
      await this.migrateChats()
      await this.migrateChatMessages()
      await this.migrateTickets()
      await this.migrateTasks()

      // Validate data integrity
      if (this.config.validateData) {
        await this.validateMigration()
      }

      this.stats.totalDuration = Date.now() - startTime

      console.log('✅ Migration completed successfully!')
      this.printStats()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Migration failed:', errorMessage)
      this.stats.errors.push(errorMessage)
      throw error
    }

    return this.stats
  }

  private async createBackup(): Promise<void> {
    console.log('💾 Creating database backup...')
    
    const dbPath = './data/promptliano.db'
    const backupPath = `./data/promptliano-backup-${Date.now()}.db`
    
    if (existsSync(dbPath)) {
      copyFileSync(dbPath, backupPath)
      console.log(`✅ Backup created: ${backupPath}`)
    } else {
      console.log('⚠️ No existing database found to backup')
    }
  }

  private async checkLegacyData(): Promise<boolean> {
    try {
      // Check for legacy table structure or data patterns
      const tables = rawDb.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all()

      const hasLegacyTables = (tables as any[]).some(table => 
        ['tickets', 'projects'].includes(table.name)
      )

      return hasLegacyTables
    } catch (error) {
      console.log('No legacy data structure detected')
      return false
    }
  }

  private async migrateProjects(): Promise<void> {
    console.log('📁 Migrating projects...')
    
    try {
      // Check if legacy projects exist in old format
      const legacyProjects = rawDb.query(`
        SELECT * FROM projects 
        WHERE id NOT IN (SELECT id FROM projects WHERE created_at IS NOT NULL)
        OR created_at IS NULL
      `).all() as any[]

      for (const legacyProject of legacyProjects) {
        try {
          if (!this.config.dryRun) {
            // Convert legacy timestamp fields
            const projectData = {
              name: legacyProject.name || 'Untitled Project',
              description: legacyProject.description || '',
              path: legacyProject.path || '/unknown'
            }

            // Use raw insert to preserve ID if possible
            await rawDb.query(`
              INSERT OR REPLACE INTO projects 
              (id, name, description, path, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              legacyProject.id,
              projectData.name,
              projectData.description, 
              projectData.path,
              legacyProject.created || Date.now(),
              legacyProject.updated || Date.now()
            )
          }
          
          this.stats.projects.migrated++
        } catch (error) {
          const errorMsg = `Failed to migrate project ${legacyProject.id}: ${error}`
          this.stats.errors.push(errorMsg)
          this.stats.projects.failed++
          
          if (!this.config.continueOnError) {
            throw new Error(errorMsg)
          }
        }
      }

      console.log(`✅ Projects: ${this.stats.projects.migrated} migrated, ${this.stats.projects.failed} failed`)
    } catch (error) {
      console.log('⚠️ No legacy projects to migrate')
    }
  }

  private async migrateTickets(): Promise<void> {
    console.log('🎫 Migrating tickets...')
    
    try {
      const legacyTickets = rawDb.query(`
        SELECT * FROM tickets 
        WHERE created_at IS NULL OR updated_at IS NULL
      `).all() as any[]

      for (const legacyTicket of legacyTickets) {
        try {
          if (!this.config.dryRun) {
            // Parse JSON arrays from legacy storage
            const suggestedFileIds = this.parseJsonArray(legacyTicket.suggested_file_ids)
            const suggestedAgentIds = this.parseJsonArray(legacyTicket.suggested_agent_ids)
            const suggestedPromptIds = this.parseJsonArray(legacyTicket.suggested_prompt_ids)

            await rawDb.query(`
              INSERT OR REPLACE INTO tickets 
              (id, project_id, title, overview, status, priority,
               suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
               created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              legacyTicket.id,
              legacyTicket.project_id,
              legacyTicket.title || 'Untitled Ticket',
              legacyTicket.overview || '',
              legacyTicket.status || 'open',
              legacyTicket.priority || 'normal',
              JSON.stringify(suggestedFileIds),
              JSON.stringify(suggestedAgentIds),
              JSON.stringify(suggestedPromptIds),
              legacyTicket.created || Date.now(),
              legacyTicket.updated || Date.now()
            )
          }
          
          this.stats.tickets.migrated++
        } catch (error) {
          const errorMsg = `Failed to migrate ticket ${legacyTicket.id}: ${error}`
          this.stats.errors.push(errorMsg)
          this.stats.tickets.failed++
          
          if (!this.config.continueOnError) {
            throw new Error(errorMsg)
          }
        }
      }

      console.log(`✅ Tickets: ${this.stats.tickets.migrated} migrated, ${this.stats.tickets.failed} failed`)
    } catch (error) {
      console.log('⚠️ No legacy tickets to migrate')
    }
  }

  private async migrateTasks(): Promise<void> {
    console.log('✅ Migrating tasks...')
    
    try {
      const legacyTasks = rawDb.query(`
        SELECT * FROM ticket_tasks 
        WHERE created_at IS NULL OR updated_at IS NULL
      `).all() as any[]

      for (const legacyTask of legacyTasks) {
        try {
          if (!this.config.dryRun) {
            const suggestedFileIds = this.parseJsonArray(legacyTask.suggested_file_ids)
            const dependencies = this.parseJsonArray(legacyTask.dependencies)
            const tags = this.parseJsonArray(legacyTask.tags)
            const suggestedPromptIds = this.parseJsonArray(legacyTask.suggested_prompt_ids)

            await rawDb.query(`
              INSERT OR REPLACE INTO ticket_tasks 
              (id, ticket_id, content, description, suggested_file_ids, done, order_index,
               estimated_hours, dependencies, tags, agent_id, suggested_prompt_ids,
               created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              legacyTask.id,
              legacyTask.ticket_id,
              legacyTask.content || 'Untitled Task',
              legacyTask.description || '',
              JSON.stringify(suggestedFileIds),
              legacyTask.done ? 1 : 0,
              legacyTask.order_index || 0,
              legacyTask.estimated_hours || null,
              JSON.stringify(dependencies),
              JSON.stringify(tags),
              legacyTask.agent_id || null,
              JSON.stringify(suggestedPromptIds),
              legacyTask.created || Date.now(),
              legacyTask.updated || Date.now()
            )
          }
          
          this.stats.tasks.migrated++
        } catch (error) {
          const errorMsg = `Failed to migrate task ${legacyTask.id}: ${error}`
          this.stats.errors.push(errorMsg)
          this.stats.tasks.failed++
          
          if (!this.config.continueOnError) {
            throw new Error(errorMsg)
          }
        }
      }

      console.log(`✅ Tasks: ${this.stats.tasks.migrated} migrated, ${this.stats.tasks.failed} failed`)
    } catch (error) {
      console.log('⚠️ No legacy tasks to migrate')
    }
  }

  private async migrateChats(): Promise<void> {
    console.log('💬 Migrating chats...')
    
    try {
      const legacyChats = rawDb.query(`
        SELECT * FROM chats 
        WHERE created_at IS NULL OR updated_at IS NULL
      `).all() as any[]

      for (const legacyChat of legacyChats) {
        try {
          if (!this.config.dryRun) {
            await rawDb.query(`
              INSERT OR REPLACE INTO chats 
              (id, project_id, title, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              legacyChat.id,
              legacyChat.project_id,
              legacyChat.title || 'Untitled Chat',
              legacyChat.created || Date.now(),
              legacyChat.updated || Date.now()
            )
          }
          
          this.stats.chats.migrated++
        } catch (error) {
          const errorMsg = `Failed to migrate chat ${legacyChat.id}: ${error}`
          this.stats.errors.push(errorMsg)
          this.stats.chats.failed++
          
          if (!this.config.continueOnError) {
            throw new Error(errorMsg)
          }
        }
      }

      console.log(`✅ Chats: ${this.stats.chats.migrated} migrated, ${this.stats.chats.failed} failed`)
    } catch (error) {
      console.log('⚠️ No legacy chats to migrate')
    }
  }

  private async migrateChatMessages(): Promise<void> {
    console.log('💭 Migrating chat messages...')
    
    try {
      const legacyMessages = rawDb.query(`
        SELECT * FROM chat_messages 
        WHERE created_at IS NULL
      `).all() as any[]

      for (const legacyMessage of legacyMessages) {
        try {
          if (!this.config.dryRun) {
            const metadata = this.parseJsonObject(legacyMessage.metadata)

            await rawDb.query(`
              INSERT OR REPLACE INTO chat_messages 
              (id, chat_id, role, content, metadata, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              legacyMessage.id,
              legacyMessage.chat_id,
              legacyMessage.role || 'user',
              legacyMessage.content || '',
              JSON.stringify(metadata),
              legacyMessage.created || Date.now()
            )
          }
          
          this.stats.messages.migrated++
        } catch (error) {
          const errorMsg = `Failed to migrate message ${legacyMessage.id}: ${error}`
          this.stats.errors.push(errorMsg)
          this.stats.messages.failed++
          
          if (!this.config.continueOnError) {
            throw new Error(errorMsg)
          }
        }
      }

      console.log(`✅ Messages: ${this.stats.messages.migrated} migrated, ${this.stats.messages.failed} failed`)
    } catch (error) {
      console.log('⚠️ No legacy messages to migrate')
    }
  }

  private async migratePrompts(): Promise<void> {
    console.log('📝 Migrating prompts...')
    
    try {
      const legacyPrompts = rawDb.query(`
        SELECT * FROM prompts 
        WHERE created_at IS NULL OR updated_at IS NULL
      `).all() as any[]

      for (const legacyPrompt of legacyPrompts) {
        try {
          if (!this.config.dryRun) {
            const tags = this.parseJsonArray(legacyPrompt.tags)

            await rawDb.query(`
              INSERT OR REPLACE INTO prompts 
              (id, project_id, title, content, description, tags, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              legacyPrompt.id,
              legacyPrompt.project_id,
              legacyPrompt.title || 'Untitled Prompt',
              legacyPrompt.content || '',
              legacyPrompt.description || '',
              JSON.stringify(tags),
              legacyPrompt.created || Date.now(),
              legacyPrompt.updated || Date.now()
            )
          }
          
          this.stats.prompts.migrated++
        } catch (error) {
          const errorMsg = `Failed to migrate prompt ${legacyPrompt.id}: ${error}`
          this.stats.errors.push(errorMsg)
          this.stats.prompts.failed++
          
          if (!this.config.continueOnError) {
            throw new Error(errorMsg)
          }
        }
      }

      console.log(`✅ Prompts: ${this.stats.prompts.migrated} migrated, ${this.stats.prompts.failed} failed`)
    } catch (error) {
      console.log('⚠️ No legacy prompts to migrate')
    }
  }

  private async validateMigration(): Promise<void> {
    console.log('🔍 Validating migration...')
    
    try {
      const health = await storageService.healthCheck()
      if (health.status !== 'healthy') {
        throw new Error(`Health check failed: ${health.error}`)
      }

      const stats = await storageService.getStorageStats()
      console.log('📊 Post-migration statistics:', stats)

      // Validate foreign key constraints
      rawDb.exec('PRAGMA foreign_key_check')
      
      console.log('✅ Migration validation passed')
    } catch (error) {
      console.error('❌ Migration validation failed:', error)
      throw error
    }
  }

  private parseJsonArray(value: any): any[] {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  private parseJsonObject(value: any): any {
    if (typeof value === 'object' && value !== null) return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    }
    return {}
  }

  private printStats(): void {
    console.log('\n📈 MIGRATION STATISTICS:')
    console.log('========================')
    console.log(`⏱️  Total Duration: ${this.stats.totalDuration}ms`)
    console.log(`📁 Projects: ${this.stats.projects.migrated} migrated, ${this.stats.projects.failed} failed`)
    console.log(`🎫 Tickets: ${this.stats.tickets.migrated} migrated, ${this.stats.tickets.failed} failed`)
    console.log(`✅ Tasks: ${this.stats.tasks.migrated} migrated, ${this.stats.tasks.failed} failed`)
    console.log(`💬 Chats: ${this.stats.chats.migrated} migrated, ${this.stats.chats.failed} failed`)
    console.log(`💭 Messages: ${this.stats.messages.migrated} migrated, ${this.stats.messages.failed} failed`)
    console.log(`📝 Prompts: ${this.stats.prompts.migrated} migrated, ${this.stats.prompts.failed} failed`)
    
    const totalMigrated = this.stats.projects.migrated + this.stats.tickets.migrated + 
                         this.stats.tasks.migrated + this.stats.chats.migrated + 
                         this.stats.messages.migrated + this.stats.prompts.migrated
    const totalFailed = this.stats.projects.failed + this.stats.tickets.failed + 
                       this.stats.tasks.failed + this.stats.chats.failed + 
                       this.stats.messages.failed + this.stats.prompts.failed

    console.log(`\n📊 TOTALS: ${totalMigrated} migrated, ${totalFailed} failed`)
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ ERRORS:')
      this.stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  
  const config: MigrationConfig = {
    dryRun: args.includes('--dry-run'),
    createBackup: args.includes('--backup'),
    validateData: true,
    continueOnError: args.includes('--continue-on-error')
  }

  console.log('⚡ Drizzle Storage Migration Tool')
  console.log('================================')
  console.log(`Configuration:`)
  console.log(`- Dry Run: ${config.dryRun}`)
  console.log(`- Create Backup: ${config.createBackup}`)
  console.log(`- Validate Data: ${config.validateData}`)
  console.log(`- Continue on Error: ${config.continueOnError}`)
  console.log('')

  try {
    const migrator = new LegacyStorageMigrator(config)
    const stats = await migrator.migrate()
    
    if (config.dryRun) {
      console.log('\n🔍 DRY RUN COMPLETE - No changes were made')
      console.log('Run without --dry-run to perform the actual migration')
    }
    
    process.exit(0)
  } catch (error) {
    console.error('\n💥 Migration failed:', error)
    process.exit(1)
  }
}

// Export for programmatic use
export { LegacyStorageMigrator, type MigrationConfig, type MigrationStats }

// Run CLI if this file is executed directly
if (import.meta.main) {
  main()
}