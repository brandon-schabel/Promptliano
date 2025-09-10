#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

function main() {
  const root = process.cwd()
  const srcDir = join(root, 'src')
  let violations: string[] = []

  try {
    const files = walk(srcDir)
      .filter((f) => ['.ts', '.tsx'].includes(extname(f).toLowerCase()))

    const importRe = /import\s+(?!type\b)[^;]*from\s+['"]@promptliano\/database['"];?|import\s+['"]@promptliano\/database['"]/g

    for (const f of files) {
      const text = readFileSync(f, 'utf-8')
      if (importRe.test(text)) violations.push(f)
    }
  } catch (e) {
    console.error('Failed to scan for database imports:', e)
    process.exit(1)
  }

  if (violations.length) {
    console.error('❌ Found non type-only @promptliano/database imports in client code:')
    for (const v of violations) console.error(' -', v)
    process.exit(1)
  } else {
    console.log('✅ All database imports are type-only')
  }
}

main()

