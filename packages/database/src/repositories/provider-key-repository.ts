/**
 * Provider Key Repository - Manages API keys and provider configurations
 * Uses BaseRepository for consistent CRUD operations with encryption support
 */

import { eq } from 'drizzle-orm'
import { createBaseRepository, extendRepository } from './base-repository'
import { 
  providerKeys,
  type ProviderKey,
  type InsertProviderKey,
  selectProviderKeySchema
} from '../schema'

// Create base provider key repository
const baseProviderKeyRepository = createBaseRepository(
  providerKeys,
  selectProviderKeySchema,
  'ProviderKey'
)

// Extend with domain-specific methods
export const providerKeyRepository = extendRepository(baseProviderKeyRepository, {
  /**
   * Get provider key by name
   */
  async getByName(name: string): Promise<ProviderKey | null> {
    const result = await baseProviderKeyRepository.findOneWhere(eq(providerKeys.name, name))
    return result as ProviderKey | null
  },

  /**
   * Get all active provider keys
   */
  async getActive(): Promise<ProviderKey[]> {
    const results = await baseProviderKeyRepository.findWhere(eq(providerKeys.isActive, true))
    return results as ProviderKey[]
  },

  /**
   * Get keys by provider type
   */
  async getByProvider(provider: string): Promise<ProviderKey[]> {
    const results = await baseProviderKeyRepository.findWhere(eq(providerKeys.provider, provider))
    return results as ProviderKey[]
  }
})