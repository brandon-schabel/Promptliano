import { spawn } from 'node:child_process'
import path from 'node:path'

export interface RipgrepMatchMeta {
  path: string // absolute path
  relativePath: string // relative to project root
  lines: { text: string }
  lineNumber: number
  column: number
}

export interface RipgrepResultItem {
  path: string // relative path under project root
  matches: Array<{
    line: number
    column: number
    text: string
  }>
  score: number
}

export interface RipgrepOptions {
  caseSensitive?: boolean
  exact?: boolean
  regex?: boolean
  limit?: number
  fileGlobs?: string[]
  excludeGlobs?: string[]
}

/**
 * Run ripgrep against a project directory and return aggregated match info per file.
 * The caller is expected to map relative paths back to DB records.
 */
export async function searchWithRipgrep(
  projectPath: string,
  query: string,
  opts: RipgrepOptions = {}
): Promise<RipgrepResultItem[]> {
  const args: string[] = ['--json', '--line-number', '--column', '--hidden', '--max-columns', '200']

  // Default excludes to reduce noise
  const defaultExcludes = ['!**/node_modules/**', '!**/.git/**', '!**/.next/**', '!**/dist/**']
  for (const ex of [...defaultExcludes, ...(opts.excludeGlobs || [])]) {
    args.push('--glob', ex)
  }

  if (opts.caseSensitive) {
    args.push('-S')
  } else {
    args.push('-i')
  }

  if (opts.exact) args.push('-F')

  // File type filters
  for (const g of opts.fileGlobs || []) args.push('--glob', g)

  // Query and path
  args.push(query, projectPath)

  const rgPath = process.env.FILE_SEARCH_RIPGREP_PATH || 'rg'
  const rg = spawn(rgPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

  const byFile = new Map<string, RipgrepResultItem>()
  let killed = false

  const consume = async () => {
    rg.stdout.setEncoding('utf8')
    for await (const chunk of rg.stdout) {
      const lines = String(chunk).split('\n')
      for (const line of lines) {
        if (!line) continue
        let evt: any
        try {
          evt = JSON.parse(line)
        } catch {
          continue
        }
        if (evt.type !== 'match') continue

        const abs = evt.data.path.text as string
        const rel = path.relative(projectPath, abs)
        const lineNumber = evt.data.line_number as number
        const column = (evt.data.submatches?.[0]?.start as number | undefined) ?? 0
        const text = (evt.data.submatches?.[0]?.match?.text as string | undefined) ?? evt.data.lines?.text ?? ''

        const existing = byFile.get(rel) || { path: rel, matches: [], score: 0 }
        existing.matches.push({ line: lineNumber, column: column + 1, text })
        // Simple score: filename boost + match count
        const nameBoost = rel.toLowerCase().includes(query.toLowerCase()) ? 5 : 0
        existing.score = nameBoost + existing.matches.length
        byFile.set(rel, existing)

        if (opts.limit && byFile.size >= opts.limit && !killed) {
          killed = true
          try {
            rg.kill('SIGTERM')
          } catch {}
        }
      }
    }
  }

  const errors: string[] = []
  rg.stderr.setEncoding('utf8')
  rg.stderr.on('data', (d) => errors.push(String(d)))

  await Promise.all([consume().catch(() => {}), new Promise<void>((resolve) => rg.on('close', () => resolve()))])

  // If ripgrep failed to execute, surface a clear error
  // Exit code 2 is usually usage error; 127 means not found
  if (errors.length > 0 && byFile.size === 0) {
    const combined = errors.join('\n')
    if (combined.includes('command not found') || combined.includes('No such file or directory')) {
      throw new Error('ripgrep (rg) not available')
    }
  }

  return Array.from(byFile.values())
}

export function buildGlobsForExtensions(extensions?: string[]): string[] {
  if (!extensions || extensions.length === 0) return []
  return extensions.map((ext) => `**/*.${ext.replace(/^\./, '')}`)
}
