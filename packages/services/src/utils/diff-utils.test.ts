import { describe, test, expect } from 'bun:test'
import {
  insertAtLine,
  replaceLineRange,
  createPatch,
  parsePatch,
  applyPatch,
  validatePatch,
  createDiff
} from './diff-utils'

describe('diff-utils', () => {
  describe('insertAtLine', () => {
    test('should insert content after specified line', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = insertAtLine(content, 2, 'inserted line', 'after')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nline 2\ninserted line\nline 3')
    })

    test('should insert content before specified line', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = insertAtLine(content, 2, 'inserted line', 'before')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\ninserted line\nline 2\nline 3')
    })

    test('should insert at beginning of file', () => {
      const content = 'line 1\nline 2'
      const result = insertAtLine(content, 1, 'new first line', 'before')

      expect(result.success).toBe(true)
      expect(result.content).toBe('new first line\nline 1\nline 2')
    })

    test('should insert at end of file', () => {
      const content = 'line 1\nline 2'
      const result = insertAtLine(content, 2, 'new last line', 'after')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nline 2\nnew last line')
    })

    test('should insert multiple lines', () => {
      const content = 'line 1\nline 3'
      const result = insertAtLine(content, 1, 'line 1.5\nline 2', 'after')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nline 1.5\nline 2\nline 3')
    })

    test('should handle empty file', () => {
      const content = ''
      const result = insertAtLine(content, 1, 'first line', 'after')

      expect(result.success).toBe(true)
      expect(result.content).toBe('first line')
    })

    test('should reject invalid line numbers', () => {
      const content = 'line 1\nline 2'
      const result = insertAtLine(content, 5, 'content', 'after')

      expect(result.success).toBe(false)
      expect(result.error).toContain('exceeds file length')
    })

    test('should reject line number < 1', () => {
      const content = 'line 1\nline 2'
      const result = insertAtLine(content, 0, 'content', 'after')

      expect(result.success).toBe(false)
      expect(result.error).toContain('must be >= 1')
    })

    test('should provide clear error for line number far beyond file length', () => {
      const content = 'line 1\nline 2\nline 3\nline 4'
      const result = insertAtLine(content, 100, 'content', 'after')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Line number 100')
      expect(result.error).toContain('exceeds file length')
      expect(result.error).toContain('File has 4 lines')
      expect(result.error).toContain('valid range: 1-5')
    })

    test('should allow insert at end + 1', () => {
      const content = 'line 1\nline 2\nline 3\nline 4'
      const result = insertAtLine(content, 5, 'new line', 'after')

      expect(result.success).toBe(true)
      expect(result.content).toContain('new line')
    })

    test('should provide detailed error with file context', () => {
      const content = 'Line A\nLine B\nLine C'
      const result = insertAtLine(content, 50, 'Insert', 'after')

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Line number 50 exceeds file length/)
      expect(result.error).toMatch(/File has 3 lines/)
      expect(result.error).toMatch(/valid range: 1-4/)
    })
  })

  describe('replaceLineRange', () => {
    test('should replace single line', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = replaceLineRange(content, 2, 2, 'new line 2')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nnew line 2\nline 3')
    })

    test('should replace multiple lines', () => {
      const content = 'line 1\nline 2\nline 3\nline 4'
      const result = replaceLineRange(content, 2, 3, 'replacement')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nreplacement\nline 4')
    })

    test('should replace with multiple lines', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = replaceLineRange(content, 2, 2, 'new line 2\nnew line 2.5')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nnew line 2\nnew line 2.5\nline 3')
    })

    test('should replace entire file', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = replaceLineRange(content, 1, 3, 'completely new content')

      expect(result.success).toBe(true)
      expect(result.content).toBe('completely new content')
    })

    test('should handle empty replacement', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = replaceLineRange(content, 2, 2, '')

      expect(result.success).toBe(true)
      // Empty replacement means the line is replaced with an empty line
      expect(result.content).toBe('line 1\nline 3')
    })

    test('should reject invalid start line', () => {
      const content = 'line 1\nline 2'
      const result = replaceLineRange(content, 0, 1, 'content')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid start line')
    })

    test('should reject invalid end line', () => {
      const content = 'line 1\nline 2'
      const result = replaceLineRange(content, 1, 5, 'content')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid end line')
    })

    test('should reject start > end', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = replaceLineRange(content, 3, 1, 'content')

      expect(result.success).toBe(false)
      expect(result.error).toContain('must be less than or equal to')
    })
  })

  describe('createPatch', () => {
    test('should create patch for single line change', () => {
      const original = 'line 1\nline 2\nline 3'
      const modified = 'line 1\nmodified line 2\nline 3'

      const patch = createPatch(original, modified)

      expect(patch).toContain('--- a/file')
      expect(patch).toContain('+++ b/file')
      expect(patch).toContain('@@')
      expect(patch).toContain('-line 2')
      expect(patch).toContain('+modified line 2')
    })

    test('should create patch for added lines', () => {
      const original = 'line 1\nline 3'
      const modified = 'line 1\nline 2\nline 3'

      const patch = createPatch(original, modified)

      expect(patch).toContain('+line 2')
    })

    test('should create patch for removed lines', () => {
      const original = 'line 1\nline 2\nline 3'
      const modified = 'line 1\nline 3'

      const patch = createPatch(original, modified)

      expect(patch).toContain('-line 2')
    })

    test('should return empty string for identical content', () => {
      const content = 'line 1\nline 2\nline 3'
      const patch = createPatch(content, content)

      expect(patch).toBe('')
    })

    test('should handle custom file names', () => {
      const original = 'old'
      const modified = 'new'

      const patch = createPatch(original, modified, {
        originalFile: 'path/to/old.ts',
        modifiedFile: 'path/to/new.ts'
      })

      expect(patch).toContain('--- path/to/old.ts')
      expect(patch).toContain('+++ path/to/new.ts')
    })
  })

  describe('parsePatch', () => {
    test('should parse simple unified diff', () => {
      const patchContent = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line 1
-line 2
+modified line 2
 line 3`

      const result = parsePatch(patchContent)

      expect(result.success).toBe(true)
      expect(result.patch).toBeDefined()
      expect(result.patch!.hunks).toHaveLength(1)
      expect(result.patch!.hunks[0].originalStart).toBe(1)
      expect(result.patch!.hunks[0].originalLines).toBe(3)
    })

    test('should parse multiple hunks', () => {
      const patchContent = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-old line 1
+new line 1
 line 2
@@ -5,2 +5,2 @@
 line 5
-old line 6
+new line 6`

      const result = parsePatch(patchContent)

      expect(result.success).toBe(true)
      expect(result.patch!.hunks).toHaveLength(2)
    })

    test('should reject missing file headers', () => {
      const patchContent = `@@ -1,2 +1,2 @@
 line 1
-line 2
+new line 2`

      const result = parsePatch(patchContent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing file headers')
    })

    test('should reject invalid hunk header', () => {
      const patchContent = `--- a/file.ts
+++ b/file.ts
@@ invalid header @@
 content`

      const result = parsePatch(patchContent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid hunk header')
    })
  })

  describe('applyPatch', () => {
    test('should apply simple patch', () => {
      const original = 'line 1\nline 2\nline 3'
      const patch = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line 1
-line 2
+modified line 2
 line 3`

      const result = applyPatch(original, patch)

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nmodified line 2\nline 3')
    })

    test('should apply patch with added lines', () => {
      const original = 'line 1\nline 3'
      const patch = `--- a/file
+++ b/file
@@ -1,2 +1,3 @@
 line 1
+line 2
 line 3`

      const result = applyPatch(original, patch)

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nline 2\nline 3')
    })

    test('should apply patch with removed lines', () => {
      const original = 'line 1\nline 2\nline 3'
      const patch = `--- a/file
+++ b/file
@@ -1,3 +1,2 @@
 line 1
-line 2
 line 3`

      const result = applyPatch(original, patch)

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nline 3')
    })

    test('should reject patch with mismatched context', () => {
      const original = 'line 1\nline 2\nline 3'
      const patch = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line 1
-different line
+modified line
 line 3`

      const result = applyPatch(original, patch)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to apply hunks')
    })

    test('should handle multiple hunks', () => {
      const original = 'line 1\nline 2\nline 3\nline 4'
      const patch = `--- a/file
+++ b/file
@@ -1,2 +1,2 @@
-line 1
+modified line 1
 line 2
@@ -3,2 +3,2 @@
 line 3
-line 4
+modified line 4`

      const result = applyPatch(original, patch)

      expect(result.success).toBe(true)
      expect(result.content).toBe('modified line 1\nline 2\nline 3\nmodified line 4')
    })
  })

  describe('validatePatch', () => {
    test('should validate correct patch', () => {
      const original = 'line 1\nline 2\nline 3'
      const patch = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line 1
-line 2
+modified line 2
 line 3`

      const result = validatePatch(original, patch)

      expect(result.valid).toBe(true)
    })

    test('should reject invalid patch', () => {
      const original = 'line 1\nline 2\nline 3'
      const patch = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line 1
-wrong line
+modified line
 line 3`

      const result = validatePatch(original, patch)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.conflicts).toBeDefined()
    })

    describe('Format Validation - Edge Cases', () => {
      test('should reject empty patch', () => {
        const result = validatePatch('content', '')

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Empty patch content')
      })

      test('should reject patch with only whitespace', () => {
        const result = validatePatch('content', '   \n  \n  ')

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Empty patch content')
      })

      test('should reject random text as patch', () => {
        const result = validatePatch('content', 'this is not a valid patch')

        expect(result.valid).toBe(false)
        expect(result.error).toContain('missing file headers')
      })

      test('should reject patch without minus header', () => {
        const patch = `+++ b/file
@@ -1,1 +1,1 @@
-old
+new`

        const result = validatePatch('content', patch)

        expect(result.valid).toBe(false)
        expect(result.error).toContain('missing file headers')
      })

      test('should reject patch without plus header', () => {
        const patch = `--- a/file
@@ -1,1 +1,1 @@
-old
+new`

        const result = validatePatch('content', patch)

        expect(result.valid).toBe(false)
        expect(result.error).toContain('missing file headers')
      })

      test('should reject patch without hunk markers', () => {
        const patch = `--- a/file
+++ b/file
just some content`

        const result = validatePatch('content', patch)

        expect(result.valid).toBe(false)
        expect(result.error).toContain('missing hunk markers')
      })

      test('should reject patch with malformed hunk header', () => {
        const patch = `--- a/file
+++ b/file
@@ invalid hunk header @@
 content`

        const result = validatePatch('content', patch)

        expect(result.valid).toBe(false)
        expect(result.error).toContain('Invalid hunk header')
      })

      test('should accept valid minimal patch', () => {
        const original = 'old line'
        const patch = `--- a/file
+++ b/file
@@ -1,1 +1,1 @@
-old line
+new line`

        const result = validatePatch(original, patch)

        expect(result.valid).toBe(true)
      })
    })
  })

  describe('parsePatch - Enhanced Validation', () => {
    test('should reject empty patch content', () => {
      const result = parsePatch('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Empty patch content')
    })

    test('should reject patch without file headers', () => {
      const result = parsePatch('@@ -1,1 +1,1 @@\n-old\n+new')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing file headers')
    })

    test('should reject patch without hunks', () => {
      const result = parsePatch('--- a/file\n+++ b/file\nno hunks here')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No hunk headers')
    })

    test('should provide format guidance in error message', () => {
      const result = parsePatch('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toContain('unified diff format')
    })
  })

  describe('line ending handling', () => {
    test('should normalize CRLF to LF', () => {
      const content = 'line 1\r\nline 2\r\nline 3'
      const result = insertAtLine(content, 2, 'inserted', 'after')

      expect(result.success).toBe(true)
      expect(result.content).toBe('line 1\nline 2\ninserted\nline 3')
    })

    test('should handle mixed line endings', () => {
      const content = 'line 1\r\nline 2\nline 3\r'
      const result = replaceLineRange(content, 2, 2, 'new line')

      expect(result.success).toBe(true)
      // Mixed line endings are normalized to \n
      // Note: trailing \r becomes an empty line after normalization
      expect(result.content).toBe('line 1\nnew line\nline 3\n')
    })
  })

  describe('edge cases', () => {
    test('should handle single line file', () => {
      const content = 'single line'
      const result = replaceLineRange(content, 1, 1, 'replaced')

      expect(result.success).toBe(true)
      expect(result.content).toBe('replaced')
    })

    test('should handle file with only newlines', () => {
      const content = '\n\n\n'
      const result = insertAtLine(content, 2, 'content', 'after')

      expect(result.success).toBe(true)
    })

    test('should handle empty content for replace', () => {
      const content = 'line 1\nline 2\nline 3'
      const result = replaceLineRange(content, 1, 3, '')

      expect(result.success).toBe(true)
      expect(result.content).toBe('')
    })
  })
})