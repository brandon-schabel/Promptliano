import { createRoute, z, OpenAPIHono } from '@hono/zod-openapi'
import { createStandardResponses, createStandardResponsesWithStatus, successResponse } from '../utils/route-helpers'
import { ApiError } from '@promptliano/shared'
import { createModelConfigService } from '@promptliano/services'
import {
  selectModelConfigSchema,
  selectModelPresetSchema,
  insertModelConfigSchema,
  insertModelPresetSchema,
  type ModelConfig,
  type ModelPreset,
  type CreateModelConfig,
  type UpdateModelConfig,
  type CreateModelPreset,
  type UpdateModelPreset
} from '@promptliano/database'

// Response schemas
const ModelConfigResponseSchema = z
  .object({
    success: z.literal(true),
    data: (selectModelConfigSchema as any).openapi('ModelConfig')
  })
  .openapi('ModelConfigResponse')

const ModelConfigListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array((selectModelConfigSchema as any).openapi('ModelConfig'))
  })
  .openapi('ModelConfigListResponse')

const ModelPresetResponseSchema = z
  .object({
    success: z.literal(true),
    data: (selectModelPresetSchema as any).openapi('ModelPreset')
  })
  .openapi('ModelPresetResponse')

const ModelPresetListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array((selectModelPresetSchema as any).openapi('ModelPreset'))
  })
  .openapi('ModelPresetListResponse')

const ModelPresetWithConfigResponseSchema = z
  .object({
    success: z.literal(true),
    data: (selectModelPresetSchema as any)
      .extend({
        config: (selectModelConfigSchema as any).openapi('ModelConfig')
      })
      .openapi('ModelPresetWithConfig')
  })
  .openapi('ModelPresetWithConfigResponse')

const ExportDataResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      configs: z.array((selectModelConfigSchema as any).openapi('ModelConfig')),
      presets: z.array((selectModelPresetSchema as any).openapi('ModelPreset'))
    })
  })
  .openapi('ExportDataResponse')

const ImportResultResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      configsImported: z.number(),
      presetsImported: z.number()
    })
  })
  .openapi('ImportResultResponse')

// Request schemas
const CreateModelConfigSchema = (insertModelConfigSchema as any)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true
  })
  .openapi('CreateModelConfig')

const UpdateModelConfigSchema = CreateModelConfigSchema.partial().openapi('UpdateModelConfig')

const CreateModelPresetSchema = (insertModelPresetSchema as any)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    usageCount: true,
    lastUsedAt: true
  })
  .openapi('CreateModelPreset')

const UpdateModelPresetSchema = CreateModelPresetSchema.partial().openapi('UpdateModelPreset')

// Path parameter schemas
const ConfigIdParamsSchema = z.object({
  id: z.coerce.number()
})

const PresetIdParamsSchema = z.object({
  id: z.coerce.number()
})

// Create OpenAPI router
export const modelConfigRoutes = new OpenAPIHono()

// Service instance
const modelConfigService = createModelConfigService()

// ==================== Model Configuration Routes ====================

// Get all configurations
const getAllConfigsRoute = createRoute({
  method: 'get',
  path: '/api/model-configs',
  tags: ['Model Configuration'],
  summary: 'Get all model configurations',
  responses: createStandardResponses(ModelConfigListResponseSchema)
})

modelConfigRoutes.openapi(getAllConfigsRoute, async (c) => {
  const configs = await modelConfigService.getAllConfigs()
  return c.json(successResponse(configs), 200)
})

// Get configurations by provider
const getConfigsByProviderRoute = createRoute({
  method: 'get',
  path: '/api/model-configs/provider/{provider}',
  tags: ['Model Configuration'],
  summary: 'Get model configurations by provider',
  request: {
    params: z.object({
      provider: z.string()
    })
  },
  responses: createStandardResponses(ModelConfigListResponseSchema)
})

modelConfigRoutes.openapi(getConfigsByProviderRoute, async (c) => {
  const { provider } = c.req.valid('param')
  const configs = await modelConfigService.getConfigsByProvider(provider)
  return c.json(successResponse(configs), 200)
})

// Get default configuration for a provider
const getDefaultConfigRoute = createRoute({
  method: 'get',
  path: '/api/model-configs/provider/{provider}/default',
  tags: ['Model Configuration'],
  summary: 'Get default configuration for a provider',
  request: {
    params: z.object({
      provider: z.string()
    })
  },
  responses: createStandardResponses(ModelConfigResponseSchema)
})

modelConfigRoutes.openapi(getDefaultConfigRoute, async (c) => {
  const { provider } = c.req.valid('param')
  const config = await modelConfigService.getDefaultConfig(provider)
  if (!config) {
    throw new ApiError(404, 'No default configuration found', 'CONFIG_NOT_FOUND')
  }
  return c.json(successResponse(config), 200)
})

// Get configuration by name
const getConfigByNameRoute = createRoute({
  method: 'get',
  path: '/api/model-configs/name/{name}',
  tags: ['Model Configuration'],
  summary: 'Get configuration by name',
  request: {
    params: z.object({
      name: z.string()
    })
  },
  responses: createStandardResponses(ModelConfigResponseSchema)
})

modelConfigRoutes.openapi(getConfigByNameRoute, async (c) => {
  const { name } = c.req.valid('param')
  const config = await modelConfigService.getConfigByName(name)
  if (!config) {
    throw new ApiError(404, 'Configuration not found', 'CONFIG_NOT_FOUND')
  }
  return c.json(successResponse(config), 200)
})

// Get configuration by ID
const getConfigByIdRoute = createRoute({
  method: 'get',
  path: '/api/model-configs/{id}',
  tags: ['Model Configuration'],
  summary: 'Get configuration by ID',
  request: {
    params: ConfigIdParamsSchema
  },
  responses: createStandardResponses(ModelConfigResponseSchema)
})

modelConfigRoutes.openapi(getConfigByIdRoute, async (c) => {
  const { id } = c.req.valid('param')
  const config = await modelConfigService.getConfigById(id)
  if (!config) {
    throw new ApiError(404, 'Configuration not found', 'CONFIG_NOT_FOUND')
  }
  return c.json(successResponse(config), 200)
})

// Create configuration
const createConfigRoute = createRoute({
  method: 'post',
  path: '/api/model-configs',
  tags: ['Model Configuration'],
  summary: 'Create a new model configuration',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateModelConfigSchema
        }
      },
      required: true
    }
  },
  responses: createStandardResponsesWithStatus(ModelConfigResponseSchema, 201, 'Created')
})

modelConfigRoutes.openapi(createConfigRoute, (async (c: any) => {
  const data = c.req.valid('json')
  const config = await modelConfigService.createConfig(data as CreateModelConfig)
  return c.json(successResponse(config), 201)
}) as any)

// Update configuration
const updateConfigRoute = createRoute({
  method: 'put',
  path: '/api/model-configs/{id}',
  tags: ['Model Configuration'],
  summary: 'Update a model configuration',
  request: {
    params: ConfigIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateModelConfigSchema
        }
      }
    }
  },
  responses: createStandardResponses(ModelConfigResponseSchema)
})

modelConfigRoutes.openapi(updateConfigRoute, async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const config = await modelConfigService.updateConfig(id, data as UpdateModelConfig)
  return c.json(successResponse(config), 200)
})

// Delete configuration
const deleteConfigRoute = createRoute({
  method: 'delete',
  path: '/api/model-configs/{id}',
  tags: ['Model Configuration'],
  summary: 'Delete a model configuration',
  request: {
    params: ConfigIdParamsSchema,
    query: z.object({
      hard: z.coerce.boolean().optional().default(false)
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        deleted: z.boolean()
      })
    })
  )
})

modelConfigRoutes.openapi(deleteConfigRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { hard } = c.req.valid('query')
  const deleted = await modelConfigService.deleteConfig(id, hard)
  return c.json(successResponse({ deleted }), 200)
})

// Set default configuration
const setDefaultConfigRoute = createRoute({
  method: 'post',
  path: '/api/model-configs/{id}/set-default',
  tags: ['Model Configuration'],
  summary: 'Set configuration as default for its provider',
  request: {
    params: ConfigIdParamsSchema
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        updated: z.boolean()
      })
    })
  )
})

modelConfigRoutes.openapi(setDefaultConfigRoute, async (c) => {
  const { id } = c.req.valid('param')
  const config = await modelConfigService.getConfigById(id)
  if (!config) {
    throw new ApiError(404, 'Configuration not found', 'CONFIG_NOT_FOUND')
  }
  const updated = await modelConfigService.setDefaultConfig(id, config.provider)
  return c.json(successResponse({ updated }), 200)
})

// ==================== Model Preset Routes ====================

// Get all presets
const getAllPresetsRoute = createRoute({
  method: 'get',
  path: '/api/model-presets',
  tags: ['Model Presets'],
  summary: 'Get all model presets with configurations',
  responses: createStandardResponses(
    z
      .object({
        success: z.literal(true),
        data: z.array(
          (selectModelPresetSchema as any)
            .extend({
              config: (selectModelConfigSchema as any).openapi('ModelConfig')
            })
            .openapi('ModelPresetWithConfig')
        )
      })
      .openapi('ModelPresetsWithConfigResponse')
  )
})

modelConfigRoutes.openapi(getAllPresetsRoute, async (c) => {
  const presets = await modelConfigService.getAllPresets()
  return c.json(successResponse(presets), 200)
})

// Get presets by category
const getPresetsByCategoryRoute = createRoute({
  method: 'get',
  path: '/api/model-presets/category/{category}',
  tags: ['Model Presets'],
  summary: 'Get presets by category',
  request: {
    params: z.object({
      category: z.enum(['general', 'coding', 'creative', 'analysis', 'custom'])
    })
  },
  responses: createStandardResponses(ModelPresetListResponseSchema)
})

modelConfigRoutes.openapi(getPresetsByCategoryRoute, async (c) => {
  const { category } = c.req.valid('param')
  const presets = await modelConfigService.getPresetsByCategory(category)
  return c.json(successResponse(presets), 200)
})

// Get most used presets
const getMostUsedPresetsRoute = createRoute({
  method: 'get',
  path: '/api/model-presets/most-used',
  tags: ['Model Presets'],
  summary: 'Get most used presets',
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(20).optional().default(5)
    })
  },
  responses: createStandardResponses(ModelPresetListResponseSchema)
})

modelConfigRoutes.openapi(getMostUsedPresetsRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const presets = await modelConfigService.getMostUsedPresets(limit)
  return c.json(successResponse(presets), 200)
})

// Get recently used presets
const getRecentlyUsedPresetsRoute = createRoute({
  method: 'get',
  path: '/api/model-presets/recently-used',
  tags: ['Model Presets'],
  summary: 'Get recently used presets',
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(20).optional().default(5)
    })
  },
  responses: createStandardResponses(ModelPresetListResponseSchema)
})

modelConfigRoutes.openapi(getRecentlyUsedPresetsRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const presets = await modelConfigService.getRecentlyUsedPresets(limit)
  return c.json(successResponse(presets), 200)
})

// Get preset with configuration
const getPresetWithConfigRoute = createRoute({
  method: 'get',
  path: '/api/model-presets/{id}',
  tags: ['Model Presets'],
  summary: 'Get preset with its configuration',
  request: {
    params: PresetIdParamsSchema
  },
  responses: createStandardResponses(ModelPresetWithConfigResponseSchema)
})

modelConfigRoutes.openapi(getPresetWithConfigRoute, async (c) => {
  const { id } = c.req.valid('param')
  const preset = await modelConfigService.getPresetWithConfig(id)
  if (!preset) {
    throw new ApiError(404, 'Preset not found', 'PRESET_NOT_FOUND')
  }
  return c.json(successResponse(preset), 200)
})

// Create preset
const createPresetRoute = createRoute({
  method: 'post',
  path: '/api/model-presets',
  tags: ['Model Presets'],
  summary: 'Create a new model preset',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateModelPresetSchema
        }
      },
      required: true
    }
  },
  responses: createStandardResponsesWithStatus(ModelPresetResponseSchema, 201, 'Created')
})

modelConfigRoutes.openapi(createPresetRoute, (async (c: any) => {
  const data = c.req.valid('json')
  const preset = await modelConfigService.createPreset(data as CreateModelPreset)
  return c.json(successResponse(preset), 201)
}) as any)

// Update preset
const updatePresetRoute = createRoute({
  method: 'put',
  path: '/api/model-presets/{id}',
  tags: ['Model Presets'],
  summary: 'Update a model preset',
  request: {
    params: PresetIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateModelPresetSchema
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(ModelPresetResponseSchema)
})

modelConfigRoutes.openapi(updatePresetRoute, async (c) => {
  const { id } = c.req.valid('param')
  const data = c.req.valid('json')
  const preset = await modelConfigService.updatePreset(id, data as UpdateModelPreset)
  return c.json(successResponse(preset), 200)
})

// Delete preset
const deletePresetRoute = createRoute({
  method: 'delete',
  path: '/api/model-presets/{id}',
  tags: ['Model Presets'],
  summary: 'Delete a model preset',
  request: {
    params: PresetIdParamsSchema,
    query: z.object({
      hard: z.coerce.boolean().optional().default(false)
    })
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        deleted: z.boolean()
      })
    })
  )
})

modelConfigRoutes.openapi(deletePresetRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { hard } = c.req.valid('query')
  const deleted = await modelConfigService.deletePreset(id, hard)
  return c.json(successResponse({ deleted }), 200)
})

// Use preset (increment usage count)
const usePresetRoute = createRoute({
  method: 'post',
  path: '/api/model-presets/{id}/use',
  tags: ['Model Presets'],
  summary: 'Mark preset as used (increments usage count)',
  request: {
    params: PresetIdParamsSchema
  },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        updated: z.boolean()
      })
    })
  )
})

modelConfigRoutes.openapi(usePresetRoute, async (c) => {
  const { id } = c.req.valid('param')
  const updated = await modelConfigService.usePreset(id)
  return c.json(successResponse({ updated }), 200)
})

// ==================== System Operations ====================

// Initialize system defaults
const initSystemDefaultsRoute = createRoute({
  method: 'post',
  path: '/api/model-configs/system/initialize',
  tags: ['Model Configuration'],
  summary: 'Initialize system default configurations',
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({
        message: z.string()
      })
    })
  )
})

modelConfigRoutes.openapi(initSystemDefaultsRoute, async (c) => {
  await modelConfigService.initializeSystemDefaults()
  return c.json(successResponse({ message: 'System defaults initialized successfully' }), 200)
})

// Export configurations
const exportConfigurationsRoute = createRoute({
  method: 'get',
  path: '/api/model-configs/export',
  tags: ['Model Configuration'],
  summary: 'Export all configurations and presets',
  responses: createStandardResponses(ExportDataResponseSchema)
})

modelConfigRoutes.openapi(exportConfigurationsRoute, async (c) => {
  const data = await modelConfigService.exportConfigurations()
  return c.json(successResponse(data), 200)
})

// Import configurations
const importConfigurationsRoute = createRoute({
  method: 'post',
  path: '/api/model-configs/import',
  tags: ['Model Configuration'],
  summary: 'Import configurations and presets',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            configs: z.array(CreateModelConfigSchema).optional(),
            presets: z.array(CreateModelPresetSchema as any).optional()
          })
        }
      },
      required: true
    }
  },
  responses: createStandardResponses(ImportResultResponseSchema)
})

modelConfigRoutes.openapi(importConfigurationsRoute, async (c) => {
  const data = c.req.valid('json')
  const result = await modelConfigService.importConfigurations(data as any)
  return c.json(successResponse(result), 200)
})
