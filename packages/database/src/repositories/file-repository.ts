/**
 * File Repository - File management and selection
 * New centralized file handling system
 */

import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '../db'
import { 
  files, 
  selectedFiles, 
  type File, 
  type SelectedFile,
  type InsertFile, 
  type InsertSelectedFile
} from '../schema'

export const fileRepository = {
  // =============================================================================
  // FILE OPERATIONS
  // =============================================================================

  /**
   * Create or update file
   */
  async upsert(data: Omit<InsertFile, 'createdAt' | 'updatedAt'>): Promise<File> {
    const now = Date.now()
    
    // Try to find existing file
    const existing = await this.getById(data.id)
    
    if (existing) {
      // Update existing
      const [updated] = await db.update(files)
        .set({
          ...data,
          updatedAt: now
        })
        .where(eq(files.id, data.id))
        .returning()
      return updated
    } else {
      // Create new
      const [created] = await db.insert(files).values({
        ...data,
        createdAt: now,
        updatedAt: now
      }).returning()
      return created
    }
  },

  /**
   * Get file by ID (path)
   */
  async getById(id: string): Promise<File | null> {
    const [file] = await db.select()
      .from(files)
      .where(eq(files.id, id))
      .limit(1)
    return file ?? null
  },

  /**
   * Get files by project ID
   */
  async getByProject(projectId: number): Promise<File[]> {
    return db.select()
      .from(files)
      .where(eq(files.projectId, projectId))
      .orderBy(desc(files.updatedAt))
  },

  /**
   * Get relevant files
   */
  async getRelevantFiles(projectId: number): Promise<File[]> {
    return db.select()
      .from(files)
      .where(and(
        eq(files.projectId, projectId),
        eq(files.isRelevant, true)
      ))
      .orderBy(desc(files.relevanceScore))
  },

  /**
   * Update file
   */
  async update(id: string, data: Partial<Omit<InsertFile, 'id' | 'createdAt'>>): Promise<File> {
    const [updated] = await db.update(files)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(files.id, id))
      .returning()
    return updated
  },

  /**
   * Delete file
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(files)
      .where(eq(files.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  // =============================================================================
  // SELECTED FILE OPERATIONS
  // =============================================================================

  /**
   * Select a file
   */
  async selectFile(data: Omit<InsertSelectedFile, 'id' | 'selectedAt'>): Promise<SelectedFile> {
    // Check if already selected
    const existing = await db.select()
      .from(selectedFiles)
      .where(and(
        eq(selectedFiles.projectId, data.projectId),
        eq(selectedFiles.fileId, data.fileId),
        eq(selectedFiles.isActive, true)
      ))
      .limit(1)

    if (existing.length > 0) {
      // Already selected, just return it
      return existing[0]
    }

    const [selected] = await db.insert(selectedFiles).values({
      ...data,
      selectedAt: Date.now()
    }).returning()
    return selected
  },

  /**
   * Deselect a file
   */
  async deselectFile(projectId: number, fileId: string): Promise<boolean> {
    const result = await db.update(selectedFiles)
      .set({
        isActive: false
      })
      .where(and(
        eq(selectedFiles.projectId, projectId),
        eq(selectedFiles.fileId, fileId)
      ))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  /**
   * Get selected files for project
   */
  async getSelectedFiles(projectId: number): Promise<(SelectedFile & { file: File })[]> {
    return db.query.selectedFiles.findMany({
      where: and(
        eq(selectedFiles.projectId, projectId),
        eq(selectedFiles.isActive, true)
      ),
      with: {
        file: true
      },
      orderBy: desc(selectedFiles.selectedAt)
    })
  },

  /**
   * Clear all selected files for project
   */
  async clearSelectedFiles(projectId: number): Promise<number> {
    const result = await db.update(selectedFiles)
      .set({
        isActive: false
      })
      .where(eq(selectedFiles.projectId, projectId))
      .run() as unknown as { changes: number }
    return result.changes
  },

  /**
   * Get file with selection status
   */
  async getFileWithSelection(projectId: number, fileId: string) {
    return db.query.files.findFirst({
      where: eq(files.id, fileId),
      with: {
        selections: {
          where: and(
            eq(selectedFiles.projectId, projectId),
            eq(selectedFiles.isActive, true)
          ),
          limit: 1
        }
      }
    })
  }
}