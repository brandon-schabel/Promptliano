/**
 * Provider Testing Schemas - Application-level validation for provider testing
 * These schemas handle provider health checks and testing functionality
 */

import { z } from 'zod'

// Provider status enum
export const ProviderStatusEnum = z.enum([
  'active',
  'inactive',
  'error',
  'testing',
  'degraded'
])

// Provider health status enum
export const ProviderHealthStatusEnum = z.enum([
  'healthy',
  'degraded',
  'down',
  'unhealthy', // Add unhealthy as alias for down
  'unknown'
])

// Provider health status schema
export const ProviderHealthStatusSchema = z.object({
  status: ProviderHealthStatusEnum,
  latency: z.number().optional(),
  averageResponseTime: z.number().optional(),
  modelCount: z.number().optional(),
  lastChecked: z.number(),
  error: z.string().optional()
})

// Provider model schema
export const ProviderModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  provider: z.string(),
  contextLength: z.number().optional(),
  maxTokens: z.number().optional(),
  capabilities: z.array(z.string()).optional()
})

// Test provider request schema
export const TestProviderRequestSchema = z.object({
  providerId: z.number(),
  model: z.string().optional(),
  testPrompt: z.string().optional().default('Hello, this is a test message.')
})

// Test provider response schema
export const TestProviderResponseSchema = z.object({
  success: z.boolean(),
  providerId: z.number(),
  provider: z.string(),
  model: z.string().optional(),
  latency: z.number(),
  error: z.string().optional(),
  response: z.string().optional(),
  models: z.array(ProviderModelSchema).optional()
})

// Batch test provider request schema
export const BatchTestProviderRequestSchema = z.object({
  providerIds: z.array(z.number()).optional(),
  testPrompt: z.string().optional().default('Hello, this is a test message.'),
  includeInactive: z.boolean().optional().default(false)
})

// Batch test provider response schema
export const BatchTestProviderResponseSchema = z.object({
  results: z.array(TestProviderResponseSchema),
  summary: z.object({
    total: z.number(),
    successful: z.number(),
    failed: z.number(),
    averageLatency: z.number().optional()
  })
})

// Create provider key input schema (for validation)
export const CreateProviderKeyInputSchema = z.object({
  provider: z.string(),
  keyName: z.string().optional(),
  name: z.string().optional(),
  key: z.string().optional(),
  encryptedValue: z.string().optional(),
  encrypted: z.boolean().optional().default(true),
  iv: z.string().optional(),
  tag: z.string().optional(),
  salt: z.string().optional(),
  baseUrl: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  environment: z.string().optional().default('production'),
  description: z.string().optional(),
  expiresAt: z.number().optional(),
  lastUsed: z.number().optional()
})

// Custom provider validation schemas
export const CustomProviderFeaturesSchema = z.object({
  streaming: z.boolean(),
  functionCalling: z.boolean(),
  structuredOutput: z.boolean(),
  vision: z.boolean(),
  embeddings: z.boolean()
})

export const ValidateCustomProviderRequestSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string(),
  customHeaders: z.record(z.string()).optional()
})

export const ValidateCustomProviderResponseSchema = z.object({
  data: z.object({
    compatible: z.boolean(),
    models: z.array(ProviderModelSchema),
    features: CustomProviderFeaturesSchema,
    baseUrl: z.string()
  })
})

// Type exports
export type ProviderStatus = z.infer<typeof ProviderStatusEnum>
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>
export type ProviderModel = z.infer<typeof ProviderModelSchema>
export type TestProviderRequest = z.infer<typeof TestProviderRequestSchema>
export type TestProviderResponse = z.infer<typeof TestProviderResponseSchema>
export type BatchTestProviderRequest = z.infer<typeof BatchTestProviderRequestSchema>
export type BatchTestProviderResponse = z.infer<typeof BatchTestProviderResponseSchema>
export type CustomProviderFeatures = z.infer<typeof CustomProviderFeaturesSchema>
export type ValidateCustomProviderRequest = z.infer<typeof ValidateCustomProviderRequestSchema>
export type ValidateCustomProviderResponse = z.infer<typeof ValidateCustomProviderResponseSchema>