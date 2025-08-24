/**
 * App State Repository - Manages application state entities
 * These entities don't follow strict BaseEntity pattern due to legacy schema
 */

import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db'
import { 
  selectedFiles as selectedFilesTable,
  activeTabs as activeTabsTable,
  type SelectedFile,
  type ActiveTab,
  type InsertSelectedFile,
  type InsertActiveTab
} from '../schema'

// Selected Files Repository (custom implementation due to non-standard schema)
export const selectedFileRepository = {
  async create(data: Omit<InsertSelectedFile, 'id'>): Promise<SelectedFile> {
    const result = await db.insert(selectedFilesTable).values({
      ...data,
      selectedAt: data.selectedAt || Date.now()
    }).returning()
    
    if (!result[0]) {
      throw new Error('Failed to create selected file')
    }
    
    return result[0]
  },

  async getById(id: number): Promise<SelectedFile | null> {
    const [file] = await db.select()
      .from(selectedFilesTable)
      .where(eq(selectedFilesTable.id, id))
      .limit(1)
    return file ?? null
  },

  async getByProject(projectId: number): Promise<SelectedFile[]> {
    return db.select()
      .from(selectedFilesTable)
      .where(eq(selectedFilesTable.projectId, projectId))
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(selectedFilesTable)
      .where(eq(selectedFilesTable.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  async deleteMany(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0
    
    // Use inArray for multiple IDs or single eq for one ID
    const condition = ids.length === 1 
      ? eq(selectedFilesTable.id, ids[0]!)
      : inArray(selectedFilesTable.id, ids)
    
    const result = await db.delete(selectedFilesTable)
      .where(condition)
      .run() as unknown as { changes: number }
    return result.changes
  },

  async isFileSelected(projectId: number, fileId: string): Promise<boolean> {
    const file = await db.select()
      .from(selectedFilesTable)
      .where(and(
        eq(selectedFilesTable.projectId, projectId),
        eq(selectedFilesTable.fileId, fileId)
      ))
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
export const activeTabRepository = {
  async create(data: Omit<InsertActiveTab, 'id'>): Promise<ActiveTab> {
    const result = await db.insert(activeTabsTable).values({
      ...data,
      createdAt: data.createdAt || Date.now(),
      lastAccessedAt: data.lastAccessedAt || Date.now()
    }).returning()
    
    if (!result[0]) {
      throw new Error('Failed to create active tab')
    }
    
    return result[0]
  },

  async getById(id: number): Promise<ActiveTab | null> {
    const [tab] = await db.select()
      .from(activeTabsTable)
      .where(eq(activeTabsTable.id, id))
      .limit(1)
    return tab ?? null
  },

  async getByProject(projectId: number): Promise<ActiveTab[]> {
    return db.select()
      .from(activeTabsTable)
      .where(eq(activeTabsTable.projectId, projectId))
  },

  async update(id: number, data: Partial<Omit<InsertActiveTab, 'id'>>): Promise<ActiveTab> {
    const result = await db.update(activeTabsTable)
      .set({
        ...data,
        lastAccessedAt: Date.now() // Update access time
      })
      .where(eq(activeTabsTable.id, id))
      .returning()
    
    if (!result[0]) {
      throw new Error(`Active tab with id ${id} not found`)
    }
    
    return result[0]
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(activeTabsTable)
      .where(eq(activeTabsTable.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  async getByPath(projectId: number, filePath: string): Promise<ActiveTab | null> {
    // Assuming filePath is stored in tabData or can be identified by tabType
    // This is a simplified implementation - may need adjustment based on actual data structure
    const tabs = await this.getByProject(projectId)
    return tabs.find(tab => 
      tab.tabType === 'file' && 
      tab.tabData && 
      (tab.tabData as any).filePath === filePath
    ) || null
  },

  async count(where?: any): Promise<number> {
    const { count } = await import('drizzle-orm')
    const query = db.select({ count: count() }).from(activeTabsTable)
    
    if (where) {
      query.where(where)
    }
    
    const [result] = await query
    return result?.count ?? 0
  }
}

// Backward compatibility exports
export { selectedFileRepository as selectedFiles }
export { activeTabRepository as activeTabs }