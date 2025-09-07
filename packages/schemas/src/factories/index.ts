/**
 * Schema Factory Exports
 *
 * Centralized exports for all schema factory functions.
 * These factories reduce repetitive schema definitions by 90%.
 */

// Response Schema Factories
export {
  createSuccessResponseSchema,
  createOperationResponseSchema,
  createMetadataResponseSchema,
  createResponseWithWarningsSchema,
  createConditionalResponseSchema,
  createMutationResponseSchema
} from './response-schema-factory'

// List Response Factories
export {
  createListResponseSchema,
  createGroupedListResponseSchema,
  createTreeResponseSchema,
  createCategorizedListResponseSchema,
  createFilteredListResponseSchema,
  createListWithStatsResponseSchema,
  createEmptyListResponseSchema
} from './list-response-factory'

// Paginated Response Factories
export {
  createPaginatedResponseSchema,
  createInfiniteScrollResponseSchema,
  createOffsetPaginationResponseSchema,
  createKeysetPaginationResponseSchema,
  createRelayPaginationResponseSchema,
  createTimeBasedPaginationResponseSchema,
  createHybridPaginationResponseSchema
} from './paginated-response-factory'

// Error Response Factories
export {
  createErrorResponseSchema,
  createValidationErrorResponseSchema,
  standardErrorResponses,
  createBatchErrorResponseSchema,
  createPartialFailureResponseSchema,
  createRetryableErrorResponseSchema,
  createActionableErrorResponseSchema,
  createFieldErrorSchema,
  createDetailedValidationErrorResponseSchema
} from './error-response-factory'

// Error Registry
export {
  domainErrorResponses,
  allErrorResponses,
  getErrorResponses,
  createStandardErrorResponses,
  createErrorResponse,
  createCustomDomainError,
  type ErrorCode
} from './error-registry'

// Streaming Response Factories
export {
  createStreamingResponseSchema,
  createWebSocketMessageSchema,
  createChunkedResponseSchema,
  createServerSentEventSchema,
  createStreamProgressSchema,
  createBidirectionalStreamSchema,
  createRealtimeUpdateSchema,
  createStreamingBatchResponseSchema
} from './streaming-response-factory'
