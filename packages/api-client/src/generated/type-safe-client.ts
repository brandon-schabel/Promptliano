/**
 * AUTO-GENERATED TYPE-SAFE API CLIENT
 * Generated at: 2025-10-10T23:15:52.043Z
 * Generated from: 214 API endpoints
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import type { paths } from './api-types'

// Re-export all paths for external usage
export type ApiPaths = paths

// ===== GENERATED TYPES FOR ALL ENDPOINTS =====

export type GetProjectsResponse = paths['/api/projects']['get']['responses']['200']['content']['application/json']
export type CreateProjectResponse = paths['/api/projects']['post']['responses']['201']['content']['application/json']
export type CreateProjectRequest = NonNullable<paths['/api/projects']['post']['requestBody']>['content']['application/json']
export type GetProjectResponse = paths['/api/projects/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateProjectResponse = paths['/api/projects/{id}']['patch']['responses']['200']['content']['application/json']
export type UpdateProjectRequest = NonNullable<paths['/api/projects/{id}']['patch']['requestBody']>['content']['application/json']
export type DeleteProjectResponse = paths['/api/projects/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSearchResponse = paths['/api/projects/{id}/search']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSearchRequest = NonNullable<paths['/api/projects/{id}/search']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdSyncResponse = paths['/api/projects/{id}/sync']['post']['responses']['200']['content']['application/json']
export type GetProjectsByIdSyncStreamResponse = { success: boolean; message?: string }
export type GetProjectsByIdFilesResponse = paths['/api/projects/{id}/files']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdFilesMetadataResponse = paths['/api/projects/{id}/files/metadata']['get']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdFilesBulkResponse = paths['/api/projects/{id}/files/bulk']['put']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdFilesBulkRequest = NonNullable<paths['/api/projects/{id}/files/bulk']['put']['requestBody']>['content']['application/json']
export type UpdateProjectsByIdFilesByFileIdResponse = paths['/api/projects/{id}/files/{fileId}']['put']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdFilesByFileIdRequest = NonNullable<paths['/api/projects/{id}/files/{fileId}']['put']['requestBody']>['content']['application/json']
export type CreateProjectsByIdRefreshResponse = paths['/api/projects/{id}/refresh']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSuggestFilesResponse = paths['/api/projects/{id}/suggest-files']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSuggestFilesRequest = NonNullable<paths['/api/projects/{id}/suggest-files']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdStatisticsResponse = paths['/api/projects/{id}/statistics']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdTicketsResponse = paths['/api/projects/{id}/tickets']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdTicketsWithCountResponse = paths['/api/projects/{id}/tickets-with-count']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdTicketsWithTasksResponse = paths['/api/projects/{id}/tickets-with-tasks']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdPromptsResponse = paths['/api/projects/{id}/prompts']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSuggestPromptsResponse = paths['/api/projects/{id}/suggest-prompts']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSuggestPromptsRequest = NonNullable<paths['/api/projects/{id}/suggest-prompts']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdPromptsByPromptIdResponse = paths['/api/projects/{id}/prompts/{promptId}']['post']['responses']['200']['content']['application/json']
export type DeleteProjectsByIdPromptsByPromptIdResponse = paths['/api/projects/{id}/prompts/{promptId}']['delete']['responses']['200']['content']['application/json']
export type CreateProjectsByIdPromptsImportResponse = paths['/api/projects/{id}/prompts/import']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdPromptsImportRequest = NonNullable<paths['/api/projects/{id}/prompts/import']['post']['requestBody']>['content']['multipart/form-data']
export type GetProjectsByIdPromptsExportResponse = paths['/api/projects/{id}/prompts/export']['get']['responses']['200']['content']['application/json']
export type CreateTicketResponse = paths['/api/tickets']['post']['responses']['201']['content']['application/json']
export type CreateTicketRequest = NonNullable<paths['/api/tickets']['post']['requestBody']>['content']['application/json']
export type GetTicketResponse = paths['/api/tickets/{ticketId}']['get']['responses']['200']['content']['application/json']
export type UpdateTicketResponse = paths['/api/tickets/{ticketId}']['patch']['responses']['200']['content']['application/json']
export type UpdateTicketRequest = NonNullable<paths['/api/tickets/{ticketId}']['patch']['requestBody']>['content']['application/json']
export type DeleteTicketResponse = paths['/api/tickets/{ticketId}']['delete']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdCompleteResponse = paths['/api/tickets/{ticketId}/complete']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdLinkFilesResponse = paths['/api/tickets/{ticketId}/link-files']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdLinkFilesRequest = NonNullable<paths['/api/tickets/{ticketId}/link-files']['post']['requestBody']>['content']['application/json']
export type CreateTicketsByTicketIdSuggestFilesResponse = paths['/api/tickets/{ticketId}/suggest-files']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdSuggestFilesRequest = NonNullable<paths['/api/tickets/{ticketId}/suggest-files']['post']['requestBody']>['content']['application/json']
export type CreateTicketsByTicketIdSuggestFilesStreamResponse = paths['/api/tickets/{ticketId}/suggest-files/stream']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdSuggestFilesStreamRequest = NonNullable<paths['/api/tickets/{ticketId}/suggest-files/stream']['post']['requestBody']>['content']['application/json']
export type CreateTicketsByTicketIdSuggestTasksResponse = paths['/api/tickets/{ticketId}/suggest-tasks']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdSuggestTasksRequest = NonNullable<paths['/api/tickets/{ticketId}/suggest-tasks']['post']['requestBody']>['content']['application/json']
export type ListTicketsByTicketIdTasksResponse = paths['/api/tickets/{ticketId}/tasks']['get']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdTasksResponse = paths['/api/tickets/{ticketId}/tasks']['post']['responses']['201']['content']['application/json']
export type CreateTicketsByTicketIdTasksRequest = NonNullable<paths['/api/tickets/{ticketId}/tasks']['post']['requestBody']>['content']['application/json']
export type UpdateTicketsByTicketIdTasksByTaskIdResponse = paths['/api/tickets/{ticketId}/tasks/{taskId}']['patch']['responses']['200']['content']['application/json']
export type UpdateTicketsByTicketIdTasksByTaskIdRequest = NonNullable<paths['/api/tickets/{ticketId}/tasks/{taskId}']['patch']['requestBody']>['content']['application/json']
export type DeleteTicketsByTicketIdTasksByTaskIdResponse = paths['/api/tickets/{ticketId}/tasks/{taskId}']['delete']['responses']['200']['content']['application/json']
export type UpdateTicketsByTicketIdTasksReorderResponse = paths['/api/tickets/{ticketId}/tasks/reorder']['patch']['responses']['200']['content']['application/json']
export type UpdateTicketsByTicketIdTasksReorderRequest = NonNullable<paths['/api/tickets/{ticketId}/tasks/reorder']['patch']['requestBody']>['content']['application/json']
export type CreateTicketsByTicketIdAutoGenerateTasksResponse = paths['/api/tickets/{ticketId}/auto-generate-tasks']['post']['responses']['200']['content']['application/json']
export type ListTicketsBulkTasksResponse = paths['/api/tickets/bulk-tasks']['get']['responses']['200']['content']['application/json']
export type GetTicketTicketsResponse = paths['/api/tickets/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateTicketTicketsResponse = paths['/api/tickets/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateTicketTicketsRequest = NonNullable<paths['/api/tickets/{id}']['put']['requestBody']>['content']['application/json']
export type DeleteTicketTicketsResponse = paths['/api/tickets/{id}']['delete']['responses']['200']['content']['application/json']
export type GetChatsResponse = paths['/api/chats']['get']['responses']['200']['content']['application/json']
export type CreateChatResponse = paths['/api/chats']['post']['responses']['201']['content']['application/json']
export type CreateChatRequest = NonNullable<paths['/api/chats']['post']['requestBody']>['content']['application/json']
export type ListChatsByChatIdMessagesResponse = paths['/api/chats/{chatId}/messages']['get']['responses']['200']['content']['application/json']
export type CreateChatsByChatIdForkResponse = paths['/api/chats/{chatId}/fork']['post']['responses']['201']['content']['application/json']
export type CreateChatsByChatIdForkRequest = NonNullable<paths['/api/chats/{chatId}/fork']['post']['requestBody']>['content']['application/json']
export type CreateChatsByChatIdForkByMessageIdResponse = paths['/api/chats/{chatId}/fork/{messageId}']['post']['responses']['201']['content']['application/json']
export type CreateChatsByChatIdForkByMessageIdRequest = NonNullable<paths['/api/chats/{chatId}/fork/{messageId}']['post']['requestBody']>['content']['application/json']
export type UpdateChatResponse = paths['/api/chats/{chatId}']['patch']['responses']['200']['content']['application/json']
export type UpdateChatRequest = NonNullable<paths['/api/chats/{chatId}']['patch']['requestBody']>['content']['application/json']
export type DeleteChatResponse = paths['/api/chats/{chatId}']['delete']['responses']['200']['content']['application/json']
export type GetChatResponse = paths['/api/chats/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateChatChatsResponse = paths['/api/chats/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateChatChatsRequest = NonNullable<paths['/api/chats/{id}']['put']['requestBody']>['content']['application/json']
export type DeleteChatChatsResponse = paths['/api/chats/{id}']['delete']['responses']['200']['content']['application/json']
export type DeleteChatsByChatIdMessagesByMessageIdResponse = paths['/api/chats/{chatId}/messages/{messageId}']['delete']['responses']['200']['content']['application/json']
export type GetPromptsResponse = paths['/api/prompts']['get']['responses']['200']['content']['application/json']
export type CreatePromptResponse = paths['/api/prompts']['post']['responses']['201']['content']['application/json']
export type CreatePromptRequest = NonNullable<paths['/api/prompts']['post']['requestBody']>['content']['application/json']
export type GetPromptResponse = paths['/api/prompts/{id}']['get']['responses']['200']['content']['application/json']
export type UpdatePromptResponse = paths['/api/prompts/{id}']['put']['responses']['200']['content']['application/json']
export type UpdatePromptRequest = NonNullable<paths['/api/prompts/{id}']['put']['requestBody']>['content']['application/json']
export type UpdatePromptPromptsResponse = paths['/api/prompts/{id}']['patch']['responses']['200']['content']['application/json']
export type UpdatePromptPromptsRequest = NonNullable<paths['/api/prompts/{id}']['patch']['requestBody']>['content']['application/json']
export type DeletePromptResponse = paths['/api/prompts/{id}']['delete']['responses']['200']['content']['application/json']
export type CreatePromptsImportResponse = paths['/api/prompts/import']['post']['responses']['200']['content']['application/json']
export type CreatePromptsImportRequest = NonNullable<paths['/api/prompts/import']['post']['requestBody']>['content']['multipart/form-data']
export type GetPromptsByIdExportResponse = { success: boolean; message?: string }
export type CreatePromptsExportBatchResponse = paths['/api/prompts/export-batch']['post']['responses']['200']['content']['application/json']
export type CreatePromptsExportBatchRequest = NonNullable<paths['/api/prompts/export-batch']['post']['requestBody']>['content']['application/json']
export type CreatePromptsValidateMarkdownResponse = paths['/api/prompts/validate-markdown']['post']['responses']['200']['content']['application/json']
export type CreatePromptsValidateMarkdownRequest = NonNullable<paths['/api/prompts/validate-markdown']['post']['requestBody']>['content']['application/json']
export type ListProjectsByProjectIdQueuesResponse = paths['/api/projects/:projectId/queues']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByProjectIdQueuesResponse = paths['/api/projects/:projectId/queues']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByProjectIdQueuesRequest = NonNullable<paths['/api/projects/:projectId/queues']['post']['requestBody']>['content']['application/json']
export type GetQueueResponse = paths['/api/queues/:queueId']['get']['responses']['200']['content']['application/json']
export type UpdateQueueResponse = paths['/api/queues/:queueId']['patch']['responses']['200']['content']['application/json']
export type UpdateQueueRequest = NonNullable<paths['/api/queues/:queueId']['patch']['requestBody']>['content']['application/json']
export type DeleteQueueResponse = paths['/api/queues/:queueId']['delete']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdEnqueueResponse = paths['/api/tickets/:ticketId/enqueue']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdEnqueueRequest = NonNullable<paths['/api/tickets/:ticketId/enqueue']['post']['requestBody']>['content']['application/json']
export type CreateTicketsByTicketIdTasksByTaskIdEnqueueResponse = paths['/api/tickets/:ticketId/tasks/:taskId/enqueue']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdTasksByTaskIdEnqueueRequest = NonNullable<paths['/api/tickets/:ticketId/tasks/:taskId/enqueue']['post']['requestBody']>['content']['application/json']
export type CreateTicketsByTicketIdDequeueResponse = paths['/api/tickets/:ticketId/dequeue']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdTasksByTaskIdDequeueResponse = paths['/api/tickets/:ticketId/tasks/:taskId/dequeue']['post']['responses']['200']['content']['application/json']
export type ListQueuesByQueueIdStatsResponse = paths['/api/queues/:queueId/stats']['get']['responses']['200']['content']['application/json']
export type ListProjectsByProjectIdQueuesWithStatsResponse = paths['/api/projects/:projectId/queues-with-stats']['get']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdNextTaskResponse = paths['/api/queues/:queueId/next-task']['post']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdNextTaskRequest = NonNullable<paths['/api/queues/:queueId/next-task']['post']['requestBody']>['content']['application/json']
export type ListProjectsByProjectIdUnqueuedItemsResponse = paths['/api/projects/:projectId/unqueued-items']['get']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdPauseResponse = paths['/api/queues/:queueId/pause']['post']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdResumeResponse = paths['/api/queues/:queueId/resume']['post']['responses']['200']['content']['application/json']
export type CreateQueueByItemTypeByItemIdCompleteResponse = paths['/api/queue/:itemType/:itemId/complete']['post']['responses']['200']['content']['application/json']
export type CreateQueueByItemTypeByItemIdCompleteRequest = NonNullable<paths['/api/queue/:itemType/:itemId/complete']['post']['requestBody']>['content']['application/json']
export type CreateQueueByItemTypeByItemIdFailResponse = paths['/api/queue/:itemType/:itemId/fail']['post']['responses']['200']['content']['application/json']
export type CreateQueueByItemTypeByItemIdFailRequest = NonNullable<paths['/api/queue/:itemType/:itemId/fail']['post']['requestBody']>['content']['application/json']
export type CreateQueueByItemTypeByItemIdMoveResponse = paths['/api/queue/:itemType/:itemId/move']['post']['responses']['200']['content']['application/json']
export type CreateQueueByItemTypeByItemIdMoveRequest = NonNullable<paths['/api/queue/:itemType/:itemId/move']['post']['requestBody']>['content']['application/json']
export type CreateQueuesByQueueIdEnqueueTicketResponse = paths['/api/queues/:queueId/enqueue-ticket']['post']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdEnqueueTicketRequest = NonNullable<paths['/api/queues/:queueId/enqueue-ticket']['post']['requestBody']>['content']['application/json']
export type ListQueuesByQueueIdItemsResponse = paths['/api/queues/:queueId/items']['get']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdItemsResponse = paths['/api/queues/:queueId/items']['post']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdItemsRequest = NonNullable<paths['/api/queues/:queueId/items']['post']['requestBody']>['content']['application/json']
export type CreateQueuesByQueueIdBatchEnqueueResponse = paths['/api/queues/:queueId/batch-enqueue']['post']['responses']['200']['content']['application/json']
export type CreateQueuesByQueueIdBatchEnqueueRequest = NonNullable<paths['/api/queues/:queueId/batch-enqueue']['post']['requestBody']>['content']['application/json']
export type ListQueuesByQueueIdTimelineResponse = paths['/api/queues/:queueId/timeline']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigLocationsResponse = paths['/api/projects/{id}/mcp/config/locations']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigMergedResponse = paths['/api/projects/{id}/mcp/config/merged']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigExpandedResponse = paths['/api/projects/{id}/mcp/config/expanded']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigResponse = paths['/api/projects/{id}/mcp/config']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigSaveToLocationResponse = paths['/api/projects/{id}/mcp/config/save-to-location']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigSaveToLocationRequest = NonNullable<paths['/api/projects/{id}/mcp/config/save-to-location']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdMcpConfigDefaultForLocationResponse = paths['/api/projects/{id}/mcp/config/default-for-location']['get']['responses']['200']['content']['application/json']
export type ListProxyCopilot_healthResponse = paths['/api/proxy/copilot/_health']['get']['responses']['200']['content']['application/json']
export type CreateCopilotEmbedToggleResponse = paths['/api/copilot/embed/toggle']['post']['responses']['200']['content']['application/json']
export type CreateCopilotEmbedToggleRequest = NonNullable<paths['/api/copilot/embed/toggle']['post']['requestBody']>['content']['application/json']
export type CreateCopilotEmbedSettingsResponse = paths['/api/copilot/embed/settings']['post']['responses']['200']['content']['application/json']
export type CreateCopilotEmbedSettingsRequest = NonNullable<paths['/api/copilot/embed/settings']['post']['requestBody']>['content']['application/json']
export type CreateCopilotEmbedAuthStartResponse = paths['/api/copilot/embed/auth/start']['post']['responses']['200']['content']['application/json']
export type CreateCopilotEmbedAuthCompleteResponse = paths['/api/copilot/embed/auth/complete']['post']['responses']['200']['content']['application/json']
export type CreateCopilotEmbedAuthCompleteRequest = NonNullable<paths['/api/copilot/embed/auth/complete']['post']['requestBody']>['content']['application/json']
export type ListCopilotEmbedStatusResponse = paths['/api/copilot/embed/status']['get']['responses']['200']['content']['application/json']
export type GetQueueQueuesResponse = paths['/api/queues/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateQueueQueuesResponse = paths['/api/queues/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateQueueQueuesRequest = NonNullable<paths['/api/queues/{id}']['put']['requestBody']>['content']['application/json']
export type DeleteQueueQueuesResponse = paths['/api/queues/{id}']['delete']['responses']['200']['content']['application/json']
export type GetKeysResponse = paths['/api/keys']['get']['responses']['200']['content']['application/json']
export type CreateKeyResponse = paths['/api/keys']['post']['responses']['201']['content']['application/json']
export type CreateKeyRequest = NonNullable<paths['/api/keys']['post']['requestBody']>['content']['application/json']
export type GetKeyResponse = paths['/api/keys/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateKeyResponse = paths['/api/keys/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateKeyRequest = NonNullable<paths['/api/keys/{id}']['put']['requestBody']>['content']['application/json']
export type UpdateKeyProviderKeysResponse = paths['/api/keys/{id}']['patch']['responses']['200']['content']['application/json']
export type UpdateKeyProviderKeysRequest = NonNullable<paths['/api/keys/{id}']['patch']['requestBody']>['content']['application/json']
export type DeleteKeyResponse = paths['/api/keys/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateKeysValidateCustomResponse = paths['/api/keys/validate-custom']['post']['responses']['200']['content']['application/json']
export type CreateKeysValidateCustomRequest = NonNullable<paths['/api/keys/validate-custom']['post']['requestBody']>['content']['application/json']
export type CreateProvidersTestResponse = paths['/api/providers/test']['post']['responses']['200']['content']['application/json']
export type CreateProvidersTestRequest = NonNullable<paths['/api/providers/test']['post']['requestBody']>['content']['application/json']
export type CreateProvidersBatchTestResponse = paths['/api/providers/batch-test']['post']['responses']['200']['content']['application/json']
export type CreateProvidersBatchTestRequest = NonNullable<paths['/api/providers/batch-test']['post']['requestBody']>['content']['application/json']
export type ListProvidersHealthResponse = paths['/api/providers/health']['get']['responses']['200']['content']['application/json']
export type UpdateProvidersSettingsResponse = paths['/api/providers/settings']['put']['responses']['200']['content']['application/json']
export type UpdateProvidersSettingsRequest = NonNullable<paths['/api/providers/settings']['put']['requestBody']>['content']['application/json']
export type ListAiChatByChatIdMcpSessionResponse = paths['/api/ai/chat/{chatId}/mcp-session']['get']['responses']['200']['content']['application/json']
export type CreateAiChatByChatIdMcpToolsRunResponse = paths['/api/ai/chat/{chatId}/mcp/tools/run']['post']['responses']['200']['content']['application/json']
export type CreateAiChatByChatIdMcpToolsRunRequest = NonNullable<paths['/api/ai/chat/{chatId}/mcp/tools/run']['post']['requestBody']>['content']['application/json']
export type CreateAiChatSdkResponse = { success: boolean; message?: string }
export type CreateAiChatSdkRequest = NonNullable<paths['/api/ai/chat/sdk']['post']['requestBody']>['content']['application/json']
export type GetProvidersResponse = paths['/api/providers']['get']['responses']['200']['content']['application/json']
export type CreateAiMermaidFixResponse = paths['/api/ai/mermaid/fix']['post']['responses']['200']['content']['application/json']
export type CreateAiMermaidFixRequest = NonNullable<paths['/api/ai/mermaid/fix']['post']['requestBody']>['content']['application/json']
export type GetModelsResponse = paths['/api/models']['get']['responses']['200']['content']['application/json']
export type ListProviders_debugConfigResponse = paths['/api/providers/_debug-config']['get']['responses']['200']['content']['application/json']
export type CreateAiGenerateTextResponse = paths['/api/ai/generate/text']['post']['responses']['200']['content']['application/json']
export type CreateAiGenerateTextRequest = NonNullable<paths['/api/ai/generate/text']['post']['requestBody']>['content']['application/json']
export type CreateProviderSettingResponse = paths['/api/provider-settings']['post']['responses']['200']['content']['application/json']
export type CreateProviderSettingRequest = NonNullable<paths['/api/provider-settings']['post']['requestBody']>['content']['application/json']
export type CreateGenAiStreamResponse = { success: boolean; message?: string }
export type CreateGenAiStreamRequest = NonNullable<paths['/api/gen-ai/stream']['post']['requestBody']>['content']['application/json']
export type CreateGenAiTextResponse = paths['/api/gen-ai/text']['post']['responses']['200']['content']['application/json']
export type CreateGenAiTextRequest = NonNullable<paths['/api/gen-ai/text']['post']['requestBody']>['content']['application/json']
export type CreateGenAiStructuredResponse = paths['/api/gen-ai/structured']['post']['responses']['200']['content']['application/json']
export type CreateGenAiStructuredRequest = NonNullable<paths['/api/gen-ai/structured']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdFlowResponse = paths['/api/projects/{id}/flow']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdFlowItemsResponse = paths['/api/projects/{id}/flow/items']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdFlowUnqueuedResponse = paths['/api/projects/{id}/flow/unqueued']['get']['responses']['200']['content']['application/json']
export type CreateFlowQueuesResponse = paths['/api/flow/queues']['post']['responses']['200']['content']['application/json']
export type CreateFlowQueuesRequest = NonNullable<paths['/api/flow/queues']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdFlowQueuesResponse = paths['/api/projects/{id}/flow/queues']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdFlowQueuesWithStatsResponse = paths['/api/projects/{id}/flow/queues-with-stats']['get']['responses']['200']['content']['application/json']
export type ListFlowQueuesByQueueIdItemsResponse = paths['/api/flow/queues/{queueId}/items']['get']['responses']['200']['content']['application/json']
export type ListFlowQueuesByQueueIdStatsResponse = paths['/api/flow/queues/{queueId}/stats']['get']['responses']['200']['content']['application/json']
export type UpdateFlowQueuesByQueueIdResponse = paths['/api/flow/queues/{queueId}']['patch']['responses']['200']['content']['application/json']
export type UpdateFlowQueuesByQueueIdRequest = NonNullable<paths['/api/flow/queues/{queueId}']['patch']['requestBody']>['content']['application/json']
export type DeleteFlowQueuesByQueueIdResponse = paths['/api/flow/queues/{queueId}']['delete']['responses']['200']['content']['application/json']
export type CreateFlowTicketsByTicketIdEnqueueResponse = paths['/api/flow/tickets/{ticketId}/enqueue']['post']['responses']['200']['content']['application/json']
export type CreateFlowTicketsByTicketIdEnqueueRequest = NonNullable<paths['/api/flow/tickets/{ticketId}/enqueue']['post']['requestBody']>['content']['application/json']
export type CreateFlowTasksByTaskIdEnqueueResponse = paths['/api/flow/tasks/{taskId}/enqueue']['post']['responses']['200']['content']['application/json']
export type CreateFlowTasksByTaskIdEnqueueRequest = NonNullable<paths['/api/flow/tasks/{taskId}/enqueue']['post']['requestBody']>['content']['application/json']
export type CreateFlowTicketsByTicketIdDequeueResponse = paths['/api/flow/tickets/{ticketId}/dequeue']['post']['responses']['200']['content']['application/json']
export type CreateFlowTasksByTaskIdDequeueResponse = paths['/api/flow/tasks/{taskId}/dequeue']['post']['responses']['200']['content']['application/json']
export type CreateFlowMoveResponse = paths['/api/flow/move']['post']['responses']['200']['content']['application/json']
export type CreateFlowMoveRequest = NonNullable<paths['/api/flow/move']['post']['requestBody']>['content']['application/json']
export type CreateFlowReorderResponse = paths['/api/flow/reorder']['post']['responses']['200']['content']['application/json']
export type CreateFlowReorderRequest = NonNullable<paths['/api/flow/reorder']['post']['requestBody']>['content']['application/json']
export type CreateFlowProcessStartResponse = paths['/api/flow/process/start']['post']['responses']['200']['content']['application/json']
export type CreateFlowProcessStartRequest = NonNullable<paths['/api/flow/process/start']['post']['requestBody']>['content']['application/json']
export type CreateFlowProcessCompleteResponse = paths['/api/flow/process/complete']['post']['responses']['200']['content']['application/json']
export type CreateFlowProcessCompleteRequest = NonNullable<paths['/api/flow/process/complete']['post']['requestBody']>['content']['application/json']
export type CreateFlowProcessFailResponse = paths['/api/flow/process/fail']['post']['responses']['200']['content']['application/json']
export type CreateFlowProcessFailRequest = NonNullable<paths['/api/flow/process/fail']['post']['requestBody']>['content']['application/json']
export type CreateFlowBulkMoveResponse = paths['/api/flow/bulk-move']['post']['responses']['200']['content']['application/json']
export type CreateFlowBulkMoveRequest = NonNullable<paths['/api/flow/bulk-move']['post']['requestBody']>['content']['application/json']
export type CreateBrowseDirectorResponse = paths['/api/browse-directory']['post']['responses']['200']['content']['application/json']
export type CreateBrowseDirectorRequest = NonNullable<paths['/api/browse-directory']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdMcpServersResponse = paths['/api/projects/{id}/mcp/servers']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpServersResponse = paths['/api/projects/{id}/mcp/servers']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpServersRequest = NonNullable<paths['/api/projects/{id}/mcp/servers']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdMcpServersByServerIdResponse = paths['/api/projects/{id}/mcp/servers/{serverId}']['get']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdMcpServersByServerIdResponse = paths['/api/projects/{id}/mcp/servers/{serverId}']['patch']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdMcpServersByServerIdRequest = NonNullable<paths['/api/projects/{id}/mcp/servers/{serverId}']['patch']['requestBody']>['content']['application/json']
export type DeleteProjectsByIdMcpServersByServerIdResponse = paths['/api/projects/{id}/mcp/servers/{serverId}']['delete']['responses']['200']['content']['application/json']
export type ListMcpToolsResponse = paths['/api/mcp/tools']['get']['responses']['200']['content']['application/json']
export type CreateMcpToolsExecuteResponse = paths['/api/mcp/tools/execute']['post']['responses']['200']['content']['application/json']
export type CreateMcpToolsExecuteRequest = NonNullable<paths['/api/mcp/tools/execute']['post']['requestBody']>['content']['application/json']
export type ListMcpResourcesResponse = paths['/api/mcp/resources']['get']['responses']['200']['content']['application/json']
export type CreateMcpResourcesReadResponse = paths['/api/mcp/resources/read']['post']['responses']['200']['content']['application/json']
export type CreateMcpResourcesReadRequest = NonNullable<paths['/api/mcp/resources/read']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdMcpAnalyticsExecutionsResponse = paths['/api/projects/{id}/mcp/analytics/executions']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsOverviewResponse = paths['/api/projects/{id}/mcp/analytics/overview']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsStatisticsResponse = paths['/api/projects/{id}/mcp/analytics/statistics']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsTimelineResponse = paths['/api/projects/{id}/mcp/analytics/timeline']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsErrorPatternsResponse = paths['/api/projects/{id}/mcp/analytics/error-patterns']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigResponse = paths['/api/projects/{id}/mcp/config']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigRequest = NonNullable<paths['/api/projects/{id}/mcp/config']['post']['requestBody']>['content']['application/json']
export type ListMcpInstallationDetectResponse = paths['/api/mcp/installation/detect']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpInstallationStatusResponse = paths['/api/projects/{id}/mcp/installation/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationInstallResponse = paths['/api/projects/{id}/mcp/installation/install']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationInstallRequest = NonNullable<paths['/api/projects/{id}/mcp/installation/install']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdMcpInstallationUninstallResponse = paths['/api/projects/{id}/mcp/installation/uninstall']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationUninstallRequest = NonNullable<paths['/api/projects/{id}/mcp/installation/uninstall']['post']['requestBody']>['content']['application/json']
export type ListMcpStatusResponse = paths['/api/mcp/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationBatchInstallResponse = paths['/api/projects/{id}/mcp/installation/batch-install']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationBatchInstallRequest = NonNullable<paths['/api/projects/{id}/mcp/installation/batch-install']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdMcpInstallProjectConfigResponse = paths['/api/projects/{id}/mcp/install-project-config']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallProjectConfigRequest = NonNullable<paths['/api/projects/{id}/mcp/install-project-config']['post']['requestBody']>['content']['application/json']
export type ListMcpActiveToolsResponse = paths['/api/mcp/active-tools']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitStatusResponse = paths['/api/projects/{id}/git/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStageResponse = paths['/api/projects/{id}/git/stage']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStageRequest = NonNullable<paths['/api/projects/{id}/git/stage']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitUnstageResponse = paths['/api/projects/{id}/git/unstage']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitUnstageRequest = NonNullable<paths['/api/projects/{id}/git/unstage']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitStageAllResponse = paths['/api/projects/{id}/git/stage-all']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitUnstageAllResponse = paths['/api/projects/{id}/git/unstage-all']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitCommitResponse = paths['/api/projects/{id}/git/commit']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitCommitRequest = NonNullable<paths['/api/projects/{id}/git/commit']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdGitLogResponse = paths['/api/projects/{id}/git/log']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitLogEnhancedResponse = paths['/api/projects/{id}/git/log-enhanced']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitCommitsByCommitHashResponse = paths['/api/projects/{id}/git/commits/{commitHash}']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitDiffResponse = paths['/api/projects/{id}/git/diff']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitBranchesResponse = paths['/api/projects/{id}/git/branches']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesResponse = paths['/api/projects/{id}/git/branches']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesRequest = NonNullable<paths['/api/projects/{id}/git/branches']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdGitBranchesEnhancedResponse = paths['/api/projects/{id}/git/branches-enhanced']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesSwitchResponse = paths['/api/projects/{id}/git/branches/switch']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesSwitchRequest = NonNullable<paths['/api/projects/{id}/git/branches/switch']['post']['requestBody']>['content']['application/json']
export type DeleteProjectsByIdGitBranchesByBranchNameResponse = paths['/api/projects/{id}/git/branches/{branchName}']['delete']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitStashResponse = paths['/api/projects/{id}/git/stash']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashResponse = paths['/api/projects/{id}/git/stash']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashRequest = NonNullable<paths['/api/projects/{id}/git/stash']['post']['requestBody']>['content']['application/json']
export type DeleteProjectsByIdGitStashResponse = paths['/api/projects/{id}/git/stash']['delete']['responses']['200']['content']['application/json']
export type DeleteProjectsByIdGitStashRequest = NonNullable<paths['/api/projects/{id}/git/stash']['delete']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitStashApplyResponse = paths['/api/projects/{id}/git/stash/apply']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashApplyRequest = NonNullable<paths['/api/projects/{id}/git/stash/apply']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitStashPopResponse = paths['/api/projects/{id}/git/stash/pop']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashPopRequest = NonNullable<paths['/api/projects/{id}/git/stash/pop']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdGitWorktreesResponse = paths['/api/projects/{id}/git/worktrees']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitWorktreesResponse = paths['/api/projects/{id}/git/worktrees']['post']['responses']['201']['content']['application/json']
export type CreateProjectsByIdGitWorktreesRequest = NonNullable<paths['/api/projects/{id}/git/worktrees']['post']['requestBody']>['content']['application/json']
export type DeleteProjectsByIdGitWorktreesResponse = paths['/api/projects/{id}/git/worktrees']['delete']['responses']['200']['content']['application/json']
export type DeleteProjectsByIdGitWorktreesRequest = NonNullable<paths['/api/projects/{id}/git/worktrees']['delete']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitWorktreesLockResponse = paths['/api/projects/{id}/git/worktrees/lock']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitWorktreesLockRequest = NonNullable<paths['/api/projects/{id}/git/worktrees/lock']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitWorktreesUnlockResponse = paths['/api/projects/{id}/git/worktrees/unlock']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitWorktreesUnlockRequest = NonNullable<paths['/api/projects/{id}/git/worktrees/unlock']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitWorktreesPruneResponse = paths['/api/projects/{id}/git/worktrees/prune']['post']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitRemotesResponse = paths['/api/projects/{id}/git/remotes']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitPushResponse = paths['/api/projects/{id}/git/push']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitPushRequest = NonNullable<paths['/api/projects/{id}/git/push']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitFetchResponse = paths['/api/projects/{id}/git/fetch']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitFetchRequest = NonNullable<paths['/api/projects/{id}/git/fetch']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitPullResponse = paths['/api/projects/{id}/git/pull']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitPullRequest = NonNullable<paths['/api/projects/{id}/git/pull']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdGitTagsResponse = paths['/api/projects/{id}/git/tags']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitTagsResponse = paths['/api/projects/{id}/git/tags']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitTagsRequest = NonNullable<paths['/api/projects/{id}/git/tags']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdGitResetResponse = paths['/api/projects/{id}/git/reset']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitResetRequest = NonNullable<paths['/api/projects/{id}/git/reset']['post']['requestBody']>['content']['application/json']
export type CreateProjectTabsByTabIdGenerateNameResponse = paths['/api/project-tabs/{tabId}/generate-name']['post']['responses']['200']['content']['application/json']
export type CreateProjectTabsByTabIdGenerateNameRequest = NonNullable<paths['/api/project-tabs/{tabId}/generate-name']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdAgentFilesDetectResponse = paths['/api/projects/{id}/agent-files/detect']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesUpdateResponse = paths['/api/projects/{id}/agent-files/update']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesUpdateRequest = NonNullable<paths['/api/projects/{id}/agent-files/update']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdAgentFilesRemoveInstructionsResponse = paths['/api/projects/{id}/agent-files/remove-instructions']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesRemoveInstructionsRequest = NonNullable<paths['/api/projects/{id}/agent-files/remove-instructions']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdAgentFilesStatusResponse = paths['/api/projects/{id}/agent-files/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesCreateResponse = paths['/api/projects/{id}/agent-files/create']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesCreateRequest = NonNullable<paths['/api/projects/{id}/agent-files/create']['post']['requestBody']>['content']['application/json']
export type GetProjectsByIdProcessesResponse = paths['/api/projects/{id}/processes']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdProcessesScriptsResponse = paths['/api/projects/{id}/processes/scripts']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdProcessesStartResponse = paths['/api/projects/{id}/processes/start']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdProcessesStartRequest = NonNullable<paths['/api/projects/{id}/processes/start']['post']['requestBody']>['content']['application/json']
export type CreateProjectsByIdProcessesByProcessIdStopResponse = paths['/api/projects/{id}/processes/{processId}/stop']['post']['responses']['200']['content']['application/json']
export type GetProjectsByIdProcessesHistoryResponse = paths['/api/projects/{id}/processes/history']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdProcessesByProcessIdLogsResponse = paths['/api/projects/{id}/processes/{processId}/logs']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdProcessesPortsResponse = paths['/api/projects/{id}/processes/ports']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdProcessesPortsByPortKillResponse = paths['/api/projects/{id}/processes/ports/{port}/kill']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdProcessesPortsScanResponse = paths['/api/projects/{id}/processes/ports/scan']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdProcessesScriptsRunResponse = paths['/api/projects/{id}/processes/scripts/run']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdProcessesScriptsRunRequest = NonNullable<paths['/api/projects/{id}/processes/scripts/run']['post']['requestBody']>['content']['application/json']
export type GetResearchResponse = paths['/api/research']['get']['responses']['200']['content']['application/json']
export type CreateResearcResponse = paths['/api/research']['post']['responses']['201']['content']['application/json']
export type CreateResearcRequest = NonNullable<paths['/api/research']['post']['requestBody']>['content']['application/json']
export type GetResearcResponse = paths['/api/research/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateResearcResponse = paths['/api/research/{id}']['patch']['responses']['200']['content']['application/json']
export type UpdateResearcRequest = NonNullable<paths['/api/research/{id}']['patch']['requestBody']>['content']['application/json']
export type DeleteResearcResponse = paths['/api/research/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateResearchStartResponse = paths['/api/research/start']['post']['responses']['200']['content']['application/json']
export type CreateResearchStartRequest = NonNullable<paths['/api/research/start']['post']['requestBody']>['content']['application/json']
export type GetResearchByIdSourcesResponse = paths['/api/research/{id}/sources']['get']['responses']['200']['content']['application/json']
export type CreateResearchByIdSourcesResponse = paths['/api/research/{id}/sources']['post']['responses']['200']['content']['application/json']
export type CreateResearchByIdSourcesRequest = NonNullable<paths['/api/research/{id}/sources']['post']['requestBody']>['content']['application/json']
export type CreateResearchSourcesByIdProcessResponse = paths['/api/research/sources/{id}/process']['post']['responses']['200']['content']['application/json']
export type GetResearchSourcesByIdProcessedDataResponse = paths['/api/research/sources/{id}/processed-data']['get']['responses']['200']['content']['application/json']
export type CreateResearchByIdOutlineResponse = paths['/api/research/{id}/outline']['post']['responses']['200']['content']['application/json']
export type CreateResearchByIdOutlineRequest = NonNullable<paths['/api/research/{id}/outline']['post']['requestBody']>['content']['application/json']
export type GetResearchByIdSectionsResponse = paths['/api/research/{id}/sections']['get']['responses']['200']['content']['application/json']
export type CreateResearchSectionsByIdBuildResponse = paths['/api/research/sections/{id}/build']['post']['responses']['200']['content']['application/json']
export type CreateResearchSectionsByIdBuildRequest = NonNullable<paths['/api/research/sections/{id}/build']['post']['requestBody']>['content']['application/json']
export type UpdateResearchSectionsByIdResponse = paths['/api/research/sections/{id}']['patch']['responses']['200']['content']['application/json']
export type UpdateResearchSectionsByIdRequest = NonNullable<paths['/api/research/sections/{id}']['patch']['requestBody']>['content']['application/json']
export type GetResearchByIdProgressResponse = paths['/api/research/{id}/progress']['get']['responses']['200']['content']['application/json']
export type CreateResearchByIdExportResponse = paths['/api/research/{id}/export']['post']['responses']['200']['content']['application/json']
export type CreateResearchByIdExportRequest = NonNullable<paths['/api/research/{id}/export']['post']['requestBody']>['content']['application/json']
export type CreateResearchByIdExecuteResponse = paths['/api/research/{id}/execute']['post']['responses']['200']['content']['application/json']
export type CreateResearchByIdExecuteRequest = NonNullable<paths['/api/research/{id}/execute']['post']['requestBody']>['content']['application/json']
export type CreateResearchByIdResumeResponse = paths['/api/research/{id}/resume']['post']['responses']['200']['content']['application/json']
export type CreateResearchByIdStopResponse = paths['/api/research/{id}/stop']['post']['responses']['200']['content']['application/json']
export type GetResearchByIdWorkflowStatusResponse = paths['/api/research/{id}/workflow-status']['get']['responses']['200']['content']['application/json']
export type GetResearchByIdCrawlProgressResponse = paths['/api/research/{id}/crawl-progress']['get']['responses']['200']['content']['application/json']
export type ListDeepResearchByResearchIdDebugEventsResponse = paths['/api/deep-research/{researchId}/debug/events']['get']['responses']['200']['content']['application/json']
export type DeleteDeepResearchByResearchIdDebugEventsResponse = paths['/api/deep-research/{researchId}/debug/events']['delete']['responses']['200']['content']['application/json']
export type ListDeepResearchByResearchIdDebugStatsResponse = paths['/api/deep-research/{researchId}/debug/stats']['get']['responses']['200']['content']['application/json']
export type ListDeepResearchByResearchIdDebugActivityResponse = paths['/api/deep-research/{researchId}/debug/activity']['get']['responses']['200']['content']['application/json']
export type GetModelConfigsResponse = paths['/api/model-configs']['get']['responses']['200']['content']['application/json']
export type CreateModelConfigResponse = paths['/api/model-configs']['post']['responses']['201']['content']['application/json']
export type CreateModelConfigRequest = NonNullable<paths['/api/model-configs']['post']['requestBody']>['content']['application/json']
export type ListModelConfigsProviderByProviderResponse = paths['/api/model-configs/provider/{provider}']['get']['responses']['200']['content']['application/json']
export type ListModelConfigsProviderByProviderDefaultResponse = paths['/api/model-configs/provider/{provider}/default']['get']['responses']['200']['content']['application/json']
export type ListModelConfigsNameByNameResponse = paths['/api/model-configs/name/{name}']['get']['responses']['200']['content']['application/json']
export type GetModelConfigResponse = paths['/api/model-configs/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateModelConfigResponse = paths['/api/model-configs/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateModelConfigRequest = NonNullable<paths['/api/model-configs/{id}']['put']['requestBody']>['content']['application/json']
export type DeleteModelConfigResponse = paths['/api/model-configs/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateModelConfigsByIdSetDefaultResponse = paths['/api/model-configs/{id}/set-default']['post']['responses']['200']['content']['application/json']
export type CreateModelConfigsSystemInitializeResponse = paths['/api/model-configs/system/initialize']['post']['responses']['200']['content']['application/json']
export type ListModelConfigsExportResponse = paths['/api/model-configs/export']['get']['responses']['200']['content']['application/json']
export type CreateModelConfigsImportResponse = paths['/api/model-configs/import']['post']['responses']['200']['content']['application/json']
export type CreateModelConfigsImportRequest = NonNullable<paths['/api/model-configs/import']['post']['requestBody']>['content']['application/json']
export type GetModelPresetsResponse = paths['/api/model-presets']['get']['responses']['200']['content']['application/json']
export type CreateModelPresetResponse = paths['/api/model-presets']['post']['responses']['201']['content']['application/json']
export type CreateModelPresetRequest = NonNullable<paths['/api/model-presets']['post']['requestBody']>['content']['application/json']
export type ListModelPresetsCategoryByCategoryResponse = paths['/api/model-presets/category/{category}']['get']['responses']['200']['content']['application/json']
export type ListModelPresetsMostUsedResponse = paths['/api/model-presets/most-used']['get']['responses']['200']['content']['application/json']
export type ListModelPresetsRecentlyUsedResponse = paths['/api/model-presets/recently-used']['get']['responses']['200']['content']['application/json']
export type GetModelPresetResponse = paths['/api/model-presets/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateModelPresetResponse = paths['/api/model-presets/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateModelPresetRequest = NonNullable<paths['/api/model-presets/{id}']['put']['requestBody']>['content']['application/json']
export type DeleteModelPresetResponse = paths['/api/model-presets/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateModelPresetsByIdUseResponse = paths['/api/model-presets/{id}/use']['post']['responses']['200']['content']['application/json']


/**
 * Comprehensive type-safe API client with full coverage of all endpoints
 * 
 * Features:
 * - Type-safe request/response handling
 * - Path parameter validation  
 * - Query parameter support
 * - Request body validation
 * - Proper HTTP method handling
 * - Error handling with context
 * - Support for all 214 API endpoints
 */
export class TypeSafeApiClient {
  private baseUrl: string
  private timeout: number
  private headers: Record<string, string>

  constructor(config?: {
    baseUrl?: string
    timeout?: number
    headers?: Record<string, string>
  }) {
    this.baseUrl = config?.baseUrl || 'http://localhost:3147'
    this.timeout = config?.timeout || 30000
    this.headers = {
      'Content-Type': 'application/json',
      ...config?.headers
    }
  }

  /**
   * Get CSRF token from cookie (browser only)
   */
  private getCsrfTokenFromCookie(): string | null {
    if (typeof document === 'undefined') {
      return null
    }

    const cookies = document.cookie.split(';')
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='))

    if (!csrfCookie) {
      return null
    }

    const tokenValue = csrfCookie.split('=')[1]
    return tokenValue || null
  }

  /**
   * Internal request handler with proper error handling and CSRF protection
   */
  private async request<T>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, any>
      body?: any
      timeout?: number
    }
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)

    // Add query parameters
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const controller = new AbortController()
    const requestTimeout = options?.timeout || this.timeout
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

    try {
      const isForm = typeof FormData !== 'undefined' && options?.body instanceof FormData
      const headers: Record<string, string> = { ...this.headers }

      // Add CSRF token for state-changing requests (browser only)
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase()) && typeof window !== 'undefined') {
        const csrfToken = this.getCsrfTokenFromCookie()
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken
        }
      }

      if (isForm && headers['Content-Type']) {
        // Let fetch set the multipart boundary
        delete headers['Content-Type']
      }

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: isForm ? (options?.body as FormData) : options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        credentials: 'include' // Include cookies for CSRF token
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: any
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }
        
        const error = new Error(
          errorData?.error?.message || errorData?.message || `HTTP ${response.status}: ${response.statusText}`
        ) as Error & { statusCode: number; code?: string; details?: any }
        error.statusCode = response.status
        error.code = errorData?.error?.code
        error.details = errorData?.error?.details
        throw error
      }

      const responseText = await response.text()
      return responseText ? (JSON.parse(responseText) as T) : (undefined as unknown as T)
    } catch (e) {
      clearTimeout(timeoutId)
      if (e instanceof Error && e.name === 'AbortError') {
        const timeoutError = new Error('Request timeout') as Error & { statusCode: number; code: string }
        timeoutError.statusCode = 408
        timeoutError.code = 'TIMEOUT'
        throw timeoutError
      }
      throw e
    }
  }

  /**
   * Validate and encode path parameters
   */
  private buildPath(template: string, params: Record<string, any>): string {
    let path = template
    
    // Replace path parameters like {id} or :id
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        throw new Error(`Missing required path parameter: ${key}`)
      }
      path = path.replace(new RegExp(`[{:]${key}[}]?`, 'g'), encodeURIComponent(String(value)))
    })
    
    // Check if any parameters remain unreplaced
    const unmatched = path.match(/[{:][^}]+[}]?/g)
    if (unmatched) {
      throw new Error(`Missing path parameters: ${unmatched.join(', ')}`)
    }
    
    return path
  }

  /**
   * Convert a plain object to FormData
   */
  private toFormData(data: Record<string, any>): FormData {
    const form = new FormData()
    if (!data) return form
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      if (Array.isArray(value)) {
        for (const item of value) this.appendFormValue(form, key, item)
      } else {
        this.appendFormValue(form, key, value)
      }
    })
    return form
  }

  private appendFormValue(form: FormData, key: string, value: any) {
    if (value === undefined || value === null) return
    const isBlob = typeof Blob !== 'undefined' && value instanceof Blob
    const isFile = typeof File !== 'undefined' && value instanceof File
    if (isBlob || isFile) {
      form.append(key, value as Blob)
      return
    }
    if (typeof value === 'boolean') {
      form.append(key, value ? 'true' : 'false')
      return
    }
    if (typeof value === 'number') {
      form.append(key, String(value))
      return
    }
    if (typeof value === 'object') {
      // Best-effort: try to detect blob-like
      if (typeof (value as any).arrayBuffer === 'function') {
        form.append(key, value as any)
        return
      }
      form.append(key, JSON.stringify(value))
      return
    }
    form.append(key, String(value))
  }

  // ===== GENERATED API METHODS =====

  // Projects Operations
  /**
   * List all projects
   */
  async getProjects(options?: { timeout?: number }): Promise<GetProjectsResponse> {
    return this.request<GetProjectsResponse>('GET', `/api/projects`, { timeout: options?.timeout })
  }

  /**
   * Create a new project and sync its files
   */
  async createProject(data: CreateProjectRequest, options?: { timeout?: number }): Promise<CreateProjectResponse> {
    return this.request<CreateProjectResponse>('POST', `/api/projects`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a specific project by ID
   */
  async getProject(id: string | number, options?: { timeout?: number }): Promise<GetProjectResponse> {
    return this.request<GetProjectResponse>('GET', this.buildPath(`/api/projects/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a project's details
   */
  async updateProject(id: string | number, data: UpdateProjectRequest, options?: { timeout?: number }): Promise<UpdateProjectResponse> {
    return this.request<UpdateProjectResponse>('PATCH', this.buildPath(`/api/projects/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a project and its associated data
   */
  async deleteProject(id: string | number, options?: { timeout?: number }): Promise<DeleteProjectResponse> {
    return this.request<DeleteProjectResponse>('DELETE', this.buildPath(`/api/projects/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Search project files (AST-grep by default)
   */
  async createProjectsByIdSearch(id: string | number, data: CreateProjectsByIdSearchRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdSearchResponse> {
    return this.request<CreateProjectsByIdSearchResponse>('POST', this.buildPath(`/api/projects/{id}/search`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Manually trigger a full file sync for a project
   */
  async createProjectsByIdSync(id: string | number, options?: { timeout?: number }): Promise<CreateProjectsByIdSyncResponse> {
    return this.request<CreateProjectsByIdSyncResponse>('POST', this.buildPath(`/api/projects/{id}/sync`, { id }), { timeout: options?.timeout })
  }

  /**
   * Trigger a file sync with real-time progress updates via SSE
   */
  async getProjectsByIdSyncStream(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdSyncStreamResponse> {
    return this.request<GetProjectsByIdSyncStreamResponse>('GET', this.buildPath(`/api/projects/{id}/sync-stream`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get the list of files associated with a project
   */
  async getProjectsByIdFiles(id: string | number, query?: { includeAllVersions?: any; limit?: any; offset?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdFilesResponse> {
    return this.request<GetProjectsByIdFilesResponse>('GET', this.buildPath(`/api/projects/{id}/files`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get project files metadata without content (for performance)
   */
  async getProjectsByIdFilesMetadata(id: string | number, query?: { limit?: any; offset?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdFilesMetadataResponse> {
    return this.request<GetProjectsByIdFilesMetadataResponse>('GET', this.buildPath(`/api/projects/{id}/files/metadata`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Update content of multiple files in a project (creates new versions)
   */
  async updateProjectsByIdFilesBulk(id: string | number, data: UpdateProjectsByIdFilesBulkRequest, options?: { timeout?: number }): Promise<UpdateProjectsByIdFilesBulkResponse> {
    return this.request<UpdateProjectsByIdFilesBulkResponse>('PUT', this.buildPath(`/api/projects/{id}/files/bulk`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Update the content of a specific file (creates new version)
   */
  async updateProjectsByIdFilesByFileId(id: string | number, fileId: string | number, data: UpdateProjectsByIdFilesByFileIdRequest, options?: { timeout?: number }): Promise<UpdateProjectsByIdFilesByFileIdResponse> {
    return this.request<UpdateProjectsByIdFilesByFileIdResponse>('PUT', this.buildPath(`/api/projects/{id}/files/{fileId}`, { id, fileId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Refresh project files (sync) optionally limited to a folder
   */
  async createProjectsByIdRefresh(id: string | number, query?: { folder?: any }, options?: { timeout?: number }): Promise<CreateProjectsByIdRefreshResponse> {
    return this.request<CreateProjectsByIdRefreshResponse>('POST', this.buildPath(`/api/projects/{id}/refresh`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Suggest relevant files based on user input and project context
   */
  async createProjectsByIdSuggestFiles(id: string | number, data: CreateProjectsByIdSuggestFilesRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdSuggestFilesResponse> {
    return this.request<CreateProjectsByIdSuggestFilesResponse>('POST', this.buildPath(`/api/projects/{id}/suggest-files`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get comprehensive statistics for a project
   */
  async getProjectsByIdStatistics(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdStatisticsResponse> {
    return this.request<GetProjectsByIdStatisticsResponse>('GET', this.buildPath(`/api/projects/{id}/statistics`, { id }), { timeout: options?.timeout })
  }

  /**
   * List all tickets for a project
   */
  async getProjectsByIdTickets(id: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdTicketsResponse> {
    return this.request<GetProjectsByIdTicketsResponse>('GET', this.buildPath(`/api/projects/{id}/tickets`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * List tickets with task counts
   */
  async getProjectsByIdTicketsWithCount(id: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdTicketsWithCountResponse> {
    return this.request<GetProjectsByIdTicketsWithCountResponse>('GET', this.buildPath(`/api/projects/{id}/tickets-with-count`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * List tickets with their tasks
   */
  async getProjectsByIdTicketsWithTasks(id: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdTicketsWithTasksResponse> {
    return this.request<GetProjectsByIdTicketsWithTasksResponse>('GET', this.buildPath(`/api/projects/{id}/tickets-with-tasks`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * List prompts associated with a specific project
   */
  async getProjectsByIdPrompts(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdPromptsResponse> {
    return this.request<GetProjectsByIdPromptsResponse>('GET', this.buildPath(`/api/projects/{id}/prompts`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get AI-suggested prompts based on user input
   */
  async createProjectsByIdSuggestPrompts(id: string | number, data: CreateProjectsByIdSuggestPromptsRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdSuggestPromptsResponse> {
    return this.request<CreateProjectsByIdSuggestPromptsResponse>('POST', this.buildPath(`/api/projects/{id}/suggest-prompts`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Associate a prompt with a project
   */
  async createProjectsByIdPromptsByPromptId(id: string | number, promptId: string | number, options?: { timeout?: number }): Promise<CreateProjectsByIdPromptsByPromptIdResponse> {
    return this.request<CreateProjectsByIdPromptsByPromptIdResponse>('POST', this.buildPath(`/api/projects/{id}/prompts/{promptId}`, { id, promptId }), { timeout: options?.timeout })
  }

  /**
   * Disassociate a prompt from a project
   */
  async deleteProjectsByIdPromptsByPromptId(id: string | number, promptId: string | number, options?: { timeout?: number }): Promise<DeleteProjectsByIdPromptsByPromptIdResponse> {
    return this.request<DeleteProjectsByIdPromptsByPromptIdResponse>('DELETE', this.buildPath(`/api/projects/{id}/prompts/{promptId}`, { id, promptId }), { timeout: options?.timeout })
  }

  /**
   * Import prompts to a specific project
   */
  async createProjectsByIdPromptsImport(id: string | number, data: FormData | CreateProjectsByIdPromptsImportRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdPromptsImportResponse> {
    const bodyToSend = data instanceof FormData ? data : this.toFormData(data as any)
    return this.request<CreateProjectsByIdPromptsImportResponse>('POST', this.buildPath(`/api/projects/{id}/prompts/import`, { id }), { body: bodyToSend, timeout: options?.timeout })
  }

  /**
   * Export all prompts from a project
   */
  async getProjectsByIdPromptsExport(id: string | number, query?: { format?: any; sortBy?: any; sortOrder?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdPromptsExportResponse> {
    return this.request<GetProjectsByIdPromptsExportResponse>('GET', this.buildPath(`/api/projects/{id}/prompts/export`, { id }), { params: query, timeout: options?.timeout })
  }


  // Tickets Operations
  /**
   * Create a new ticket
   */
  async createTicket(data: CreateTicketRequest, options?: { timeout?: number }): Promise<CreateTicketResponse> {
    return this.request<CreateTicketResponse>('POST', `/api/tickets`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a ticket by ID
   */
  async getTicket(ticketId: string | number, options?: { timeout?: number }): Promise<GetTicketResponse> {
    return this.request<GetTicketResponse>('GET', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), { timeout: options?.timeout })
  }

  /**
   * Update a ticket
   */
  async updateTicket(ticketId: string | number, data: UpdateTicketRequest, options?: { timeout?: number }): Promise<UpdateTicketResponse> {
    return this.request<UpdateTicketResponse>('PATCH', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a ticket
   */
  async deleteTicket(ticketId: string | number, options?: { timeout?: number }): Promise<DeleteTicketResponse> {
    return this.request<DeleteTicketResponse>('DELETE', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), { timeout: options?.timeout })
  }

  /**
   * Complete a ticket and mark all tasks as done
   */
  async createTicketsByTicketIdComplete(ticketId: string | number, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdCompleteResponse> {
    return this.request<CreateTicketsByTicketIdCompleteResponse>('POST', this.buildPath(`/api/tickets/{ticketId}/complete`, { ticketId }), { timeout: options?.timeout })
  }

  /**
   * Link files to a ticket
   */
  async createTicketsByTicketIdLinkFiles(ticketId: string | number, data: CreateTicketsByTicketIdLinkFilesRequest, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdLinkFilesResponse> {
    return this.request<CreateTicketsByTicketIdLinkFilesResponse>('POST', this.buildPath(`/api/tickets/{ticketId}/link-files`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get AI suggestions for relevant files
   */
  async createTicketsByTicketIdSuggestFiles(ticketId: string | number, data: CreateTicketsByTicketIdSuggestFilesRequest, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdSuggestFilesResponse> {
    return this.request<CreateTicketsByTicketIdSuggestFilesResponse>('POST', this.buildPath(`/api/tickets/{ticketId}/suggest-files`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Stream progressive AI suggestions for relevant files
   */
  async createTicketsByTicketIdSuggestFilesStream(ticketId: string | number, data: CreateTicketsByTicketIdSuggestFilesStreamRequest, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdSuggestFilesStreamResponse> {
    return this.request<CreateTicketsByTicketIdSuggestFilesStreamResponse>('POST', this.buildPath(`/api/tickets/{ticketId}/suggest-files/stream`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get AI suggestions for tasks
   */
  async createTicketsByTicketIdSuggestTasks(ticketId: string | number, data: CreateTicketsByTicketIdSuggestTasksRequest, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdSuggestTasksResponse> {
    return this.request<CreateTicketsByTicketIdSuggestTasksResponse>('POST', this.buildPath(`/api/tickets/{ticketId}/suggest-tasks`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get all tasks for a ticket
   */
  async listTicketsByTicketIdTasks(ticketId: string | number, options?: { timeout?: number }): Promise<ListTicketsByTicketIdTasksResponse> {
    return this.request<ListTicketsByTicketIdTasksResponse>('GET', this.buildPath(`/api/tickets/{ticketId}/tasks`, { ticketId }), { timeout: options?.timeout })
  }

  /**
   * Create a new task for a ticket
   */
  async createTicketsByTicketIdTasks(ticketId: string | number, data: CreateTicketsByTicketIdTasksRequest, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdTasksResponse> {
    return this.request<CreateTicketsByTicketIdTasksResponse>('POST', this.buildPath(`/api/tickets/{ticketId}/tasks`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Update a task
   */
  async updateTicketsByTicketIdTasksByTaskId(ticketId: string | number, taskId: string | number, data: UpdateTicketsByTicketIdTasksByTaskIdRequest, options?: { timeout?: number }): Promise<UpdateTicketsByTicketIdTasksByTaskIdResponse> {
    return this.request<UpdateTicketsByTicketIdTasksByTaskIdResponse>('PATCH', this.buildPath(`/api/tickets/{ticketId}/tasks/{taskId}`, { ticketId, taskId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a task
   */
  async deleteTicketsByTicketIdTasksByTaskId(ticketId: string | number, taskId: string | number, options?: { timeout?: number }): Promise<DeleteTicketsByTicketIdTasksByTaskIdResponse> {
    return this.request<DeleteTicketsByTicketIdTasksByTaskIdResponse>('DELETE', this.buildPath(`/api/tickets/{ticketId}/tasks/{taskId}`, { ticketId, taskId }), { timeout: options?.timeout })
  }

  /**
   * Reorder tasks within a ticket
   */
  async updateTicketsByTicketIdTasksReorder(ticketId: string | number, data: UpdateTicketsByTicketIdTasksReorderRequest, options?: { timeout?: number }): Promise<UpdateTicketsByTicketIdTasksReorderResponse> {
    return this.request<UpdateTicketsByTicketIdTasksReorderResponse>('PATCH', this.buildPath(`/api/tickets/{ticketId}/tasks/reorder`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Auto-generate tasks from ticket overview
   */
  async createTicketsByTicketIdAutoGenerateTasks(ticketId: string | number, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdAutoGenerateTasksResponse> {
    return this.request<CreateTicketsByTicketIdAutoGenerateTasksResponse>('POST', this.buildPath(`/api/tickets/{ticketId}/auto-generate-tasks`, { ticketId }), { timeout: options?.timeout })
  }

  /**
   * Get tasks for multiple tickets
   */
  async listTicketsBulkTasks(query?: { ids?: any }, options?: { timeout?: number }): Promise<ListTicketsBulkTasksResponse> {
    return this.request<ListTicketsBulkTasksResponse>('GET', `/api/tickets/bulk-tasks`, { params: query, timeout: options?.timeout })
  }

  /**
   * Get a ticket by ID (basic)
   */
  async getTicketTickets(id: string | number, options?: { timeout?: number }): Promise<GetTicketTicketsResponse> {
    return this.request<GetTicketTicketsResponse>('GET', this.buildPath(`/api/tickets/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a ticket by ID (basic)
   */
  async updateTicketTickets(id: string | number, data: UpdateTicketTicketsRequest, options?: { timeout?: number }): Promise<UpdateTicketTicketsResponse> {
    return this.request<UpdateTicketTicketsResponse>('PUT', this.buildPath(`/api/tickets/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a ticket by ID (basic)
   */
  async deleteTicketTickets(id: string | number, options?: { timeout?: number }): Promise<DeleteTicketTicketsResponse> {
    return this.request<DeleteTicketTicketsResponse>('DELETE', this.buildPath(`/api/tickets/{id}`, { id }), { timeout: options?.timeout })
  }


  // Chats Operations
  /**
   * Get all chat sessions
   */
  async getChats(options?: { timeout?: number }): Promise<GetChatsResponse> {
    return this.request<GetChatsResponse>('GET', `/api/chats`, { timeout: options?.timeout })
  }

  /**
   * Create a new chat session
   */
  async createChat(data: CreateChatRequest, options?: { timeout?: number }): Promise<CreateChatResponse> {
    return this.request<CreateChatResponse>('POST', `/api/chats`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get messages for a specific chat
   */
  async listChatsByChatIdMessages(chatId: string | number, options?: { timeout?: number }): Promise<ListChatsByChatIdMessagesResponse> {
    return this.request<ListChatsByChatIdMessagesResponse>('GET', this.buildPath(`/api/chats/{chatId}/messages`, { chatId }), { timeout: options?.timeout })
  }

  /**
   * Fork a chat session
   */
  async createChatsByChatIdFork(chatId: string | number, data: CreateChatsByChatIdForkRequest, options?: { timeout?: number }): Promise<CreateChatsByChatIdForkResponse> {
    return this.request<CreateChatsByChatIdForkResponse>('POST', this.buildPath(`/api/chats/{chatId}/fork`, { chatId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Fork a chat session from a specific message
   */
  async createChatsByChatIdForkByMessageId(chatId: string | number, messageId: string | number, data: CreateChatsByChatIdForkByMessageIdRequest, options?: { timeout?: number }): Promise<CreateChatsByChatIdForkByMessageIdResponse> {
    return this.request<CreateChatsByChatIdForkByMessageIdResponse>('POST', this.buildPath(`/api/chats/{chatId}/fork/{messageId}`, { chatId, messageId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Update chat properties (e.g., title)
   */
  async updateChat(chatId: string | number, data: UpdateChatRequest, options?: { timeout?: number }): Promise<UpdateChatResponse> {
    return this.request<UpdateChatResponse>('PATCH', this.buildPath(`/api/chats/{chatId}`, { chatId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a chat session and its messages
   */
  async deleteChat(chatId: string | number, options?: { timeout?: number }): Promise<DeleteChatResponse> {
    return this.request<DeleteChatResponse>('DELETE', this.buildPath(`/api/chats/{chatId}`, { chatId }), { timeout: options?.timeout })
  }

  /**
   * Get a chat by ID
   */
  async getChat(id: string | number, options?: { timeout?: number }): Promise<GetChatResponse> {
    return this.request<GetChatResponse>('GET', this.buildPath(`/api/chats/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a chat by ID
   */
  async updateChatChats(id: string | number, data: UpdateChatChatsRequest, options?: { timeout?: number }): Promise<UpdateChatChatsResponse> {
    return this.request<UpdateChatChatsResponse>('PUT', this.buildPath(`/api/chats/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a chat by ID
   */
  async deleteChatChats(id: string | number, options?: { timeout?: number }): Promise<DeleteChatChatsResponse> {
    return this.request<DeleteChatChatsResponse>('DELETE', this.buildPath(`/api/chats/{id}`, { id }), { timeout: options?.timeout })
  }


  // Messages Operations
  /**
   * Delete a specific message
   */
  async deleteChatsByChatIdMessagesByMessageId(chatId: string | number, messageId: string | number, options?: { timeout?: number }): Promise<DeleteChatsByChatIdMessagesByMessageIdResponse> {
    return this.request<DeleteChatsByChatIdMessagesByMessageIdResponse>('DELETE', this.buildPath(`/api/chats/{chatId}/messages/{messageId}`, { chatId, messageId }), { timeout: options?.timeout })
  }


  // Prompts Operations
  /**
   * List all available prompts
   */
  async getPrompts(options?: { timeout?: number }): Promise<GetPromptsResponse> {
    return this.request<GetPromptsResponse>('GET', `/api/prompts`, { timeout: options?.timeout })
  }

  /**
   * Create a new prompt
   */
  async createPrompt(data: CreatePromptRequest, options?: { timeout?: number }): Promise<CreatePromptResponse> {
    return this.request<CreatePromptResponse>('POST', `/api/prompts`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a prompt by ID (basic)
   */
  async getPrompt(id: string | number, options?: { timeout?: number }): Promise<GetPromptResponse> {
    return this.request<GetPromptResponse>('GET', this.buildPath(`/api/prompts/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a prompt by ID (basic)
   */
  async updatePrompt(id: string | number, data: UpdatePromptRequest, options?: { timeout?: number }): Promise<UpdatePromptResponse> {
    return this.request<UpdatePromptResponse>('PUT', this.buildPath(`/api/prompts/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Update a prompt's details
   */
  async updatePromptPrompts(id: string | number, data: UpdatePromptPromptsRequest, options?: { timeout?: number }): Promise<UpdatePromptPromptsResponse> {
    return this.request<UpdatePromptPromptsResponse>('PATCH', this.buildPath(`/api/prompts/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a prompt by ID (basic)
   */
  async deletePrompt(id: string | number, options?: { timeout?: number }): Promise<DeletePromptResponse> {
    return this.request<DeletePromptResponse>('DELETE', this.buildPath(`/api/prompts/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Import prompts from markdown files
   */
  async createPromptsImport(data: FormData | CreatePromptsImportRequest, options?: { timeout?: number }): Promise<CreatePromptsImportResponse> {
    const bodyToSend = data instanceof FormData ? data : this.toFormData(data as any)
    return this.request<CreatePromptsImportResponse>('POST', `/api/prompts/import`, { body: bodyToSend, timeout: options?.timeout })
  }

  /**
   * Export a single prompt as markdown
   */
  async getPromptsByIdExport(id: string | number, options?: { timeout?: number }): Promise<GetPromptsByIdExportResponse> {
    return this.request<GetPromptsByIdExportResponse>('GET', this.buildPath(`/api/prompts/{id}/export`, { id }), { timeout: options?.timeout })
  }

  /**
   * Export multiple prompts as markdown
   */
  async createPromptsExportBatch(data: CreatePromptsExportBatchRequest, options?: { timeout?: number }): Promise<CreatePromptsExportBatchResponse> {
    return this.request<CreatePromptsExportBatchResponse>('POST', `/api/prompts/export-batch`, { body: data, timeout: options?.timeout })
  }

  /**
   * Validate markdown content for prompt import
   */
  async createPromptsValidateMarkdown(data: CreatePromptsValidateMarkdownRequest, options?: { timeout?: number }): Promise<CreatePromptsValidateMarkdownResponse> {
    return this.request<CreatePromptsValidateMarkdownResponse>('POST', `/api/prompts/validate-markdown`, { body: data, timeout: options?.timeout })
  }


  // Default Operations
  /**
   * GET /api/projects/:projectId/queues
   */
  async listProjectsByProjectIdQueues(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdQueuesResponse> {
    return this.request<ListProjectsByProjectIdQueuesResponse>('GET', this.buildPath(`/api/projects/:projectId/queues`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/:projectId/queues
   */
  async createProjectsByProjectIdQueues(projectId: string | number, data: CreateProjectsByProjectIdQueuesRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdQueuesResponse> {
    return this.request<CreateProjectsByProjectIdQueuesResponse>('POST', this.buildPath(`/api/projects/:projectId/queues`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/queues/:queueId
   */
  async getQueue(queueId: string | number, options?: { timeout?: number }): Promise<GetQueueResponse> {
    return this.request<GetQueueResponse>('GET', this.buildPath(`/api/queues/:queueId`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * PATCH /api/queues/:queueId
   */
  async updateQueue(queueId: string | number, data: UpdateQueueRequest, options?: { timeout?: number }): Promise<UpdateQueueResponse> {
    return this.request<UpdateQueueResponse>('PATCH', this.buildPath(`/api/queues/:queueId`, { queueId }), { body: data, timeout: options?.timeout })
  }

  /**
   * DELETE /api/queues/:queueId
   */
  async deleteQueue(queueId: string | number, options?: { timeout?: number }): Promise<DeleteQueueResponse> {
    return this.request<DeleteQueueResponse>('DELETE', this.buildPath(`/api/queues/:queueId`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/tickets/:ticketId/enqueue
   */
  async createTicketsByTicketIdEnqueue(ticketId: string | number, data: CreateTicketsByTicketIdEnqueueRequest, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdEnqueueResponse> {
    return this.request<CreateTicketsByTicketIdEnqueueResponse>('POST', this.buildPath(`/api/tickets/:ticketId/enqueue`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/tickets/:ticketId/tasks/:taskId/enqueue
   */
  async createTicketsByTicketIdTasksByTaskIdEnqueue(ticketId: string | number, taskId: string | number, data: CreateTicketsByTicketIdTasksByTaskIdEnqueueRequest, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdTasksByTaskIdEnqueueResponse> {
    return this.request<CreateTicketsByTicketIdTasksByTaskIdEnqueueResponse>('POST', this.buildPath(`/api/tickets/:ticketId/tasks/:taskId/enqueue`, { ticketId, taskId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/tickets/:ticketId/dequeue
   */
  async createTicketsByTicketIdDequeue(ticketId: string | number, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdDequeueResponse> {
    return this.request<CreateTicketsByTicketIdDequeueResponse>('POST', this.buildPath(`/api/tickets/:ticketId/dequeue`, { ticketId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/tickets/:ticketId/tasks/:taskId/dequeue
   */
  async createTicketsByTicketIdTasksByTaskIdDequeue(ticketId: string | number, taskId: string | number, options?: { timeout?: number }): Promise<CreateTicketsByTicketIdTasksByTaskIdDequeueResponse> {
    return this.request<CreateTicketsByTicketIdTasksByTaskIdDequeueResponse>('POST', this.buildPath(`/api/tickets/:ticketId/tasks/:taskId/dequeue`, { ticketId, taskId }), { timeout: options?.timeout })
  }

  /**
   * GET /api/queues/:queueId/stats
   */
  async listQueuesByQueueIdStats(queueId: string | number, options?: { timeout?: number }): Promise<ListQueuesByQueueIdStatsResponse> {
    return this.request<ListQueuesByQueueIdStatsResponse>('GET', this.buildPath(`/api/queues/:queueId/stats`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/:projectId/queues-with-stats
   */
  async listProjectsByProjectIdQueuesWithStats(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdQueuesWithStatsResponse> {
    return this.request<ListProjectsByProjectIdQueuesWithStatsResponse>('GET', this.buildPath(`/api/projects/:projectId/queues-with-stats`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/queues/:queueId/next-task
   */
  async createQueuesByQueueIdNextTask(queueId: string | number, data: CreateQueuesByQueueIdNextTaskRequest, options?: { timeout?: number }): Promise<CreateQueuesByQueueIdNextTaskResponse> {
    return this.request<CreateQueuesByQueueIdNextTaskResponse>('POST', this.buildPath(`/api/queues/:queueId/next-task`, { queueId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/:projectId/unqueued-items
   */
  async listProjectsByProjectIdUnqueuedItems(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdUnqueuedItemsResponse> {
    return this.request<ListProjectsByProjectIdUnqueuedItemsResponse>('GET', this.buildPath(`/api/projects/:projectId/unqueued-items`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/queues/:queueId/pause
   */
  async createQueuesByQueueIdPause(queueId: string | number, options?: { timeout?: number }): Promise<CreateQueuesByQueueIdPauseResponse> {
    return this.request<CreateQueuesByQueueIdPauseResponse>('POST', this.buildPath(`/api/queues/:queueId/pause`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/queues/:queueId/resume
   */
  async createQueuesByQueueIdResume(queueId: string | number, options?: { timeout?: number }): Promise<CreateQueuesByQueueIdResumeResponse> {
    return this.request<CreateQueuesByQueueIdResumeResponse>('POST', this.buildPath(`/api/queues/:queueId/resume`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/queue/:itemType/:itemId/complete
   */
  async createQueueByItemTypeByItemIdComplete(itemType: string | number, itemId: string | number, data: CreateQueueByItemTypeByItemIdCompleteRequest, options?: { timeout?: number }): Promise<CreateQueueByItemTypeByItemIdCompleteResponse> {
    return this.request<CreateQueueByItemTypeByItemIdCompleteResponse>('POST', this.buildPath(`/api/queue/:itemType/:itemId/complete`, { itemType, itemId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/queue/:itemType/:itemId/fail
   */
  async createQueueByItemTypeByItemIdFail(itemType: string | number, itemId: string | number, data: CreateQueueByItemTypeByItemIdFailRequest, options?: { timeout?: number }): Promise<CreateQueueByItemTypeByItemIdFailResponse> {
    return this.request<CreateQueueByItemTypeByItemIdFailResponse>('POST', this.buildPath(`/api/queue/:itemType/:itemId/fail`, { itemType, itemId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/queue/:itemType/:itemId/move
   */
  async createQueueByItemTypeByItemIdMove(itemType: string | number, itemId: string | number, data: CreateQueueByItemTypeByItemIdMoveRequest, options?: { timeout?: number }): Promise<CreateQueueByItemTypeByItemIdMoveResponse> {
    return this.request<CreateQueueByItemTypeByItemIdMoveResponse>('POST', this.buildPath(`/api/queue/:itemType/:itemId/move`, { itemType, itemId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/queues/:queueId/enqueue-ticket
   */
  async createQueuesByQueueIdEnqueueTicket(queueId: string | number, data: CreateQueuesByQueueIdEnqueueTicketRequest, options?: { timeout?: number }): Promise<CreateQueuesByQueueIdEnqueueTicketResponse> {
    return this.request<CreateQueuesByQueueIdEnqueueTicketResponse>('POST', this.buildPath(`/api/queues/:queueId/enqueue-ticket`, { queueId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/queues/:queueId/items
   */
  async listQueuesByQueueIdItems(queueId: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<ListQueuesByQueueIdItemsResponse> {
    return this.request<ListQueuesByQueueIdItemsResponse>('GET', this.buildPath(`/api/queues/:queueId/items`, { queueId }), { params: query, timeout: options?.timeout })
  }

  /**
   * POST /api/queues/:queueId/items
   */
  async createQueuesByQueueIdItems(queueId: string | number, data: CreateQueuesByQueueIdItemsRequest, options?: { timeout?: number }): Promise<CreateQueuesByQueueIdItemsResponse> {
    return this.request<CreateQueuesByQueueIdItemsResponse>('POST', this.buildPath(`/api/queues/:queueId/items`, { queueId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/queues/:queueId/batch-enqueue
   */
  async createQueuesByQueueIdBatchEnqueue(queueId: string | number, data: CreateQueuesByQueueIdBatchEnqueueRequest, options?: { timeout?: number }): Promise<CreateQueuesByQueueIdBatchEnqueueResponse> {
    return this.request<CreateQueuesByQueueIdBatchEnqueueResponse>('POST', this.buildPath(`/api/queues/:queueId/batch-enqueue`, { queueId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/queues/:queueId/timeline
   */
  async listQueuesByQueueIdTimeline(queueId: string | number, options?: { timeout?: number }): Promise<ListQueuesByQueueIdTimelineResponse> {
    return this.request<ListQueuesByQueueIdTimelineResponse>('GET', this.buildPath(`/api/queues/:queueId/timeline`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/mcp/config/locations
   */
  async getProjectsByIdMcpConfigLocations(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdMcpConfigLocationsResponse> {
    return this.request<GetProjectsByIdMcpConfigLocationsResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/config/locations`, { id }), { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/mcp/config/merged
   */
  async getProjectsByIdMcpConfigMerged(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdMcpConfigMergedResponse> {
    return this.request<GetProjectsByIdMcpConfigMergedResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/config/merged`, { id }), { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/mcp/config/expanded
   */
  async getProjectsByIdMcpConfigExpanded(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdMcpConfigExpandedResponse> {
    return this.request<GetProjectsByIdMcpConfigExpandedResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/config/expanded`, { id }), { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/mcp/config
   */
  async getProjectsByIdMcpConfig(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdMcpConfigResponse> {
    return this.request<GetProjectsByIdMcpConfigResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/config`, { id }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/mcp/config/save-to-location
   */
  async createProjectsByIdMcpConfigSaveToLocation(id: string | number, data: CreateProjectsByIdMcpConfigSaveToLocationRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdMcpConfigSaveToLocationResponse> {
    return this.request<CreateProjectsByIdMcpConfigSaveToLocationResponse>('POST', this.buildPath(`/api/projects/{id}/mcp/config/save-to-location`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/mcp/config/default-for-location
   */
  async getProjectsByIdMcpConfigDefaultForLocation(id: string | number, query?: { location?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdMcpConfigDefaultForLocationResponse> {
    return this.request<GetProjectsByIdMcpConfigDefaultForLocationResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/config/default-for-location`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Copilot proxy health
   */
  async listProxyCopilot_health(options?: { timeout?: number }): Promise<ListProxyCopilot_healthResponse> {
    return this.request<ListProxyCopilot_healthResponse>('GET', `/api/proxy/copilot/_health`, { timeout: options?.timeout })
  }

  /**
   * Enable or disable embedded Copilot proxy
   */
  async createCopilotEmbedToggle(data: CreateCopilotEmbedToggleRequest, options?: { timeout?: number }): Promise<CreateCopilotEmbedToggleResponse> {
    return this.request<CreateCopilotEmbedToggleResponse>('POST', `/api/copilot/embed/toggle`, { body: data, timeout: options?.timeout })
  }

  /**
   * Update embedded Copilot runtime settings
   */
  async createCopilotEmbedSettings(data: CreateCopilotEmbedSettingsRequest, options?: { timeout?: number }): Promise<CreateCopilotEmbedSettingsResponse> {
    return this.request<CreateCopilotEmbedSettingsResponse>('POST', `/api/copilot/embed/settings`, { body: data, timeout: options?.timeout })
  }

  /**
   * Start GitHub device authorization flow
   */
  async createCopilotEmbedAuthStart(options?: { timeout?: number }): Promise<CreateCopilotEmbedAuthStartResponse> {
    return this.request<CreateCopilotEmbedAuthStartResponse>('POST', `/api/copilot/embed/auth/start`, { timeout: options?.timeout })
  }

  /**
   * Complete device authorization and initialize Copilot tokens
   */
  async createCopilotEmbedAuthComplete(data: CreateCopilotEmbedAuthCompleteRequest, options?: { timeout?: number }): Promise<CreateCopilotEmbedAuthCompleteResponse> {
    return this.request<CreateCopilotEmbedAuthCompleteResponse>('POST', `/api/copilot/embed/auth/complete`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get embedded Copilot status
   */
  async listCopilotEmbedStatus(options?: { timeout?: number }): Promise<ListCopilotEmbedStatusResponse> {
    return this.request<ListCopilotEmbedStatusResponse>('GET', `/api/copilot/embed/status`, { timeout: options?.timeout })
  }


  // Queues Operations
  /**
   * Get a queue by ID (basic)
   */
  async getQueueQueues(id: string | number, options?: { timeout?: number }): Promise<GetQueueQueuesResponse> {
    return this.request<GetQueueQueuesResponse>('GET', this.buildPath(`/api/queues/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a queue by ID (basic)
   */
  async updateQueueQueues(id: string | number, data: UpdateQueueQueuesRequest, options?: { timeout?: number }): Promise<UpdateQueueQueuesResponse> {
    return this.request<UpdateQueueQueuesResponse>('PUT', this.buildPath(`/api/queues/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a queue by ID (basic)
   */
  async deleteQueueQueues(id: string | number, options?: { timeout?: number }): Promise<DeleteQueueQueuesResponse> {
    return this.request<DeleteQueueQueuesResponse>('DELETE', this.buildPath(`/api/queues/{id}`, { id }), { timeout: options?.timeout })
  }


  // Provider Keys Operations
  /**
   * List all configured provider keys (excluding secrets)
   */
  async getKeys(options?: { timeout?: number }): Promise<GetKeysResponse> {
    return this.request<GetKeysResponse>('GET', `/api/keys`, { timeout: options?.timeout })
  }

  /**
   * Add a new API key for an AI provider
   */
  async createKey(data: CreateKeyRequest, options?: { timeout?: number }): Promise<CreateKeyResponse> {
    return this.request<CreateKeyResponse>('POST', `/api/keys`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a provider key by ID (basic)
   */
  async getKey(id: string | number, options?: { timeout?: number }): Promise<GetKeyResponse> {
    return this.request<GetKeyResponse>('GET', this.buildPath(`/api/keys/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a provider key by ID (basic)
   */
  async updateKey(id: string | number, data: UpdateKeyRequest, options?: { timeout?: number }): Promise<UpdateKeyResponse> {
    return this.request<UpdateKeyResponse>('PUT', this.buildPath(`/api/keys/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Update a provider key's details
   */
  async updateKeyProviderKeys(id: string | number, data: UpdateKeyProviderKeysRequest, options?: { timeout?: number }): Promise<UpdateKeyProviderKeysResponse> {
    return this.request<UpdateKeyProviderKeysResponse>('PATCH', this.buildPath(`/api/keys/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a provider key by ID (basic)
   */
  async deleteKey(id: string | number, options?: { timeout?: number }): Promise<DeleteKeyResponse> {
    return this.request<DeleteKeyResponse>('DELETE', this.buildPath(`/api/keys/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Validate a custom OpenAI-compatible provider
   */
  async createKeysValidateCustom(data: CreateKeysValidateCustomRequest, options?: { timeout?: number }): Promise<CreateKeysValidateCustomResponse> {
    return this.request<CreateKeysValidateCustomResponse>('POST', `/api/keys/validate-custom`, { body: data, timeout: options?.timeout })
  }


  // Provider Testing Operations
  /**
   * Test a single provider connection
   */
  async createProvidersTest(data: CreateProvidersTestRequest, options?: { timeout?: number }): Promise<CreateProvidersTestResponse> {
    return this.request<CreateProvidersTestResponse>('POST', `/api/providers/test`, { body: data, timeout: options?.timeout })
  }

  /**
   * Test multiple providers at once
   */
  async createProvidersBatchTest(data: CreateProvidersBatchTestRequest, options?: { timeout?: number }): Promise<CreateProvidersBatchTestResponse> {
    return this.request<CreateProvidersBatchTestResponse>('POST', `/api/providers/batch-test`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get health status of all configured providers
   */
  async listProvidersHealth(query?: { refresh?: any }, options?: { timeout?: number }): Promise<ListProvidersHealthResponse> {
    return this.request<ListProvidersHealthResponse>('GET', `/api/providers/health`, { params: query, timeout: options?.timeout })
  }


  // Provider Settings Operations
  /**
   * Update provider settings (URLs for local providers)
   */
  async updateProvidersSettings(data: UpdateProvidersSettingsRequest, options?: { timeout?: number }): Promise<UpdateProvidersSettingsResponse> {
    return this.request<UpdateProvidersSettingsResponse>('PUT', `/api/providers/settings`, { body: data, timeout: options?.timeout })
  }


  // AI Operations
  /**
   * Get MCP session metadata for a chat
   */
  async listAiChatByChatIdMcpSession(chatId: string | number, options?: { timeout?: number }): Promise<ListAiChatByChatIdMcpSessionResponse> {
    return this.request<ListAiChatByChatIdMcpSessionResponse>('GET', this.buildPath(`/api/ai/chat/{chatId}/mcp-session`, { chatId }), { timeout: options?.timeout })
  }

  /**
   * Invoke the default Promptliano MCP tool for a chat turn
   */
  async createAiChatByChatIdMcpToolsRun(chatId: string | number, data: CreateAiChatByChatIdMcpToolsRunRequest, options?: { timeout?: number }): Promise<CreateAiChatByChatIdMcpToolsRunResponse> {
    return this.request<CreateAiChatByChatIdMcpToolsRunResponse>('POST', this.buildPath(`/api/ai/chat/{chatId}/mcp/tools/run`, { chatId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Stream chat completions via AI SDK
   */
  async createAiChatSdk(data: CreateAiChatSdkRequest, options?: { timeout?: number }): Promise<CreateAiChatSdkResponse> {
    return this.request<CreateAiChatSdkResponse>('POST', `/api/ai/chat/sdk`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get all available providers including custom ones
   */
  async getProviders(options?: { timeout?: number }): Promise<GetProvidersResponse> {
    return this.request<GetProvidersResponse>('GET', `/api/providers`, { timeout: options?.timeout })
  }

  /**
   * Fix and optimize mermaid diagram code
   */
  async createAiMermaidFix(data: CreateAiMermaidFixRequest, options?: { timeout?: number }): Promise<CreateAiMermaidFixResponse> {
    return this.request<CreateAiMermaidFixResponse>('POST', `/api/ai/mermaid/fix`, { body: data, timeout: options?.timeout })
  }

  /**
   * List available AI models for a provider
   */
  async getModels(query?: { provider?: any; includeDisabled?: any }, options?: { timeout?: number }): Promise<GetModelsResponse> {
    return this.request<GetModelsResponse>('GET', `/api/models`, { params: query, timeout: options?.timeout })
  }

  /**
   * Debug provider key resolution (no secrets)
   */
  async listProviders_debugConfig(options?: { timeout?: number }): Promise<ListProviders_debugConfigResponse> {
    return this.request<ListProviders_debugConfigResponse>('GET', `/api/providers/_debug-config`, { timeout: options?.timeout })
  }

  /**
   * Generate text (one-off, non-streaming)
   */
  async createAiGenerateText(data: CreateAiGenerateTextRequest, options?: { timeout?: number }): Promise<CreateAiGenerateTextResponse> {
    return this.request<CreateAiGenerateTextResponse>('POST', `/api/ai/generate/text`, { body: data, timeout: options?.timeout })
  }

  /**
   * Update provider settings
   */
  async createProviderSetting(data: CreateProviderSettingRequest, options?: { timeout?: number }): Promise<CreateProviderSettingResponse> {
    return this.request<CreateProviderSettingResponse>('POST', `/api/provider-settings`, { body: data, timeout: options?.timeout })
  }


  // GenAI Operations
  /**
   * Generate text using a specified model and prompt
   */
  async createGenAiStream(data: CreateGenAiStreamRequest, options?: { timeout?: number }): Promise<CreateGenAiStreamResponse> {
    return this.request<CreateGenAiStreamResponse>('POST', `/api/gen-ai/stream`, { body: data, timeout: options?.timeout })
  }

  /**
   * Generate text using a specified model and prompt
   */
  async createGenAiText(data: CreateGenAiTextRequest, options?: { timeout?: number }): Promise<CreateGenAiTextResponse> {
    return this.request<CreateGenAiTextResponse>('POST', `/api/gen-ai/text`, { body: data, timeout: options?.timeout })
  }

  /**
   * Generate structured data based on a predefined schema key and user input
   */
  async createGenAiStructured(data: CreateGenAiStructuredRequest, options?: { timeout?: number }): Promise<CreateGenAiStructuredResponse> {
    return this.request<CreateGenAiStructuredResponse>('POST', `/api/gen-ai/structured`, { body: data, timeout: options?.timeout })
  }


  // Flow Operations
  /**
   * Get complete flow data for a project
   */
  async getProjectsByIdFlow(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdFlowResponse> {
    return this.request<GetProjectsByIdFlowResponse>('GET', this.buildPath(`/api/projects/{id}/flow`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get all flow items as a flat list
   */
  async getProjectsByIdFlowItems(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdFlowItemsResponse> {
    return this.request<GetProjectsByIdFlowItemsResponse>('GET', this.buildPath(`/api/projects/{id}/flow/items`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get all unqueued tickets and tasks
   */
  async getProjectsByIdFlowUnqueued(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdFlowUnqueuedResponse> {
    return this.request<GetProjectsByIdFlowUnqueuedResponse>('GET', this.buildPath(`/api/projects/{id}/flow/unqueued`, { id }), { timeout: options?.timeout })
  }

  /**
   * Create a queue (Flow)
   */
  async createFlowQueues(data: CreateFlowQueuesRequest, options?: { timeout?: number }): Promise<CreateFlowQueuesResponse> {
    return this.request<CreateFlowQueuesResponse>('POST', `/api/flow/queues`, { body: data, timeout: options?.timeout })
  }

  /**
   * List queues for a project (Flow)
   */
  async getProjectsByIdFlowQueues(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdFlowQueuesResponse> {
    return this.request<GetProjectsByIdFlowQueuesResponse>('GET', this.buildPath(`/api/projects/{id}/flow/queues`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get queues with stats (Flow)
   */
  async getProjectsByIdFlowQueuesWithStats(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdFlowQueuesWithStatsResponse> {
    return this.request<GetProjectsByIdFlowQueuesWithStatsResponse>('GET', this.buildPath(`/api/projects/{id}/flow/queues-with-stats`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get items in a queue (Flow)
   */
  async listFlowQueuesByQueueIdItems(queueId: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<ListFlowQueuesByQueueIdItemsResponse> {
    return this.request<ListFlowQueuesByQueueIdItemsResponse>('GET', this.buildPath(`/api/flow/queues/{queueId}/items`, { queueId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get queue statistics (Flow)
   */
  async listFlowQueuesByQueueIdStats(queueId: string | number, options?: { timeout?: number }): Promise<ListFlowQueuesByQueueIdStatsResponse> {
    return this.request<ListFlowQueuesByQueueIdStatsResponse>('GET', this.buildPath(`/api/flow/queues/{queueId}/stats`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * Update queue (Flow)
   */
  async updateFlowQueuesByQueueId(queueId: string | number, data: UpdateFlowQueuesByQueueIdRequest, options?: { timeout?: number }): Promise<UpdateFlowQueuesByQueueIdResponse> {
    return this.request<UpdateFlowQueuesByQueueIdResponse>('PATCH', this.buildPath(`/api/flow/queues/{queueId}`, { queueId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete queue (Flow)
   */
  async deleteFlowQueuesByQueueId(queueId: string | number, options?: { timeout?: number }): Promise<DeleteFlowQueuesByQueueIdResponse> {
    return this.request<DeleteFlowQueuesByQueueIdResponse>('DELETE', this.buildPath(`/api/flow/queues/{queueId}`, { queueId }), { timeout: options?.timeout })
  }

  /**
   * Enqueue a ticket to a queue
   */
  async createFlowTicketsByTicketIdEnqueue(ticketId: string | number, data: CreateFlowTicketsByTicketIdEnqueueRequest, options?: { timeout?: number }): Promise<CreateFlowTicketsByTicketIdEnqueueResponse> {
    return this.request<CreateFlowTicketsByTicketIdEnqueueResponse>('POST', this.buildPath(`/api/flow/tickets/{ticketId}/enqueue`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Enqueue a task to a queue
   */
  async createFlowTasksByTaskIdEnqueue(taskId: string | number, data: CreateFlowTasksByTaskIdEnqueueRequest, options?: { timeout?: number }): Promise<CreateFlowTasksByTaskIdEnqueueResponse> {
    return this.request<CreateFlowTasksByTaskIdEnqueueResponse>('POST', this.buildPath(`/api/flow/tasks/{taskId}/enqueue`, { taskId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Remove a ticket from its queue
   */
  async createFlowTicketsByTicketIdDequeue(ticketId: string | number, query?: { includeTasks?: any }, options?: { timeout?: number }): Promise<CreateFlowTicketsByTicketIdDequeueResponse> {
    return this.request<CreateFlowTicketsByTicketIdDequeueResponse>('POST', this.buildPath(`/api/flow/tickets/{ticketId}/dequeue`, { ticketId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Remove a task from its queue
   */
  async createFlowTasksByTaskIdDequeue(taskId: string | number, options?: { timeout?: number }): Promise<CreateFlowTasksByTaskIdDequeueResponse> {
    return this.request<CreateFlowTasksByTaskIdDequeueResponse>('POST', this.buildPath(`/api/flow/tasks/{taskId}/dequeue`, { taskId }), { timeout: options?.timeout })
  }

  /**
   * Move an item between queues or to unqueued
   */
  async createFlowMove(data: CreateFlowMoveRequest, options?: { timeout?: number }): Promise<CreateFlowMoveResponse> {
    return this.request<CreateFlowMoveResponse>('POST', `/api/flow/move`, { body: data, timeout: options?.timeout })
  }

  /**
   * Persist new order for items in a queue
   */
  async createFlowReorder(data: CreateFlowReorderRequest, options?: { timeout?: number }): Promise<CreateFlowReorderResponse> {
    return this.request<CreateFlowReorderResponse>('POST', `/api/flow/reorder`, { body: data, timeout: options?.timeout })
  }

  /**
   * Mark an item as being processed
   */
  async createFlowProcessStart(data: CreateFlowProcessStartRequest, options?: { timeout?: number }): Promise<CreateFlowProcessStartResponse> {
    return this.request<CreateFlowProcessStartResponse>('POST', `/api/flow/process/start`, { body: data, timeout: options?.timeout })
  }

  /**
   * Mark an item as completed
   */
  async createFlowProcessComplete(data: CreateFlowProcessCompleteRequest, options?: { timeout?: number }): Promise<CreateFlowProcessCompleteResponse> {
    return this.request<CreateFlowProcessCompleteResponse>('POST', `/api/flow/process/complete`, { body: data, timeout: options?.timeout })
  }

  /**
   * Mark an item as failed
   */
  async createFlowProcessFail(data: CreateFlowProcessFailRequest, options?: { timeout?: number }): Promise<CreateFlowProcessFailResponse> {
    return this.request<CreateFlowProcessFailResponse>('POST', `/api/flow/process/fail`, { body: data, timeout: options?.timeout })
  }

  /**
   * Move multiple items to a queue or unqueued
   */
  async createFlowBulkMove(data: CreateFlowBulkMoveRequest, options?: { timeout?: number }): Promise<CreateFlowBulkMoveResponse> {
    return this.request<CreateFlowBulkMoveResponse>('POST', `/api/flow/bulk-move`, { body: data, timeout: options?.timeout })
  }


  // System Operations
  /**
   * Browse directories on the file system
   */
  async createBrowseDirector(data: CreateBrowseDirectorRequest, options?: { timeout?: number }): Promise<CreateBrowseDirectorResponse> {
    return this.request<CreateBrowseDirectorResponse>('POST', `/api/browse-directory`, { body: data, timeout: options?.timeout })
  }


  // MCP Operations
  /**
   * List all MCP server configurations for a project
   */
  async getProjectsByIdMcpServers(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdMcpServersResponse> {
    return this.request<GetProjectsByIdMcpServersResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/servers`, { id }), { timeout: options?.timeout })
  }

  /**
   * Create MCP server configuration
   */
  async createProjectsByIdMcpServers(id: string | number, data: CreateProjectsByIdMcpServersRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdMcpServersResponse> {
    return this.request<CreateProjectsByIdMcpServersResponse>('POST', this.buildPath(`/api/projects/{id}/mcp/servers`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get MCP server configuration by ID
   */
  async getProjectsByIdMcpServersByServerId(id: string | number, serverId: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdMcpServersByServerIdResponse> {
    return this.request<GetProjectsByIdMcpServersByServerIdResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/servers/{serverId}`, { id, serverId }), { timeout: options?.timeout })
  }

  /**
   * Update MCP server configuration
   */
  async updateProjectsByIdMcpServersByServerId(id: string | number, serverId: string | number, data: UpdateProjectsByIdMcpServersByServerIdRequest, options?: { timeout?: number }): Promise<UpdateProjectsByIdMcpServersByServerIdResponse> {
    return this.request<UpdateProjectsByIdMcpServersByServerIdResponse>('PATCH', this.buildPath(`/api/projects/{id}/mcp/servers/{serverId}`, { id, serverId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete MCP server configuration
   */
  async deleteProjectsByIdMcpServersByServerId(id: string | number, serverId: string | number, options?: { timeout?: number }): Promise<DeleteProjectsByIdMcpServersByServerIdResponse> {
    return this.request<DeleteProjectsByIdMcpServersByServerIdResponse>('DELETE', this.buildPath(`/api/projects/{id}/mcp/servers/{serverId}`, { id, serverId }), { timeout: options?.timeout })
  }

  /**
   * List available MCP tools
   */
  async listMcpTools(query?: { serverId?: any }, options?: { timeout?: number }): Promise<ListMcpToolsResponse> {
    return this.request<ListMcpToolsResponse>('GET', `/api/mcp/tools`, { params: query, timeout: options?.timeout })
  }

  /**
   * Execute an MCP tool
   */
  async createMcpToolsExecute(data: CreateMcpToolsExecuteRequest, options?: { timeout?: number }): Promise<CreateMcpToolsExecuteResponse> {
    return this.request<CreateMcpToolsExecuteResponse>('POST', `/api/mcp/tools/execute`, { body: data, timeout: options?.timeout })
  }

  /**
   * List available MCP resources
   */
  async listMcpResources(query?: { serverId?: any }, options?: { timeout?: number }): Promise<ListMcpResourcesResponse> {
    return this.request<ListMcpResourcesResponse>('GET', `/api/mcp/resources`, { params: query, timeout: options?.timeout })
  }

  /**
   * Read MCP resource content
   */
  async createMcpResourcesRead(data: CreateMcpResourcesReadRequest, options?: { timeout?: number }): Promise<CreateMcpResourcesReadResponse> {
    return this.request<CreateMcpResourcesReadResponse>('POST', `/api/mcp/resources/read`, { body: data, timeout: options?.timeout })
  }

  /**
   * List MCP tool executions for a project
   */
  async getProjectsByIdMcpAnalyticsExecutions(id: string | number, query?: { toolName?: any; status?: any; sessionId?: any; startDate?: any; endDate?: any; limit?: any; offset?: any; sortBy?: any; sortOrder?: any; toolNames?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdMcpAnalyticsExecutionsResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsExecutionsResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/analytics/executions`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get aggregated MCP analytics overview for a project
   */
  async getProjectsByIdMcpAnalyticsOverview(id: string | number, query?: { period?: any; toolNames?: any; startDate?: any; endDate?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdMcpAnalyticsOverviewResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsOverviewResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/analytics/overview`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get MCP tool statistics for a project
   */
  async getProjectsByIdMcpAnalyticsStatistics(id: string | number, query?: { period?: any; toolNames?: any; startDate?: any; endDate?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdMcpAnalyticsStatisticsResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsStatisticsResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/analytics/statistics`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get MCP execution timeline for a project
   */
  async getProjectsByIdMcpAnalyticsTimeline(id: string | number, query?: { period?: any; toolNames?: any; startDate?: any; endDate?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdMcpAnalyticsTimelineResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsTimelineResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/analytics/timeline`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get common MCP error patterns for a project
   */
  async getProjectsByIdMcpAnalyticsErrorPatterns(id: string | number, query?: { period?: any; toolNames?: any; startDate?: any; endDate?: any; limit?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdMcpAnalyticsErrorPatternsResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsErrorPatternsResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/analytics/error-patterns`, { id }), { params: query, timeout: options?.timeout })
  }


  // MCP Installation Operations
  /**
   * POST /api/projects/{id}/mcp/config
   */
  async createProjectsByIdMcpConfig(id: string | number, data: CreateProjectsByIdMcpConfigRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdMcpConfigResponse> {
    return this.request<CreateProjectsByIdMcpConfigResponse>('POST', this.buildPath(`/api/projects/{id}/mcp/config`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/mcp/installation/detect
   */
  async listMcpInstallationDetect(options?: { timeout?: number }): Promise<ListMcpInstallationDetectResponse> {
    return this.request<ListMcpInstallationDetectResponse>('GET', `/api/mcp/installation/detect`, { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/mcp/installation/status
   */
  async getProjectsByIdMcpInstallationStatus(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdMcpInstallationStatusResponse> {
    return this.request<GetProjectsByIdMcpInstallationStatusResponse>('GET', this.buildPath(`/api/projects/{id}/mcp/installation/status`, { id }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/mcp/installation/install
   */
  async createProjectsByIdMcpInstallationInstall(id: string | number, data: CreateProjectsByIdMcpInstallationInstallRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdMcpInstallationInstallResponse> {
    return this.request<CreateProjectsByIdMcpInstallationInstallResponse>('POST', this.buildPath(`/api/projects/{id}/mcp/installation/install`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/mcp/installation/uninstall
   */
  async createProjectsByIdMcpInstallationUninstall(id: string | number, data: CreateProjectsByIdMcpInstallationUninstallRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdMcpInstallationUninstallResponse> {
    return this.request<CreateProjectsByIdMcpInstallationUninstallResponse>('POST', this.buildPath(`/api/projects/{id}/mcp/installation/uninstall`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/mcp/status
   */
  async listMcpStatus(options?: { timeout?: number }): Promise<ListMcpStatusResponse> {
    return this.request<ListMcpStatusResponse>('GET', `/api/mcp/status`, { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/mcp/installation/batch-install
   */
  async createProjectsByIdMcpInstallationBatchInstall(id: string | number, data: CreateProjectsByIdMcpInstallationBatchInstallRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdMcpInstallationBatchInstallResponse> {
    return this.request<CreateProjectsByIdMcpInstallationBatchInstallResponse>('POST', this.buildPath(`/api/projects/{id}/mcp/installation/batch-install`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/mcp/install-project-config
   */
  async createProjectsByIdMcpInstallProjectConfig(id: string | number, data: CreateProjectsByIdMcpInstallProjectConfigRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdMcpInstallProjectConfigResponse> {
    return this.request<CreateProjectsByIdMcpInstallProjectConfigResponse>('POST', this.buildPath(`/api/projects/{id}/mcp/install-project-config`, { id }), { body: data, timeout: options?.timeout })
  }


  // MCP Tools Operations
  /**
   * GET /api/mcp/active-tools
   */
  async listMcpActiveTools(query?: { projectId?: any; provider?: any }, options?: { timeout?: number }): Promise<ListMcpActiveToolsResponse> {
    return this.request<ListMcpActiveToolsResponse>('GET', `/api/mcp/active-tools`, { params: query, timeout: options?.timeout })
  }


  // Git Operations
  /**
   * Get git status for a project
   */
  async getProjectsByIdGitStatus(id: string | number, query?: { refresh?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdGitStatusResponse> {
    return this.request<GetProjectsByIdGitStatusResponse>('GET', this.buildPath(`/api/projects/{id}/git/status`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Stage files for commit
   */
  async createProjectsByIdGitStage(id: string | number, data: CreateProjectsByIdGitStageRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitStageResponse> {
    return this.request<CreateProjectsByIdGitStageResponse>('POST', this.buildPath(`/api/projects/{id}/git/stage`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Unstage files from commit
   */
  async createProjectsByIdGitUnstage(id: string | number, data: CreateProjectsByIdGitUnstageRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitUnstageResponse> {
    return this.request<CreateProjectsByIdGitUnstageResponse>('POST', this.buildPath(`/api/projects/{id}/git/unstage`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Stage all changes
   */
  async createProjectsByIdGitStageAll(id: string | number, options?: { timeout?: number }): Promise<CreateProjectsByIdGitStageAllResponse> {
    return this.request<CreateProjectsByIdGitStageAllResponse>('POST', this.buildPath(`/api/projects/{id}/git/stage-all`, { id }), { timeout: options?.timeout })
  }

  /**
   * Unstage all changes
   */
  async createProjectsByIdGitUnstageAll(id: string | number, options?: { timeout?: number }): Promise<CreateProjectsByIdGitUnstageAllResponse> {
    return this.request<CreateProjectsByIdGitUnstageAllResponse>('POST', this.buildPath(`/api/projects/{id}/git/unstage-all`, { id }), { timeout: options?.timeout })
  }

  /**
   * Create a new commit
   */
  async createProjectsByIdGitCommit(id: string | number, data: CreateProjectsByIdGitCommitRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitCommitResponse> {
    return this.request<CreateProjectsByIdGitCommitResponse>('POST', this.buildPath(`/api/projects/{id}/git/commit`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get commit history
   */
  async getProjectsByIdGitLog(id: string | number, query?: { maxCount?: any; skip?: any; author?: any; since?: any; until?: any; grep?: any; branch?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdGitLogResponse> {
    return this.request<GetProjectsByIdGitLogResponse>('GET', this.buildPath(`/api/projects/{id}/git/log`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get enhanced commit history
   */
  async getProjectsByIdGitLogEnhanced(id: string | number, query?: { maxCount?: any; skip?: any; author?: any; since?: any; until?: any; grep?: any; branch?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdGitLogEnhancedResponse> {
    return this.request<GetProjectsByIdGitLogEnhancedResponse>('GET', this.buildPath(`/api/projects/{id}/git/log-enhanced`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get commit details
   */
  async getProjectsByIdGitCommitsByCommitHash(id: string | number, commitHash: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdGitCommitsByCommitHashResponse> {
    return this.request<GetProjectsByIdGitCommitsByCommitHashResponse>('GET', this.buildPath(`/api/projects/{id}/git/commits/{commitHash}`, { id, commitHash }), { timeout: options?.timeout })
  }

  /**
   * Get file diff
   */
  async getProjectsByIdGitDiff(id: string | number, query?: { filePath?: any; cached?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdGitDiffResponse> {
    return this.request<GetProjectsByIdGitDiffResponse>('GET', this.buildPath(`/api/projects/{id}/git/diff`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * List all branches
   */
  async getProjectsByIdGitBranches(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdGitBranchesResponse> {
    return this.request<GetProjectsByIdGitBranchesResponse>('GET', this.buildPath(`/api/projects/{id}/git/branches`, { id }), { timeout: options?.timeout })
  }

  /**
   * Create a new branch
   */
  async createProjectsByIdGitBranches(id: string | number, data: CreateProjectsByIdGitBranchesRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitBranchesResponse> {
    return this.request<CreateProjectsByIdGitBranchesResponse>('POST', this.buildPath(`/api/projects/{id}/git/branches`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * List branches with enhanced information
   */
  async getProjectsByIdGitBranchesEnhanced(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdGitBranchesEnhancedResponse> {
    return this.request<GetProjectsByIdGitBranchesEnhancedResponse>('GET', this.buildPath(`/api/projects/{id}/git/branches-enhanced`, { id }), { timeout: options?.timeout })
  }

  /**
   * Switch to a different branch
   */
  async createProjectsByIdGitBranchesSwitch(id: string | number, data: CreateProjectsByIdGitBranchesSwitchRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitBranchesSwitchResponse> {
    return this.request<CreateProjectsByIdGitBranchesSwitchResponse>('POST', this.buildPath(`/api/projects/{id}/git/branches/switch`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a branch
   */
  async deleteProjectsByIdGitBranchesByBranchName(id: string | number, branchName: string | number, query?: { force?: any }, options?: { timeout?: number }): Promise<DeleteProjectsByIdGitBranchesByBranchNameResponse> {
    return this.request<DeleteProjectsByIdGitBranchesByBranchNameResponse>('DELETE', this.buildPath(`/api/projects/{id}/git/branches/{branchName}`, { id, branchName }), { params: query, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/git/stash
   */
  async getProjectsByIdGitStash(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdGitStashResponse> {
    return this.request<GetProjectsByIdGitStashResponse>('GET', this.buildPath(`/api/projects/{id}/git/stash`, { id }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/git/stash
   */
  async createProjectsByIdGitStash(id: string | number, data: CreateProjectsByIdGitStashRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitStashResponse> {
    return this.request<CreateProjectsByIdGitStashResponse>('POST', this.buildPath(`/api/projects/{id}/git/stash`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Drop a stash
   */
  async deleteProjectsByIdGitStash(id: string | number, data: DeleteProjectsByIdGitStashRequest, options?: { timeout?: number }): Promise<DeleteProjectsByIdGitStashResponse> {
    return this.request<DeleteProjectsByIdGitStashResponse>('DELETE', this.buildPath(`/api/projects/{id}/git/stash`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/git/stash/apply
   */
  async createProjectsByIdGitStashApply(id: string | number, data: CreateProjectsByIdGitStashApplyRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitStashApplyResponse> {
    return this.request<CreateProjectsByIdGitStashApplyResponse>('POST', this.buildPath(`/api/projects/{id}/git/stash/apply`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Pop a stash
   */
  async createProjectsByIdGitStashPop(id: string | number, data: CreateProjectsByIdGitStashPopRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitStashPopResponse> {
    return this.request<CreateProjectsByIdGitStashPopResponse>('POST', this.buildPath(`/api/projects/{id}/git/stash/pop`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * List all worktrees
   */
  async getProjectsByIdGitWorktrees(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdGitWorktreesResponse> {
    return this.request<GetProjectsByIdGitWorktreesResponse>('GET', this.buildPath(`/api/projects/{id}/git/worktrees`, { id }), { timeout: options?.timeout })
  }

  /**
   * Add a new worktree
   */
  async createProjectsByIdGitWorktrees(id: string | number, data: CreateProjectsByIdGitWorktreesRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitWorktreesResponse> {
    return this.request<CreateProjectsByIdGitWorktreesResponse>('POST', this.buildPath(`/api/projects/{id}/git/worktrees`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Remove a worktree
   */
  async deleteProjectsByIdGitWorktrees(id: string | number, data: DeleteProjectsByIdGitWorktreesRequest, options?: { timeout?: number }): Promise<DeleteProjectsByIdGitWorktreesResponse> {
    return this.request<DeleteProjectsByIdGitWorktreesResponse>('DELETE', this.buildPath(`/api/projects/{id}/git/worktrees`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Lock a worktree
   */
  async createProjectsByIdGitWorktreesLock(id: string | number, data: CreateProjectsByIdGitWorktreesLockRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitWorktreesLockResponse> {
    return this.request<CreateProjectsByIdGitWorktreesLockResponse>('POST', this.buildPath(`/api/projects/{id}/git/worktrees/lock`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Unlock a worktree
   */
  async createProjectsByIdGitWorktreesUnlock(id: string | number, data: CreateProjectsByIdGitWorktreesUnlockRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitWorktreesUnlockResponse> {
    return this.request<CreateProjectsByIdGitWorktreesUnlockResponse>('POST', this.buildPath(`/api/projects/{id}/git/worktrees/unlock`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Prune worktrees
   */
  async createProjectsByIdGitWorktreesPrune(id: string | number, query?: { dryRun?: any }, options?: { timeout?: number }): Promise<CreateProjectsByIdGitWorktreesPruneResponse> {
    return this.request<CreateProjectsByIdGitWorktreesPruneResponse>('POST', this.buildPath(`/api/projects/{id}/git/worktrees/prune`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/git/remotes
   */
  async getProjectsByIdGitRemotes(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdGitRemotesResponse> {
    return this.request<GetProjectsByIdGitRemotesResponse>('GET', this.buildPath(`/api/projects/{id}/git/remotes`, { id }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/git/push
   */
  async createProjectsByIdGitPush(id: string | number, data: CreateProjectsByIdGitPushRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitPushResponse> {
    return this.request<CreateProjectsByIdGitPushResponse>('POST', this.buildPath(`/api/projects/{id}/git/push`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/git/fetch
   */
  async createProjectsByIdGitFetch(id: string | number, data: CreateProjectsByIdGitFetchRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitFetchResponse> {
    return this.request<CreateProjectsByIdGitFetchResponse>('POST', this.buildPath(`/api/projects/{id}/git/fetch`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/git/pull
   */
  async createProjectsByIdGitPull(id: string | number, data: CreateProjectsByIdGitPullRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitPullResponse> {
    return this.request<CreateProjectsByIdGitPullResponse>('POST', this.buildPath(`/api/projects/{id}/git/pull`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/git/tags
   */
  async getProjectsByIdGitTags(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdGitTagsResponse> {
    return this.request<GetProjectsByIdGitTagsResponse>('GET', this.buildPath(`/api/projects/{id}/git/tags`, { id }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/git/tags
   */
  async createProjectsByIdGitTags(id: string | number, data: CreateProjectsByIdGitTagsRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitTagsResponse> {
    return this.request<CreateProjectsByIdGitTagsResponse>('POST', this.buildPath(`/api/projects/{id}/git/tags`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/git/reset
   */
  async createProjectsByIdGitReset(id: string | number, data: CreateProjectsByIdGitResetRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdGitResetResponse> {
    return this.request<CreateProjectsByIdGitResetResponse>('POST', this.buildPath(`/api/projects/{id}/git/reset`, { id }), { body: data, timeout: options?.timeout })
  }


  // Project Tabs Operations
  /**
   * Generate an AI-powered name for a project tab
   */
  async createProjectTabsByTabIdGenerateName(tabId: string | number, data: CreateProjectTabsByTabIdGenerateNameRequest, options?: { timeout?: number }): Promise<CreateProjectTabsByTabIdGenerateNameResponse> {
    return this.request<CreateProjectTabsByTabIdGenerateNameResponse>('POST', this.buildPath(`/api/project-tabs/{tabId}/generate-name`, { tabId }), { body: data, timeout: options?.timeout })
  }


  // Agent Files Operations
  /**
   * GET /api/projects/{id}/agent-files/detect
   */
  async getProjectsByIdAgentFilesDetect(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdAgentFilesDetectResponse> {
    return this.request<GetProjectsByIdAgentFilesDetectResponse>('GET', this.buildPath(`/api/projects/{id}/agent-files/detect`, { id }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/agent-files/update
   */
  async createProjectsByIdAgentFilesUpdate(id: string | number, data: CreateProjectsByIdAgentFilesUpdateRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdAgentFilesUpdateResponse> {
    return this.request<CreateProjectsByIdAgentFilesUpdateResponse>('POST', this.buildPath(`/api/projects/{id}/agent-files/update`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/agent-files/remove-instructions
   */
  async createProjectsByIdAgentFilesRemoveInstructions(id: string | number, data: CreateProjectsByIdAgentFilesRemoveInstructionsRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdAgentFilesRemoveInstructionsResponse> {
    return this.request<CreateProjectsByIdAgentFilesRemoveInstructionsResponse>('POST', this.buildPath(`/api/projects/{id}/agent-files/remove-instructions`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{id}/agent-files/status
   */
  async getProjectsByIdAgentFilesStatus(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdAgentFilesStatusResponse> {
    return this.request<GetProjectsByIdAgentFilesStatusResponse>('GET', this.buildPath(`/api/projects/{id}/agent-files/status`, { id }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{id}/agent-files/create
   */
  async createProjectsByIdAgentFilesCreate(id: string | number, data: CreateProjectsByIdAgentFilesCreateRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdAgentFilesCreateResponse> {
    return this.request<CreateProjectsByIdAgentFilesCreateResponse>('POST', this.buildPath(`/api/projects/{id}/agent-files/create`, { id }), { body: data, timeout: options?.timeout })
  }


  // Processes Operations
  /**
   * List processes for a project
   */
  async getProjectsByIdProcesses(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdProcessesResponse> {
    return this.request<GetProjectsByIdProcessesResponse>('GET', this.buildPath(`/api/projects/{id}/processes`, { id }), { timeout: options?.timeout })
  }

  /**
   * List package.json scripts in the project (root + workspaces)
   */
  async getProjectsByIdProcessesScripts(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdProcessesScriptsResponse> {
    return this.request<GetProjectsByIdProcessesScriptsResponse>('GET', this.buildPath(`/api/projects/{id}/processes/scripts`, { id }), { timeout: options?.timeout })
  }

  /**
   * Start a new process for a project
   */
  async createProjectsByIdProcessesStart(id: string | number, data: CreateProjectsByIdProcessesStartRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdProcessesStartResponse> {
    return this.request<CreateProjectsByIdProcessesStartResponse>('POST', this.buildPath(`/api/projects/{id}/processes/start`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Stop a running process
   */
  async createProjectsByIdProcessesByProcessIdStop(id: string | number, processId: string | number, options?: { timeout?: number }): Promise<CreateProjectsByIdProcessesByProcessIdStopResponse> {
    return this.request<CreateProjectsByIdProcessesByProcessIdStopResponse>('POST', this.buildPath(`/api/projects/{id}/processes/{processId}/stop`, { id, processId }), { timeout: options?.timeout })
  }

  /**
   * Get process execution history
   */
  async getProjectsByIdProcessesHistory(id: string | number, query?: { limit?: any; offset?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdProcessesHistoryResponse> {
    return this.request<GetProjectsByIdProcessesHistoryResponse>('GET', this.buildPath(`/api/projects/{id}/processes/history`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get logs for a process
   */
  async getProjectsByIdProcessesByProcessIdLogs(id: string | number, processId: string | number, query?: { limit?: any; offset?: any; type?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdProcessesByProcessIdLogsResponse> {
    return this.request<GetProjectsByIdProcessesByProcessIdLogsResponse>('GET', this.buildPath(`/api/projects/{id}/processes/{processId}/logs`, { id, processId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get ports used by processes
   */
  async getProjectsByIdProcessesPorts(id: string | number, query?: { state?: any }, options?: { timeout?: number }): Promise<GetProjectsByIdProcessesPortsResponse> {
    return this.request<GetProjectsByIdProcessesPortsResponse>('GET', this.buildPath(`/api/projects/{id}/processes/ports`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Kill process using a specific port
   */
  async createProjectsByIdProcessesPortsByPortKill(id: string | number, port: string | number, options?: { timeout?: number }): Promise<CreateProjectsByIdProcessesPortsByPortKillResponse> {
    return this.request<CreateProjectsByIdProcessesPortsByPortKillResponse>('POST', this.buildPath(`/api/projects/{id}/processes/ports/{port}/kill`, { id, port }), { timeout: options?.timeout })
  }

  /**
   * Scan and update port usage
   */
  async createProjectsByIdProcessesPortsScan(id: string | number, options?: { timeout?: number }): Promise<CreateProjectsByIdProcessesPortsScanResponse> {
    return this.request<CreateProjectsByIdProcessesPortsScanResponse>('POST', this.buildPath(`/api/projects/{id}/processes/ports/scan`, { id }), { timeout: options?.timeout })
  }

  /**
   * Run a package.json script
   */
  async createProjectsByIdProcessesScriptsRun(id: string | number, data: CreateProjectsByIdProcessesScriptsRunRequest, options?: { timeout?: number }): Promise<CreateProjectsByIdProcessesScriptsRunResponse> {
    return this.request<CreateProjectsByIdProcessesScriptsRunResponse>('POST', this.buildPath(`/api/projects/{id}/processes/scripts/run`, { id }), { body: data, timeout: options?.timeout })
  }


  // Deep Research Operations
  /**
   * List all research sessions
   */
  async getResearch(options?: { timeout?: number }): Promise<GetResearchResponse> {
    return this.request<GetResearchResponse>('GET', `/api/research`, { timeout: options?.timeout })
  }

  /**
   * Create a new research session
   */
  async createResearc(data: CreateResearcRequest, options?: { timeout?: number }): Promise<CreateResearcResponse> {
    return this.request<CreateResearcResponse>('POST', `/api/research`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a specific research session
   */
  async getResearc(id: string | number, options?: { timeout?: number }): Promise<GetResearcResponse> {
    return this.request<GetResearcResponse>('GET', this.buildPath(`/api/research/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a research session
   */
  async updateResearc(id: string | number, data: UpdateResearcRequest, options?: { timeout?: number }): Promise<UpdateResearcResponse> {
    return this.request<UpdateResearcResponse>('PATCH', this.buildPath(`/api/research/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a research session
   */
  async deleteResearc(id: string | number, options?: { timeout?: number }): Promise<DeleteResearcResponse> {
    return this.request<DeleteResearcResponse>('DELETE', this.buildPath(`/api/research/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Start a new research session with automatic source gathering
   */
  async createResearchStart(data: CreateResearchStartRequest, options?: { timeout?: number }): Promise<CreateResearchStartResponse> {
    return this.request<CreateResearchStartResponse>('POST', `/api/research/start`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get all sources for a research session
   */
  async getResearchByIdSources(id: string | number, options?: { timeout?: number }): Promise<GetResearchByIdSourcesResponse> {
    return this.request<GetResearchByIdSourcesResponse>('GET', this.buildPath(`/api/research/{id}/sources`, { id }), { timeout: options?.timeout })
  }

  /**
   * Add a source to research
   */
  async createResearchByIdSources(id: string | number, data: CreateResearchByIdSourcesRequest, options?: { timeout?: number }): Promise<CreateResearchByIdSourcesResponse> {
    return this.request<CreateResearchByIdSourcesResponse>('POST', this.buildPath(`/api/research/{id}/sources`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Process a specific source
   */
  async createResearchSourcesByIdProcess(id: string | number, options?: { timeout?: number }): Promise<CreateResearchSourcesByIdProcessResponse> {
    return this.request<CreateResearchSourcesByIdProcessResponse>('POST', this.buildPath(`/api/research/sources/{id}/process`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get processed data for a specific source
   */
  async getResearchSourcesByIdProcessedData(id: string | number, options?: { timeout?: number }): Promise<GetResearchSourcesByIdProcessedDataResponse> {
    return this.request<GetResearchSourcesByIdProcessedDataResponse>('GET', this.buildPath(`/api/research/sources/{id}/processed-data`, { id }), { timeout: options?.timeout })
  }

  /**
   * Generate document outline
   */
  async createResearchByIdOutline(id: string | number, data: CreateResearchByIdOutlineRequest, options?: { timeout?: number }): Promise<CreateResearchByIdOutlineResponse> {
    return this.request<CreateResearchByIdOutlineResponse>('POST', this.buildPath(`/api/research/{id}/outline`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get all sections for a research document
   */
  async getResearchByIdSections(id: string | number, options?: { timeout?: number }): Promise<GetResearchByIdSectionsResponse> {
    return this.request<GetResearchByIdSectionsResponse>('GET', this.buildPath(`/api/research/{id}/sections`, { id }), { timeout: options?.timeout })
  }

  /**
   * Build a specific section
   */
  async createResearchSectionsByIdBuild(id: string | number, data: CreateResearchSectionsByIdBuildRequest, options?: { timeout?: number }): Promise<CreateResearchSectionsByIdBuildResponse> {
    return this.request<CreateResearchSectionsByIdBuildResponse>('POST', this.buildPath(`/api/research/sections/{id}/build`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Update a section
   */
  async updateResearchSectionsById(id: string | number, data: UpdateResearchSectionsByIdRequest, options?: { timeout?: number }): Promise<UpdateResearchSectionsByIdResponse> {
    return this.request<UpdateResearchSectionsByIdResponse>('PATCH', this.buildPath(`/api/research/sections/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get research progress
   */
  async getResearchByIdProgress(id: string | number, options?: { timeout?: number }): Promise<GetResearchByIdProgressResponse> {
    return this.request<GetResearchByIdProgressResponse>('GET', this.buildPath(`/api/research/{id}/progress`, { id }), { timeout: options?.timeout })
  }

  /**
   * Export research document
   */
  async createResearchByIdExport(id: string | number, data: CreateResearchByIdExportRequest, options?: { timeout?: number }): Promise<CreateResearchByIdExportResponse> {
    return this.request<CreateResearchByIdExportResponse>('POST', this.buildPath(`/api/research/{id}/export`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Execute workflow from current state to completion
   */
  async createResearchByIdExecute(id: string | number, data: CreateResearchByIdExecuteRequest, options?: { timeout?: number }): Promise<CreateResearchByIdExecuteResponse> {
    return this.request<CreateResearchByIdExecuteResponse>('POST', this.buildPath(`/api/research/{id}/execute`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Resume workflow from failed/stopped state
   */
  async createResearchByIdResume(id: string | number, options?: { timeout?: number }): Promise<CreateResearchByIdResumeResponse> {
    return this.request<CreateResearchByIdResumeResponse>('POST', this.buildPath(`/api/research/{id}/resume`, { id }), { timeout: options?.timeout })
  }

  /**
   * Stop automatic workflow execution
   */
  async createResearchByIdStop(id: string | number, options?: { timeout?: number }): Promise<CreateResearchByIdStopResponse> {
    return this.request<CreateResearchByIdStopResponse>('POST', this.buildPath(`/api/research/{id}/stop`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get detailed workflow status with action availability
   */
  async getResearchByIdWorkflowStatus(id: string | number, options?: { timeout?: number }): Promise<GetResearchByIdWorkflowStatusResponse> {
    return this.request<GetResearchByIdWorkflowStatusResponse>('GET', this.buildPath(`/api/research/{id}/workflow-status`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get web crawling progress
   */
  async getResearchByIdCrawlProgress(id: string | number, options?: { timeout?: number }): Promise<GetResearchByIdCrawlProgressResponse> {
    return this.request<GetResearchByIdCrawlProgressResponse>('GET', this.buildPath(`/api/research/{id}/crawl-progress`, { id }), { timeout: options?.timeout })
  }

  /**
   * Get debug events for a research session
   */
  async listDeepResearchByResearchIdDebugEvents(researchId: string | number, query?: { category?: any; level?: any; limit?: any; from?: any; to?: any }, options?: { timeout?: number }): Promise<ListDeepResearchByResearchIdDebugEventsResponse> {
    return this.request<ListDeepResearchByResearchIdDebugEventsResponse>('GET', this.buildPath(`/api/deep-research/{researchId}/debug/events`, { researchId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Clear all debug events
   */
  async deleteDeepResearchByResearchIdDebugEvents(researchId: string | number, options?: { timeout?: number }): Promise<DeleteDeepResearchByResearchIdDebugEventsResponse> {
    return this.request<DeleteDeepResearchByResearchIdDebugEventsResponse>('DELETE', this.buildPath(`/api/deep-research/{researchId}/debug/events`, { researchId }), { timeout: options?.timeout })
  }

  /**
   * Get debug statistics for a research session
   */
  async listDeepResearchByResearchIdDebugStats(researchId: string | number, options?: { timeout?: number }): Promise<ListDeepResearchByResearchIdDebugStatsResponse> {
    return this.request<ListDeepResearchByResearchIdDebugStatsResponse>('GET', this.buildPath(`/api/deep-research/{researchId}/debug/stats`, { researchId }), { timeout: options?.timeout })
  }

  /**
   * Get recent debug activity
   */
  async listDeepResearchByResearchIdDebugActivity(researchId: string | number, query?: { limit?: any }, options?: { timeout?: number }): Promise<ListDeepResearchByResearchIdDebugActivityResponse> {
    return this.request<ListDeepResearchByResearchIdDebugActivityResponse>('GET', this.buildPath(`/api/deep-research/{researchId}/debug/activity`, { researchId }), { params: query, timeout: options?.timeout })
  }


  // Model Configuration Operations
  /**
   * Get all model configurations
   */
  async getModelConfigs(options?: { timeout?: number }): Promise<GetModelConfigsResponse> {
    return this.request<GetModelConfigsResponse>('GET', `/api/model-configs`, { timeout: options?.timeout })
  }

  /**
   * Create a new model configuration
   */
  async createModelConfig(data: CreateModelConfigRequest, options?: { timeout?: number }): Promise<CreateModelConfigResponse> {
    return this.request<CreateModelConfigResponse>('POST', `/api/model-configs`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get model configurations by provider
   */
  async listModelConfigsProviderByProvider(provider: string | number, options?: { timeout?: number }): Promise<ListModelConfigsProviderByProviderResponse> {
    return this.request<ListModelConfigsProviderByProviderResponse>('GET', this.buildPath(`/api/model-configs/provider/{provider}`, { provider }), { timeout: options?.timeout })
  }

  /**
   * Get default configuration for a provider
   */
  async listModelConfigsProviderByProviderDefault(provider: string | number, options?: { timeout?: number }): Promise<ListModelConfigsProviderByProviderDefaultResponse> {
    return this.request<ListModelConfigsProviderByProviderDefaultResponse>('GET', this.buildPath(`/api/model-configs/provider/{provider}/default`, { provider }), { timeout: options?.timeout })
  }

  /**
   * Get configuration by name
   */
  async listModelConfigsNameByName(name: string | number, options?: { timeout?: number }): Promise<ListModelConfigsNameByNameResponse> {
    return this.request<ListModelConfigsNameByNameResponse>('GET', this.buildPath(`/api/model-configs/name/{name}`, { name }), { timeout: options?.timeout })
  }

  /**
   * Get configuration by ID
   */
  async getModelConfig(id: string | number, options?: { timeout?: number }): Promise<GetModelConfigResponse> {
    return this.request<GetModelConfigResponse>('GET', this.buildPath(`/api/model-configs/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a model configuration
   */
  async updateModelConfig(id: string | number, data: UpdateModelConfigRequest, options?: { timeout?: number }): Promise<UpdateModelConfigResponse> {
    return this.request<UpdateModelConfigResponse>('PUT', this.buildPath(`/api/model-configs/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a model configuration
   */
  async deleteModelConfig(id: string | number, query?: { hard?: any }, options?: { timeout?: number }): Promise<DeleteModelConfigResponse> {
    return this.request<DeleteModelConfigResponse>('DELETE', this.buildPath(`/api/model-configs/{id}`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Set configuration as default for its provider
   */
  async createModelConfigsByIdSetDefault(id: string | number, options?: { timeout?: number }): Promise<CreateModelConfigsByIdSetDefaultResponse> {
    return this.request<CreateModelConfigsByIdSetDefaultResponse>('POST', this.buildPath(`/api/model-configs/{id}/set-default`, { id }), { timeout: options?.timeout })
  }

  /**
   * Initialize system default configurations
   */
  async createModelConfigsSystemInitialize(options?: { timeout?: number }): Promise<CreateModelConfigsSystemInitializeResponse> {
    return this.request<CreateModelConfigsSystemInitializeResponse>('POST', `/api/model-configs/system/initialize`, { timeout: options?.timeout })
  }

  /**
   * Export all configurations and presets
   */
  async listModelConfigsExport(options?: { timeout?: number }): Promise<ListModelConfigsExportResponse> {
    return this.request<ListModelConfigsExportResponse>('GET', `/api/model-configs/export`, { timeout: options?.timeout })
  }

  /**
   * Import configurations and presets
   */
  async createModelConfigsImport(data: CreateModelConfigsImportRequest, options?: { timeout?: number }): Promise<CreateModelConfigsImportResponse> {
    return this.request<CreateModelConfigsImportResponse>('POST', `/api/model-configs/import`, { body: data, timeout: options?.timeout })
  }


  // Model Presets Operations
  /**
   * Get all model presets with configurations
   */
  async getModelPresets(options?: { timeout?: number }): Promise<GetModelPresetsResponse> {
    return this.request<GetModelPresetsResponse>('GET', `/api/model-presets`, { timeout: options?.timeout })
  }

  /**
   * Create a new model preset
   */
  async createModelPreset(data: CreateModelPresetRequest, options?: { timeout?: number }): Promise<CreateModelPresetResponse> {
    return this.request<CreateModelPresetResponse>('POST', `/api/model-presets`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get presets by category
   */
  async listModelPresetsCategoryByCategory(category: string | number, options?: { timeout?: number }): Promise<ListModelPresetsCategoryByCategoryResponse> {
    return this.request<ListModelPresetsCategoryByCategoryResponse>('GET', this.buildPath(`/api/model-presets/category/{category}`, { category }), { timeout: options?.timeout })
  }

  /**
   * Get most used presets
   */
  async listModelPresetsMostUsed(query?: { limit?: any }, options?: { timeout?: number }): Promise<ListModelPresetsMostUsedResponse> {
    return this.request<ListModelPresetsMostUsedResponse>('GET', `/api/model-presets/most-used`, { params: query, timeout: options?.timeout })
  }

  /**
   * Get recently used presets
   */
  async listModelPresetsRecentlyUsed(query?: { limit?: any }, options?: { timeout?: number }): Promise<ListModelPresetsRecentlyUsedResponse> {
    return this.request<ListModelPresetsRecentlyUsedResponse>('GET', `/api/model-presets/recently-used`, { params: query, timeout: options?.timeout })
  }

  /**
   * Get preset with its configuration
   */
  async getModelPreset(id: string | number, options?: { timeout?: number }): Promise<GetModelPresetResponse> {
    return this.request<GetModelPresetResponse>('GET', this.buildPath(`/api/model-presets/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a model preset
   */
  async updateModelPreset(id: string | number, data: UpdateModelPresetRequest, options?: { timeout?: number }): Promise<UpdateModelPresetResponse> {
    return this.request<UpdateModelPresetResponse>('PUT', this.buildPath(`/api/model-presets/{id}`, { id }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a model preset
   */
  async deleteModelPreset(id: string | number, query?: { hard?: any }, options?: { timeout?: number }): Promise<DeleteModelPresetResponse> {
    return this.request<DeleteModelPresetResponse>('DELETE', this.buildPath(`/api/model-presets/{id}`, { id }), { params: query, timeout: options?.timeout })
  }

  /**
   * Mark preset as used (increments usage count)
   */
  async createModelPresetsByIdUse(id: string | number, options?: { timeout?: number }): Promise<CreateModelPresetsByIdUseResponse> {
    return this.request<CreateModelPresetsByIdUseResponse>('POST', this.buildPath(`/api/model-presets/{id}/use`, { id }), { timeout: options?.timeout })
  }



}

/**
 * Factory function for creating the type-safe API client
 */
export function createTypeSafeClient(config?: {
  baseUrl?: string
  timeout?: number
  headers?: Record<string, string>
}): TypeSafeApiClient {
  return new TypeSafeApiClient(config)
}
