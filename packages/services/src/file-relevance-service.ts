// Backward compatibility wrapper - imports from new factory-based implementation
export * from './file-services/file-relevance-service'

// Re-export main types and singleton for existing code
export type {
  RelevanceConfig,
  RelevanceScoreResult,
  FileRelevanceService
} from './file-services/file-relevance-service'

export { fileRelevanceService } from './file-services/file-relevance-service'