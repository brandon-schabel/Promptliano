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