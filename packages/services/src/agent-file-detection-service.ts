// Backward compatibility wrapper - imports from new factory-based implementation
export * from './file-services/agent-file-detection-service'

// Re-export main types and singleton for existing code
export type {
  DetectedAgentFile,
  AgentFilePattern,
  AgentFileDetectionService
} from './file-services/agent-file-detection-service'

export { agentFileDetectionService } from './file-services/agent-file-detection-service'
