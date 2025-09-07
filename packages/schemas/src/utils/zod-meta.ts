import { z } from '@hono/zod-openapi'

// Central helpers to safely access Zod internal metadata with loose typing.
// This avoids TypeScript errors when using different Zod/OpenAPI integrations.

export function getZodDescription(schema: z.ZodTypeAny): string | undefined {
  return (schema as any)?._def?.description
}

export function getZodExample<T = unknown>(schema: z.ZodTypeAny): T | undefined {
  return (schema as any)?._def?.example as T | undefined
}

export function getZodOpenApi(schema: z.ZodTypeAny): any | undefined {
  return (schema as any)?._def?.openapi
}

export function ensureZodOpenApi(schema: z.ZodTypeAny): any {
  const def = (schema as any)?._def
  if (!def) return undefined
  if (!def.openapi) def.openapi = {}
  return def.openapi
}

export function setZodOpenApiRef(schema: z.ZodTypeAny, ref: string): void {
  const openapi = ensureZodOpenApi(schema)
  if (openapi) openapi.ref = ref
}
