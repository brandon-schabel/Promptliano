// Backward compatibility wrapper - imports from new factory-based implementation
export * from './file-services/file-search-service'

// Re-export main types and singleton for existing code
export type { SearchOptions, SearchResult, SearchStats, FileSearchService } from './file-services/file-search-service'

export { fileSearchService } from './file-services/file-search-service'
