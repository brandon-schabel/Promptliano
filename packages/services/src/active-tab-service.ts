/**
 * Active Tab Service - Migrated to Repository Pattern
 * Manages active tab state for projects using activeTabRepository
 */

import { ErrorFactory, withErrorContext } from '@promptliano/shared'
import { activeTabRepository, type ActiveTab, type InsertActiveTab, selectActiveTabSchema } from '@promptliano/database'
import { getProjectById } from './project-service'

// Legacy interface compatibility
interface ActiveTabData {
  projectId: number;
  activeTabId: number;
  clientId?: string;
  lastUpdated: number;
  tabMetadata?: any;
}

interface UpdateActiveTabBody {
  tabId: number;
  clientId?: string;
  tabMetadata?: any;
}

interface LegacyActiveTab {
  id: number;
  data: ActiveTabData;
  created: number;
  updated: number;
}

/**
 * Map database ActiveTab to legacy format for backward compatibility
 */
function mapToLegacyFormat(dbTab: ActiveTab): LegacyActiveTab {
  return {
    id: dbTab.id,
    data: {
      projectId: dbTab.projectId,
      activeTabId: (dbTab.tabData as any)?.activeTabId || 0,
      clientId: (dbTab.tabData as any)?.clientId,
      lastUpdated: dbTab.lastAccessedAt,
      tabMetadata: dbTab.tabData,
    },
    created: dbTab.createdAt,
    updated: dbTab.lastAccessedAt,
  }
}

/**
 * Map legacy format to database ActiveTab for creation
 */
function mapFromLegacyFormat(data: ActiveTabData): Omit<InsertActiveTab, 'id'> {
  return {
    projectId: data.projectId,
    tabType: 'active',
    tabData: {
      activeTabId: data.activeTabId,
      clientId: data.clientId,
      ...data.tabMetadata,
    },
    isActive: true,
    lastAccessedAt: data.lastUpdated,
    createdAt: Date.now(),
  }
}

/**
 * Get the active tab for a project
 */
export async function getActiveTab(projectId: number, clientId?: string): Promise<LegacyActiveTab | null> {
  return withErrorContext(
    async () => {
      // Validate project exists
      await getProjectById(projectId)

      // Get active tabs for this project
      const dbTabs = await activeTabRepository.getByProject(projectId)
      
      // Find the matching active tab
      const matchingTab = dbTabs.find(tab => {
        if (!tab.isActive) return false
        
        // If clientId specified, must match
        if (clientId) {
          const tabClientId = (tab.tabData as any)?.clientId
          return tabClientId === clientId
        }
        
        return true
      })
      
      return matchingTab ? mapToLegacyFormat(matchingTab) : null
    },
    { entity: 'ActiveTab', action: 'get', projectId, clientId }
  )
}

/**
 * Set the active tab for a project
 */
export async function setActiveTab(
  projectId: number,
  tabId: number,
  clientId?: string,
  tabMetadata?: ActiveTabData['tabMetadata']
): Promise<LegacyActiveTab> {
  return withErrorContext(
    async () => {
      // Validate project exists
      await getProjectById(projectId)

      // Check if we already have an active tab entry for this project
      const existingActiveTab = await getActiveTab(projectId, clientId)

      const now = Date.now()
      const activeTabData: ActiveTabData = {
        projectId,
        activeTabId: tabId,
        clientId,
        lastUpdated: now,
        tabMetadata
      }

      if (existingActiveTab) {
        // Update existing entry
        const updateData = mapFromLegacyFormat(activeTabData)
        const updated = await activeTabRepository.update(existingActiveTab.id, updateData)
        return mapToLegacyFormat(updated)
      } else {
        // Create new entry
        const createData = mapFromLegacyFormat(activeTabData)
        const created = await activeTabRepository.create(createData)
        return mapToLegacyFormat(created)
      }
    },
    { entity: 'ActiveTab', action: 'set', projectId, tabId, clientId }
  )
}

/**
 * Get active tab or create default (tab 0)
 */
export async function getOrCreateDefaultActiveTab(projectId: number, clientId?: string): Promise<number> {
  try {
    return await withErrorContext(
      async () => {
        const activeTab = await getActiveTab(projectId, clientId)
        if (activeTab) {
          return activeTab.data.activeTabId
        }
        // No active tab, create default tab 0
        const created = await setActiveTab(projectId, 0, clientId)
        return created.data.activeTabId
      },
      { entity: 'ActiveTab', action: 'getOrCreate', projectId, clientId }
    )
  } catch (error) {
    // Fallback: return 0 if all else fails
    console.warn(`Failed to get/create active tab for project ${projectId}, defaulting to 0:`, error)
    return 0
  }
}

/**
 * Clear active tab for a project
 */
export async function clearActiveTab(projectId: number, clientId?: string): Promise<boolean> {
  return withErrorContext(
    async () => {
      const activeTab = await getActiveTab(projectId, clientId)
      if (!activeTab) {
        return false
      }
      return await activeTabRepository.delete(activeTab.id)
    },
    { entity: 'ActiveTab', action: 'clear', projectId, clientId }
  )
}

/**
 * Update active tab from request body
 */
export async function updateActiveTab(projectId: number, body: UpdateActiveTabBody): Promise<LegacyActiveTab> {
  return setActiveTab(projectId, body.tabId, body.clientId, body.tabMetadata)
}

/**
 * Service factory function for route compatibility
 */
export function createActiveTabService(deps = {}) {
  return {
    async list(): Promise<LegacyActiveTab[]> {
      // Get all active tabs from the repository
      return withErrorContext(
        async () => {
          const allTabs = await activeTabRepository.getAll()
          return allTabs.map(mapToLegacyFormat)
        },
        { entity: 'ActiveTab', action: 'list' }
      )
    },

    async getById(id: number | string): Promise<LegacyActiveTab> {
      return withErrorContext(
        async () => {
          const tab = await activeTabRepository.getById(Number(id))
          if (!tab) {
            throw ErrorFactory.notFound('ActiveTab', id)
          }
          return mapToLegacyFormat(tab)
        },
        { entity: 'ActiveTab', action: 'getById', id }
      )
    },

    async create(data: any): Promise<LegacyActiveTab> {
      return withErrorContext(
        async () => {
          const createData = mapFromLegacyFormat(data)
          const created = await activeTabRepository.create(createData)
          return mapToLegacyFormat(created)
        },
        { entity: 'ActiveTab', action: 'create' }
      )
    },

    async update(id: number | string, data: any): Promise<LegacyActiveTab> {
      return withErrorContext(
        async () => {
          const updateData = mapFromLegacyFormat(data)
          const updated = await activeTabRepository.update(Number(id), updateData)
          if (!updated) {
            throw ErrorFactory.notFound('ActiveTab', id)
          }
          return mapToLegacyFormat(updated)
        },
        { entity: 'ActiveTab', action: 'update', id }
      )
    },

    async delete(id: number | string): Promise<boolean> {
      return withErrorContext(
        async () => {
          return await activeTabRepository.delete(Number(id))
        },
        { entity: 'ActiveTab', action: 'delete', id }
      )
    },

    // Additional methods for compatibility
    getActiveTab,
    setActiveTab,
    getOrCreateDefaultActiveTab,
    clearActiveTab,
    updateActiveTab
  }
}

// Export singleton service for route compatibility
export const activeTabService = createActiveTabService()
