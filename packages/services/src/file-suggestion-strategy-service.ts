// Backward compatibility wrapper - imports from new factory-based implementation
export * from './file-services/file-suggestion-strategy-service'

// Re-export main types and singleton for existing code
export type {
  FileSuggestionResponse,
  StrategyConfig,
  FileSuggestionStrategyService
} from './file-services/file-suggestion-strategy-service'

export { fileSuggestionStrategyService } from './file-services/file-suggestion-strategy-service'
