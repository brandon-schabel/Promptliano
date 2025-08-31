import { createRoute, z, OpenAPIHono } from '@hono/zod-openapi'
import { createStandardResponses, successResponse, withErrorHandling } from '../utils/route-helpers'
import { 
  createModelConfigService,
  type ModelConfigService 
} from '@promptliano/services'
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
const ModelConfigResponseSchema = z.object({
  success: z.literal(true),
  data: selectModelConfigSchema
}).openapi('ModelConfigResponse')

const ModelConfigListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(selectModelConfigSchema)
}).openapi('ModelConfigListResponse')

const ModelPresetResponseSchema = z.object({
  success: z.literal(true),
  data: selectModelPresetSchema
}).openapi('ModelPresetResponse')

const ModelPresetListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(selectModelPresetSchema)
}).openapi('ModelPresetListResponse')

const ModelPresetWithConfigResponseSchema = z.object({
  success: z.literal(true),
  data: selectModelPresetSchema.extend({
    config: selectModelConfigSchema
  })
}).openapi('ModelPresetWithConfigResponse')

const ExportDataResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    configs: z.array(selectModelConfigSchema),
    presets: z.array(selectModelPresetSchema)
  })
}).openapi('ExportDataResponse')

const ImportResultResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    configsImported: z.number(),
    presetsImported: z.number()
  })
}).openapi('ImportResultResponse')

// Request schemas
const CreateModelConfigSchema = insertModelConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

const UpdateModelConfigSchema = CreateModelConfigSchema.partial()

const CreateModelPresetSchema = insertModelPresetSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  lastUsedAt: true
})

const UpdateModelPresetSchema = CreateModelPresetSchema.partial()

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

modelConfigRoutes.openapi(
  getAllConfigsRoute,
  withErrorHandling(async (c) => {
    const configs = await modelConfigService.getAllConfigs()
    return c.json(successResponse(configs))
  })
)

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

modelConfigRoutes.openapi(
  getConfigsByProviderRoute,
  withErrorHandling(async (c) => {
    const { provider } = c.req.valid('param')
    const configs = await modelConfigService.getConfigsByProvider(provider)
    return c.json(successResponse(configs))
  })
)

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

modelConfigRoutes.openapi(
  getDefaultConfigRoute,
  withErrorHandling(async (c) => {
    const { provider } = c.req.valid('param')
    const config = await modelConfigService.getDefaultConfig(provider)
    if (!config) {
      return c.json({ success: false, error: 'No default configuration found' }, 404)
    }
    return c.json(successResponse(config))
  })
)

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

modelConfigRoutes.openapi(
  getConfigByNameRoute,
  withErrorHandling(async (c) => {
    const { name } = c.req.valid('param')
    const config = await modelConfigService.getConfigByName(name)
    if (!config) {
      return c.json({ success: false, error: 'Configuration not found' }, 404)
    }
    return c.json(successResponse(config))
  })
)

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

modelConfigRoutes.openapi(
  getConfigByIdRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const config = await modelConfigService.getConfigById(id)
    if (!config) {
      return c.json({ success: false, error: 'Configuration not found' }, 404)
    }
    return c.json(successResponse(config))
  })
)

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
      }
    }
  },
  responses: createStandardResponses(ModelConfigResponseSchema)
})

modelConfigRoutes.openapi(
  createConfigRoute,
  withErrorHandling(async (c) => {
    const data = c.req.valid('json')
    const config = await modelConfigService.createConfig(data as CreateModelConfig)
    return c.json(successResponse(config), 201)
  })
)

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

modelConfigRoutes.openapi(
  updateConfigRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const config = await modelConfigService.updateConfig(id, data as UpdateModelConfig)
    return c.json(successResponse(config))
  })
)

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
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      deleted: z.boolean()
    })
  }))
})

modelConfigRoutes.openapi(
  deleteConfigRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const { hard } = c.req.valid('query')
    const deleted = await modelConfigService.deleteConfig(id, hard)
    return c.json(successResponse({ deleted }))
  })
)

// Set default configuration
const setDefaultConfigRoute = createRoute({
  method: 'post',
  path: '/api/model-configs/{id}/set-default',
  tags: ['Model Configuration'],
  summary: 'Set configuration as default for its provider',
  request: {
    params: ConfigIdParamsSchema
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      updated: z.boolean()
    })
  }))
})

modelConfigRoutes.openapi(
  setDefaultConfigRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const config = await modelConfigService.getConfigById(id)
    if (!config) {
      return c.json({ success: false, error: 'Configuration not found' }, 404)
    }
    const updated = await modelConfigService.setDefaultConfig(id, config.provider)
    return c.json(successResponse({ updated }))
  })
)

// ==================== Model Preset Routes ====================

// Get all presets
const getAllPresetsRoute = createRoute({
  method: 'get',
  path: '/api/model-presets',
  tags: ['Model Presets'],
  summary: 'Get all model presets with configurations',
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.array(selectModelPresetSchema.extend({
      config: selectModelConfigSchema
    }))
  }))
})

modelConfigRoutes.openapi(
  getAllPresetsRoute,
  withErrorHandling(async (c) => {
    const presets = await modelConfigService.getAllPresets()
    return c.json(successResponse(presets))
  })
)

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

modelConfigRoutes.openapi(
  getPresetsByCategoryRoute,
  withErrorHandling(async (c) => {
    const { category } = c.req.valid('param')
    const presets = await modelConfigService.getPresetsByCategory(category)
    return c.json(successResponse(presets))
  })
)

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

modelConfigRoutes.openapi(
  getMostUsedPresetsRoute,
  withErrorHandling(async (c) => {
    const { limit } = c.req.valid('query')
    const presets = await modelConfigService.getMostUsedPresets(limit)
    return c.json(successResponse(presets))
  })
)

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

modelConfigRoutes.openapi(
  getRecentlyUsedPresetsRoute,
  withErrorHandling(async (c) => {
    const { limit } = c.req.valid('query')
    const presets = await modelConfigService.getRecentlyUsedPresets(limit)
    return c.json(successResponse(presets))
  })
)

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

modelConfigRoutes.openapi(
  getPresetWithConfigRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const preset = await modelConfigService.getPresetWithConfig(id)
    if (!preset) {
      return c.json({ success: false, error: 'Preset not found' }, 404)
    }
    return c.json(successResponse(preset))
  })
)

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
      }
    }
  },
  responses: createStandardResponses(ModelPresetResponseSchema)
})

modelConfigRoutes.openapi(
  createPresetRoute,
  withErrorHandling(async (c) => {
    const data = c.req.valid('json')
    const preset = await modelConfigService.createPreset(data as CreateModelPreset)
    return c.json(successResponse(preset), 201)
  })
)

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
      }
    }
  },
  responses: createStandardResponses(ModelPresetResponseSchema)
})

modelConfigRoutes.openapi(
  updatePresetRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const preset = await modelConfigService.updatePreset(id, data as UpdateModelPreset)
    return c.json(successResponse(preset))
  })
)

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
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      deleted: z.boolean()
    })
  }))
})

modelConfigRoutes.openapi(
  deletePresetRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const { hard } = c.req.valid('query')
    const deleted = await modelConfigService.deletePreset(id, hard)
    return c.json(successResponse({ deleted }))
  })
)

// Use preset (increment usage count)
const usePresetRoute = createRoute({
  method: 'post',
  path: '/api/model-presets/{id}/use',
  tags: ['Model Presets'],
  summary: 'Mark preset as used (increments usage count)',
  request: {
    params: PresetIdParamsSchema
  },
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      updated: z.boolean()
    })
  }))
})

modelConfigRoutes.openapi(
  usePresetRoute,
  withErrorHandling(async (c) => {
    const { id } = c.req.valid('param')
    const updated = await modelConfigService.usePreset(id)
    return c.json(successResponse({ updated }))
  })
)

// ==================== System Operations ====================

// Initialize system defaults
const initSystemDefaultsRoute = createRoute({
  method: 'post',
  path: '/api/model-configs/system/initialize',
  tags: ['Model Configuration'],
  summary: 'Initialize system default configurations',
  responses: createStandardResponses(z.object({
    success: z.literal(true),
    data: z.object({
      message: z.string()
    })
  }))
})

modelConfigRoutes.openapi(
  initSystemDefaultsRoute,
  withErrorHandling(async (c) => {
    await modelConfigService.initializeSystemDefaults()
    return c.json(successResponse({ message: 'System defaults initialized successfully' }))
  })
)

// Export configurations
const exportConfigurationsRoute = createRoute({
  method: 'get',
  path: '/api/model-configs/export',
  tags: ['Model Configuration'],
  summary: 'Export all configurations and presets',
  responses: createStandardResponses(ExportDataResponseSchema)
})

modelConfigRoutes.openapi(
  exportConfigurationsRoute,
  withErrorHandling(async (c) => {
    const data = await modelConfigService.exportConfigurations()
    return c.json(successResponse(data))
  })
)

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
            presets: z.array(CreateModelPresetSchema).optional()
          })
        }
      }
    }
  },
  responses: createStandardResponses(ImportResultResponseSchema)
})

modelConfigRoutes.openapi(
  importConfigurationsRoute,
  withErrorHandling(async (c) => {
    const data = c.req.valid('json')
    const result = await modelConfigService.importConfigurations(data as any)
    return c.json(successResponse(result))
  })
)