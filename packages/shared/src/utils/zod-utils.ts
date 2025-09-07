import { z } from 'zod'

// Extract top-level defaults from a Zod object schema.
// - Only returns defaults defined via `.default(...)` on each field.
// - Does not attempt to synthesize nested defaults unless the field itself has a default.
// - Supports Zod v3 (where defaultValue is a function) and Zod v4 (getter returning the value).
export function getSchemaDefaults<Schema extends z.ZodObject<any, any>>(schema: Schema) {
  const shape: Record<string, unknown> = (schema as any).shape

  return Object.fromEntries(
    Object.entries(shape).map(([key, fieldSchema]) => {
      if (fieldSchema instanceof z.ZodDefault) {
        const def = (fieldSchema as any)._def
        const dv = def?.defaultValue
        const value = typeof dv === 'function' ? dv() : dv
        return [key, value]
      }
      return [key, undefined]
    })
  )
}
