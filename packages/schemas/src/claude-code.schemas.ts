import { z } from '@hono/zod-openapi'

// Claude Code message content types
export const ClaudeTextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string()
})

export const ClaudeImageContentSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.string(),
    data: z.string()
  })
})

export const ClaudeToolResultContentSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([
    z.string(),
    z.array(z.any()) // Allow nested content arrays
  ])
})

export const ClaudeToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.any()
})

export const ClaudeContentSchema = z.union([
  ClaudeTextContentSchema,
  ClaudeImageContentSchema,
  ClaudeToolResultContentSchema,
  ClaudeToolUseContentSchema,
  z.string() // For simple string content
])

// Token usage breakdown
export const TokenUsageSchema = z.object({
  input_tokens: z.coerce.number().optional(),
  cache_creation_input_tokens: z.coerce.number().optional(),
  cache_read_input_tokens: z.coerce.number().optional(),
  output_tokens: z.coerce.number().optional(),
  service_tier: z.string().optional()
})

// Tool use result (for todo tracking etc)
export const ToolUseResultSchema = z
  .object({
    oldTodos: z.array(z.any()).optional(),
    newTodos: z.array(z.any()).optional()
  })
  .passthrough() // Allow additional fields

// Claude Code message schema (from JSONL files)
export const ClaudeMessageSchema = z.object({
  type: z.enum(['user', 'assistant', 'result', 'system', 'summary']),
  message: z
    .object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.union([
        z.string(),
        z.array(ClaudeContentSchema),
        z.null() // Handle null content
      ]),
      id: z.string().nullable().optional(), // Message ID (for assistant messages) - can be null
      model: z.string().nullable().optional(), // Model used (for assistant messages) - can be null
      stop_reason: z.string().nullable().optional(),
      stop_sequence: z.string().nullable().optional(),
      usage: TokenUsageSchema.optional() // Token usage breakdown
    })
    .optional(), // Some system messages may not have message object
  timestamp: z.string(), // ISO 8601 format
  sessionId: z.string(),
  uuid: z.string().nullable().optional(), // Unique message identifier - can be null
  parentUuid: z.string().nullable().optional(), // Parent message UUID for threading - can be null
  requestId: z.string().nullable().optional(), // Request tracking ID - can be null
  userType: z.string().nullable().optional(), // "external" or other types - can be null
  isSidechain: z.boolean().optional(), // Sidechain flag
  cwd: z.string().nullable().optional(), // Working directory - can be null
  version: z.string().nullable().optional(), // Claude Code version - can be null
  gitBranch: z.string().nullable().optional(), // Git branch at message time - can be null
  toolUseResult: z
    .union([
      ToolUseResultSchema,
      z.string(), // Can be a string that needs parsing
      z.array(z.any()), // Can be an array
      z.null() // Can be null
    ])
    .optional(), // Tool use results (todos, etc)
  // Additional fields found in real Claude Code data
  content: z.union([z.string(), z.array(ClaudeContentSchema), z.null()]).optional(), // Top-level content (for system messages)
  isMeta: z.boolean().optional(), // Meta message flag
  toolUseID: z.string().nullable().optional(), // Tool use identifier - can be null
  level: z.string().optional(), // Log level (info, debug, etc)
  // Legacy fields (kept for backward compatibility)
  tokensUsed: z.coerce.number().nullable().optional(),
  costUsd: z.coerce.number().nullable().optional(),
  durationMs: z.coerce.number().nullable().optional(),
  model: z.string().nullable().optional()
})

// Lenient schema for third-party Claude Code data that may not match our strict schema
export const ClaudeMessageLenientSchema = z
  .object({
    type: z.enum(['user', 'assistant', 'result', 'system', 'summary']).or(z.string()).optional().default('assistant'),
    message: z
      .union([
        z.object({
          role: z.enum(['user', 'assistant', 'system']).or(z.string()).optional().default('assistant'),
          content: z
            .union([
              z.string(),
              z.array(ClaudeContentSchema),
              z.array(z.any()), // Allow arrays of any content
              z.null(),
              z.any() // Allow any content format
            ])
            .optional()
            .default(''),
          id: z.string().nullable().optional(),
          model: z.string().nullable().optional(),
          stop_reason: z.string().nullable().optional(),
          stop_sequence: z.string().nullable().optional(),
          usage: TokenUsageSchema.optional()
        }),
        z.string(), // Sometimes message is just a string
        z.array(z.any()), // Sometimes message is an array
        z.null(), // Sometimes message is null
        z.any() // Fallback for any message format
      ])
      .optional()
      .default({}),
    timestamp: z.union([z.string(), z.null()]).optional().default(new Date().toISOString()),
    sessionId: z.union([z.string(), z.null()]).optional().default('unknown'),
    uuid: z.union([z.string(), z.null(), z.undefined()]).optional(),
    parentUuid: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(), // Accept numbers too
    requestId: z.union([z.string(), z.boolean(), z.null(), z.undefined()]).optional(), // Accept booleans too
    userType: z.union([z.string(), z.object({}), z.null(), z.undefined()]).optional(), // Accept objects too
    isSidechain: z.union([z.boolean(), z.string(), z.undefined()]).optional(), // Accept string booleans
    cwd: z.union([z.string(), z.array(z.any()), z.null(), z.undefined()]).optional(), // Accept arrays too
    version: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(), // Accept numbers too
    gitBranch: z.union([z.string(), z.date(), z.null(), z.undefined()]).optional(), // Accept dates too
    toolUseResult: z
      .union([
        ToolUseResultSchema,
        z.string(), // Accept string values
        z.array(z.any()), // Accept array values
        z.null(), // Accept null values
        z.any() // Accept any format
      ])
      .optional(),
    // Additional fields found in real Claude Code data
    content: z
      .union([
        z.string(),
        z.array(ClaudeContentSchema),
        z.array(z.any()), // Allow arrays of any content
        z.null(),
        z.any() // Allow any content format
      ])
      .optional(), // Top-level content (for system messages)
    isMeta: z.boolean().optional(), // Meta message flag
    toolUseID: z.union([z.string(), z.symbol(), z.null(), z.undefined()]).optional(), // Tool use identifier - can be null or symbol
    level: z.union([z.string(), z.null(), z.undefined()]).optional(), // Log level (info, debug, etc) - can be null
    // Legacy fields
    tokensUsed: z.coerce.number().nullable().optional(),
    costUsd: z.coerce.number().nullable().optional(),
    durationMs: z.coerce.number().nullable().optional(),
    model: z.string().nullable().optional()
  })
  .passthrough() // Allow additional unknown fields

export type ClaudeMessage = z.infer<typeof ClaudeMessageSchema>
export type ClaudeMessageLenient = z.infer<typeof ClaudeMessageLenientSchema>
export type TokenUsage = z.infer<typeof TokenUsageSchema>
export type ToolUseResult = z.infer<typeof ToolUseResultSchema>

// Session metadata derived from messages
export const ClaudeSessionSchema = z.object({
  sessionId: z.string(),
  projectPath: z.string(),
  startTime: z.string(),
  lastUpdate: z.string(),
  messageCount: z.number(),
  gitBranch: z.string().optional(),
  cwd: z.string().optional(),
  // Token breakdown totals
  tokenUsage: z
    .object({
      totalInputTokens: z.number(),
      totalCacheCreationTokens: z.number(),
      totalCacheReadTokens: z.number(),
      totalOutputTokens: z.number(),
      totalTokens: z.number() // Sum of all token types
    })
    .optional(),
  serviceTiers: z.array(z.string()).optional(), // All service tiers used
  // Legacy fields
  totalTokensUsed: z.number().optional(),
  totalCostUsd: z.number().optional()
})

export type ClaudeSession = z.infer<typeof ClaudeSessionSchema>

// Project data extracted from Claude files
export const ClaudeProjectDataSchema = z.object({
  projectPath: z.string(),
  encodedPath: z.string(), // The encoded directory name
  sessions: z.array(ClaudeSessionSchema),
  totalMessages: z.number(),
  firstMessageTime: z.string().optional(),
  lastMessageTime: z.string().optional(),
  branches: z.array(z.string()), // All git branches seen in messages
  workingDirectories: z.array(z.string()) // All cwds seen
})

export type ClaudeProjectData = z.infer<typeof ClaudeProjectDataSchema>

// API Response schemas
export const ClaudeSessionsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeSessionSchema)
  })
  .openapi('ClaudeSessionsResponse')

export const ClaudeMessagesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeMessageSchema)
  })
  .openapi('ClaudeMessagesResponse')

export const ClaudeProjectDataResponseSchema = z
  .object({
    success: z.literal(true),
    data: ClaudeProjectDataSchema
  })
  .openapi('ClaudeProjectDataResponse')

// Query parameter schemas
export const ClaudeSessionQuerySchema = z
  .object({
    search: z.string().optional(),
    branch: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.coerce.number().int().positive().optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0)
  })
  .openapi('ClaudeSessionQuery')

export const ClaudeMessageQuerySchema = z
  .object({
    search: z.string().optional(),
    role: z.enum(['user', 'assistant', 'all']).optional().default('all'),
    limit: z.coerce.number().int().positive().optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0)
  })
  .openapi('ClaudeMessageQuery')

// Lightweight session metadata for efficient loading
export const ClaudeSessionMetadataSchema = z.object({
  sessionId: z.string(),
  projectPath: z.string(),
  startTime: z.string(),
  lastUpdate: z.string(),
  messageCount: z.number(),
  fileSize: z.number(), // Size of JSONL file in bytes
  hasGitBranch: z.boolean(),
  hasCwd: z.boolean(),
  firstMessagePreview: z.string().optional(), // First 100 chars of first message
  lastMessagePreview: z.string().optional() // First 100 chars of last message
})

export type ClaudeSessionMetadata = z.infer<typeof ClaudeSessionMetadataSchema>

// Cursor-based pagination for efficient traversal
export const ClaudeSessionCursorSchema = z
  .object({
    cursor: z.string().optional(), // Base64 encoded cursor
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    sortBy: z.enum(['lastUpdate', 'startTime', 'messageCount', 'fileSize']).optional().default('lastUpdate'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().optional(),
    branch: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  })
  .openapi('ClaudeSessionCursor')

export type ClaudeSessionCursor = z.infer<typeof ClaudeSessionCursorSchema>

// Response for paginated sessions
export const ClaudeSessionsPaginatedResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeSessionSchema),
    pagination: z.object({
      hasMore: z.boolean(),
      nextCursor: z.string().optional(),
      total: z.number().optional() // Only calculated when specifically requested
    })
  })
  .openapi('ClaudeSessionsPaginatedResponse')

// Response for session metadata
export const ClaudeSessionsMetadataResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeSessionMetadataSchema),
    pagination: z
      .object({
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
        total: z.number().optional()
      })
      .optional()
  })
  .openapi('ClaudeSessionsMetadataResponse')

// Export inferred types for the missing response types
export type ClaudeSessionsResponse = z.infer<typeof ClaudeSessionsResponseSchema>
export type ClaudeSessionsPaginatedResponse = z.infer<typeof ClaudeSessionsPaginatedResponseSchema>
export type ClaudeSessionsMetadataResponse = z.infer<typeof ClaudeSessionsMetadataResponseSchema>
export type ClaudeMessagesResponse = z.infer<typeof ClaudeMessagesResponseSchema>
export type ClaudeProjectDataResponse = z.infer<typeof ClaudeProjectDataResponseSchema>
export type ClaudeSessionQuery = z.infer<typeof ClaudeSessionQuerySchema>
export type ClaudeMessageQuery = z.infer<typeof ClaudeMessageQuerySchema>
