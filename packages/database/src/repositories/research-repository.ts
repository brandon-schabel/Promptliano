/**
 * Deep Research Repositories - Data access layer for research operations
 * Provides CRUD and custom queries for all research-related entities
 */

import { eq, and, desc, asc, inArray, ne, lt } from 'drizzle-orm'
import { db } from '../db'
import {
  researchRecords,
  researchSources,
  researchProcessedData,
  researchDocumentSections,
  researchExports,
  type ResearchRecord,
  type InsertResearchRecord,
  type ResearchSource,
  type InsertResearchSource,
  type ResearchProcessedData,
  type InsertResearchProcessedData,
  type ResearchDocumentSection,
  type InsertResearchDocumentSection,
  type ResearchExport,
  type InsertResearchExport
} from '../schema'
import { createBaseRepository, extendRepository } from './base-repository'

// =============================================================================
// Research Record Repository
// =============================================================================

const baseResearchRecordRepo = createBaseRepository(researchRecords, undefined, undefined, 'ResearchRecord')

export const researchRecordRepository = extendRepository(baseResearchRecordRepo, {

  /**
   * Get all research records for a project
   */
  async getByProject(projectId: number): Promise<ResearchRecord[]> {
    const results = await db
      .select()
      .from(researchRecords)
      .where(eq(researchRecords.projectId, projectId))
      .orderBy(desc(researchRecords.createdAt))

    // Type assertion for JSON fields
    return results as ResearchRecord[]
  },

  /**
   * Get research records by status
   */
  async getByStatus(status: ResearchRecord['status']): Promise<ResearchRecord[]> {
    const results = await db.select().from(researchRecords).where(eq(researchRecords.status, status))
    return results as ResearchRecord[]
  },

  /**
   * Get research with all relations
   */
  async getWithRelations(id: number) {
    const [research] = await db
      .select()
      .from(researchRecords)
      .where(eq(researchRecords.id, id))
      .limit(1)

    if (!research) return null

    const [sources, processedData, sections, exports] = await Promise.all([
      researchSourceRepository.getByResearch(id),
      researchProcessedDataRepository.getByResearch(id),
      researchDocumentSectionRepository.getByResearch(id),
      researchExportRepository.getByResearch(id)
    ])

    return {
      ...research,
      sources,
      processedData,
      sections,
      exports
    }
  }
})

// =============================================================================
// Research Source Repository
// =============================================================================

const baseResearchSourceRepo = createBaseRepository(researchSources, undefined, undefined, 'ResearchSource')

export const researchSourceRepository = extendRepository(baseResearchSourceRepo, {

  /**
   * Get all sources for a research session
   */
  async getByResearch(researchId: number): Promise<ResearchSource[]> {
    return db
      .select()
      .from(researchSources)
      .where(eq(researchSources.researchId, researchId))
      .orderBy(asc(researchSources.createdAt))
  },

  /**
   * Get sources by status
   */
  async getByStatus(researchId: number, status: ResearchSource['status']): Promise<ResearchSource[]> {
    return db
      .select()
      .from(researchSources)
      .where(and(eq(researchSources.researchId, researchId), eq(researchSources.status, status)))
  },

  /**
   * Get pending sources (for processing)
   */
  async getPendingSources(researchId: number): Promise<ResearchSource[]> {
    return db
      .select()
      .from(researchSources)
      .where(and(eq(researchSources.researchId, researchId), eq(researchSources.status, 'pending')))
      .orderBy(asc(researchSources.createdAt))
  },

  /**
   * Check if URL already exists for research
   */
  async existsByUrl(researchId: number, url: string): Promise<boolean> {
    const results = await db
      .select({ id: researchSources.id })
      .from(researchSources)
      .where(and(eq(researchSources.researchId, researchId), eq(researchSources.url, url)))
      .limit(1)

    return results.length > 0
  },

  /**
   * Count sources by status
   */
  async countByStatus(researchId: number, status: ResearchSource['status']): Promise<number> {
    const results = await db
      .select({ id: researchSources.id })
      .from(researchSources)
      .where(and(eq(researchSources.researchId, researchId), eq(researchSources.status, status)))

    return results.length
  },

  /**
   * Create multiple sources in batch
   * @returns Array of created sources
   */
  async createMany(sources: InsertResearchSource[]): Promise<ResearchSource[]> {
    if (sources.length === 0) return []

    const timestamp = Date.now()
    const sourcesWithTimestamps = sources.map(source => ({
      ...source,
      createdAt: timestamp,
      updatedAt: timestamp
    }))

    const results = await db
      .insert(researchSources)
      .values(sourcesWithTimestamps)
      .returning()

    return results as ResearchSource[]
  }
})

// =============================================================================
// Research Processed Data Repository
// =============================================================================

const baseResearchProcessedDataRepo = createBaseRepository(
  researchProcessedData,
  undefined,
  undefined,
  'ResearchProcessedData'
)

export const researchProcessedDataRepository = extendRepository(baseResearchProcessedDataRepo, {

  /**
   * Get all processed data for a research session
   */
  async getByResearch(researchId: number): Promise<ResearchProcessedData[]> {
    const results = await db
      .select()
      .from(researchProcessedData)
      .where(eq(researchProcessedData.researchId, researchId))
      .orderBy(desc(researchProcessedData.createdAt))

    // Type assertion for JSON array fields
    return results as ResearchProcessedData[]
  },

  /**
   * Get processed data for a specific source
   */
  async getBySource(sourceId: number): Promise<ResearchProcessedData | null> {
    const results = await db
      .select()
      .from(researchProcessedData)
      .where(eq(researchProcessedData.sourceId, sourceId))
      .limit(1)

    return (results[0] as ResearchProcessedData) || null
  },

  /**
   * Search processed data by keywords
   */
  async searchByKeywords(researchId: number, keywords: string[]): Promise<ResearchProcessedData[]> {
    // Note: This is a simplified search - in production, you'd want full-text search
    const allData = await this.getByResearch(researchId)
    return allData.filter((data) =>
      keywords.some((keyword) => data.keywords.includes(keyword.toLowerCase()))
    )
  },

  /**
   * Create multiple processed data records in batch
   * @returns Array of created records
   */
  async createMany(processedDataRecords: InsertResearchProcessedData[]): Promise<ResearchProcessedData[]> {
    if (processedDataRecords.length === 0) return []

    const timestamp = Date.now()
    const recordsWithTimestamps = processedDataRecords.map(record => ({
      ...record,
      createdAt: timestamp,
      updatedAt: timestamp
    }))

    const results = await db
      .insert(researchProcessedData)
      .values(recordsWithTimestamps)
      .returning()

    return results as ResearchProcessedData[]
  }
})

// =============================================================================
// Research Document Section Repository
// =============================================================================

const baseResearchDocumentSectionRepo = createBaseRepository(
  researchDocumentSections,
  undefined,
  undefined,
  'ResearchDocumentSection'
)

export const researchDocumentSectionRepository = extendRepository(baseResearchDocumentSectionRepo, {

  /**
   * Get all sections for a research document
   */
  async getByResearch(researchId: number): Promise<ResearchDocumentSection[]> {
    const results = await db
      .select()
      .from(researchDocumentSections)
      .where(eq(researchDocumentSections.researchId, researchId))
      .orderBy(asc(researchDocumentSections.orderIndex))

    // Type assertion for JSON array fields
    return results as ResearchDocumentSection[]
  },

  /**
   * Get sections by status
   */
  async getByStatus(
    researchId: number,
    status: ResearchDocumentSection['status']
  ): Promise<ResearchDocumentSection[]> {
    const results = await db
      .select()
      .from(researchDocumentSections)
      .where(
        and(
          eq(researchDocumentSections.researchId, researchId),
          eq(researchDocumentSections.status, status)
        )
      )
      .orderBy(asc(researchDocumentSections.orderIndex))

    return results as ResearchDocumentSection[]
  },

  /**
   * Get pending sections (ready to be built)
   */
  async getPendingSections(researchId: number): Promise<ResearchDocumentSection[]> {
    return this.getByStatus(researchId, 'pending')
  },

  /**
   * Get top-level sections (no parent)
   */
  async getTopLevelSections(researchId: number): Promise<ResearchDocumentSection[]> {
    const results = await db
      .select()
      .from(researchDocumentSections)
      .where(
        and(
          eq(researchDocumentSections.researchId, researchId),
          eq(researchDocumentSections.parentSectionId, null as any)
        )
      )
      .orderBy(asc(researchDocumentSections.orderIndex))

    return results as ResearchDocumentSection[]
  },

  /**
   * Get subsections for a parent section
   */
  async getSubsections(parentSectionId: number): Promise<ResearchDocumentSection[]> {
    const results = await db
      .select()
      .from(researchDocumentSections)
      .where(eq(researchDocumentSections.parentSectionId, parentSectionId))
      .orderBy(asc(researchDocumentSections.orderIndex))

    return results as ResearchDocumentSection[]
  },

  /**
   * Update section order indexes
   */
  async reorderSections(updates: Array<{ id: number; orderIndex: number }>): Promise<void> {
    await Promise.all(
      updates.map((update) =>
        db
          .update(researchDocumentSections)
          .set({ orderIndex: update.orderIndex, updatedAt: Date.now() })
          .where(eq(researchDocumentSections.id, update.id))
      )
    )
  },

  /**
   * Count sections by status
   */
  async countByStatus(researchId: number, status: ResearchDocumentSection['status']): Promise<number> {
    const results = await db
      .select({ id: researchDocumentSections.id })
      .from(researchDocumentSections)
      .where(and(eq(researchDocumentSections.researchId, researchId), eq(researchDocumentSections.status, status)))

    return results.length
  }
})

// =============================================================================
// Research Export Repository
// =============================================================================

const baseResearchExportRepo = createBaseRepository(researchExports, undefined, undefined, 'ResearchExport')

export const researchExportRepository = extendRepository(baseResearchExportRepo, {

  /**
   * Get all exports for a research session
   */
  async getByResearch(researchId: number): Promise<ResearchExport[]> {
    return db
      .select()
      .from(researchExports)
      .where(eq(researchExports.researchId, researchId))
      .orderBy(desc(researchExports.createdAt))
  },

  /**
   * Get exports by format
   */
  async getByFormat(researchId: number, format: ResearchExport['format']): Promise<ResearchExport[]> {
    return db
      .select()
      .from(researchExports)
      .where(and(eq(researchExports.researchId, researchId), eq(researchExports.format, format)))
      .orderBy(desc(researchExports.createdAt))
  },

  /**
   * Get most recent export by format
   */
  async getLatestByFormat(researchId: number, format: ResearchExport['format']): Promise<ResearchExport | null> {
    const results = await db
      .select()
      .from(researchExports)
      .where(and(eq(researchExports.researchId, researchId), eq(researchExports.format, format)))
      .orderBy(desc(researchExports.createdAt))
      .limit(1)

    return results[0] || null
  },

  /**
   * Increment download count
   */
  async incrementDownloadCount(id: number): Promise<void> {
    const current = await baseResearchExportRepo.getById(id)
    if (current) {
      await db
        .update(researchExports)
        .set({ downloadCount: ((current.downloadCount as number) || 0) + 1 })
        .where(eq(researchExports.id, id))
    }
  },

  /**
   * Delete expired exports
   */
  async deleteExpired(): Promise<number> {
    const now = Date.now()
    const result = (await db
      .delete(researchExports)
      .where(
        and(
          ne(researchExports.expiresAt, null as any),
          lt(researchExports.expiresAt, now)
        )
      )
      .run()) as unknown as { changes: number }

    return result.changes || 0
  }
})
