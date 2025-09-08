/**
 * App State Repository - Manages application state entities
 * These entities don't follow strict BaseEntity pattern due to legacy schema
 */

import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db'
import { selectedFiles as selectedFilesTable, type SelectedFile, type InsertSelectedFile } from '../schema'

// Selected Files Repository (custom implementation due to non-standard schema)
export const selectedFileRepository = {
  async create(data: Omit<InsertSelectedFile, 'id'>): Promise<SelectedFile> {
    const result = await db
      .insert(selectedFilesTable)
      .values({
        ...data,
        selectedAt: data.selectedAt || Date.now()
      })
      .returning()

    if (!result[0]) {
      throw new Error('Failed to create selected file')
    }

    return result[0]
  },

  async getById(id: number): Promise<SelectedFile | null> {
    const [file] = await db.select().from(selectedFilesTable).where(eq(selectedFilesTable.id, id)).limit(1)
    return file ?? null
  },

  async getByProject(projectId: number): Promise<SelectedFile[]> {
    return db.select().from(selectedFilesTable).where(eq(selectedFilesTable.projectId, projectId))
  },

  async delete(id: number): Promise<boolean> {
    const result = (await db.delete(selectedFilesTable).where(eq(selectedFilesTable.id, id)).run()) as unknown as {
      changes: number
    }
    return result.changes > 0
  },

  async deleteMany(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0

    // Use inArray for multiple IDs or single eq for one ID
    const condition = ids.length === 1 ? eq(selectedFilesTable.id, ids[0]!) : inArray(selectedFilesTable.id, ids)

    const result = (await db.delete(selectedFilesTable).where(condition).run()) as unknown as { changes: number }
    return result.changes
  },

  async isFileSelected(projectId: number, fileId: string): Promise<boolean> {
    const file = await db
      .select()
      .from(selectedFilesTable)
      .where(and(eq(selectedFilesTable.projectId, projectId), eq(selectedFilesTable.fileId, fileId)))
      .limit(1)
    return file.length > 0
  },

  async count(where?: any): Promise<number> {
    const { count } = await import('drizzle-orm')
    const query = db.select({ count: count() }).from(selectedFilesTable)

    if (where) {
      query.where(where)
    }

    const [result] = await query
    return result?.count ?? 0
  }
}

// Active Tabs Repository (custom implementation due to non-standard schema)
// Backward compatibility exports
export { selectedFileRepository as selectedFiles }
