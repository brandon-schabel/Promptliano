import { z } from '@hono/zod-openapi'
import { getZodDescription } from '../utils/zod-meta'

/**
 * Creates a schema for SSE streaming responses
 */
export function createStreamingResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  options?: {
    includeHeartbeat?: boolean
    includeMetadata?: boolean
    includeProgress?: boolean
    name?: string
  }
) {
  const schemaName = options?.name || getZodDescription(dataSchema) || 'Data'
  
  const eventTypes = ['data', 'error', 'complete'] as string[]
  
  if (options?.includeHeartbeat) {
    eventTypes.push('heartbeat')
  }
  
  if (options?.includeMetadata) {
    eventTypes.push('metadata')
  }
  
  if (options?.includeProgress) {
    eventTypes.push('progress')
  }
  
  const dataUnion: z.ZodTypeAny[] = [
    dataSchema,
    z.object({ error: z.string(), code: z.string().optional() }),
    z.object({ complete: z.boolean(), summary: z.any().optional() })
  ]
  
  if (options?.includeHeartbeat) {
    dataUnion.push(z.object({ heartbeat: z.number() }))
  }
  
  if (options?.includeMetadata) {
    dataUnion.push(z.object({ metadata: z.record(z.string(), z.any()) }))
  }
  
  if (options?.includeProgress) {
    dataUnion.push(z.object({ 
      progress: z.number().min(0).max(100),
      message: z.string().optional()
    }))
  }
  
  // Ensure we have at least 2 items for union
  const unionSchema = dataUnion.length < 2 
    ? dataSchema 
    : z.union([dataUnion[0], dataUnion[1], ...dataUnion.slice(2)] as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
  
  return z.object({
    event: z.enum(eventTypes as [string, ...string[]]),
    data: unionSchema,
    id: z.string().optional(),
    retry: z.number().optional()
  }).openapi(`${schemaName}StreamResponse`)
}

/**
 * Creates a WebSocket message schema
 */
export function createWebSocketMessageSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(dataSchema) || 'Data'
  
  return z.object({
    type: z.enum(['message', 'error', 'ping', 'pong', 'close', 'open']),
    data: dataSchema.optional(),
    error: z.string().optional(),
    code: z.number().optional().describe('WebSocket close code'),
    timestamp: z.number(),
    id: z.string().optional().describe('Message ID for acknowledgment')
  }).openapi(`${schemaName}WebSocketMessage`)
}

/**
 * Creates a chunked response schema for large data
 */
export function createChunkedResponseSchema<T extends z.ZodTypeAny>(
  chunkSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(chunkSchema) || 'Chunk'
  
  return z.object({
    chunkId: z.string(),
    chunkIndex: z.number().int().min(0),
    totalChunks: z.number().int().min(1),
    data: chunkSchema,
    isLast: z.boolean(),
    checksum: z.string().optional().describe('Checksum for data integrity')
  }).openapi(`${schemaName}ChunkedResponse`)
}

/**
 * Creates a server-sent event schema
 */
export function createServerSentEventSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(dataSchema) || 'Event'
  
  return z.object({
    id: z.string().optional(),
    event: z.string().optional(),
    data: z.union([
      z.string(),
      dataSchema
    ]),
    retry: z.number().optional()
  }).openapi(`${schemaName}ServerSentEvent`)
}

/**
 * Creates a streaming progress update schema
 */
export function createStreamProgressSchema(name?: string) {
  return z.object({
    event: z.literal('progress'),
    data: z.object({
      current: z.number(),
      total: z.number(),
      percentage: z.number().min(0).max(100),
      message: z.string().optional(),
      eta: z.number().optional().describe('Estimated time remaining in seconds'),
      throughput: z.number().optional().describe('Items per second')
    }),
    timestamp: z.number()
  }).openapi(name || 'StreamProgressUpdate')
}

/**
 * Creates a bi-directional streaming schema (for WebSocket)
 */
export function createBidirectionalStreamSchema<TRequest extends z.ZodTypeAny, TResponse extends z.ZodTypeAny>(
  requestSchema: TRequest,
  responseSchema: TResponse,
  name?: string
) {
  const schemaName = name || 'BidirectionalStream'
  
  const ClientMessage = z.object({
    type: z.enum(['request', 'ping', 'close']),
    data: requestSchema.optional(),
    id: z.string(),
    timestamp: z.number()
  }).openapi(`${schemaName}ClientMessage`)
  
  const ServerMessage = z.object({
    type: z.enum(['response', 'pong', 'error', 'close']),
    data: responseSchema.optional(),
    error: z.string().optional(),
    requestId: z.string().optional(),
    timestamp: z.number()
  }).openapi(`${schemaName}ServerMessage`)
  
  return {
    client: ClientMessage,
    server: ServerMessage
  }
}

/**
 * Creates a real-time update schema
 */
export function createRealtimeUpdateSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(dataSchema) || 'Update'
  
  return z.object({
    type: z.enum(['create', 'update', 'delete', 'patch']),
    data: dataSchema.optional(),
    id: z.union([z.string(), z.number()]),
    timestamp: z.number(),
    version: z.number().optional().describe('Data version for conflict resolution'),
    delta: z.any().optional().describe('Change delta for updates')
  }).openapi(`${schemaName}RealtimeUpdate`)
}

/**
 * Creates a streaming batch response schema
 */
export function createStreamingBatchResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name?: string
) {
  const schemaName = name || getZodDescription(itemSchema) || 'Batch'
  
  return z.object({
    event: z.enum(['batch', 'complete', 'error']),
    data: z.union([
      z.object({
        items: z.array(itemSchema),
        batchIndex: z.number(),
        totalBatches: z.number().optional()
      }),
      z.object({
        complete: z.literal(true),
        totalProcessed: z.number(),
        duration: z.number()
      }),
      z.object({
        error: z.string(),
        failedBatch: z.number().optional()
      })
    ]),
    timestamp: z.number()
  }).openapi(`${schemaName}StreamingBatchResponse`)
}
