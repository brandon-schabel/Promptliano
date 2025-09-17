import type { Prompt } from '@promptliano/database'

export type CompactLevel = 'ultra' | 'compact' | 'standard'

export interface CompactPromptRepresentation {
  i: string
  t: string
  g?: string[]
  m?: number
}

export interface CompactPromptSummary {
  prompts: CompactPromptRepresentation[]
  total: number
  format: CompactLevel
}

export class CompactPromptFormatter {
  static ultraCompact(prompts: Prompt[]): string {
    const data = prompts.map((p) => ({ i: String(p.id), t: this.truncate(p.title, 60) }))
    return JSON.stringify(data)
  }

  static compact(prompts: Prompt[]): string {
    const data = prompts.map((p) => ({
      i: String(p.id),
      t: this.truncate(p.title, 60),
      g: Array.isArray(p.tags) ? (p.tags as string[]).slice(0, 5) : []
    }))
    return JSON.stringify(data)
  }

  static standard(prompts: Prompt[]): string {
    const data = prompts.map((p) => ({
      i: String(p.id),
      t: this.truncate(p.title, 80),
      g: Array.isArray(p.tags) ? (p.tags as string[]).slice(0, 8) : [],
      m: p.updatedAt
    }))
    return JSON.stringify(data)
  }

  static format(prompts: Prompt[], level: CompactLevel = 'compact'): CompactPromptSummary {
    let list: CompactPromptRepresentation[]
    switch (level) {
      case 'ultra':
        list = prompts.map((p) => ({ i: String(p.id), t: this.truncate(p.title, 60) }))
        break
      case 'standard':
        list = prompts.map((p) => ({
          i: String(p.id),
          t: this.truncate(p.title, 80),
          g: Array.isArray(p.tags) ? (p.tags as string[]).slice(0, 8) : [],
          m: p.updatedAt
        }))
        break
      case 'compact':
      default:
        list = prompts.map((p) => ({
          i: String(p.id),
          t: this.truncate(p.title, 60),
          g: Array.isArray(p.tags) ? (p.tags as string[]).slice(0, 5) : []
        }))
    }
    return { prompts: list, total: prompts.length, format: level }
  }

  static toAIPrompt(prompts: Prompt[], level: CompactLevel = 'compact'): string {
    const summary = this.format(prompts, level)
    let out = `Project has ${summary.total} prompts\n`
    for (const p of summary.prompts) {
      out += `[${p.i}] ${p.t}`
      if (p.g && p.g.length) out += ` — ${p.g.join(', ')}`
      out += '\n'
    }
    return out
  }

  private static truncate(text: string, max: number): string {
    const s = String(text || '').trim()
    if (s.length <= max) return s
    return s.slice(0, Math.max(0, max - 3)) + '...'
  }
}

