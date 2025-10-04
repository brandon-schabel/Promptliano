/**
 * Diff Utilities - Line-based diff and patch operations
 *
 * Provides simple line-based diffing and patching without external dependencies.
 * Supports unified diff format for compatibility with standard tools.
 */

/**
 * Represents a line change in a diff
 */
export interface DiffLine {
  type: 'context' | 'add' | 'remove'
  lineNumber: number
  content: string
}

/**
 * Represents a hunk (chunk of changes) in a unified diff
 */
export interface DiffHunk {
  originalStart: number
  originalLines: number
  modifiedStart: number
  modifiedLines: number
  lines: DiffLine[]
}

/**
 * Represents a complete patch
 */
export interface Patch {
  originalFile: string
  modifiedFile: string
  hunks: DiffHunk[]
}

/**
 * Parse result for unified diff format
 */
export interface ParsedPatch {
  success: boolean
  patch?: Patch
  error?: string
}

/**
 * Result of applying a patch
 */
export interface PatchResult {
  success: boolean
  content?: string
  error?: string
  failedHunks?: number[]
}

/**
 * Normalize line endings to \n
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Split content into lines, preserving empty lines
 */
function splitLines(content: string): string[] {
  const normalized = normalizeLineEndings(content)
  // Handle empty content
  if (normalized === '') return []
  // Split and preserve empty lines
  return normalized.split('\n')
}

/**
 * Create a simple line-based diff between two contents
 */
export function createDiff(original: string, modified: string): DiffHunk[] {
  const originalLines = splitLines(original)
  const modifiedLines = splitLines(modified)

  const hunks: DiffHunk[] = []
  let i = 0
  let j = 0

  while (i < originalLines.length || j < modifiedLines.length) {
    // Find the next difference
    while (i < originalLines.length && j < modifiedLines.length && originalLines[i] === modifiedLines[j]) {
      i++
      j++
    }

    // If we've reached the end, we're done
    if (i >= originalLines.length && j >= modifiedLines.length) {
      break
    }

    // Start a new hunk
    const hunkStart = Math.max(0, i - 3) // Include 3 lines of context
    const lines: DiffLine[] = []

    // Add context before the change
    for (let k = hunkStart; k < i; k++) {
      const line = originalLines[k]
      if (line !== undefined) {
        lines.push({
          type: 'context',
          lineNumber: k + 1,
          content: line
        })
      }
    }

    const originalChangeStart = i
    const modifiedChangeStart = j

    // Find the end of this change
    let changeEndI = i
    let changeEndJ = j

    // Look ahead to find matching lines (end of change)
    const lookAhead = 3
    let matchCount = 0

    while (changeEndI < originalLines.length || changeEndJ < modifiedLines.length) {
      if (changeEndI < originalLines.length && changeEndJ < modifiedLines.length &&
          originalLines[changeEndI] === modifiedLines[changeEndJ]) {
        matchCount++
        if (matchCount >= lookAhead) {
          // Found the end of the change
          changeEndI -= lookAhead - 1
          changeEndJ -= lookAhead - 1
          break
        }
        changeEndI++
        changeEndJ++
      } else {
        matchCount = 0
        if (changeEndI < originalLines.length) changeEndI++
        if (changeEndJ < modifiedLines.length) changeEndJ++
      }
    }

    // Add removed lines
    for (let k = i; k < changeEndI; k++) {
      const line = originalLines[k]
      if (line !== undefined) {
        lines.push({
          type: 'remove',
          lineNumber: k + 1,
          content: line
        })
      }
    }

    // Add added lines
    for (let k = j; k < changeEndJ; k++) {
      const line = modifiedLines[k]
      if (line !== undefined) {
        lines.push({
          type: 'add',
          lineNumber: k + 1,
          content: line
        })
      }
    }

    // Add context after the change
    const contextEnd = Math.min(changeEndI + 3, originalLines.length)
    for (let k = changeEndI; k < contextEnd; k++) {
      const line = originalLines[k]
      if (line !== undefined) {
        lines.push({
          type: 'context',
          lineNumber: k + 1,
          content: line
        })
      }
    }

    hunks.push({
      originalStart: hunkStart + 1,
      originalLines: changeEndI - hunkStart,
      modifiedStart: hunkStart + 1,
      modifiedLines: changeEndJ - hunkStart,
      lines
    })

    i = changeEndI
    j = changeEndJ
  }

  return hunks
}

/**
 * Create a unified diff patch
 */
export function createPatch(
  original: string,
  modified: string,
  options: {
    originalFile?: string
    modifiedFile?: string
  } = {}
): string {
  const { originalFile = 'a/file', modifiedFile = 'b/file' } = options

  const hunks = createDiff(original, modified)

  if (hunks.length === 0) {
    return '' // No changes
  }

  let patch = `--- ${originalFile}\n+++ ${modifiedFile}\n`

  for (const hunk of hunks) {
    patch += `@@ -${hunk.originalStart},${hunk.originalLines} +${hunk.modifiedStart},${hunk.modifiedLines} @@\n`

    for (const line of hunk.lines) {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
      patch += `${prefix}${line.content}\n`
    }
  }

  return patch
}

/**
 * Parse a unified diff patch
 */
export function parsePatch(patchContent: string): ParsedPatch {
  try {
    // Pre-validation: Check basic structure
    const trimmed = patchContent.trim()

    if (trimmed.length === 0) {
      return {
        success: false,
        error: 'Empty patch content. Expected unified diff format with --- / +++ headers and @@ hunk markers'
      }
    }

    const lines = patchContent.split('\n')
    let i = 0

    // Parse file headers
    let originalFile = 'a/file'
    let modifiedFile = 'b/file'
    let hasMinusHeader = false
    let hasPlusHeader = false

    const minusLine = lines[i]
    if (minusLine?.startsWith('---')) {
      originalFile = minusLine.substring(4).trim()
      hasMinusHeader = true
      i++
    }

    const plusLine = lines[i]
    if (plusLine?.startsWith('+++')) {
      modifiedFile = plusLine.substring(4).trim()
      hasPlusHeader = true
      i++
    }

    // Validate required headers exist
    if (!hasMinusHeader || !hasPlusHeader) {
      return {
        success: false,
        error: 'Invalid unified diff format: Missing file headers (--- and +++). Expected format: "--- a/file\\n+++ b/file\\n@@ -1,1 +1,1 @@\\n content"'
      }
    }

    const hunks: DiffHunk[] = []

    // Parse hunks
    while (i < lines.length) {
      const line = lines[i]

      if (!line) {
        i++
        continue
      }

      // Parse hunk header: @@ -start,count +start,count @@
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/)
        if (!match) {
          return {
            success: false,
            error: `Invalid hunk header at line ${i + 1}: "${line}". Expected format: "@@ -start,count +start,count @@"`
          }
        }

        const hunk: DiffHunk = {
          originalStart: parseInt(match[1]!, 10),
          originalLines: parseInt(match[2]!, 10),
          modifiedStart: parseInt(match[3]!, 10),
          modifiedLines: parseInt(match[4]!, 10),
          lines: []
        }

        i++

        // Parse hunk lines
        while (i < lines.length && !lines[i]?.startsWith('@@')) {
          const hunkLine = lines[i]
          if (!hunkLine) {
            i++
            continue
          }

          const prefix = hunkLine[0]
          const content = hunkLine.substring(1)

          if (prefix === ' ') {
            hunk.lines.push({ type: 'context', lineNumber: 0, content })
          } else if (prefix === '+') {
            hunk.lines.push({ type: 'add', lineNumber: 0, content })
          } else if (prefix === '-') {
            hunk.lines.push({ type: 'remove', lineNumber: 0, content })
          }

          i++
        }

        hunks.push(hunk)
      } else {
        i++
      }
    }

    // Validate that at least one hunk was found
    if (hunks.length === 0) {
      return {
        success: false,
        error: 'Invalid unified diff format: No hunk headers (@@ markers) found. Expected format: "@@ -start,count +start,count @@"'
      }
    }

    return {
      success: true,
      patch: {
        originalFile,
        modifiedFile,
        hunks
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse patch: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Apply a patch to content
 */
export function applyPatch(original: string, patchContent: string): PatchResult {
  const parsed = parsePatch(patchContent)

  if (!parsed.success || !parsed.patch) {
    return {
      success: false,
      error: parsed.error || 'Failed to parse patch'
    }
  }

  const lines = splitLines(original)
  const result: string[] = []
  const failedHunks: number[] = []

  let currentLine = 0

  for (let hunkIndex = 0; hunkIndex < parsed.patch.hunks.length; hunkIndex++) {
    const hunk = parsed.patch.hunks[hunkIndex]
    if (!hunk) continue

    // Copy lines before this hunk
    while (currentLine < hunk.originalStart - 1) {
      const line = lines[currentLine]
      if (line !== undefined) {
        result.push(line)
      }
      currentLine++
    }

    // Apply hunk
    let hunkLine = 0
    let originalLineInHunk = currentLine

    for (const diffLine of hunk.lines) {
      if (diffLine.type === 'context') {
        // Verify context matches
        if (originalLineInHunk < lines.length && lines[originalLineInHunk] !== diffLine.content) {
          // Context doesn't match - hunk fails
          failedHunks.push(hunkIndex)
          break
        }
        result.push(diffLine.content)
        originalLineInHunk++
      } else if (diffLine.type === 'remove') {
        // Verify line to remove matches
        if (originalLineInHunk >= lines.length || lines[originalLineInHunk] !== diffLine.content) {
          // Line to remove doesn't match - hunk fails
          failedHunks.push(hunkIndex)
          break
        }
        originalLineInHunk++
      } else if (diffLine.type === 'add') {
        result.push(diffLine.content)
      }
    }

    currentLine = originalLineInHunk
  }

  // Copy remaining lines
  while (currentLine < lines.length) {
    const line = lines[currentLine]
    if (line !== undefined) {
      result.push(line)
    }
    currentLine++
  }

  if (failedHunks.length > 0) {
    return {
      success: false,
      error: `Failed to apply hunks: ${failedHunks.join(', ')}`,
      failedHunks
    }
  }

  return {
    success: true,
    content: result.join('\n')
  }
}

/**
 * Validate that a patch can be applied to content
 */
export function validatePatch(original: string, patchContent: string): {
  valid: boolean
  error?: string
  conflicts?: string[]
} {
  // Pre-validation: Check basic format before attempting to parse/apply
  const trimmed = patchContent.trim()

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Empty patch content'
    }
  }

  if (!trimmed.includes('---') || !trimmed.includes('+++')) {
    return {
      valid: false,
      error: 'Invalid patch format: missing file headers (--- and +++). A valid unified diff requires file headers.'
    }
  }

  if (!trimmed.includes('@@')) {
    return {
      valid: false,
      error: 'Invalid patch format: missing hunk markers (@@). A valid unified diff requires at least one hunk with @@ markers.'
    }
  }

  // Attempt to parse the patch
  const parsed = parsePatch(patchContent)
  if (!parsed.success) {
    return {
      valid: false,
      error: parsed.error
    }
  }

  // Check for empty hunks (shouldn't happen after parse validation, but double-check)
  if (!parsed.patch || parsed.patch.hunks.length === 0) {
    return {
      valid: false,
      error: 'Invalid patch: no hunks found. Patch must contain at least one change.'
    }
  }

  // Attempt to apply the patch to verify it can be applied
  const result = applyPatch(original, patchContent)

  if (!result.success) {
    return {
      valid: false,
      error: result.error,
      conflicts: result.failedHunks?.map(h => `Hunk ${h + 1}`)
    }
  }

  return { valid: true }
}

/**
 * Insert content at a specific line number
 */
export function insertAtLine(
  content: string,
  lineNumber: number,
  insertContent: string,
  position: 'before' | 'after' = 'after'
): { success: boolean; content?: string; error?: string } {
  const lines = splitLines(content)
  const maxLine = lines.length + 1 // Allow insert at end + 1

  // Validate line number (1-indexed)
  if (lineNumber < 1) {
    return {
      success: false,
      error: `Line number must be >= 1, got ${lineNumber}`
    }
  }

  if (lineNumber > maxLine) {
    return {
      success: false,
      error: `Line number ${lineNumber} exceeds file length. File has ${lines.length} lines (valid range: 1-${maxLine})`
    }
  }

  const insertLines = splitLines(insertContent)
  const index = position === 'before' ? lineNumber - 1 : lineNumber

  // Insert the new lines
  lines.splice(index, 0, ...insertLines)

  return {
    success: true,
    content: lines.join('\n')
  }
}

/**
 * Replace a range of lines with new content
 */
export function replaceLineRange(
  content: string,
  startLine: number,
  endLine: number,
  replacementContent: string
): { success: boolean; content?: string; error?: string } {
  const lines = splitLines(content)

  // Validate line numbers (1-indexed)
  if (startLine < 1 || startLine > lines.length) {
    return {
      success: false,
      error: `Invalid start line ${startLine}. File has ${lines.length} lines. Valid range: 1-${lines.length}`
    }
  }

  if (endLine < 1 || endLine > lines.length) {
    return {
      success: false,
      error: `Invalid end line ${endLine}. File has ${lines.length} lines. Valid range: 1-${lines.length}`
    }
  }

  if (startLine > endLine) {
    return {
      success: false,
      error: `Start line ${startLine} must be less than or equal to end line ${endLine}`
    }
  }

  const replacementLines = splitLines(replacementContent)

  // Replace the range (convert to 0-indexed)
  const removeCount = endLine - startLine + 1
  lines.splice(startLine - 1, removeCount, ...replacementLines)

  return {
    success: true,
    content: lines.join('\n')
  }
}