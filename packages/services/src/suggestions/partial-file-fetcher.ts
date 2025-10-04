import path from 'node:path'
import type { File } from '@promptliano/database'
import { getProjectFiles, getProjectById } from '../project-service'
import { ErrorFactory } from '@promptliano/shared'

/**
 * Partial file content with metadata
 */
export interface PartialFileContent {
  fileId: string
  path: string
  extension: string | null
  partialContent: string
  lineCount: number
  totalLines: number
  truncated: boolean
  size: number | null
}

/**
 * Options for fetching partial files
 */
export interface PartialFileFetchOptions {
  lineCount?: number // Default: 50
  includeExtensions?: string[] // Optional: filter by extensions
  excludeExtensions?: string[] // Optional: exclude extensions
  maxFileSize?: number // Optional: skip files larger than this (bytes)
  maxTotalFiles?: number // NEW: Hard cap on total files to fetch
  maxFilesPerDirectory?: number // NEW: Limit files per directory
}

/**
 * Result of partial file fetching with metadata
 */
export interface PartialFileFetchResult {
  partialFiles: PartialFileContent[]
  metadata: {
    totalFilesInDirectories: number
    filesReturned: number
    filesSkipped: number
    averageLineCount: number
    totalTokensEstimate: number
    processingTime: number
  }
}

/**
 * Extracts first N lines from file content
 */
function extractFirstLines(content: string, lineCount: number): { partial: string; totalLines: number } {
  if (!content) {
    return { partial: '', totalLines: 0 }
  }

  const lines = content.split('\n')
  const totalLines = lines.length
  const partial = lines.slice(0, lineCount).join('\n')

  return { partial, totalLines }
}

/**
 * Validates that a directory path is within the project root
 * Prevents path traversal attacks
 */
function validateDirectorySafety(directory: string, projectRoot: string): void {
  const resolved = path.resolve(projectRoot, directory)
  const relative = path.relative(projectRoot, resolved)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw ErrorFactory.invalidInput(
      'directory',
      'path within project root',
      directory,
      {
        message: `Security violation: Directory "${directory}" is outside project root. Directories must be within project path.`
      }
    )
  }
}

/**
 * Checks if file matches the selected directories (safe path comparison)
 * @param filePath - File path relative to project root
 * @param directories - Directory paths relative to project root
 * @param projectRoot - Absolute path to project root
 */
function isFileInDirectories(filePath: string, directories: string[], projectRoot: string): boolean {
  if (directories.length === 0) return false

  // Resolve file path relative to project root
  const absoluteFilePath = path.resolve(projectRoot, filePath)
  const relativeFilePath = path.relative(projectRoot, absoluteFilePath)

  // Prevent path traversal - file must be within project
  if (relativeFilePath.startsWith('..') || path.isAbsolute(relativeFilePath)) {
    return false
  }

  return directories.some((dir) => {
    try {
      // Validate directory is within project (throws on violation)
      validateDirectorySafety(dir, projectRoot)

      // Resolve directory path
      const absoluteDir = path.resolve(projectRoot, dir)
      const relativeToDir = path.relative(absoluteDir, absoluteFilePath)

      // File is in directory if relative path doesn't escape with '..'
      return !relativeToDir.startsWith('..') && relativeToDir !== '..'
    } catch (error) {
      // Invalid directory - exclude file
      return false
    }
  })
}

/**
 * Checks if file should be excluded based on options
 */
function shouldExcludeFile(file: File, options: PartialFileFetchOptions): boolean {
  const { includeExtensions, excludeExtensions, maxFileSize } = options

  // Check file size
  if (maxFileSize && file.size && file.size > maxFileSize) {
    return true
  }

  // Check extension filters
  const ext = file.extension?.toLowerCase()
  if (!ext) return false

  if (includeExtensions && includeExtensions.length > 0) {
    return !includeExtensions.map((e) => e.toLowerCase()).includes(ext)
  }

  if (excludeExtensions && excludeExtensions.length > 0) {
    return excludeExtensions.map((e) => e.toLowerCase()).includes(ext)
  }

  return false
}

/**
 * Estimates token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Fetches partial content from files in specified directories
 *
 * @param projectId - The project ID
 * @param directories - List of directory paths to fetch files from (relative to project root)
 * @param options - Fetch options
 * @returns Partial file content with metadata
 * @throws Error if directories are outside project root (path traversal attempt)
 */
export async function fetchPartialFilesFromDirectories(
  projectId: number,
  directories: string[],
  options: PartialFileFetchOptions = {}
): Promise<PartialFileFetchResult> {
  const startTime = Date.now()
  const {
    lineCount = 50,
    includeExtensions,
    excludeExtensions,
    maxFileSize,
    maxTotalFiles = 100, // Default cap at 100 files
    maxFilesPerDirectory = 50 // Default cap at 50 files per directory
  } = options

  // Get project details for root path validation
  const project = await getProjectById(projectId)
  if (!project) {
    throw ErrorFactory.notFound('Project', projectId)
  }

  const projectRoot = project.path

  // Validate all directories are within project root (security check)
  for (const dir of directories) {
    validateDirectorySafety(dir, projectRoot)
  }

  // Get all project files
  const allFiles = (await getProjectFiles(projectId)) || []

  // Group files by directory for per-directory limiting
  const filesByDirectory = new Map<string, File[]>()
  for (const dir of directories) {
    filesByDirectory.set(dir, [])
  }

  // Categorize files into directories
  for (const file of allFiles) {
    if (isFileInDirectories(file.path, directories, projectRoot)) {
      // Find which directory this file belongs to
      for (const dir of directories) {
        if (isFileInDirectories(file.path, [dir], projectRoot)) {
          filesByDirectory.get(dir)?.push(file)
          break // File only belongs to first matching directory
        }
      }
    }
  }

  const partialFiles: PartialFileContent[] = []
  let filesSkipped = 0
  let totalTokensEstimate = 0
  let totalFilesProcessed = 0

  // Process files with per-directory and total limits
  for (const [dir, files] of filesByDirectory) {
    let filesFromThisDirectory = 0

    for (const file of files) {
      // Stop if we've hit the total files cap
      if (totalFilesProcessed >= maxTotalFiles) {
        filesSkipped += files.length - filesFromThisDirectory
        break
      }

      // Stop if we've hit the per-directory cap
      if (filesFromThisDirectory >= maxFilesPerDirectory) {
        filesSkipped++
        continue
      }

      // Check if file should be excluded
      if (shouldExcludeFile(file, options)) {
        filesSkipped++
        continue
      }

      // Skip files without content
      if (!file.content) {
        filesSkipped++
        continue
      }

      // Extract first N lines
      const { partial, totalLines } = extractFirstLines(file.content, lineCount)

      totalFilesProcessed++
      filesFromThisDirectory++

      const partialFile: PartialFileContent = {
        fileId: String(file.id),
        path: file.path,
        extension: file.extension,
        partialContent: partial,
        lineCount: Math.min(lineCount, totalLines),
        totalLines,
        truncated: totalLines > lineCount,
        size: file.size
      }

      partialFiles.push(partialFile)
      totalTokensEstimate += estimateTokens(partial)
    }
  }

  // Calculate average line count
  const averageLineCount =
    partialFiles.length > 0 ? partialFiles.reduce((sum, f) => sum + f.lineCount, 0) / partialFiles.length : 0

  // Calculate total files across all directories
  const totalFilesInDirectories = Array.from(filesByDirectory.values()).reduce((sum, files) => sum + files.length, 0)

  return {
    partialFiles,
    metadata: {
      totalFilesInDirectories,
      filesReturned: partialFiles.length,
      filesSkipped,
      averageLineCount: Math.round(averageLineCount),
      totalTokensEstimate,
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Formats partial files for AI consumption
 * Returns compact JSON representation
 */
export function formatPartialFilesForAI(partialFiles: PartialFileContent[]): string {
  const formatted = partialFiles.map((file, idx) => ({
    index: idx + 1,
    id: file.fileId,
    path: file.path,
    extension: file.extension,
    lines: file.lineCount,
    totalLines: file.totalLines,
    truncated: file.truncated,
    content: file.partialContent
  }))

  return JSON.stringify(formatted, null, 2)
}
