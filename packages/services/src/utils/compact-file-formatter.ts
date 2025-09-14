import type { File } from '@promptliano/database'

export type CompactLevel = 'ultra' | 'compact' | 'standard'

export interface CompactFileRepresentation {
  i: string // id (file path)
  p: string // path
  s?: string // summary snippet
  t?: string // type/extension
  m?: number // modified timestamp
}

export interface CompactProjectSummary {
  files: CompactFileRepresentation[]
  total: number
  format: CompactLevel
}

/**
 * Builds a compact representation of project files optimized for token efficiency
 * Reduces from ~500 chars/file (XML) to ~50-150 chars/file (JSON)
 */
export class CompactFileFormatter {
  /**
   * Format files in ultra-compact mode (~50 chars/file)
   * Only includes id and path
   */
  static ultraCompact(files: File[]): string {
    const data = files.map((f) => ({
      i: f.id,
      p: this.truncatePath(f.path, 50)
    }))
    return JSON.stringify(data)
  }

  /**
   * Format files in compact mode (~100 chars/file)
   * Includes id, path, and brief summary
   */
  static compact(files: File[]): string {
    const data = files.map((f) => ({
      i: f.id,
      p: this.truncatePath(f.path, 50)
    }))
    return JSON.stringify(data)
  }

  /**
   * Format files in standard mode (~150 chars/file)
   * Includes id, path, summary, type, and modification time
   */
  static standard(files: File[]): string {
    const data = files.map((f) => ({
      i: f.id,
      p: this.truncatePath(f.path, 60),
      t: this.getFileExtension(f.path),
      m: f.updatedAt
    }))
    return JSON.stringify(data)
  }

  /**
   * Build a formatted summary based on the specified level
   */
  static format(files: File[], level: CompactLevel = 'compact'): CompactProjectSummary {
    let formattedFiles: CompactFileRepresentation[]

    switch (level) {
      case 'ultra':
        formattedFiles = files.map((f) => ({
          i: f.id,
          p: this.truncatePath(f.path, 50)
        }))
        break
      case 'standard':
        formattedFiles = files.map((f) => ({
          i: f.id,
          p: this.truncatePath(f.path, 60),
          t: this.getFileExtension(f.path),
          m: f.updatedAt
        }))
        break
      case 'compact':
      default:
        formattedFiles = files.map((f) => ({
          i: f.id,
          p: this.truncatePath(f.path, 50)
        }))
    }

    return {
      files: formattedFiles,
      total: files.length,
      format: level
    }
  }

  /**
   * Create a human-readable summary for AI consumption
   */
  static toAIPrompt(files: File[], level: CompactLevel = 'compact'): string {
    const summary = this.format(files, level)

    let prompt = `Project contains ${summary.total} files:\n`

    for (const file of summary.files) {
      prompt += `[${file.i}] ${file.p}`
      // no summary snippet
      prompt += '\n'
    }

    return prompt
  }

  /**
   * Create a categorized summary grouping files by type
   */
  static categorizedSummary(files: File[]): string {
    const categories = new Map<string, File[]>()

    // Group files by extension/type
    for (const file of files) {
      const category = this.getFileCategory(file)
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(file)
    }

    let summary = ''
    for (const [category, categoryFiles] of Array.from(categories.entries())) {
      summary += `\n${category} (${categoryFiles.length}):\n`
      for (const file of categoryFiles.slice(0, 5)) {
        // Show max 5 per category
        summary += `- [${file.id}] ${this.getFileName(file.path)}`
        // no summary snippet
        summary += '\n'
      }
      if (categoryFiles.length > 5) {
        summary += `  ...and ${categoryFiles.length - 5} more\n`
      }
    }

    return summary
  }

  private static truncatePath(path: string, maxLength: number): string {
    if (path.length <= maxLength) return path
    const parts = path.split('/')
    if (parts.length <= 2) return path.substring(0, Math.max(0, maxLength - 3)) + '...'
    const first = parts[0] ?? ''
    const last = parts.at(-1) ?? ''
    const middle = parts.slice(1, -1).join('/')
    if (first.length + last.length + 6 > maxLength) return '.../' + last.substring(0, Math.max(0, maxLength - 4))
    const remainingLength = Math.max(0, maxLength - first.length - last.length - 6)
    const truncatedMiddle = middle.substring(0, remainingLength)
    return `${first}/...${truncatedMiddle}/${last}`
  }

  private static truncateSummary(summary: string | undefined, maxLength: number): string {
    if (!summary) return ''
    const cleaned = summary.replace(/\n/g, ' ').trim()
    if (cleaned.length <= maxLength) return cleaned
    return cleaned.substring(0, maxLength - 3) + '...'
  }

  private static getFileName(path: string): string {
    return path.split('/').pop() ?? path
  }

  private static getFileExtension(path: string): string {
    const filename = path.split('/').pop() ?? ''
    const lastDot = filename.lastIndexOf('.')
    return lastDot !== -1 ? filename.slice(lastDot + 1) : ''
  }

  private static getFileCategory(file: File): string {
    const ext = this.getFileExtension(file.path).toLowerCase() || ''
    const path = file.path.toLowerCase()

    // Check for specific file patterns
    if (path.includes('test.') || path.includes('.test.') || path.includes('spec.')) return 'Tests'
    if (path.includes('component')) return 'Components'
    if (path.includes('service')) return 'Services'
    if (path.includes('route') || path.includes('api')) return 'API/Routes'
    if (path.includes('hook')) return 'Hooks'
    if (path.includes('util') || path.includes('helper')) return 'Utilities'
    if (path.includes('schema') || path.includes('model')) return 'Schemas/Models'
    if (path.includes('config')) return 'Configuration'

    // Check by extension
    const extensionCategories: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'React Components',
      js: 'JavaScript',
      jsx: 'React Components',
      css: 'Styles',
      scss: 'Styles',
      json: 'Data/Config',
      md: 'Documentation',
      sql: 'Database',
      yml: 'Configuration',
      yaml: 'Configuration'
    }

    return extensionCategories[ext] || 'Other'
  }
}

/**
 * Compare token usage between old XML format and new compact format
 */
export function calculateTokenSavings(files: File[]): {
  oldTokens: number
  newTokens: number
  savings: number
  savingsPercent: number
} {
  // Estimate old XML format tokens (avg ~500 chars/file, ~125 tokens/file)
  const oldChars = files.length * 500
  const oldTokens = Math.ceil(oldChars / 4)

  // Calculate new format tokens using the format method instead
  const compactSummary = CompactFileFormatter.format(files, 'compact')
  const newChars = JSON.stringify(compactSummary).length
  const newTokens = Math.ceil(newChars / 4)

  const savings = oldTokens - newTokens
  const savingsPercent = (savings / oldTokens) * 100

  return {
    oldTokens,
    newTokens,
    savings,
    savingsPercent
  }
}
