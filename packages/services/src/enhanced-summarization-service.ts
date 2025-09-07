// Backward compatibility wrapper - imports from new factory-based implementation
export * from './file-services/enhanced-summarization-service'

// Re-export main types and singleton for existing code
export type {
  BatchProgress,
  GroupContext,
  EnhancedSummarizationService
} from './file-services/enhanced-summarization-service'

export { enhancedSummarizationService } from './file-services/enhanced-summarization-service'
