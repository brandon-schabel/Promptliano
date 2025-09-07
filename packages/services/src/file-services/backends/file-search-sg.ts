import { spawn } from 'node:child_process'
import path from 'node:path'

export interface AstGrepResultItem {
  path: string // relative to project root
  matches: Array<{
    line: number
    column: number
    text: string
  }>
  score: number
}

export interface AstGrepOptions {
  caseSensitive?: boolean
  limit?: number
}

function resolveAstGrepPath(): string[] {
  const custom = process.env.FILE_SEARCH_ASTGREP_PATH || process.env.AST_GREP_PATH
  if (custom) return [custom]
  return ['ast-grep', 'sg']
}

/**
 * Runs ast-grep against a project directory.
 * Tries JSON reporter; falls back to parsing colon-separated output.
 */
export async function searchWithAstGrep(
  projectPath: string,
  pattern: string,
  opts: AstGrepOptions = {}
): Promise<AstGrepResultItem[]> {
  const candidates = resolveAstGrepPath()
  let lastErr: any
  for (const bin of candidates) {
    try {
      const results = await runAstGrep(bin, projectPath, pattern, opts)
      return results
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('ast-grep not available')
}

async function runAstGrep(
  bin: string,
  projectPath: string,
  pattern: string,
  opts: AstGrepOptions
): Promise<AstGrepResultItem[]> {
  const args: string[] = []
  // Pattern
  args.push('-p', pattern)
  // Case-insensitive if not caseSensitive
  if (!opts.caseSensitive) args.push('-i')
  // Prefer JSON if supported
  args.push('--json')
  // Target root path
  args.push(projectPath)

  const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const byFile = new Map<string, AstGrepResultItem>()
  const errors: string[] = []

  const consume = async () => {
    proc.stdout.setEncoding('utf8')
    for await (const chunk of proc.stdout) {
      const lines = String(chunk).split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        // Try JSON first
        let parsed: any
        try {
          parsed = JSON.parse(line)
        } catch {
          // Fallback: parse colon-separated "path:line:column: ..."
          const m = line.match(/^(.*?):(\d+):(\d+):/)
          if (m) {
            const abs = path.resolve(projectPath, m[1]!)
            const rel = path.relative(projectPath, abs)
            const lineNum = parseInt(m[2]!, 10)
            const col = parseInt(m[3]!, 10)
            const rest = line.slice(m[0]!.length)
            const existing = byFile.get(rel) || { path: rel, matches: [], score: 0 }
            existing.matches.push({ line: lineNum, column: col, text: rest.trim() })
            existing.score = existing.matches.length
            byFile.set(rel, existing)
          }
          continue
        }

        // JSON line; expected shape may vary by version, handle common fields
        // Example guess: { file: { path }, range: { start: { line, column } }, lines: { text } }
        const filePath = parsed?.file?.path || parsed?.path || parsed?.data?.path || ''
        if (!filePath) continue
        const abs = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath)
        const rel = path.relative(projectPath, abs)
        const lineNum =
          parsed?.range?.start?.line || parsed?.data?.range?.start?.line || parsed?.line || parsed?.line_number || 0
        const col =
          parsed?.range?.start?.column ||
          parsed?.data?.range?.start?.column ||
          parsed?.column ||
          parsed?.column_number ||
          0
        const text = parsed?.lines?.text || parsed?.match || parsed?.code || ''
        const existing = byFile.get(rel) || { path: rel, matches: [], score: 0 }
        existing.matches.push({ line: Number(lineNum) || 0, column: Number(col) || 0, text: String(text || '') })
        existing.score = existing.matches.length
        byFile.set(rel, existing)
      }
    }
  }

  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (d) => errors.push(String(d)))

  await Promise.all([
    consume().catch(() => {}),
    new Promise<void>((resolve) => proc.on('close', () => resolve())),
  ])

  if (errors.length > 0 && byFile.size === 0) {
    const combined = errors.join('\n')
    if (/not found|No such file|unrecognized option/i.test(combined)) {
      throw new Error(`ast-grep failed: ${combined.split('\n')[0]}`)
    }
  }

  const list = Array.from(byFile.values())
  return opts.limit ? list.slice(0, opts.limit) : list
}

