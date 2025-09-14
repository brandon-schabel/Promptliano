import { ProjectFile } from '@promptliano/schemas'

// Common binary file extensions
const BINARY_EXTENSIONS = new Set([
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.ico',
  '.svg',
  '.webp',
  '.tiff',
  // Videos
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.mkv',
  '.webm',
  // Audio
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.ogg',
  '.wma',
  '.m4a',
  // Archives
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.bz2',
  '.xz',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  // Executables
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.app',
  // Database
  '.db',
  '.sqlite',
  '.mdb',
  '.accdb',
  // Fonts
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot'
])

// File size limit for processing (1MB)
const MAX_FILE_SIZE_FOR_PROCESSING = 1024 * 1024

export interface FileCategory {
  category: 'text' | 'binary' | 'too-large' | 'empty' | 'error'
  reason?: string
}

export interface FileCategorization {
  text: ProjectFile[]
  binary: ProjectFile[]
  tooLarge: ProjectFile[]
  empty: ProjectFile[]
  error: ProjectFile[]
  processable: ProjectFile[] // Files that can be processed (text files)
  nonProcessable: ProjectFile[] // Files that cannot be processed
}

export interface FileStats {
  total: number
  text: number
  binary: number
  tooLarge: number
  empty: number
  error: number
  processable: number
  nonProcessable: number
  textPercentage: number // (text / total) * 100
  processablePercentage: number // (processable / total) * 100
}

/**
 * Categorize a single file based on its properties
 */
export function categorizeFile(file: ProjectFile): FileCategory {
  // Check if empty
  if (!file.content || file.content.trim().length === 0) {
    return {
      category: 'empty',
      reason: 'File has no content'
    }
  }

  // Check if binary based on extension
  const extension = file.extension?.toLowerCase()
  if (extension && BINARY_EXTENSIONS.has(extension)) {
    return {
      category: 'binary',
      reason: `Binary file type: ${extension}`
    }
  }

  // Check if too large
  if (file.size && file.size > MAX_FILE_SIZE_FOR_PROCESSING) {
    return {
      category: 'too-large',
      reason: `File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
    }
  }

  // Default to text file
  return { category: 'text', reason: 'Text file suitable for processing' }
}

/**
 * Categorize an array of files
 */
export function categorizeProjectFiles(files: ProjectFile[]): FileCategorization {
  const categorization: FileCategorization = {
    text: [],
    binary: [],
    tooLarge: [],
    empty: [],
    error: [],
    processable: [],
    nonProcessable: []
  }

  files.forEach((file) => {
    const { category } = categorizeFile(file)

    switch (category) {
      case 'text':
        categorization.text.push(file)
        categorization.processable.push(file)
        break
      case 'binary':
        categorization.binary.push(file)
        categorization.nonProcessable.push(file)
        break
      case 'too-large':
        categorization.tooLarge.push(file)
        categorization.nonProcessable.push(file)
        break
      case 'empty':
        categorization.empty.push(file)
        categorization.nonProcessable.push(file)
        break
      case 'error':
        categorization.error.push(file)
        categorization.processable.push(file) // Errors can potentially be retried
        break
    }
  })

  return categorization
}

/**
 * Get file statistics for a project
 */
export function getFileStats(files: ProjectFile[]): FileStats {
  const categorization = categorizeProjectFiles(files)

  const total = files.length
  const processable = categorization.processable.length

  const stats: FileStats = {
    total,
    text: categorization.text.length,
    binary: categorization.binary.length,
    tooLarge: categorization.tooLarge.length,
    empty: categorization.empty.length,
    error: categorization.error.length,
    processable,
    nonProcessable: categorization.nonProcessable.length,
    textPercentage: total > 0 ? (categorization.text.length / total) * 100 : 0,
    processablePercentage: total > 0 ? (processable / total) * 100 : 0
  }

  return stats
}

/**
 * Check if a file can be processed based on its properties
 */
export function canProcessFile(file: ProjectFile): boolean {
  const { category } = categorizeFile(file)
  return category === 'text' || category === 'error'
}

/**
 * Filter files that can be processed
 */
export function filterProcessableFiles(files: ProjectFile[]): ProjectFile[] {
  return files.filter(canProcessFile)
}