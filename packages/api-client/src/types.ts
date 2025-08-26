// Re-export shared types from base client
export type { ApiConfig, DataResponseSchema } from './base-client'
export { PromptlianoError } from './base-client'

// Import and re-export commonly used types from database schemas
export type {
  CreateChat as CreateChatBody,
  UpdateChat as UpdateChatBody,
  CreateChatMessage,
  UpdateChatMessage
} from '@promptliano/database'

// Use schema types for entities
import type { ChatSchema, ChatMessageSchema } from '@promptliano/database'
export type Chat = typeof ChatSchema._type
export type ChatMessage = typeof ChatMessageSchema._type

// Note: AiChatStreamRequest moved to API types

export type {
  CreateProject as CreateProjectBody,
  UpdateProject as UpdateProjectBody,
  CreateFile as ProjectFile
} from '@promptliano/database'

// Use schema types for entities
import type { ProjectSchema, FileSchema } from '@promptliano/database'
export type Project = typeof ProjectSchema._type
export type File = typeof FileSchema._type

// Note: ProjectStatistics available via API types

export type { CreatePrompt as CreatePromptBody, UpdatePrompt as UpdatePromptBody } from '@promptliano/database'

// Use schema type for entity
import type { PromptSchema } from '@promptliano/database'
export type Prompt = typeof PromptSchema._type

// Note: OptimizePromptRequest available via API types

export type {
  CreateProviderKey as CreateProviderKeyBody,
  UpdateProviderKey as UpdateProviderKeyBody
} from '@promptliano/database'

// Use schema type for entity
import type { ProviderKeySchema } from '@promptliano/database'
export type ProviderKey = typeof ProviderKeySchema._type

export type {
  CreateClaudeAgent as CreateClaudeAgentBody,
  UpdateClaudeAgent as UpdateClaudeAgentBody
} from '@promptliano/database'

// Use schema type for entity
import type { ClaudeAgentSchema } from '@promptliano/database'
export type ClaudeAgent = typeof ClaudeAgentSchema._type

// Claude Command types
export type {
  CreateClaudeCommand as CreateClaudeCommandBody,
  UpdateClaudeCommand as UpdateClaudeCommandBody
} from '@promptliano/database'

// Use schema type for entity
import type { ClaudeCommandSchema } from '@promptliano/database'
export type ClaudeCommand = typeof ClaudeCommandSchema._type

// Note: Other command types available via API types

// Provider testing types available via API types
// export type {
//   TestProviderRequest,
//   TestProviderResponse,
//   BatchTestProviderRequest,
//   BatchTestProviderResponse,
//   ProviderHealthStatus,
//   ValidateCustomProviderRequest,
//   CustomProviderFeatures,
//   ProviderModel
// } from '@promptliano/schemas'

// AI generation types available via API types
// export type {
//   AiGenerateTextRequest,
//   UnifiedModel
// } from '@promptliano/schemas'

// Claude Code types available via API types
// export type {
//   ClaudeSession,
//   ClaudeSessionMetadata,
//   ClaudeSessionCursor,
//   ClaudeMessage,
//   ClaudeProjectData,
//   ClaudeSessionsResponse,
//   ClaudeSessionsPaginatedResponse,
//   ClaudeSessionsMetadataResponse,
//   ClaudeMessagesResponse,
//   ClaudeProjectDataResponse,
//   ClaudeSessionQuery,
//   ClaudeMessageQuery
// } from '@promptliano/schemas'

// Git-related types available via API types
// export type {
//   GitBranch,
//   GitCommit,
//   GitStatus,
//   GitStash,
//   GitWorktree,
//   GitFileDiff,
//   GitDiff,
//   GitRemote,
//   GitTag,
//   GitBlame,
//   GitLogEntry,
//   GitDiffResponse,
//   GitOperationResponse,
//   GitStatusResult,
//   GetProjectGitStatusResponse,
//   GitBranchListResponse,
//   GitLogResponse,
//   GitCommitDetailResponse,
//   GitWorktreeListResponse,
//   GitWorktreePruneResponse,
//   GitLogEnhancedRequest,
//   GitLogEnhancedResponse,
//   GitBranchListEnhancedResponse,
//   GitCompareCommitsResponse
// } from '@promptliano/schemas'

// Ticket and Queue types
export type {
  CreateTicket as CreateTicketBody,
  UpdateTicket as UpdateTicketBody,
  CreateTask as CreateTaskBody,
  UpdateTask as UpdateTaskBody,
  CreateQueue,
  UpdateQueue,
  CreateQueueItem,
  UpdateQueueItem
} from '@promptliano/database'

// Use schema types for entities
import type { TicketSchema, TaskSchema, QueueSchema, QueueItemSchema } from '@promptliano/database'
export type Ticket = typeof TicketSchema._type
export type TicketTask = typeof TaskSchema._type
export type Queue = typeof QueueSchema._type
export type QueueItem = typeof QueueItemSchema._type

// Note: Complex types like TicketWithTasks, QueueStats available via API types

// Define Task alias for backwards compatibility using schema type
export type Task = typeof TaskSchema._type

// Missing types needed by queue client
export type CompleteTaskBody = {
  itemType: 'ticket' | 'task'
  itemId: number
  ticketId?: number
  completionNotes?: string
}

export type FailTaskBody = {
  itemType: 'ticket' | 'task'
  itemId: number
  ticketId?: number
  errorMessage: string
}

// Re-export complex types from API generated types
// These are available via the generated TypeSafe client

// MCP types available via API types
// export type {
//   MCPServerConfig,
//   MCPServerConfigResponse,
//   MCPToolExecutionRequest,
//   MCPToolExecutionResult,
//   MCPServerState,
//   MCPTool,
//   MCPResource,
//   CreateMCPServerConfigBody,
//   UpdateMCPServerConfigBody,
//   MCPAnalyticsOverview,
//   MCPAnalyticsRequest,
//   MCPExecutionQuery,
//   MCPExecutionTimeline,
//   MCPToolStatistics,
//   MCPToolPattern,
//   MCPToolExecution,
//   MCPExecutionListResponse
// } from '@promptliano/schemas'

// Additional types that will be defined in individual client modules
// as needed rather than importing from schemas to avoid import errors

// Note: Complex types for MCP, Flow, Agent Files, Claude Code, and Markdown
// are defined within their respective client modules to avoid dependency issues.

// Define missing types here to satisfy type checker
export type MCPGlobalConfig = {
  mcpEnabled: boolean
  defaultServers: Array<{
    name: string
    command: string
    args: string[]
  }>
  maxConcurrentServers: number
  serverTimeoutMs: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export type MCPProjectConfig = {
  projectId: number
  mcpEnabled: boolean
  servers: Array<{
    id: number
    name: string
    command: string
    args: string[]
    autoStart: boolean
  }>
  customInstructions?: string
}

export type MCPInstallationStatus = {
  projectConfig: {
    projectId: number
    projectName: string
    mcpEnabled: boolean
    installedTools: Array<{
      tool: string
      installedAt: number
      configPath?: string
      serverName: string
    }>
    customInstructions?: string
  } | null
  connectionStatus: {
    connected: boolean
    sessionId?: string
    lastActivity?: number
    projectId?: number
  }
}

export type MCPAnalyticsData = {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  toolUsage: Array<{
    toolName: string
    count: number
    averageTime: number
  }>
  serverStats: Array<{
    serverId: number
    serverName: string
    executions: number
    uptime: number
  }>
}

export type MCPInstallRequest = {
  tools: string[]
  customInstructions?: string
}

export type MCPInstallResponse = {
  success: boolean
  data: {
    installationId: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    message?: string
  }
}

export type MCPUninstallRequest = {
  removeAll?: boolean
  tools?: string[]
}

export type MCPUninstallResponse = {
  success: boolean
  data: {
    status: 'completed' | 'failed'
    message?: string
  }
}

export type MCPProjectConfigRequest = {
  mcpEnabled?: boolean
  servers?: Array<{
    name: string
    command: string
    args: string[]
    autoStart?: boolean
  }>
  customInstructions?: string
}

export type MCPProjectConfigResponse = {
  success: boolean
  data: MCPProjectConfig
}

// Note: CreateMCPServerConfigBody and UpdateMCPServerConfigBody are already imported from schemas above

// Git-related types that are missing from schemas
export type GitDiffFile = {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  insertions: number
  deletions: number
  binary: boolean
}

export type GitCommitDetails = {
  hash: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
  parents: string[]
  files: Array<{
    path: string
    status: string
    insertions: number
    deletions: number
  }>
  stats: {
    total: number
    insertions: number
    deletions: number
  }
}

export type CommitSummaryRequest = {
  projectId: number
  commitHash: string
}

export type FileCommitHistoryRequest = {
  projectId: number
  filePath: string
  limit?: number
}

export type GitOperationRequest = {
  projectId: number
  operation: string
  parameters?: Record<string, any>
}

export type GitBranchOperationRequest = {
  projectId: number
  branchName: string
  operation: 'create' | 'delete' | 'switch' | 'merge'
  startPoint?: string
  force?: boolean
}

export type GitStashOperationRequest = {
  projectId: number
  operation: 'save' | 'apply' | 'pop' | 'drop'
  stashRef?: string
  message?: string
}

export type GitWorktreeOperationRequest = {
  projectId: number
  operation: 'add' | 'remove' | 'list' | 'lock' | 'unlock'
  path?: string
  branch?: string
  force?: boolean
}

export type GitDiffRequest = {
  projectId: number
  filePath?: string
  commitHash1?: string
  commitHash2?: string
  staged?: boolean
}

// Claude Hooks types available via database schemas
export type { CreateClaudeHook, UpdateClaudeHook } from '@promptliano/database'

// Use schema type for entity
import type { ClaudeHookSchema } from '@promptliano/database'
export type ClaudeHook = typeof ClaudeHookSchema._type

// Other hook types available via API types
