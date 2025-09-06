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
import { z } from 'zod'

// Helper type for schema inference
type InferSchema<T> = T extends { _output: infer U } ? U : T extends { _def: { _output: infer V } } ? V : any

export type Chat = InferSchema<typeof ChatSchema>
export type ChatMessage = InferSchema<typeof ChatMessageSchema>

// Note: AiChatStreamRequest moved to API types

export type {
  CreateProject as CreateProjectBody,
  UpdateProject as UpdateProjectBody,
  CreateFile as ProjectFile
} from '@promptliano/database'

// Use schema types for entities
import type { ProjectSchema, FileSchema } from '@promptliano/database'
export type Project = InferSchema<typeof ProjectSchema>
export type File = InferSchema<typeof FileSchema>

// Note: ProjectStatistics available via API types

export type { CreatePrompt as CreatePromptBody, UpdatePrompt as UpdatePromptBody } from '@promptliano/database'

// Use schema type for entity
import type { PromptSchema } from '@promptliano/database'
export type Prompt = InferSchema<typeof PromptSchema>

// Note: OptimizePromptRequest available via API types

export type {
  CreateProviderKey as CreateProviderKeyBody,
  UpdateProviderKey as UpdateProviderKeyBody
} from '@promptliano/database'

// Use schema type for entity
import type { ProviderKeySchema } from '@promptliano/database'
export type ProviderKey = InferSchema<typeof ProviderKeySchema>

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


// Other hook types available via API types
