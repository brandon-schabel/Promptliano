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
    return baseProviderKeyRepository.findOneWhere(eq(providerKeys.name, name))
  },

  /**
   * Get all active provider keys
   */
  async getActive(): Promise<ProviderKey[]> {
    return baseProviderKeyRepository.findWhere(eq(providerKeys.isActive, true))
  },

  /**
   * Get keys by provider type
   */
  async getByProvider(provider: string): Promise<ProviderKey[]> {
    return baseProviderKeyRepository.findWhere(eq(providerKeys.provider, provider))
  }
})