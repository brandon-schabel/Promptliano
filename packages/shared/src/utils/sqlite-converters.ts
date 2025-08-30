export function toBoolean(value: any, fallback = false): boolean {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === '1') return true
    if (lower === 'false' || lower === '0') return false
    return fallback
  }
  return fallback
}

export function fromBoolean(value: boolean): number {
  return value ? 1 : 0
}

export function toNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') {
    return isNaN(value) ? fallback : value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? fallback : parsed
  }
  return fallback
}

export function fromNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (isNaN(value)) return null
  return value
}

export function toString(value: any, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function fromString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value
}

export function toJson<T = any>(value: any, fallback: T | null = null, context?: string): T | null {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (e) {
      if (context) {
        console.warn(`Failed to parse JSON for ${context}:`, e)
      }
      return fallback
    }
  }
  return value
}

export function fromJson(value: any): string | null {
  if (value === null) return null
  if (value === undefined) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch (e) {
    console.warn('Failed to stringify value (likely circular reference):', e)
    return null
  }
}

export function toArray<T = any>(value: any, fallback: T[] = []): T[] {
  if (value === null || value === undefined) return fallback
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

export function fromArray(value: any): string {
  if (value === null || value === undefined) return '[]'
  if (!Array.isArray(value)) return '[]'
  try {
    return JSON.stringify(value)
  } catch (e) {
    console.warn('Failed to stringify array:', e)
    return '[]'
  }
}

export function toObject<T = Record<string, any>>(value: any, fallback: T = {} as T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed === null) return fallback
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

export function fromObject(value: Record<string, any> | null | undefined): string {
  if (value === null || value === undefined) return '{}'
  if (Array.isArray(value) || typeof value !== 'object') return '{}'
  try {
    return JSON.stringify(value)
  } catch (e) {
    console.warn('Failed to stringify object:', e)
    return '{}'
  }
}

export function toTimestamp(value: any, fallback?: number): number {
  // If no fallback provided, use Date.now() for null/undefined
  if (value === null || value === undefined) {
    return fallback !== undefined ? fallback : Date.now()
  }
  if (typeof value === 'number') {
    if (isNaN(value)) return fallback !== undefined ? fallback : Date.now()
    // Handle zero with fallback
    if (value === 0 && fallback !== undefined) return fallback
    // Convert seconds to milliseconds if it looks like seconds
    // (timestamps before year 2001 in seconds = less than 1000000000)
    if (value < 10000000000) return value * 1000
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) return fallback !== undefined ? fallback : Date.now()
    // Same conversion logic for parsed numbers
    if (parsed === 0 && fallback !== undefined) return fallback
    if (parsed < 10000000000) return parsed * 1000
    return parsed
  }
  if (value instanceof Date) return value.getTime()
  return fallback !== undefined ? fallback : Date.now()
}

export function fromTimestamp(value: number | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.getTime() : value
}

export function isNullish(value: any): value is null | undefined {
  return value === null || value === undefined
}

export function isValidJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

export function ensureString(value: any, fallback = ''): string {
  return toString(value, fallback)
}

export function ensureNumber(value: any, fallback = 0): number {
  return toNumber(value, fallback)
}

export function ensureBoolean(value: any, fallback = false): boolean {
  return toBoolean(value, fallback)
}

export function safeJsonParse<T = any>(
  value: string | null | undefined,
  fallback: T,
  validator?: (value: any) => value is T
): T {
  if (value === null || value === undefined) return fallback
  try {
    const parsed = JSON.parse(value)
    if (validator && !validator(parsed)) {
      return fallback
    }
    return parsed
  } catch {
    return fallback
  }
}

export function batchConvert<T, R>(values: T[], converter: (value: T) => R): R[] {
  return values.map(converter)
}

export function rowsToRecord<T extends Record<string, any>, K extends keyof T, V = T>(
  rows: T[],
  keyField: K | ((row: T) => string),
  valueField?: (row: T) => V
): Record<string, V> {
  const record: Record<string, V> = {}
  for (const row of rows) {
    const key = typeof keyField === 'function' ? keyField(row) : String(row[keyField])
    const value = valueField ? valueField(row) : (row as unknown as V)
    record[key] = value
  }
  return record
}

export const SqliteConverters = {
  toBoolean,
  fromBoolean,
  toNumber,
  fromNumber,
  toString,
  fromString,
  toJson,
  fromJson,
  toArray,
  fromArray,
  toObject,
  fromObject,
  toTimestamp,
  fromTimestamp,
  isNullish,
  isValidJson,
  ensureString,
  ensureNumber,
  ensureBoolean,
  safeJsonParse,
  batchConvert,
  rowsToRecord
}
