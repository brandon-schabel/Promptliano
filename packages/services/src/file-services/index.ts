// File Service Factory
export * from './file-service-factory'

// Individual File Services
export * from './file-search-service'
export * from './file-grouping-service'
export * from './file-relevance-service'
export * from './file-suggestion-strategy-service'
export * from './agent-file-detection-service'

// Re-export singletons for backward compatibility
export { fileSearchService } from './file-search-service'
export { fileGroupingService } from './file-grouping-service'
export { fileRelevanceService } from './file-relevance-service'
export { fileSuggestionStrategyService } from './file-suggestion-strategy-service'
export { agentFileDetectionService } from './agent-file-detection-service'
