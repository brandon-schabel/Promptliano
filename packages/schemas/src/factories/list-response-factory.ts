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
 * Creates a tree/hierarchical response (simplified flat structure for OpenAPI compatibility)
 */
export function createTreeResponseSchema<T extends z.ZodTypeAny>(
  nodeSchema: T,
  name?: string
) {
  const schemaName = name || nodeSchema._def.description || 'Node'
  
  // Create a simplified flat tree node schema that OpenAPI can handle
  const TreeNode = z.object({
    node: nodeSchema,
    parentId: z.number().optional().describe('Parent node ID for hierarchical relationship'),
    level: z.number().int().min(0).describe('Depth level in the tree (0 = root)'),
    hasChildren: z.boolean().describe('Whether this node has children'),
    childrenCount: z.number().int().min(0).optional().describe('Number of direct children')
  }).openapi(`${schemaName}TreeNode`, {
    description: `Flattened tree node for ${schemaName} - use parentId to reconstruct hierarchy`,
    example: {
      node: { id: 1, name: 'Example Node' },
      parentId: null,
      level: 0,
      hasChildren: true,
      childrenCount: 2
    }
  })
  
  return createListResponseSchema(TreeNode, {
    description: 'Flattened hierarchical structure - reconstruct tree using parentId and level',
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