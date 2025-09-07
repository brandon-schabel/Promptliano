// Backward compatibility wrapper - imports from new factory-based implementation
export * from './file-services/file-grouping-service'

// Re-export main types and singleton for existing code
export type { FileRelationshipGraph, GroupingOptions, FileGroupingService } from './file-services/file-grouping-service'

export { fileGroupingService } from './file-services/file-grouping-service'
