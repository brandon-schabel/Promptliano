import { createRoute, z } from '@hono/zod-openapi'

import { ApiError } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { createStandardResponses, successResponse } from '../utils/route-helpers'
import { ModelsQuerySchema } from '@promptliano/schemas'
import {
  AiGenerateTextRequestSchema,
  AiGenerateTextResponseSchema,
  AiGenerateStructuredRequestSchema,
  AiGenerateStructuredResponseSchema,
  type StructuredDataSchemaConfig,
  ModelsListResponseSchema,
  structuredDataSchemas
} from '@promptliano/schemas'

import { OpenAPIHono } from '@hono/zod-openapi'
import {
  generateSingleText,
  generateStructuredData,
  genTextStream,
  providerKeyService,
  updateProviderSettings,
  handleChatMessage
} from '@promptliano/services' // Import the service instance
import { type APIProviders, type ProviderKey } from '@promptliano/database'
import { type ProviderKeysConfig, ModelFetcherService } from '@promptliano/services'
import { OLLAMA_BASE_URL, LMSTUDIO_BASE_URL } from '@promptliano/services/src/model-providers/provider-defaults'
import { stream } from 'hono/streaming'

// Define the Zod schema for filename suggestions
const FilenameSuggestionSchema = z
  .object({
    suggestions: z
      .array(z.string())
      .length(5)
      .openapi({
        description: 'An array of exactly 5 suggested filenames.',
        example: ['stringUtils.ts', 'textHelpers.ts', 'stringManipulators.ts', 'strUtils.ts', 'stringLib.ts']
      }),
    reasoning: z.string().optional().openapi({
      description: 'Brief reasoning for the suggestions.',
      example: 'Suggestions focus on clarity and common naming conventions for utility files.'
    })
  })
  .openapi('FilenameSuggestionOutput')

const ProvidersListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        isCustom: z.boolean().optional(),
        baseUrl: z.string().optional()
      })
    )
  })
  .openapi('ProvidersListResponse')

// Vercel AI SDK-compatible chat request schema (messages-based)
const AiSdkChatRequestSchema = z
  .object({
    id: z.string().optional().describe('Chat/session identifier (maps to chatId)'),
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string()
        })
      )
      .min(1),
    provider: z.string().optional().default('openai'),
    model: z.string(),
    temperature: z.number().optional(),
    maxTokens: z.number().int().optional(),
    topP: z.number().optional()
  })
  .openapi('AiSdkChatRequest')

// Use the imported structuredDataSchemas from @promptliano/schemas
// which now includes all our asset generators

const getProvidersRoute = createRoute({
  method: 'get',
  path: '/api/providers',
  tags: ['AI'],
  summary: 'Get all available providers including custom ones',
  responses: createStandardResponses(ProvidersListResponseSchema)
})

const getModelsRoute = createRoute({
  method: 'get',
  path: '/api/models',
  tags: ['AI'],
  summary: 'List available AI models for a provider',
  request: {
    query: ModelsQuerySchema
  },
  responses: createStandardResponses(ModelsListResponseSchema)
})

// AI SDK chat endpoint compatible with @ai-sdk/react useChat
const postAiChatSdkRoute = createRoute({
  method: 'post',
  path: '/api/ai/chat',
  tags: ['AI'],
  summary: 'Chat completion (Vercel AI SDK compatible, streaming)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AiSdkChatRequestSchema
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({ description: 'Stream of response tokens (Vercel AI SDK format)' })
        }
      },
      description: 'Successfully initiated AI response stream.'
    },
    400: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Bad request - invalid chat request parameters.'
    },
    500: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Internal server error.'
    }
  }
})

const generateTextRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/text',
  tags: ['GenAI'],
  summary: 'Generate text using a specified model and prompt',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(AiGenerateTextResponseSchema)
})

const generateStreamRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/stream',
  tags: ['GenAI'],
  summary: 'Generate text using a specified model and prompt',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'text/event-stream': {
          // Standard content type for SSE/streaming text
          schema: z.string().openapi({ description: 'Stream of response tokens (Vercel AI SDK format)' })
        }
      },
      description: 'Successfully initiated AI response stream.'
    }
  }
})

const generateStructuredRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/structured',
  tags: ['GenAI'],
  summary: 'Generate structured data based on a predefined schema key and user input',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateStructuredRequestSchema } },
      required: true
    }
  },
  responses: createStandardResponses(AiGenerateStructuredResponseSchema)
})

const postAiGenerateTextRoute = createRoute({
  method: 'post',
  path: '/api/ai/generate/text',
  tags: ['AI'],
  summary: 'Generate text (one-off, non-streaming)',
  description:
    'Generates text based on a prompt using the specified provider and model. Does not use chat history or save messages.',
  request: {
    body: {
      content: {
        'application/json': { schema: AiGenerateTextRequestSchema } // Use the NEW schema
      },
      required: true,
      description: 'Prompt, provider, model, and options for text generation.'
    }
  },
  responses: createStandardResponses(AiGenerateTextResponseSchema)
})

// Schema for updating provider settings
const UpdateProviderSettingsSchema = z
  .object({
    ollamaUrl: z.string().url().optional(),
    lmstudioUrl: z.string().url().optional()
  })
  .openapi('UpdateProviderSettings')

const updateProviderSettingsRoute = createRoute({
  method: 'post',
  path: '/api/provider-settings',
  tags: ['AI'],
  summary: 'Update provider settings',
  description: 'Updates custom URLs for local AI providers like Ollama and LMStudio',
  request: {
    body: {
      content: {
        'application/json': { schema: UpdateProviderSettingsSchema }
      },
      required: true,
      description: 'Provider settings to update'
    }
  },
  responses: createStandardResponses(
    OperationSuccessResponseSchema.extend({
      data: UpdateProviderSettingsSchema
    })
  )
})

export const genAiRoutes = new OpenAPIHono()
  .openapi(postAiChatSdkRoute, async (c) => {
    const body = c.req.valid('json') as z.infer<typeof AiSdkChatRequestSchema>

    // Extract the most recent user message and optional system message
    const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
    const systemMsg = body.messages.find((m) => m.role === 'system')?.content

    const chatId = body.id ? Number(body.id) : NaN
    if (!lastUser || !Number.isFinite(chatId)) {
      return c.json(
        {
          success: false,
          error: {
            message: !Number.isFinite(chatId) ? 'Missing or invalid chat id' : 'Missing user message',
            code: 'INVALID_CHAT_REQUEST'
          }
        },
        400
      )
    }

    // Prepare unified options expected by the chat handler
    const unifiedOptions = {
      provider: body.provider || 'openai',
      model: body.model,
      ...(body.temperature !== undefined && { temperature: body.temperature }),
      ...(body.maxTokens !== undefined && { maxTokens: body.maxTokens }),
      ...(body.topP !== undefined && { topP: body.topP })
    }

    c.header('Content-Type', 'text/event-stream; charset=utf-8')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    const readableStream = await handleChatMessage({
      chatId,
      userMessage: lastUser.content,
      options: unifiedOptions,
      systemMessage: systemMsg
    })

    return c.body(readableStream.toDataStream(), 200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache'
    })
  })
  .openapi(getProvidersRoute, async (c) => {
    try {
      // Get predefined providers
      const predefinedProviders = [
        { id: 'openai', name: 'OpenAI', isCustom: false },
        { id: 'anthropic', name: 'Anthropic', isCustom: false },
        { id: 'google_gemini', name: 'Google Gemini', isCustom: false },
        { id: 'groq', name: 'Groq', isCustom: false },
        { id: 'together', name: 'Together', isCustom: false },
        { id: 'xai', name: 'XAI', isCustom: false },
        { id: 'openrouter', name: 'OpenRouter', isCustom: false },
        { id: 'copilot', name: 'GitHub Copilot', isCustom: false },
        { id: 'lmstudio', name: 'LMStudio', isCustom: false },
        { id: 'ollama', name: 'Ollama', isCustom: false }
      ]

      // Get custom providers
      const customProviders = await providerKeyService.getCustomProviders()
      const formattedCustomProviders = customProviders.map((cp) => ({
        id: cp.id,
        name: cp.name,
        isCustom: true,
        baseUrl: cp.baseUrl
      }))

      // Combine both lists
      const allProviders = [...predefinedProviders, ...formattedCustomProviders]

      return c.json(successResponse(allProviders), 200)
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      throw new ApiError(500, 'Failed to fetch providers', 'PROVIDERS_FETCH_ERROR')
    }
  })
  .openapi(generateStreamRoute, async (c) => {
    const body = c.req.valid('json')
    const { prompt, options, systemMessage } = body

    const aiSDKStream = await genTextStream({
      prompt,
      ...(options && {
        options: options
      }),
      systemMessage
    })

    c.header('Content-Type', 'text/event-stream; charset=utf-8')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    return c.body(aiSDKStream.toDataStream(), 200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache'
    })
  })
  .openapi(generateTextRoute, async (c) => {
    const body = c.req.valid('json')

    const generatedText = await generateSingleText({
      prompt: body.prompt,
      ...(body.options && {
        options: body.options
      }),
      systemMessage: body.systemMessage
    })

    return c.json(successResponse({ text: generatedText }), 200)
  })
  .openapi(generateStructuredRoute, async (c) => {
    const body = c.req.valid('json')
    const { schemaKey, userInput, options } = body

    const config: StructuredDataSchemaConfig<z.ZodTypeAny> =
      structuredDataSchemas[schemaKey as keyof typeof structuredDataSchemas]
    if (!config) {
      throw new ApiError(
        400,
        `Invalid schemaKey provided: ${schemaKey}. Valid keys are: ${Object.keys(structuredDataSchemas).join(', ')}`,
        'INVALID_SCHEMA_KEY'
      )
    }

    const finalPrompt = config?.promptTemplate?.replace('{userInput}', userInput)
    const finalModel = options?.model ?? config?.modelSettings?.model ?? 'gpt-4o'
    const finalOptions = { ...config.modelSettings, ...options, model: finalModel }
    const finalSystemPrompt = config.systemPrompt

    const result = await generateStructuredData({
      prompt: finalPrompt ?? '',
      schema: config.schema,
      options: finalOptions,
      systemMessage: finalSystemPrompt
    })

    return c.json(successResponse({ output: result.object }), 200)
  })
  .openapi(getModelsRoute, async (c) => {
    const { provider } = c.req.valid('query')

    // Check if this is a custom provider with format "custom_<keyId>"
    if (provider && provider.startsWith('custom_')) {
      const keyId = parseInt(provider.replace('custom_', ''), 10)
      if (!isNaN(keyId)) {
        // Get the specific custom provider key
        const customKey = await providerKeyService.getKeyById(keyId)
        if (customKey && customKey.provider === 'custom' && customKey.baseUrl) {
          const modelFetcherService = new ModelFetcherService({})

          try {
            const models = await modelFetcherService.listCustomProviderModels({
              baseUrl: customKey.baseUrl,
              apiKey:
                customKey.key ||
                (process.env.CUSTOM_API_KEY as string | undefined) ||
                (String(process.env.ALLOW_KEYLESS_CUSTOM || '').toLowerCase() === 'true' ? 'dummy' : undefined)
            })

            const modelData = models.map((model) => ({
              id: model.id,
              name: model.name,
              provider: provider || 'openai'
            }))

            return c.json(successResponse(modelData), 200)
          } catch (error) {
            console.error(`Failed to fetch models for custom provider ${keyId}:`, error)
            return c.json(successResponse([]), 200)
          }
        }
      }
    }

    // Handle standard providers
    let keys: ProviderKey[] = []
    try {
      keys = await providerKeyService.listKeysUncensored()
    } catch (err) {
      console.warn('Failed to load provider keys; continuing with empty set', err)
      keys = []
    }
    // Normalize provider names to config keys to avoid casing/alias issues
    // Use a normalized provider id (letters only, lowercase) so "OpenRouter", "open_router", etc. all match
    const PROVIDER_TO_CONFIG_KEY_NORMALIZED: Record<string, keyof ProviderKeysConfig> = {
      openai: 'openaiKey',
      anthropic: 'anthropicKey',
      googlegemini: 'googleGeminiKey',
      groq: 'groqKey',
      together: 'togetherKey',
      xai: 'xaiKey',
      openrouter: 'openrouterKey',
      copilot: 'copilotKey',
      githubcopilot: 'copilotKey'
      // Local providers (ollama, lmstudio) and custom don't need API keys here
    }

    const providerKeysConfig: ProviderKeysConfig = {}

    for (const key of keys) {
      const rawProviderId = String(key.provider || '')
      const normalized = rawProviderId.toLowerCase().replace(/[^a-z]/g, '')
      const configProp = PROVIDER_TO_CONFIG_KEY_NORMALIZED[normalized]
      if (!configProp) continue

      // Prefer explicit plaintext key if present
      let resolvedKey: string | undefined
      if (typeof key.key === 'string' && key.key.length > 0) {
        resolvedKey = key.key
      } else if (typeof (key as any).secretRef === 'string' && (key as any).secretRef) {
        // Fall back to environment variable via secretRef name (e.g., OPENROUTER_API_KEY)
        const envVar = (key as any).secretRef as string
        const envVal = (process.env as Record<string, string | undefined>)[envVar]
        if (typeof envVal === 'string' && envVal.length > 0) {
          resolvedKey = envVal
        }
      }

      if (resolvedKey && (!providerKeysConfig[configProp] || key.isDefault)) {
        providerKeysConfig[configProp] = resolvedKey as any
      }
    }

    // Environment fallbacks for providers if DB key is not present
    providerKeysConfig.openrouterKey = providerKeysConfig.openrouterKey || (process.env.OPENROUTER_API_KEY as any)
    providerKeysConfig.openaiKey = providerKeysConfig.openaiKey || (process.env.OPENAI_API_KEY as any)
    providerKeysConfig.anthropicKey = providerKeysConfig.anthropicKey || (process.env.ANTHROPIC_API_KEY as any)
    providerKeysConfig.googleGeminiKey =
      providerKeysConfig.googleGeminiKey || (process.env.GOOGLE_GENERATIVE_AI_API_KEY as any)
    providerKeysConfig.groqKey = providerKeysConfig.groqKey || (process.env.GROQ_API_KEY as any)
    providerKeysConfig.togetherKey = providerKeysConfig.togetherKey || (process.env.TOGETHER_API_KEY as any)
    providerKeysConfig.xaiKey = providerKeysConfig.xaiKey || (process.env.XAI_API_KEY as any)
    providerKeysConfig.copilotKey = providerKeysConfig.copilotKey || (process.env.COPILOT_API_KEY as any)

    // If a required API key is missing for the selected provider, return an empty list gracefully
    const REQUIRED_KEY_BY_PROVIDER: Record<string, keyof ProviderKeysConfig> = {
      openai: 'openaiKey',
      anthropic: 'anthropicKey',
      google_gemini: 'googleGeminiKey',
      groq: 'groqKey',
      together: 'togetherKey',
      xai: 'xaiKey',
      openrouter: 'openrouterKey'
    }

    const requiredKeyProp = REQUIRED_KEY_BY_PROVIDER[String(provider)]
    if (requiredKeyProp && !providerKeysConfig[requiredKeyProp]) {
      // No configured key for this provider; return empty list so UI can handle without error
      console.warn(`[GenAI Models] Missing API key for provider '${provider}'. Returning empty model list.`)
      return c.json(successResponse([]), 200)
    }

    const modelFetcherService = new ModelFetcherService(providerKeysConfig)

    // Get custom URLs from query params if provided, otherwise use defaults
    const ollamaUrl = c.req.query('ollamaUrl') || OLLAMA_BASE_URL
    const lmstudioUrl = c.req.query('lmstudioUrl') || LMSTUDIO_BASE_URL

    // Update provider settings if custom URLs are provided
    if (c.req.query('ollamaUrl') || c.req.query('lmstudioUrl')) {
      const settings: any = {}
      if (c.req.query('ollamaUrl')) settings.ollamaUrl = ollamaUrl
      if (c.req.query('lmstudioUrl')) settings.lmstudioUrl = lmstudioUrl
      updateProviderSettings(settings)
    }

    const listOptions = { ollamaBaseUrl: ollamaUrl, lmstudioBaseUrl: lmstudioUrl }

    let models = [] as { id: string; name: string; description: string }[]
    try {
      models = await modelFetcherService.listModels(provider as APIProviders, listOptions)
    } catch (err: any) {
      console.warn(`[GenAI Models] Failed to fetch models for provider '${provider}':`, err?.message || err)
      models = []
    }

    const modelData = models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: provider || 'openai'
    }))

    return c.json(successResponse(modelData), 200)
  })
  // Debug route to inspect provider key resolution without exposing secrets
  .openapi(
    createRoute({
      method: 'get',
      path: '/api/providers/_debug-config',
      tags: ['AI'],
      summary: 'Debug provider key resolution (no secrets)',
      responses: createStandardResponses(
        z.object({
          success: z.literal(true),
          data: z.object({
            providerKeysConfig: z.record(z.string(), z.boolean()),
            envFallback: z.record(z.string(), z.boolean()),
            keys: z.array(
              z.object({
                id: z.number(),
                provider: z.string(),
                normalized: z.string(),
                isDefault: z.boolean().optional(),
                decrypted: z.boolean(),
                createdAt: z.number(),
                updatedAt: z.number()
              })
            )
          })
        })
      )
    }),
    async (c) => {
      const keys: ProviderKey[] = await providerKeyService.listKeysUncensored()

      const PROVIDER_TO_CONFIG_KEY_NORMALIZED: Record<string, keyof ProviderKeysConfig> = {
        openai: 'openaiKey',
        anthropic: 'anthropicKey',
        googlegemini: 'googleGeminiKey',
        groq: 'groqKey',
        together: 'togetherKey',
        xai: 'xaiKey',
        openrouter: 'openrouterKey',
        copilot: 'copilotKey',
        githubcopilot: 'copilotKey'
      }

      const providerKeysConfig: ProviderKeysConfig = {}
      for (const key of keys) {
        const normalized = String(key.provider || '')
          .toLowerCase()
          .replace(/[^a-z]/g, '')
        const configProp = PROVIDER_TO_CONFIG_KEY_NORMALIZED[normalized]
        if (!configProp) continue
        let resolvedKey: string | undefined
        if (typeof key.key === 'string' && key.key.length > 0) {
          resolvedKey = key.key
        } else if (typeof (key as any).secretRef === 'string' && (key as any).secretRef) {
          const envVar = (key as any).secretRef as string
          const envVal = (process.env as Record<string, string | undefined>)[envVar]
          if (typeof envVal === 'string' && envVal.length > 0) {
            resolvedKey = envVal
          }
        }
        if (resolvedKey && (!providerKeysConfig[configProp] || key.isDefault)) {
          providerKeysConfig[configProp] = resolvedKey as any
        }
      }

      const redactedConfig: Record<string, boolean> = {}
      Object.entries(providerKeysConfig).forEach(([k, v]) => {
        redactedConfig[k] = typeof v === 'string' && v.length > 0
      })

      const envFallback = {
        OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        GROQ_API_KEY: !!process.env.GROQ_API_KEY,
        TOGETHER_API_KEY: !!process.env.TOGETHER_API_KEY,
        XAI_API_KEY: !!process.env.XAI_API_KEY,
        COPILOT_API_KEY: !!process.env.COPILOT_API_KEY
      }

      const keysMeta = keys.map((k) => ({
        id: k.id,
        provider: k.provider,
        normalized: String(k.provider || '')
          .toLowerCase()
          .replace(/[^a-z]/g, ''),
        isDefault: k.isDefault,
        decrypted: typeof k.key === 'string' && k.key.length > 0,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
      }))

      return c.json(
        successResponse({
          providerKeysConfig: redactedConfig,
          envFallback,
          keys: keysMeta
        }),
        200
      )
    }
  )
  .openapi(postAiGenerateTextRoute, async (c) => {
    const { prompt, options, systemMessage } = c.req.valid('json')

    console.log(`[Hono AI Generate] /ai/generate/text request: Provider=${options?.provider}, Model=${options?.model}`)

    const generatedText = await generateSingleText({
      prompt,
      ...(options && {
        options: options
      }),
      systemMessage
    })

    return c.json(successResponse({ text: generatedText }), 200)
  })
  .openapi(updateProviderSettingsRoute, async (c) => {
    const body = c.req.valid('json')

    // Update the provider settings
    const updatedSettings = updateProviderSettings(body)

    // Also update the settings when models are fetched with custom URLs
    if (body.ollamaUrl || body.lmstudioUrl) {
      console.log('[GenAI Routes] Provider settings updated:', body)
    }

    return c.json(
      {
        success: true as const,
        message: 'Provider settings updated',
        data: updatedSettings
      },
      200
    )
  })
