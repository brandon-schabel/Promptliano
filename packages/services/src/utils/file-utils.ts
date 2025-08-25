/**
 * File Utility Functions
 * Handles file path operations and extension extraction
 */

import { extname, basename } from 'path'

/**
 * Extract file extension from a file path
 * @param filePath - The file path to extract extension from
 * @returns The file extension without the dot (e.g., 'ts', 'js', 'md')
 */
export function getFileExtension(filePath: string): string {
  if (!filePath) return ''
  
  const ext = extname(filePath)
  return ext.startsWith('.') ? ext.slice(1) : ext
}

/**
 * Get file name without extension
 * @param filePath - The file path
 * @returns The file name without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  if (!filePath) return ''
  
  const name = basename(filePath)
  const ext = extname(filePath)
  return ext ? name.slice(0, -ext.length) : name
}

/**
 * Check if a file is a specific type based on extension
 * @param filePath - The file path
 * @param extensions - Array of extensions to check (without dots)
 * @returns True if the file matches any of the extensions
 */
export function isFileType(filePath: string, extensions: string[]): boolean {
  const ext = getFileExtension(filePath).toLowerCase()
  return extensions.map(e => e.toLowerCase()).includes(ext)
}

/**
 * Check if a file is a code file
 * @param filePath - The file path
 * @returns True if the file is a code file
 */
export function isCodeFile(filePath: string): boolean {
  const codeExtensions = [
    'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
    'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'clj',
    'hs', 'ml', 'fs', 'elm', 'dart', 'vue', 'svelte'
  ]
  return isFileType(filePath, codeExtensions)
}

/**
 * Check if a file is a configuration file
 * @param filePath - The file path
 * @returns True if the file is a config file
 */
export function isConfigFile(filePath: string): boolean {
  const configExtensions = ['json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf']
  const configFilenames = [
    'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js',
    'tailwind.config.js', 'next.config.js', 'nuxt.config.js', 'dockerfile',
    '.env', '.env.local', '.env.development', '.env.production', '.gitignore',
    '.gitattributes', 'readme.md', 'license', 'changelog.md'
  ]
  
  return isFileType(filePath, configExtensions) || 
         configFilenames.some(name => basename(filePath).toLowerCase() === name.toLowerCase())
}

/**
 * Check if a file is a documentation file
 * @param filePath - The file path
 * @returns True if the file is a documentation file
 */
export function isDocumentationFile(filePath: string): boolean {
  const docExtensions = ['md', 'rst', 'txt', 'adoc', 'org']
  return isFileType(filePath, docExtensions)
}

/**
 * Type Conversion Utilities
 * Handles database null values vs TypeScript undefined values
 */

/**
 * Convert null to undefined for optional fields
 * @param value - Value that might be null or undefined
 * @returns Value or undefined (never null)
 */
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value
}

/**
 * Convert database object with null fields to undefined
 * @param obj - Object from database with potentially null fields
 * @returns Object with null values converted to undefined
 */
export function convertNullsToUndefined<T extends Record<string, any>>(obj: T): {
  [K in keyof T]: T[K] extends null ? undefined : T[K] extends null | infer U ? U | undefined : T[K]
} {
  const result = {} as any
  for (const [key, value] of Object.entries(obj)) {
    result[key] = nullToUndefined(value)
  }
  return result
}

/**
 * Add timestamps to create operations
 * @param data - Base data object
 * @returns Data with createdAt and updatedAt timestamps
 */
export function addTimestamps<T extends Record<string, any>>(data: T): T & { createdAt: number; updatedAt: number } {
  const now = Date.now()
  return {
    ...data,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Update timestamp for update operations
 * @param data - Base data object
 * @returns Data with updated updatedAt timestamp
 */
export function updateTimestamp<T extends Record<string, any>>(data: T): T & { updatedAt: number } {
  return {
    ...data,
    updatedAt: Date.now()
  }
}

/**
 * Convert database Json field to string array, handling null values
 * @param value - Json value that could be string[], null, or undefined
 * @returns string[] or empty array
 */
export function jsonToStringArray(value: any): string[] {
  if (!value || value === null) return []
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string')
  return []
}

/**
 * Convert database Json field to number array, handling null values
 * @param value - Json value that could be number[], null, or undefined
 * @returns number[] or empty array
 */
export function jsonToNumberArray(value: any): number[] {
  if (!value || value === null) return []
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'number' || !isNaN(Number(item)))
                .map(item => typeof item === 'number' ? item : Number(item))
  }
  return []
}