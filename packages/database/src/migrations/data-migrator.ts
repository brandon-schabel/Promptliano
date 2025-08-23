/**
 * Data Migration Utilities
 * Converts legacy storage format to new Drizzle schema
 */

import { db, rawDb } from '../db'
import * as schema from '../schema'
import type { LegacyTicket, LegacyTicketTask } from '../schema'

/**
 * Migration status tracking
 */
interface MigrationStatus {
  step: string
  startTime: number
  endTime?: number
  recordsProcessed: number
  errors: string[]
}

/**
 * Main data migration orchestrator
 */
export class DataMigrator {
  private status: MigrationStatus[] = []

  /**
   * Migrate all data from legacy format to Drizzle schema
   */
  async migrateAllData(): Promise<void> {
    console.log('🚀 Starting data migration from legacy storage to Drizzle...')
    
    try {
      await this.migrateProjects()
      await this.migrateTickets()
      await this.migrateTicketTasks()
      await this.migrateChats()
      await this.migrateChatMessages()
      await this.migratePrompts()
      await this.migrateProviderKeys()
      
      console.log('✅ Data migration completed successfully')
      this.printMigrationSummary()
      
    } catch (error) {
      console.error('❌ Data migration failed:', error)
      throw error
    }
  }

  /**
   * Migrate projects table
   */
  private async migrateProjects(): Promise<void> {
    const step = this.startStep('projects')
    
    try {
      // Read from legacy projects table
      const legacyProjects = rawDb.query(`
        SELECT id, name, description, path, created, updated
        FROM projects
      `).all() as any[]

      for (const legacy of legacyProjects) {
        await db.insert(schema.projects).values({
          id: legacy.id,
          name: legacy.name,
          description: legacy.description,
          path: legacy.path,
          createdAt: legacy.created, // Convert legacy timestamp
          updatedAt: legacy.updated
        }).onConflictDoNothing() // Skip if already exists
        
        step.recordsProcessed++
      }
      
      this.endStep(step)
      console.log(`✅ Migrated ${step.recordsProcessed} projects`)
      
    } catch (error) {
      step.errors.push(String(error))
      this.endStep(step)
      throw error
    }
  }

  /**
   * Migrate tickets table with enhanced queue fields
   */
  private async migrateTickets(): Promise<void> {
    const step = this.startStep('tickets')
    
    try {
      // Read from legacy tickets table
      const legacyTickets = rawDb.query(`
        SELECT 
          id, project_id, title, overview, status, priority,
          suggested_file_ids, suggested_agent_ids, suggested_prompt_ids,
          created_at, updated_at
        FROM tickets
      `).all() as any[]

      for (const legacy of legacyTickets) {
        // Parse JSON fields safely
        const suggestedFileIds = this.parseJsonArray(legacy.suggested_file_ids, [])
        const suggestedAgentIds = this.parseJsonArray(legacy.suggested_agent_ids, [])
        const suggestedPromptIds = this.parseJsonArray(legacy.suggested_prompt_ids, [])

        await db.insert(schema.tickets).values({
          id: legacy.id,
          projectId: legacy.project_id,
          title: legacy.title,
          overview: legacy.overview || '',
          status: legacy.status || 'open',
          priority: legacy.priority || 'normal',
          suggestedFileIds,
          suggestedAgentIds,
          suggestedPromptIds,
          // Queue fields start as null - will be populated by queue migration
          queueId: null,
          queuePosition: null,
          queueStatus: null,
          queuePriority: null,
          queuedAt: null,
          queueStartedAt: null,
          queueCompletedAt: null,
          queueAgentId: null,
          queueErrorMessage: null,
          estimatedProcessingTime: null,
          actualProcessingTime: null,
          createdAt: legacy.created_at,
          updatedAt: legacy.updated_at
        }).onConflictDoNothing()
        
        step.recordsProcessed++
      }
      
      this.endStep(step)
      console.log(`✅ Migrated ${step.recordsProcessed} tickets`)
      
    } catch (error) {
      step.errors.push(String(error))
      this.endStep(step)
      throw error
    }
  }

  /**
   * Migrate ticket tasks with enhanced fields
   */
  private async migrateTicketTasks(): Promise<void> {
    const step = this.startStep('ticket_tasks')
    
    try {
      const legacyTasks = rawDb.query(`
        SELECT 
          id, ticket_id, content, description, suggested_file_ids,
          done, order_index, estimated_hours, dependencies, tags,
          agent_id, suggested_prompt_ids, created_at, updated_at
        FROM ticket_tasks
      `).all() as any[]

      for (const legacy of legacyTasks) {
        const suggestedFileIds = this.parseJsonArray(legacy.suggested_file_ids, [])
        const dependencies = this.parseJsonArray(legacy.dependencies, [])
        const tags = this.parseJsonArray(legacy.tags, [])
        const suggestedPromptIds = this.parseJsonArray(legacy.suggested_prompt_ids, [])

        await db.insert(schema.ticketTasks).values({
          id: legacy.id,
          ticketId: legacy.ticket_id,
          content: legacy.content,
          description: legacy.description || '',
          suggestedFileIds,
          done: Boolean(legacy.done),
          orderIndex: legacy.order_index || 0,
          estimatedHours: legacy.estimated_hours,
          dependencies,
          tags,
          agentId: legacy.agent_id,
          suggestedPromptIds,
          // Queue fields start as null
          queueId: null,
          queuePosition: null,
          queueStatus: null,
          queuePriority: null,
          queuedAt: null,
          queueStartedAt: null,
          queueCompletedAt: null,
          queueAgentId: null,
          queueErrorMessage: null,
          estimatedProcessingTime: null,
          actualProcessingTime: null,
          createdAt: legacy.created_at,
          updatedAt: legacy.updated_at
        }).onConflictDoNothing()
        
        step.recordsProcessed++
      }
      
      this.endStep(step)
      console.log(`✅ Migrated ${step.recordsProcessed} ticket tasks`)
      
    } catch (error) {
      step.errors.push(String(error))
      this.endStep(step)
      throw error
    }
  }

  /**
   * Migrate chats table
   */
  private async migrateChats(): Promise<void> {
    const step = this.startStep('chats')
    
    try {
      const legacyChats = rawDb.query(`
        SELECT id, project_id, title, created_at, updated_at
        FROM chats
      `).all() as any[]

      for (const legacy of legacyChats) {
        await db.insert(schema.chats).values({
          id: legacy.id,
          projectId: legacy.project_id,
          title: legacy.title,
          createdAt: legacy.created_at,
          updatedAt: legacy.updated_at
        }).onConflictDoNothing()
        
        step.recordsProcessed++
      }
      
      this.endStep(step)
      console.log(`✅ Migrated ${step.recordsProcessed} chats`)
      
    } catch (error) {
      step.errors.push(String(error))
      this.endStep(step)
      throw error
    }
  }

  /**
   * Migrate chat messages table
   */
  private async migrateChatMessages(): Promise<void> {
    const step = this.startStep('chat_messages')
    
    try {
      const legacyMessages = rawDb.query(`
        SELECT id, chat_id, role, content, metadata, created_at
        FROM chat_messages
      `).all() as any[]

      for (const legacy of legacyMessages) {
        const metadata = this.parseJsonObject(legacy.metadata, {})

        await db.insert(schema.chatMessages).values({
          id: legacy.id,
          chatId: legacy.chat_id,
          role: legacy.role,
          content: legacy.content,
          metadata,
          createdAt: legacy.created_at
        }).onConflictDoNothing()
        
        step.recordsProcessed++
      }
      
      this.endStep(step)
      console.log(`✅ Migrated ${step.recordsProcessed} chat messages`)
      
    } catch (error) {
      step.errors.push(String(error))
      this.endStep(step)
      throw error
    }
  }

  /**
   * Migrate prompts table
   */
  private async migratePrompts(): Promise<void> {
    const step = this.startStep('prompts')
    
    try {
      const legacyPrompts = rawDb.query(`
        SELECT id, project_id, title, content, description, tags, created_at, updated_at
        FROM prompts
      `).all() as any[]

      for (const legacy of legacyPrompts) {
        const tags = this.parseJsonArray(legacy.tags, [])

        await db.insert(schema.prompts).values({
          id: legacy.id,
          projectId: legacy.project_id,
          title: legacy.title,
          content: legacy.content,
          description: legacy.description || '',
          tags,
          createdAt: legacy.created_at,
          updatedAt: legacy.updated_at
        }).onConflictDoNothing()
        
        step.recordsProcessed++
      }
      
      this.endStep(step)
      console.log(`✅ Migrated ${step.recordsProcessed} prompts`)
      
    } catch (error) {
      step.errors.push(String(error))
      this.endStep(step)
      throw error
    }
  }

  /**
   * Migrate provider keys with encryption preservation
   */
  private async migrateProviderKeys(): Promise<void> {
    const step = this.startStep('provider_keys')
    
    try {
      const legacyKeys = rawDb.query(`
        SELECT id, provider, key_name, encrypted_value, is_active, created_at, updated_at
        FROM provider_keys
      `).all() as any[]

      for (const legacy of legacyKeys) {
        await db.insert(schema.providerKeys).values({
          id: legacy.id,
          provider: legacy.provider,
          keyName: legacy.key_name,
          encryptedValue: legacy.encrypted_value,
          isActive: Boolean(legacy.is_active),
          createdAt: legacy.created_at,
          updatedAt: legacy.updated_at
        }).onConflictDoNothing()
        
        step.recordsProcessed++
      }
      
      this.endStep(step)
      console.log(`✅ Migrated ${step.recordsProcessed} provider keys`)
      
    } catch (error) {
      step.errors.push(String(error))
      this.endStep(step)
      throw error
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Safely parse JSON array with fallback
   */
  private parseJsonArray(value: any, fallback: any[] = []): any[] {
    if (!value) return fallback
    
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      console.warn(`Failed to parse JSON array: ${value}`)
      return fallback
    }
  }

  /**
   * Safely parse JSON object with fallback
   */
  private parseJsonObject(value: any, fallback: any = {}): any {
    if (!value) return fallback
    
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return typeof parsed === 'object' && parsed !== null ? parsed : fallback
    } catch {
      console.warn(`Failed to parse JSON object: ${value}`)
      return fallback
    }
  }

  /**
   * Start tracking a migration step
   */
  private startStep(stepName: string): MigrationStatus {
    const step: MigrationStatus = {
      step: stepName,
      startTime: Date.now(),
      recordsProcessed: 0,
      errors: []
    }
    this.status.push(step)
    console.log(`📋 Starting migration: ${stepName}`)
    return step
  }

  /**
   * End tracking a migration step
   */
  private endStep(step: MigrationStatus): void {
    step.endTime = Date.now()
    const duration = step.endTime - step.startTime
    console.log(`⏱️  ${step.step} completed in ${duration}ms`)
  }

  /**
   * Print migration summary
   */
  private printMigrationSummary(): void {
    console.log('\n📊 Migration Summary:')
    console.log('====================')
    
    let totalRecords = 0
    let totalTime = 0
    let totalErrors = 0
    
    for (const step of this.status) {
      const duration = (step.endTime || Date.now()) - step.startTime
      totalRecords += step.recordsProcessed
      totalTime += duration
      totalErrors += step.errors.length
      
      console.log(`${step.step}: ${step.recordsProcessed} records (${duration}ms)`)
      if (step.errors.length > 0) {
        console.log(`  ❌ ${step.errors.length} errors`)
      }
    }
    
    console.log('====================')
    console.log(`Total: ${totalRecords} records in ${totalTime}ms`)
    console.log(`Errors: ${totalErrors}`)
    console.log(`Performance: ${Math.round(totalRecords / (totalTime / 1000))} records/second`)
  }
}