import { asc, desc, eq, and, inArray, sql, isNotNull } from 'drizzle-orm'
import { db } from '../db'
import { chatStreamEvents, chatStreams } from '../schema'

export interface CreateChatStreamParams {
  chatId: number
  direction: 'assistant' | 'user'
  provider: string
  model: string
  messageMetadata?: Record<string, unknown> | null
}

export interface FinalizeChatStreamParams {
  finishedAt: number
  finishReason?: string | null
  usage?: Record<string, unknown> | null
  assistantMessageId?: number | null
  messageMetadata?: Record<string, unknown> | null
}

export interface StreamEventBatchItem {
  type: string
  payload: unknown | null
  ts?: number
}

export interface GetStreamsForChatOptions {
  limit?: number
  direction?: 'assistant' | 'user'
  includeUnfinished?: boolean
}

export interface StreamSummary {
  id: number
  chatId: number
  direction: 'assistant' | 'user'
  provider: string
  model: string
  startedAt: number
  finishedAt: number | null
  finishReason: string | null
  usageJson: Record<string, unknown> | null
  messageMetadataJson: Record<string, unknown> | null
  format: 'ui' | 'data'
  version: number
  assistantMessageId: number | null
  createdAt: number
  updatedAt: number
  eventCount: number
  latestEventTs: number | null
}

export const chatStreamRepository = {
  async createStream(params: CreateChatStreamParams) {
    const now = Date.now()
    const [row] = await db
      .insert(chatStreams)
      .values({
        chatId: params.chatId,
        direction: params.direction,
        provider: params.provider,
        model: params.model,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        messageMetadataJson: params.messageMetadata ?? null
      })
      .returning({ id: chatStreams.id })

    if (!row) {
      throw new Error('Failed to create chat stream')
    }

    return row
  },

  async getStreamById(streamId: number) {
    const [stream] = await db.select().from(chatStreams).where(eq(chatStreams.id, streamId)).limit(1)
    return stream ?? null
  },

  async getStreamWithEvents(streamId: number) {
    const stream = await db.query.chatStreams?.findFirst({
      where: eq(chatStreams.id, streamId),
      with: {
        events: {
          orderBy: asc(chatStreamEvents.seq)
        }
      }
    })

    return stream ?? null
  },

  async getLatestStreamForChat(chatId: number) {
    const [stream] = await db
      .select()
      .from(chatStreams)
      .where(eq(chatStreams.chatId, chatId))
      .orderBy(desc(chatStreams.startedAt))
      .limit(1)

    return stream ?? null
  },

  async getStreamsForChat(chatId: number, options: GetStreamsForChatOptions = {}) {
    const predicates = [eq(chatStreams.chatId, chatId)]

    if (options.direction) {
      predicates.push(eq(chatStreams.direction, options.direction))
    }

    if (options.includeUnfinished === false) {
      predicates.push(isNotNull(chatStreams.finishedAt))
    }

    const whereClause = predicates.length === 1 ? predicates[0] : and(...predicates)

    const streams = await db
      .select()
      .from(chatStreams)
      .where(whereClause)
      .orderBy(desc(chatStreams.startedAt), desc(chatStreams.id))
      .limit(options.limit ?? 20)

    if (streams.length === 0) {
      return [] as StreamSummary[]
    }

    const streamIds = streams.map((entry) => entry.id)
    const aggregates = await db
      .select({
        streamId: chatStreamEvents.streamId,
        eventCount: sql<number>`count(${chatStreamEvents.id})`,
        latestEventTs: sql<number | null>`max(${chatStreamEvents.ts})`
      })
      .from(chatStreamEvents)
      .where(inArray(chatStreamEvents.streamId, streamIds))
      .groupBy(chatStreamEvents.streamId)

    const aggregateMap = new Map<number, { eventCount: number; latestEventTs: number | null }>()
    for (const aggregate of aggregates) {
      aggregateMap.set(aggregate.streamId, {
        eventCount: aggregate.eventCount,
        latestEventTs: aggregate.latestEventTs
      })
    }

    return streams.map((stream) => ({
      ...stream,
      eventCount: aggregateMap.get(stream.id)?.eventCount ?? 0,
      latestEventTs: aggregateMap.get(stream.id)?.latestEventTs ?? null
    })) as StreamSummary[]
  },

  async appendEvents(streamId: number, batch: StreamEventBatchItem[], lastSeq: number = 0) {
    if (!batch.length) {
      return lastSeq
    }

    const now = Date.now()
    const rows = batch.map((event, index) => ({
      streamId,
      seq: lastSeq + index + 1,
      ts: event.ts ?? now,
      type: event.type,
      payload: event.payload ?? null
    }))

    await db.transaction(async (tx) => {
      await tx.insert(chatStreamEvents).values(rows)
      await tx.update(chatStreams).set({ updatedAt: Date.now() }).where(eq(chatStreams.id, streamId))
    })

    return lastSeq + batch.length
  },

  async finalizeStream(streamId: number, params: FinalizeChatStreamParams) {
    const updateData: Record<string, unknown> = {
      finishedAt: params.finishedAt,
      finishReason: params.finishReason ?? null,
      usageJson: params.usage ?? null,
      assistantMessageId: params.assistantMessageId ?? null,
      updatedAt: Date.now()
    }

    if (params.messageMetadata !== undefined) {
      updateData.messageMetadataJson = params.messageMetadata ?? null
    }

    await db.update(chatStreams).set(updateData).where(eq(chatStreams.id, streamId))
  },

  async getEvents(streamId: number) {
    return db
      .select({
        streamId: chatStreamEvents.streamId,
        id: chatStreamEvents.id,
        seq: chatStreamEvents.seq,
        ts: chatStreamEvents.ts,
        type: chatStreamEvents.type,
        payload: chatStreamEvents.payload
      })
      .from(chatStreamEvents)
      .where(eq(chatStreamEvents.streamId, streamId))
      .orderBy(asc(chatStreamEvents.seq))
  }
}
