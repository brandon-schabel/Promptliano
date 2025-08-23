import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { ApiError } from '@promptliano/shared'
import { createStandardResponses, createStandardResponsesWithStatus, successResponse, operationSuccessResponse } from '../utils/route-helpers'
import {
  type ProviderKey
} from '@promptliano/database'
import {
  CreateProviderKeyBodySchema,
  UpdateProviderKeyBodySchema,
  ProviderKeyIdParamsSchema,
  ProviderKeyResponseSchema,
  ProviderKeyListResponseSchema,
  TestProviderRequestSchema,
  TestProviderApiResponseSchema,
  BatchTestProviderRequestSchema,
  BatchTestProviderApiResponseSchema,
  ProviderHealthStatusListResponseSchema,
  ValidateCustomProviderRequestSchema,
  ValidateCustomProviderResponseSchema
} from '@promptliano/schemas'
import { providerKeyService, validateCustomProvider } from '@promptliano/services'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { updateProviderSettings } from '@promptliano/services'

const createProviderKeyRoute = createRoute({
  method: 'post',
  path: '/api/keys',
  tags: ['Provider Keys'],
  summary: 'Add a new API key for an AI provider',
  request: {
    body: {
      content: { 'application/json': { schema: CreateProviderKeyBodySchema } },
      required: true
    }
  },
  responses: createStandardResponsesWithStatus(ProviderKeyResponseSchema, 201, 'Provider key created successfully')
})

const listProviderKeysRoute = createRoute({
  method: 'get',
  path: '/api/keys',
  tags: ['Provider Keys'],
  summary: 'List all configured provider keys (excluding secrets)',
  responses: createStandardResponses(ProviderKeyListResponseSchema)
})

const getProviderKeyByIdRoute = createRoute({
  method: 'get',
  path: '/api/keys/{keyId}',
  tags: ['Provider Keys'],
  summary: 'Get a specific provider key by ID (including secret)',
  request: {
    params: ProviderKeyIdParamsSchema
  },
  responses: createStandardResponses(ProviderKeyResponseSchema)
})

const updateProviderKeyRoute = createRoute({
  method: 'patch',
  path: '/api/keys/{keyId}',
  tags: ['Provider Keys'],
  summary: "Update a provider key's details",
  request: {
    params: ProviderKeyIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateProviderKeyBodySchema } },
      required: true
    }
  },
  responses: createStandardResponses(ProviderKeyResponseSchema)
})

const deleteProviderKeyRoute = createRoute({
  method: 'delete',
  path: '/api/keys/{keyId}',
  tags: ['Provider Keys'],
  summary: 'Delete a provider key',
  request: {
    params: ProviderKeyIdParamsSchema
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

const testProviderRoute = createRoute({
  method: 'post',
  path: '/api/providers/test',
  tags: ['Provider Testing'],
  summary: 'Test a single provider connection',
  description: 'Test the connection to a specific AI provider and retrieve available models',
  request: {
    body: {
      content: { 'application/json': { schema: TestProviderRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(TestProviderApiResponseSchema)
})

const batchTestProviderRoute = createRoute({
  method: 'post',
  path: '/api/providers/batch-test',
  tags: ['Provider Testing'],
  summary: 'Test multiple providers at once',
  description: 'Test connections to multiple AI providers in parallel or sequentially',
  request: {
    body: {
      content: { 'application/json': { schema: BatchTestProviderRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(BatchTestProviderApiResponseSchema)
})

const providerHealthRoute = createRoute({
  method: 'get',
  path: '/api/providers/health',
  tags: ['Provider Testing'],
  summary: 'Get health status of all configured providers',
  description: 'Retrieve health status information for all configured AI providers',
  request: {
    query: z.object({
      refresh: z
        .string()
        .optional()
        .transform((val) => val === 'true')
        .pipe(z.boolean().optional())
        .openapi({
          param: {
            name: 'refresh',
            in: 'query',
            description: 'Force fresh health check instead of using cached data'
          },
          example: 'true'
        })
    })
  },
  responses: createStandardResponses(ProviderHealthStatusListResponseSchema)
})

// Schema for provider settings update
const ProviderSettingsSchema = z.object({
  ollamaUrl: z.string().optional(),
  lmstudioUrl: z.string().optional()
})

const updateProviderSettingsRoute = createRoute({
  method: 'put',
  path: '/api/providers/settings',
  tags: ['Provider Settings'],
  summary: 'Update provider settings (URLs for local providers)',
  description: 'Update custom URLs for local AI providers like Ollama and LMStudio',
  request: {
    body: {
      content: { 'application/json': { schema: ProviderSettingsSchema } },
      required: true
    }
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

export const providerKeyRoutes = new OpenAPIHono()
  .openapi(createProviderKeyRoute, (async (c: Context) => {
    const body = (c.req as any).valid('json')
    const createKeyInput = {
      ...body,
      encrypted: false,
      isActive: true,
      environment: 'production',
      isDefault: body.isDefault ?? false
    }
    const newKey = await providerKeyService.createKey(createKeyInput)
    return c.json(successResponse(newKey), 201)
  }) as any)

  .openapi(listProviderKeysRoute, async (c) => {
    const keys = await providerKeyService.listKeysCensoredKeys()
    return c.json(successResponse(keys), 200)
  })

  .openapi(getProviderKeyByIdRoute, async (c) => {
    const { keyId } = c.req.valid('param')
    const key = await providerKeyService.getKeyById(keyId)
    if (!key) {
      throw new ApiError(404, 'Provider key not found', 'PROVIDER_KEY_NOT_FOUND')
    }
    return c.json(successResponse(key), 200)
  })

  .openapi(updateProviderKeyRoute, async (c) => {
    const { keyId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedKey = await providerKeyService.updateKey(keyId, body)
    return c.json(successResponse(updatedKey), 200)
  })

  .openapi(deleteProviderKeyRoute, async (c) => {
    const { keyId } = c.req.valid('param')
    await providerKeyService.deleteKey(keyId)
    return c.json(operationSuccessResponse('Key deleted successfully.'), 200)
  })

  .openapi(testProviderRoute, async (c) => {
    const body = c.req.valid('json')
    const testResult = await providerKeyService.testProvider(body)
    return c.json(successResponse(testResult), 200)
  })

  .openapi(batchTestProviderRoute, async (c) => {
    const body = c.req.valid('json')
    const batchResult = await providerKeyService.batchTestProviders(body)
    return c.json(successResponse(batchResult), 200)
  })

  .openapi(providerHealthRoute, async (c) => {
    const { refresh } = c.req.valid('query')
    const healthStatuses = await providerKeyService.getProviderHealthStatus(refresh)
    return c.json(successResponse(healthStatuses), 200)
  })

  .openapi(updateProviderSettingsRoute, async (c) => {
    const body = c.req.valid('json')

    // Transform and update the provider settings with custom URLs
    const settings = {
      ollamaUrl: body.ollamaUrl,
      lmstudioUrl: body.lmstudioUrl,
      lastUpdated: Date.now()
    }
    updateProviderSettings(settings)

    return c.json(operationSuccessResponse('Provider settings updated successfully'), 200)
  })

// Validate custom provider route
const validateCustomProviderRoute = createRoute({
  method: 'post',
  path: '/api/keys/validate-custom',
  tags: ['Provider Keys'],
  summary: 'Validate a custom OpenAI-compatible provider',
  request: {
    body: {
      content: { 'application/json': { schema: ValidateCustomProviderRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(ValidateCustomProviderResponseSchema)
})

providerKeyRoutes.openapi(validateCustomProviderRoute, async (c) => {
  const body = c.req.valid('json')
  
  try {
    const result = await validateCustomProvider(body)
    
    return c.json(successResponse(result), 200)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      500,
      'Failed to validate custom provider',
      'CUSTOM_PROVIDER_VALIDATION_ERROR',
      error instanceof Error ? { error: error.message } : undefined
    )
  }
})

export type ProviderKeyRouteTypes = typeof providerKeyRoutes
