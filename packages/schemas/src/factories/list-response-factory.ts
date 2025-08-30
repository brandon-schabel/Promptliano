import { z } from '@hono/zod-openapi'

/**
 * Creates a list response schema for arrays of items
 */
export function createListResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  options?: {
    description?: string
    includeCount?: boolean
    includeFilters?: boolean
    additionalFields?: Record<string, z.ZodTypeAny>
    name?: string
  }
) {
  const schemaName = options?.name || itemSchema._def.description || 'Item'
  
  const baseSchema: Record<string, z.ZodTypeAny> = {
    success: z.literal(true),
    data: z.array(itemSchema).describe(`List of ${schemaName}s`)
  }
  
  // Add optional count
  if (options?.includeCount) {
    baseSchema['count'] = z.number().int().min(0).describe('Total number of items')
  }
  
  // Add optional filters that were applied
  if (options?.includeFilters) {
    baseSchema['appliedFilters'] = z.record(z.any()).optional().describe('Filters applied to the list')
  }
  
  // Add any additional fields
  if (options?.additionalFields) {
    Object.assign(baseSchema, options.additionalFields)
  }
  
  const responseSchema = z.object(baseSchema)
  
  return responseSchema.openapi(`${schemaName}ListResponse`, {
    description: options?.description || `List of ${schemaName}s`,
    example: {
      success: true,
      data: [itemSchema._def.example || {}],
      ...(options?.includeCount && { count: 10 }),
      ...(options?.includeFilters && { appliedFilters: {} })
    }
  })
}

/**
 * Creates a grouped list response
 */
export function createGroupedListResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  groupKey: string,
  name?: string
) {
  const schemaName = name || itemSchema._def.description || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.record(z.array(itemSchema)),
    groupedBy: z.literal(groupKey),
    groupCount: z.number().int().min(0)
  }).openapi(`${schemaName}GroupedListResponse`)
}

/**
 * Creates a tree/hierarchical response
 */
export function createTreeResponseSchema<T extends z.ZodTypeAny>(
  nodeSchema: T,
  name?: string
) {
  const schemaName = name || nodeSchema._def.description || 'Node'
  
  // Create recursive tree node schema
  const TreeNode: z.ZodSchema<any> = z.lazy(() =>
    z.object({
      ...(nodeSchema as any).shape,
      children: z.array(TreeNode).optional()
    })
  )
  
  return createListResponseSchema(TreeNode, {
    description: 'Hierarchical tree structure',
    name: `${schemaName}Tree`
  })
}

/**
 * Creates a categorized list response
 */
export function createCategorizedListResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  categorySchema: z.ZodTypeAny,
  name?: string
) {
  const schemaName = name || itemSchema._def.description || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.object({
      categories: z.array(categorySchema),
      items: z.array(itemSchema),
      itemsByCategory: z.record(z.array(z.number())).describe('Map of category ID to item indices')
    })
  }).openapi(`${schemaName}CategorizedListResponse`)
}

/**
 * Creates a filtered list response with metadata about the filters
 */
export function createFilteredListResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  filterSchema: z.ZodTypeAny,
  name?: string
) {
  const schemaName = name || itemSchema._def.description || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    filters: filterSchema.describe('Active filters'),
    totalCount: z.number().int().min(0).describe('Total items before filtering'),
    filteredCount: z.number().int().min(0).describe('Items after filtering'),
    availableFilters: z.record(z.array(z.string())).optional().describe('Available filter options')
  }).openapi(`${schemaName}FilteredListResponse`)
}

/**
 * Creates a list response with summary statistics
 */
export function createListWithStatsResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  statsSchema: z.ZodTypeAny,
  name?: string
) {
  const schemaName = name || itemSchema._def.description || 'Item'
  
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    stats: statsSchema.describe('Summary statistics')
  }).openapi(`${schemaName}ListWithStatsResponse`)
}

/**
 * Creates an empty list response with a reason
 */
export function createEmptyListResponseSchema(
  reason?: string,
  name?: string
) {
  return z.object({
    success: z.literal(true),
    data: z.array(z.never()).default([]),
    message: z.string().default(reason || 'No items found'),
    isEmpty: z.literal(true)
  }).openapi(`${name || 'Empty'}ListResponse`)
}