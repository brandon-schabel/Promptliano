/**
 * Official Schema Factory - drizzle-zod v0.8.0+ with @hono/zod-openapi Integration
 *
 * This module provides the official createSchemaFactory from drizzle-zod v0.8.0+
 * configured to use @hono/zod-openapi's extended Zod instance.
 *
 * This ensures all generated schemas are compatible with Hono's OpenAPI system
 * and eliminates ZodLazy prototype mismatch issues.
 */

import { createSchemaFactory } from 'drizzle-zod'
import { z } from '@hono/zod-openapi'

/**
 * Use drizzle-zod's factory with @hono/zod-openapi's Zod instance.
 * This ensures all generated schemas carry OpenAPI metadata and avoid ZodLazy mismatches.
 */
export const { createInsertSchema, createSelectSchema, createUpdateSchema } = createSchemaFactory({
  zodInstance: z
})

/**
 * Helper type for table transformations with OpenAPI metadata support
 */
export type TableTransform = Partial<Record<string, (schema: any) => any>>

/**
 * Creates typed schemas with OpenAPI metadata support
 * @param table - Drizzle table definition
 * @param transforms - Optional field transformations with OpenAPI metadata
 * @returns Object containing select, insert, and update schemas
 */
export const createTypedSchemas = (table: any, transforms?: TableTransform) => ({
  select: createSelectSchema(table, transforms),
  insert: createInsertSchema(table, transforms),
  update: createUpdateSchema(table, transforms)
})
