/**
 * Base Repository Pattern - Replaces BaseStorage with Drizzle ORM
 * Provides common CRUD operations with full type safety and performance optimization
 */

import { eq, ne, gt, gte, lt, lte, like, notLike, isNull, isNotNull, and, or, not, inArray, notInArray, exists, notExists, between, asc, desc, count, sum, avg, min, max } from 'drizzle-orm'
import { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { db, type DrizzleDb, type DrizzleTransaction } from '../db'
import { z } from 'zod'
import { ErrorFactory, assertExists, assertDatabaseOperation, createErrorHandler } from '@promptliano/shared/src/error/error-factory'

export type BaseEntity = {
  id: number
  createdAt: number
  updatedAt: number
}

export type InsertBaseEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Generic repository class for common database operations
 */
export class BaseRepository<
  TEntity extends BaseEntity,
  TInsert extends Record<string, any> = InsertBaseEntity<TEntity>,
  TTable extends SQLiteTable = SQLiteTable
> {
  protected readonly errorHandler: ReturnType<typeof createErrorHandler>

  constructor(
    protected readonly table: TTable,
    protected readonly schema?: z.ZodSchema<TEntity>,
    protected readonly entityName: string = table._.name
  ) {
    this.errorHandler = createErrorHandler(this.entityName)
  }

  /**
   * Create a new entity
   */
  async create(data: TInsert): Promise<TEntity> {
    return this.errorHandler.withContext(async () => {
      const now = Date.now()
      const [entity] = await db.insert(this.table).values({
        ...data,
        createdAt: now,
        updatedAt: now
      } as any).returning()
      
      assertDatabaseOperation(entity, 'create', `Failed to create ${this.entityName}`)
      return this.validateEntity(entity)
    }, 'create')
  }

  /**
   * Get entity by ID
   */
  async getById(id: number): Promise<TEntity | null> {
    return this.errorHandler.withContext(async () => {
      const [entity] = await db.select()
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
    const entities = await db.select()
      .from(this.table)
      .orderBy(orderBy === 'desc' ? desc((this.table as any).createdAt) : asc((this.table as any).createdAt))
    
    return entities.map(e => this.validateEntity(e))
  }

  /**
   * Update entity by ID
   */
  async update(id: number, data: Partial<TInsert>): Promise<TEntity> {
    return this.errorHandler.withContext(async () => {
      const [updated] = await db.update(this.table)
        .set({
          ...data,
          updatedAt: Date.now()
        } as any)
        .where(eq((this.table as any).id, id))
        .returning()
      
      if (!updated) {
        throw ErrorFactory.updateFailed(this.entityName, id, 'No rows affected')
      }
      
      return this.validateEntity(updated)
    }, 'update')
  }

  /**
   * Delete entity by ID
   */
  async delete(id: number): Promise<boolean> {
    return this.errorHandler.withContext(async () => {
      const result = await db.delete(this.table)
        .where(eq((this.table as any).id, id))
        .run() as unknown as { changes: number }
      
      return result.changes > 0
    }, 'delete')
  }

  /**
   * Check if entity exists
   */
  async exists(id: number): Promise<boolean> {
    const [result] = await db.select({ count: count() })
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1)
    
    return (result?.count ?? 0) > 0
  }

  /**
   * Count entities with optional where clause
   */
  async count(where?: any): Promise<number> {
    const query = db.select({ count: count() }).from(this.table)
    
    if (where) {
      query.where(where)
    }
    
    const [result] = await query
    return result?.count ?? 0
  }

  /**
   * Create many entities in a single transaction
   */
  async createMany(items: TInsert[]): Promise<TEntity[]> {
    return this.errorHandler.withContext(async () => {
      if (items.length === 0) return []
      
      const now = Date.now()
      const values = items.map(item => ({
        ...item,
        createdAt: now,
        updatedAt: now
      }))

      const entities = await db.insert(this.table).values(values as any).returning()
      assertDatabaseOperation(entities, 'createMany', `Failed to create ${items.length} ${this.entityName} entities`)
      return entities.map(e => this.validateEntity(e))
    }, 'createMany')
  }

  /**
   * Update many entities by IDs
   */
  async updateMany(ids: number[], data: Partial<TInsert>): Promise<TEntity[]> {
    if (ids.length === 0) return []
    
    const entities = await db.update(this.table)
      .set({
        ...data,
        updatedAt: Date.now()
      } as any)
      .where(inArray((this.table as any).id, ids))
      .returning()
    
    return entities.map(e => this.validateEntity(e))
  }

  /**
   * Delete many entities by IDs
   */
  async deleteMany(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0
    
    const result = await db.delete(this.table)
      .where(inArray((this.table as any).id, ids))
      .run() as unknown as { changes: number }
    
    return result.changes
  }

  /**
   * Find entities with custom where clause
   */
  async findWhere(where: any): Promise<TEntity[]> {
    const entities = await db.select()
      .from(this.table)
      .where(where)
      .orderBy(desc((this.table as any).createdAt))
    
    return entities.map(e => this.validateEntity(e))
  }

  /**
   * Find single entity with custom where clause
   */
  async findOneWhere(where: any): Promise<TEntity | null> {
    const [entity] = await db.select()
      .from(this.table)
      .where(where)
      .limit(1)
    
    return entity ? this.validateEntity(entity) : null
  }

  /**
   * Paginated query
   */
  async paginate(page: number = 1, limit: number = 10, where?: any): Promise<{
    data: TEntity[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const offset = (page - 1) * limit
    
    // Get total count
    const countQuery = db.select({ count: count() }).from(this.table)
    if (where) countQuery.where(where)
    const countResult = await countQuery
    const total = countResult[0]?.count ?? 0
    
    // Get paginated data
    const dataQuery = db.select()
      .from(this.table)
      .orderBy(desc((this.table as any).createdAt))
      .limit(limit)
      .offset(offset)
    
    if (where) dataQuery.where(where)
    const entities = await dataQuery
    
    return {
      data: entities.map(e => this.validateEntity(e)),
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
    return queryFn(this.table, db)
  }

  /**
   * Batch upsert (insert or update)
   */
  async upsert(data: TInsert, conflictColumns: string[] = ['id']): Promise<TEntity> {
    // SQLite doesn't have native UPSERT, so we use INSERT OR REPLACE
    const now = Date.now()
    const [entity] = await db.insert(this.table)
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
  async transaction<T>(
    callback: (tx: DrizzleTransaction) => Promise<T>
  ): Promise<T> {
    return db.transaction(callback)
  }

  /**
   * Validate entity using Zod schema (if provided)
   */
  protected validateEntity(entity: any): TEntity {
    if (this.schema) {
      const result = this.schema.safeParse(entity)
      if (!result.success) {
        console.warn('Entity validation failed:', result.error.errors)
        throw ErrorFactory.validationFailed(result.error, { 
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
    return db
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
    const query = db.select().from(this.table)
    
    if (!includeDeleted) {
      query.where(eq((this.table as any).deletedAt, null))
    }
    
    query.orderBy(orderBy === 'desc' ? desc((this.table as any).createdAt) : asc((this.table as any).createdAt))
    
    const entities = await query
    return entities.map(e => this.validateEntity(e))
  }

  /**
   * Soft delete (mark as deleted without removing from database)
   */
  async softDelete(id: number): Promise<TEntity> {
    const [deleted] = await db.update(this.table)
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
    const [restored] = await db.update(this.table)
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
    const entities = await db.select()
      .from(this.table)
      .where(ne((this.table as any).deletedAt, null))
      .orderBy(desc((this.table as any).deletedAt))
    
    return entities.map(e => this.validateEntity(e))
  }
}

// Helper functions for common query patterns
export const queryHelpers = {
  /**
   * Create a date range filter
   */
  dateRange: (column: any, startDate: number, endDate: number) => 
    and(gte(column, startDate), lte(column, endDate)),

  /**
   * Create a text search filter (case-insensitive)
   */
  textSearch: (column: any, searchTerm: string) => 
    like(column, `%${searchTerm}%`),

  /**
   * Create an "in array" filter
   */
  inArray: (column: any, values: any[]) => 
    inArray(column, values),

  /**
   * Create multiple OR conditions
   */
  anyOf: (...conditions: any[]) => or(...conditions),

  /**
   * Create multiple AND conditions
   */
  allOf: (...conditions: any[]) => and(...conditions),
}

// Re-export query operators for convenience
export { eq, ne, gt, gte, lt, lte, like, notLike, isNull, isNotNull, and, or, not, inArray, notInArray, exists, notExists, between, asc, desc, count, sum, avg, min, max }