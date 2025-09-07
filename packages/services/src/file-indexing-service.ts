// Backward compatibility wrapper - imports from new factory-based implementation
export * from './file-services/file-indexing-service'

// Re-export main types and singleton for existing code
export type { IndexingStats, IndexingResult, FileIndexingService } from './file-services/file-indexing-service'

export { fileIndexingService } from './file-services/file-indexing-service'
