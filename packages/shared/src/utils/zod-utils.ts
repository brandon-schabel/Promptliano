import { z } from 'zod'

// Zod v4: AnyZodObject is not exported; use ZodObject with broad generics
export function getSchemaDefaults<Schema extends z.ZodObject<any, any>>(schema: Schema) {
  // Access internal defs via any to avoid tight coupling to Zod's private types
  const shape: Record<string, any> = (schema as any).shape
  return Object.fromEntries(
    Object.entries(shape).map(([key, value]: [string, any]) => {
      if (value instanceof z.ZodDefault) {
        // defaultValue() exists at runtime; cast def to any
        return [key, (value as any)._def.defaultValue()]
      }
      return [key, undefined]
    })
  )
}
