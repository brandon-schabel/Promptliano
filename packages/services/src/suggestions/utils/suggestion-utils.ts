export function clamp01(n: number): number {
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function extractKeywords(text: string): string[] {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const stop = new Set([
    'the',
    'is',
    'at',
    'which',
    'on',
    'and',
    'a',
    'an',
    'as',
    'are',
    'was',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'to',
    'of',
    'in',
    'for',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'please',
    'help',
    'me',
    'find',
    'show',
    'provide',
    'some',
    'list'
  ])

  const typos: Record<string, string> = { improvements: 'improvements' }

  const rawTokens = cleaned
    .split(/\s+/)
    .map((token) => {
      const trimmed = token.trim()
      const correctionKey = trimmed === 'improvments' ? 'improvements' : trimmed
      return typos[correctionKey] || correctionKey
    })
    .filter((t) => t.length > 1 && !stop.has(t))

  const seen = new Set<string>()
  const ordered: string[] = []
  for (const t of rawTokens) {
    if (!seen.has(t)) {
      ordered.push(t)
      seen.add(t)
    }
  }
  return ordered.slice(0, 12)
}

export function buildFuzzyQuery(tokens: string[]): string {
  if (!tokens || tokens.length === 0) return ''
  return tokens.slice(0, 3).join(' ')
}

export function buildVariantQueries(tokens: string[]): string[] {
  const joined = (tokens || []).join(' ')
  const variants = new Set<string>()

  const hasSuggest = tokens.includes('suggest') || tokens.includes('suggestion') || tokens.includes('suggestions')
  const hasFiles = tokens.includes('file') || tokens.includes('files')
  const hasPrompts = tokens.includes('prompt') || tokens.includes('prompts')

  if (/suggest\s+files?/.test(joined) || (hasSuggest && hasFiles)) {
    variants.add('suggest-files')
    variants.add('suggest_files')
    variants.add('file-suggestion')
    variants.add('suggestion-service')
    variants.add('suggestFiles')
  }
  if (/suggest\s+prompts?/.test(joined) || (hasSuggest && hasPrompts)) {
    variants.add('suggest-prompts')
    variants.add('suggest_prompts')
    variants.add('prompt-suggestion')
    variants.add('suggestion-service')
    variants.add('suggestPrompts')
  }

  if (tokens.includes('feature') || tokens.includes('route') || tokens.includes('api') || tokens.includes('service')) {
    variants.add('route')
    variants.add('routes')
    variants.add('api')
    variants.add('server')
    variants.add('service')
  }

  return Array.from(variants)
}

export function hasAny(set: Set<string>, terms: string[]): boolean {
  for (const t of terms) if (set.has(t)) return true
  return false
}

