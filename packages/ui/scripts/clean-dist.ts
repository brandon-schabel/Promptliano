#!/usr/bin/env bun
import { rmSync } from 'node:fs'

try {
  rmSync('dist', { recursive: true, force: true })
  console.log('🧹 Cleaned dist')
} catch (e) {
  console.warn('Could not clean dist:', e)
}

