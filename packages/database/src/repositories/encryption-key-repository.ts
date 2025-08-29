/**
 * Encryption Key Repository - Database-based replacement for file-based encryption key storage
 * Stores encryption keys in the database instead of filesystem
 */

import { eq } from 'drizzle-orm'
import { db } from '../db'
import { encryptionKeys, type EncryptionKey, type InsertEncryptionKey } from '../schema'

const DEFAULT_KEY = 'promptliano-default-key-v1'

// Cache for performance
let cachedKey: EncryptionKey | null = null

export const encryptionKeyRepository = {
  /**
   * Returns the encryption key used for provider key encryption.
   * If a user-provided key is not set, returns the default key.
   */
  async getKey(): Promise<string> {
    if (cachedKey) return cachedKey.key

    // Prefer explicit env override if provided
    const envKey = process.env.PROMPTLIANO_ENCRYPTION_KEY
    if (envKey && envKey.trim().length > 0) {
      cachedKey = {
        id: 0,
        key: envKey,
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      return envKey
    }

    // Try to get from database
    const [record] = await db.select().from(encryptionKeys).limit(1)

    if (record) {
      cachedKey = record
      return record.key
    }

    // Fall back to default (insecure) key; persisted so behavior is stable
    const fallback: InsertEncryptionKey = {
      key: DEFAULT_KEY,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const [newRecord] = await db.insert(encryptionKeys).values(fallback).returning()
    if (!newRecord) {
      throw new Error('Failed to create default encryption key')
    }

    cachedKey = newRecord
    return newRecord.key
  },

  /** Set a custom user-provided encryption key (persists to database). */
  async setKey(key: string): Promise<void> {
    const record: InsertEncryptionKey = {
      key,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Delete existing key first
    await db.delete(encryptionKeys)

    // Insert new key
    const [newRecord] = await db.insert(encryptionKeys).values(record).returning()
    if (!newRecord) {
      throw new Error('Failed to set encryption key')
    }

    cachedKey = newRecord
  },

  /** Use the default (insecure) encryption key; persisted with isDefault flag. */
  async useDefault(): Promise<void> {
    const record: InsertEncryptionKey = {
      key: DEFAULT_KEY,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Delete existing key first
    await db.delete(encryptionKeys)

    // Insert default key
    const [newRecord] = await db.insert(encryptionKeys).values(record).returning()
    if (!newRecord) {
      throw new Error('Failed to set default encryption key')
    }

    cachedKey = newRecord
  },

  /** Returns true if a non-default key is configured. */
  async hasKey(): Promise<boolean> {
    if (cachedKey) return !cachedKey.isDefault

    const [record] = await db.select().from(encryptionKeys).limit(1)
    return record ? !record.isDefault : false
  },

  /** Returns true if the current key is the default insecure key. */
  async isDefault(): Promise<boolean> {
    if (cachedKey) return cachedKey.isDefault

    const [record] = await db.select().from(encryptionKeys).limit(1)
    return record ? record.isDefault : true
  },

  /** Clears in-memory cache. */
  clearCache(): void {
    cachedKey = null
  },

  /** Get the current encryption key record */
  async getCurrent(): Promise<EncryptionKey | null> {
    if (cachedKey) return cachedKey

    const [record] = await db.select().from(encryptionKeys).limit(1)
    if (record) {
      cachedKey = record
    }
    return record ?? null
  },

  /** Count encryption keys (should be 0 or 1) */
  async count(): Promise<number> {
    const { count } = await import('drizzle-orm')
    const [result] = await db.select({ count: count() }).from(encryptionKeys)
    return result?.count ?? 0
  }
}

export type EncryptionKeyRepository = typeof encryptionKeyRepository
