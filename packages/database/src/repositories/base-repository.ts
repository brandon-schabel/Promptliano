/**
 * Base Repository Pattern - Replaces BaseStorage with Drizzle ORM
 * Provides common CRUD operations with full type safety and performance optimization
 */

import {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  notLike,
  isNull,
  isNotNull,
  and,
  or,
  not,
  inArray,
  notInArray,
  exists,
  notExists,
  between,
  asc,
  desc,
  count,
  sum,
  avg,
  min,
  max,
  type InferSelectModel,
  type InferInsertModel
} from 'drizzle-orm'
import { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { db, type DrizzleDb, type DrizzleTransaction } from '../db'
import { z } from 'zod'
import { ErrorFactory, assertExists, assertDatabaseOperation, createErrorHandler } from '@promptliano/shared'
import { ApiError } from '@promptliano/shared/src/error/api-error'

export type BaseEntity<TId = number> = {
  id: TId
  createdAt: number
  updatedAt: number
}

export type InsertBaseEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Generic repository class for common database operations
 */
export class BaseRepository<
  TEntity extends BaseEntity<any>,
  TInsert extends Record<string, any> = InsertBaseEntity<TEntity>,
  TTable extends SQLiteTable = SQLiteTable
> {
  protected readonly errorHandler: ReturnType<typeof createErrorHandler>

  constructor(
    protected readonly table: TTable,
    protected readonly dbInstance: DrizzleDb = db,
    protected readonly schema?: any,
    protected readonly entityName?: string
  ) {
    this.errorHandler = createErrorHandler(entityName || (table as any)?.['_']?.['name'] || 'entity')
  }

  /**
   * Create a new entity
   */
  async create(data: Omit<TInsert, 'id' | 'createdAt' | 'updatedAt'>): Promise<TEntity> {
    return this.errorHandler.withContext(async () => {
      const now = Date.now()
      const [entity] = await this.dbInstance
        .insert(this.table)
        .values({
          ...data,
          createdAt: now,
          updatedAt: now
        } as any)
        .returning()

      assertDatabaseOperation(entity, 'create', `Failed to create ${this.entityName}`)
      return this.validateEntity(entity)
    }, 'create')
  }

  /**
   * Get entity by ID
   */
  async getById(id: TEntity['id']): Promise<TEntity | null> {
    return this.errorHandler.withContext(async () => {
      const [entity] = await this.dbInstance
        .select()
        .from(this.table)
        .where(eq((this.table as any).id, id))
        .limit(1)

      return entity ? this.validateEntity(entity) : null
    }, 'getById')
  }

  /**
   * Get all entities with optional ordering
   */
  async getAll(orderBy: 'asc' | 'desc' = 'desc'): Promise<TEntity[]> {
    const entities = await this.dbInstance
      .select()
      .from(this.table)
      .orderBy(orderBy === 'desc' ? desc((this.table as any).createdAt) : asc((this.table as any).createdAt))

    return entities.map((e) => this.validateEntity(e))
  }

  /**
   * Update entity by ID
   */
  async update(id: TEntity['id'], data: Partial<TInsert>): Promise<TEntity> {
    return this.errorHandler.withContext(async () => {
      const [updated] = await this.dbInstance
        .update(this.table)
        .set({
          ...data,
          updatedAt: Date.now()
        } as any)
        .where(eq((this.table as any).id, id))
        .returning()

      if (!updated) {
        if (ErrorFactory.updateFailed) {
          throw ErrorFactory.updateFailed(this.entityName || 'Entity', id, 'No rows affected')
        }
        throw new ApiError(500, `Failed to update ${this.entityName || 'Entity'} with ID ${id}: No rows affected`, 'UPDATE_FAILED', {
          entity: this.entityName || 'Entity',
          id,
          reason: 'No rows affected'
        })
      }

      return this.validateEntity(updated)
    }, 'update')
  }

  /**
   * Delete entity by ID
   */
  async delete(id: TEntity['id']): Promise<boolean> {
    return this.errorHandler.withContext(async () => {
      const result = (await this.dbInstance
        .delete(this.table)
        .where(eq((this.table as any).id, id))
        .run()) as unknown as { changes: number }

      return result.changes > 0
    }, 'delete')
  }

  /**
   * Check if entity exists
   */
  async exists(id: TEntity['id']): Promise<boolean> {
    const [result] = await this.dbInstance
      .select({ count: count() })
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1)

    return (result?.count ?? 0) > 0
  }

  /**
   * Count entities with optional where clause
   */
  async count(where?: any): Promise<number> {
    const query = this.dbInstance.select({ count: count() }).from(this.table)

    if (where) {
      query.where(where)
    }

    const [result] = await query
    return result?.count ?? 0
  }

  /**
   * Create many entities in a single transaction
   */
  async createMany(items: Omit<TInsert, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<TEntity[]> {
    return this.errorHandler.withContext(async () => {
      if (items.length === 0) return []

      const now = Date.now()
      const values = items.map((item) => ({
        ...item,
        createdAt: now,
        updatedAt: now
      }))

      const entities = await this.dbInstance
        .insert(this.table)
        .values(values as any)
        .returning()
      assertDatabaseOperation(entities, 'createMany', `Failed to create ${items.length} ${this.entityName} entities`)
      return entities.map((e) => this.validateEntity(e))
    }, 'createMany')
  }

  /**
   * Update many entities by IDs
   */
  async updateMany(ids: number[], data: Partial<TInsert>): Promise<TEntity[]> {
    if (ids.length === 0) return []

    const entities = await this.dbInstance
      .update(this.table)
      .set({
        ...data,
        updatedAt: Date.now()
      } as any)
      .where(inArray((this.table as any).id, ids))
      .returning()

    return entities.map((e) => this.validateEntity(e))
  }

  /**
   * Delete many entities by IDs
   */
  async deleteMany(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0

    const result = (await this.dbInstance
      .delete(this.table)
      .where(inArray((this.table as any).id, ids))
      .run()) as unknown as { changes: number }

    return result.changes
  }

  /**
   * Find entities with custom where clause
   */
  async findWhere(where: any): Promise<TEntity[]> {
    const entities = await this.dbInstance
      .select()
      .from(this.table)
      .where(where)
      .orderBy(desc((this.table as any).createdAt))

    return entities.map((e) => this.validateEntity(e))
  }

  /**
   * Find single entity with custom where clause
   */
  async findOneWhere(where: any): Promise<TEntity | null> {
    const [entity] = await this.dbInstance.select().from(this.table).where(where).limit(1)

    return entity ? this.validateEntity(entity) : null
  }

  /**
   * Paginated query
   */
  async paginate(
    page: number = 1,
    limit: number = 10,
    where?: any
  ): Promise<{
    data: TEntity[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const offset = (page - 1) * limit

    // Get total count
    const countQuery = this.dbInstance.select({ count: count() }).from(this.table)
    if (where) countQuery.where(where)
    const countResult = await countQuery
    const total = countResult[0]?.count ?? 0

    // Get paginated data
    const dataQuery = this.dbInstance
      .select()
      .from(this.table)
      .orderBy(desc((this.table as any).createdAt))
      .limit(limit)
      .offset(offset)

    if (where) dataQuery.where(where)
    const entities = await dataQuery

    return {
      data: entities.map((e) => this.validateEntity(e)),
      total: total ?? 0,
      page,
      limit,
      totalPages: Math.ceil((total ?? 0) / limit)
    }
  }

  /**
   * Execute custom query with the table
   */
  async customQuery(queryFn: (table: SQLiteTable, db: DrizzleDb) => Promise<any>): Promise<any> {
    return queryFn(this.table, this.dbInstance)
  }

  /**
   * Batch upsert (insert or update)
   */
  async upsert(data: Omit<TInsert, 'createdAt' | 'updatedAt'>, conflictColumns: string[] = ['id']): Promise<TEntity> {
    // SQLite doesn't have native UPSERT, so we use INSERT OR REPLACE
    const now = Date.now()
    const [entity] = await this.dbInstance
      .insert(this.table)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now
      } as any)
      .onConflictDoUpdate({
        target: conflictColumns as any,
        set: {
          ...data,
          updatedAt: now
        } as any
      })
      .returning()

    return this.validateEntity(entity)
  }

  /**
   * Transaction wrapper
   */
  async transaction<T>(callback: (tx: DrizzleTransaction) => Promise<T>): Promise<T> {
    return this.dbInstance.transaction(callback)
  }

  /**
   * Validate entity using Zod schema (if provided)
   */
  protected validateEntity(entity: any): TEntity {
    if (this.schema) {
      const result = this.schema.safeParse(entity)
      if (!result.success) {
        console.warn('Entity validation failed:', result.error.errors)
        if (ErrorFactory.validationFailed) {
          throw ErrorFactory.validationFailed(result.error, {
            entity: this.entityName,
            context: 'repository validation'
          })
        }
        throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', {
          errors: result.error.format(),
          entity: this.entityName,
          context: 'repository validation'
        })
      }
      return result.data
    }
    return entity as TEntity
  }

  /**
   * Get the underlying Drizzle table for advanced operations
   */
  getTable(): SQLiteTable {
    return this.table
  }

  /**
   * Get the database instance for advanced operations
   */
  getDb(): DrizzleDb {
    return this.dbInstance
  }
}

/**
 * Repository with soft delete support
 */
export class SoftDeleteRepository<
  TEntity extends BaseEntity & { deletedAt?: number | null },
  TInsert extends Record<string, any> = InsertBaseEntity<TEntity>,
  TTable extends SQLiteTable = SQLiteTable
> extends BaseRepository<TEntity, TInsert, TTable> {
  /**
   * Override getAll to exclude soft-deleted items by default
   */
  async getAll(orderBy: 'asc' | 'desc' = 'desc', includeDeleted: boolean = false): Promise<TEntity[]> {
    const query = this.dbInstance.select().from(this.table)

    if (!includeDeleted) {
      query.where(eq((this.table as any).deletedAt, null))
    }

    query.orderBy(orderBy === 'desc' ? desc((this.table as any).createdAt) : asc((this.table as any).createdAt))

    const entities = await query
    return entities.map((e) => this.validateEntity(e))
  }

  /**
   * Soft delete (mark as deleted without removing from database)
   */
  async softDelete(id: number): Promise<TEntity> {
    const [deleted] = await this.dbInstance
      .update(this.table)
      .set({
        deletedAt: Date.now(),
        updatedAt: Date.now()
      } as any)
      .where(eq((this.table as any).id, id))
      .returning()

    return this.validateEntity(deleted)
  }

  /**
   * Restore soft-deleted entity
   */
  async restore(id: number): Promise<TEntity> {
    const [restored] = await this.dbInstance
      .update(this.table)
      .set({
        deletedAt: null,
        updatedAt: Date.now()
      } as any)
      .where(eq((this.table as any).id, id))
      .returning()

    return this.validateEntity(restored)
  }

  /**
   * Hard delete (permanently remove from database)
   */
  async hardDelete(id: number): Promise<boolean> {
    return super.delete(id)
  }

  /**
   * Get only soft-deleted entities
   */
  async getDeleted(): Promise<TEntity[]> {
    const entities = await this.dbInstance
      .select()
      .from(this.table)
      .where(ne((this.table as any).deletedAt, null))
      .orderBy(desc((this.table as any).deletedAt))

    return entities.map((e) => this.validateEntity(e))
  }
}

// Helper functions for common query patterns
export const queryHelpers = {
  /**
   * Create a date range filter
   */
  dateRange: (column: any, startDate: number, endDate: number) => and(gte(column, startDate), lte(column, endDate)),

  /**
   * Create a text search filter (case-insensitive)
   */
  textSearch: (column: any, searchTerm: string) => like(column, `%${searchTerm}%`),

  /**
   * Create an "in array" filter
   */
  inArray: (column: any, values: any[]) => inArray(column, values),

  /**
   * Create multiple OR conditions
   */
  anyOf: (...conditions: any[]) => or(...conditions),

  /**
   * Create multiple AND conditions
   */
  allOf: (...conditions: any[]) => and(...conditions)
}

// Repository factory helper for creating typed repositories
export function createBaseRepository<
  TTable extends SQLiteTable,
  TEntity extends BaseEntity = InferSelectModel<TTable> & BaseEntity,
  TInsert extends Record<string, any> = InferInsertModel<TTable>
>(table: TTable, dbInstance?: DrizzleDb, schema?: any, entityName?: string): BaseRepository<TEntity, TInsert, TTable> {
  // Ensure we have a valid database instance
  const validDbInstance = dbInstance || db

  // Validate that the database instance has the required methods for Drizzle operations
  if (!validDbInstance || typeof validDbInstance.select !== 'function') {
    const instanceType = validDbInstance ? typeof validDbInstance : 'null/undefined'
    throw new Error(
      `Invalid database instance provided to repository. ` +
      `Expected Drizzle database instance with .select method, got ${instanceType}. ` +
      `This often happens when tests don't use createTestDatabase() properly.`
    )
  }

  return new BaseRepository<TEntity, TInsert, TTable>(table, validDbInstance, schema, entityName)
}

// Repository composition helper - merge BaseRepository with extensions
export function extendRepository<TBase extends BaseRepository<any, any, any>, TExtensions extends Record<string, any>>(
  baseRepository: TBase,
  extensions: TExtensions
): TBase & TExtensions {
  // Create a new object that properly preserves the base repository instance
  const extended = Object.create(Object.getPrototypeOf(baseRepository))

  // Copy all properties from the base repository instance
  Object.assign(extended, baseRepository)

  // Bind extension methods to the extended object to ensure proper context
  const boundExtensions: Record<string, any> = {}
  for (const [key, value] of Object.entries(extensions)) {
    if (typeof value === 'function') {
      // Bind the function to the extended object so it has access to the base repository methods
      boundExtensions[key] = value.bind(extended)
    } else {
      boundExtensions[key] = value
    }
  }

  // Add the bound extensions to the extended object
  Object.assign(extended, boundExtensions)

  return extended as TBase & TExtensions
}

// Re-export query operators for convenience
export {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  notLike,
  isNull,
  isNotNull,
  and,
  or,
  not,
  inArray,
  notInArray,
  exists,
  notExists,
  between,
  asc,
  desc,
  count,
  sum,
  avg,
  min,
  max
}

// Re-export types for convenience
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
