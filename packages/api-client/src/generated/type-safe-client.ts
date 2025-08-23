/**
 * AUTO-GENERATED TYPE-SAFE API CLIENT
 * Generated at: 2025-08-23T17:06:51.807Z
 * Generated from: 208 API endpoints
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import type { paths } from './api-types'

// Re-export all paths for external usage
export type ApiPaths = paths

// ===== UTILITY TYPES FOR SAFE RESPONSE EXTRACTION =====

/**
 * Safely extract 200 response type from OpenAPI paths
 */
type Safe200ResponseType<T> = T extends { responses: { 200: { content: { 'application/json': infer R } } } } ? R : never

/**
 * Safely extract 201 response type from OpenAPI paths  
 */
type Safe201ResponseType<T> = T extends { responses: { 201: { content: { 'application/json': infer R } } } } ? R : never

/**
 * Safely extract request body type from OpenAPI paths
 */
type SafeRequestType<T> = T extends { requestBody: { content: { 'application/json': infer R } } } ? R : never

// ===== GENERATED TYPES FOR ALL ENDPOINTS =====

export type GetChatsResponse = Safe200ResponseType<paths['/api/chats']['get']>
export type CreateChatsResponse = Safe201ResponseType<paths['/api/chats']['post']>
export type CreateChatsRequest = SafeRequestType<paths['/api/chats']['post']>
export type ListChatsByChatIdMessagesResponse = Safe200ResponseType<paths['/api/chats/{chatId}/messages']['get']>
export type CreateChatsByChatIdForkResponse = Safe201ResponseType<paths['/api/chats/{chatId}/fork']['post']>
export type CreateChatsByChatIdForkRequest = SafeRequestType<paths['/api/chats/{chatId}/fork']['post']>
export type CreateChatsByChatIdForkByMessageIdResponse = Safe201ResponseType<paths['/api/chats/{chatId}/fork/{messageId}']['post']>
export type CreateChatsByChatIdForkByMessageIdRequest = SafeRequestType<paths['/api/chats/{chatId}/fork/{messageId}']['post']>
export type UpdateChatsByChatIdResponse = Safe200ResponseType<paths['/api/chats/{chatId}']['patch']>
export type UpdateChatsByChatIdRequest = SafeRequestType<paths['/api/chats/{chatId}']['patch']>
export type DeleteChatsByChatIdResponse = Safe200ResponseType<paths['/api/chats/{chatId}']['delete']>
export type CreateAiChatResponse = { success: boolean; message?: string }
export type CreateAiChatRequest = SafeRequestType<paths['/api/ai/chat']['post']>
export type GetProvidersResponse = Safe200ResponseType<paths['/api/providers']['get']>
export type GetModelsResponse = Safe200ResponseType<paths['/api/models']['get']>
export type CreateAiGenerateTextResponse = Safe200ResponseType<paths['/api/ai/generate/text']['post']>
export type CreateAiGenerateTextRequest = SafeRequestType<paths['/api/ai/generate/text']['post']>
export type CreateProviderSettingsResponse = Safe200ResponseType<paths['/api/provider-settings']['post']>
export type CreateProviderSettingsRequest = SafeRequestType<paths['/api/provider-settings']['post']>
export type DeleteChatsByChatIdMessagesByMessageIdResponse = Safe200ResponseType<paths['/api/chats/{chatId}/messages/{messageId}']['delete']>
export type GetProjectsResponse = Safe200ResponseType<paths['/api/projects']['get']>
export type CreateProjectsResponse = Safe201ResponseType<paths['/api/projects']['post']>
export type CreateProjectsRequest = SafeRequestType<paths['/api/projects']['post']>
export type ListProjectsByProjectIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}']['get']>
export type UpdateProjectsByProjectIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}']['patch']>
export type UpdateProjectsByProjectIdRequest = SafeRequestType<paths['/api/projects/{projectId}']['patch']>
export type DeleteProjectsByProjectIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}']['delete']>
export type CreateProjectsByProjectIdSyncResponse = Safe200ResponseType<paths['/api/projects/{projectId}/sync']['post']>
export type ListProjectsByProjectIdSyncStreamResponse = { success: boolean; message?: string }
export type ListProjectsByProjectIdFilesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/files']['get']>
export type ListProjectsByProjectIdFilesMetadataResponse = Safe200ResponseType<paths['/api/projects/{projectId}/files/metadata']['get']>
export type UpdateProjectsByProjectIdFilesBulkResponse = Safe200ResponseType<paths['/api/projects/{projectId}/files/bulk']['put']>
export type UpdateProjectsByProjectIdFilesBulkRequest = SafeRequestType<paths['/api/projects/{projectId}/files/bulk']['put']>
export type UpdateProjectsByProjectIdFilesByFileIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}/files/{fileId}']['put']>
export type UpdateProjectsByProjectIdFilesByFileIdRequest = SafeRequestType<paths['/api/projects/{projectId}/files/{fileId}']['put']>
export type CreateProjectsByProjectIdRefreshResponse = Safe200ResponseType<paths['/api/projects/{projectId}/refresh']['post']>
export type ListProjectsByProjectIdSummaryResponse = Safe200ResponseType<paths['/api/projects/{projectId}/summary']['get']>
export type CreateProjectsByProjectIdSummaryAdvancedResponse = Safe200ResponseType<paths['/api/projects/{projectId}/summary/advanced']['post']>
export type CreateProjectsByProjectIdSummaryAdvancedRequest = SafeRequestType<paths['/api/projects/{projectId}/summary/advanced']['post']>
export type ListProjectsByProjectIdSummaryMetricsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/summary/metrics']['get']>
export type CreateProjectsByProjectIdSummaryInvalidateResponse = Safe200ResponseType<paths['/api/projects/{projectId}/summary/invalidate']['post']>
export type CreateProjectsByProjectIdSuggestFilesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/suggest-files']['post']>
export type CreateProjectsByProjectIdSuggestFilesRequest = SafeRequestType<paths['/api/projects/{projectId}/suggest-files']['post']>
export type CreateProjectsByProjectIdFilesSummarizeResponse = Safe200ResponseType<paths['/api/projects/{projectId}/files/summarize']['post']>
export type CreateProjectsByProjectIdFilesSummarizeRequest = SafeRequestType<paths['/api/projects/{projectId}/files/summarize']['post']>
export type CreateProjectsByProjectIdFilesRemoveSummariesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/files/remove-summaries']['post']>
export type CreateProjectsByProjectIdFilesRemoveSummariesRequest = SafeRequestType<paths['/api/projects/{projectId}/files/remove-summaries']['post']>
export type ListProjectsByProjectIdStatisticsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/statistics']['get']>
export type CreateProjectsByProjectIdBatchSummarizeResponse = Safe200ResponseType<paths['/api/projects/{projectId}/batch-summarize']['post']>
export type CreateProjectsByProjectIdBatchSummarizeRequest = SafeRequestType<paths['/api/projects/{projectId}/batch-summarize']['post']>
export type ListProjectsByProjectIdBatchSummarizeByBatchIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}/batch-summarize/{batchId}']['get']>
export type DeleteProjectsByProjectIdBatchSummarizeByBatchIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}/batch-summarize/{batchId}']['delete']>
export type ListProjectsByProjectIdSummarizationStatsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/summarization-stats']['get']>
export type CreateProjectsByProjectIdPreviewFileGroupsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/preview-file-groups']['post']>
export type CreateProjectsByProjectIdPreviewFileGroupsRequest = SafeRequestType<paths['/api/projects/{projectId}/preview-file-groups']['post']>
export type ListProjectsByProjectIdPromptsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/prompts']['get']>
export type CreateProjectsByProjectIdSuggestPromptsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/suggest-prompts']['post']>
export type CreateProjectsByProjectIdSuggestPromptsRequest = SafeRequestType<paths['/api/projects/{projectId}/suggest-prompts']['post']>
export type CreateProjectsByProjectIdPromptsByPromptIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}/prompts/{promptId}']['post']>
export type DeleteProjectsByProjectIdPromptsByPromptIdResponse = Safe200ResponseType<paths['/api/projects/{projectId}/prompts/{promptId}']['delete']>
export type ListProjectsByProjectIdPromptsExportResponse = Safe200ResponseType<paths['/api/projects/{projectId}/prompts/export']['get']>
export type ListProjectsByProjectIdTicketsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/tickets']['get']>
export type ListProjectsByProjectIdTicketsWithCountResponse = Safe200ResponseType<paths['/api/projects/{projectId}/tickets-with-count']['get']>
export type ListProjectsByProjectIdTicketsWithTasksResponse = Safe200ResponseType<paths['/api/projects/{projectId}/tickets-with-tasks']['get']>
export type ListProjectsByProjectIdAgentsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/agents']['get']>
export type CreateProjectsByProjectIdSuggestAgentsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/suggest-agents']['post']>
export type CreateProjectsByProjectIdSuggestAgentsRequest = SafeRequestType<paths['/api/projects/{projectId}/suggest-agents']['post']>
export type CreatePromptOptimizeResponse = Safe200ResponseType<paths['/api/prompt/optimize']['post']>
export type CreatePromptOptimizeRequest = SafeRequestType<paths['/api/prompt/optimize']['post']>
export type GetPromptsResponse = Safe200ResponseType<paths['/api/prompts']['get']>
export type CreatePromptsResponse = Safe201ResponseType<paths['/api/prompts']['post']>
export type CreatePromptsRequest = SafeRequestType<paths['/api/prompts']['post']>
export type ListPromptsByPromptIdResponse = Safe200ResponseType<paths['/api/prompts/{promptId}']['get']>
export type UpdatePromptsByPromptIdResponse = Safe200ResponseType<paths['/api/prompts/{promptId}']['patch']>
export type UpdatePromptsByPromptIdRequest = SafeRequestType<paths['/api/prompts/{promptId}']['patch']>
export type DeletePromptsByPromptIdResponse = Safe200ResponseType<paths['/api/prompts/{promptId}']['delete']>
export type ListPromptsByPromptIdExportResponse = { success: boolean; message?: string }
export type CreatePromptsExportBatchResponse = Safe200ResponseType<paths['/api/prompts/export-batch']['post']>
export type CreatePromptsExportBatchRequest = SafeRequestType<paths['/api/prompts/export-batch']['post']>
export type CreatePromptsValidateMarkdownResponse = Safe200ResponseType<paths['/api/prompts/validate-markdown']['post']>
export type CreatePromptsValidateMarkdownRequest = SafeRequestType<paths['/api/prompts/validate-markdown']['post']>
export type GetKeysResponse = Safe200ResponseType<paths['/api/keys']['get']>
export type CreateKeysResponse = Safe201ResponseType<paths['/api/keys']['post']>
export type CreateKeysRequest = SafeRequestType<paths['/api/keys']['post']>
export type ListKeysByKeyIdResponse = Safe200ResponseType<paths['/api/keys/{keyId}']['get']>
export type UpdateKeysByKeyIdResponse = Safe200ResponseType<paths['/api/keys/{keyId}']['patch']>
export type UpdateKeysByKeyIdRequest = SafeRequestType<paths['/api/keys/{keyId}']['patch']>
export type DeleteKeysByKeyIdResponse = Safe200ResponseType<paths['/api/keys/{keyId}']['delete']>
export type CreateKeysValidateCustomResponse = Safe200ResponseType<paths['/api/keys/validate-custom']['post']>
export type CreateKeysValidateCustomRequest = SafeRequestType<paths['/api/keys/validate-custom']['post']>
export type CreateProvidersTestResponse = Safe200ResponseType<paths['/api/providers/test']['post']>
export type CreateProvidersTestRequest = SafeRequestType<paths['/api/providers/test']['post']>
export type CreateProvidersBatchTestResponse = Safe200ResponseType<paths['/api/providers/batch-test']['post']>
export type CreateProvidersBatchTestRequest = SafeRequestType<paths['/api/providers/batch-test']['post']>
export type ListProvidersHealthResponse = Safe200ResponseType<paths['/api/providers/health']['get']>
export type UpdateProvidersSettingsResponse = Safe200ResponseType<paths['/api/providers/settings']['put']>
export type UpdateProvidersSettingsRequest = SafeRequestType<paths['/api/providers/settings']['put']>
export type CreateTicketsResponse = Safe201ResponseType<paths['/api/tickets']['post']>
export type CreateTicketsRequest = SafeRequestType<paths['/api/tickets']['post']>
export type ListTicketsByTicketIdResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}']['get']>
export type UpdateTicketsByTicketIdResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}']['patch']>
export type UpdateTicketsByTicketIdRequest = SafeRequestType<paths['/api/tickets/{ticketId}']['patch']>
export type DeleteTicketsByTicketIdResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}']['delete']>
export type CreateTicketsByTicketIdCompleteResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/complete']['post']>
export type CreateTicketsByTicketIdLinkFilesResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/link-files']['post']>
export type CreateTicketsByTicketIdLinkFilesRequest = SafeRequestType<paths['/api/tickets/{ticketId}/link-files']['post']>
export type CreateTicketsByTicketIdSuggestFilesResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/suggest-files']['post']>
export type CreateTicketsByTicketIdSuggestFilesRequest = SafeRequestType<paths['/api/tickets/{ticketId}/suggest-files']['post']>
export type CreateTicketsByTicketIdSuggestTasksResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/suggest-tasks']['post']>
export type CreateTicketsByTicketIdSuggestTasksRequest = SafeRequestType<paths['/api/tickets/{ticketId}/suggest-tasks']['post']>
export type ListTicketsByTicketIdTasksResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/tasks']['get']>
export type CreateTicketsByTicketIdTasksResponse = Safe201ResponseType<paths['/api/tickets/{ticketId}/tasks']['post']>
export type CreateTicketsByTicketIdTasksRequest = SafeRequestType<paths['/api/tickets/{ticketId}/tasks']['post']>
export type UpdateTicketsByTicketIdTasksByTaskIdResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/tasks/{taskId}']['patch']>
export type UpdateTicketsByTicketIdTasksByTaskIdRequest = SafeRequestType<paths['/api/tickets/{ticketId}/tasks/{taskId}']['patch']>
export type DeleteTicketsByTicketIdTasksByTaskIdResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/tasks/{taskId}']['delete']>
export type UpdateTicketsByTicketIdTasksReorderResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/tasks/reorder']['patch']>
export type UpdateTicketsByTicketIdTasksReorderRequest = SafeRequestType<paths['/api/tickets/{ticketId}/tasks/reorder']['patch']>
export type CreateTicketsByTicketIdAutoGenerateTasksResponse = Safe200ResponseType<paths['/api/tickets/{ticketId}/auto-generate-tasks']['post']>
export type ListTicketsBulkTasksResponse = Safe200ResponseType<paths['/api/tickets/bulk-tasks']['get']>
export type ListProjectsByProjectIdFlowResponse = Safe200ResponseType<paths['/api/projects/{projectId}/flow']['get']>
export type ListProjectsByProjectIdFlowItemsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/flow/items']['get']>
export type ListProjectsByProjectIdFlowUnqueuedResponse = Safe200ResponseType<paths['/api/projects/{projectId}/flow/unqueued']['get']>
export type CreateFlowTicketsByTicketIdEnqueueResponse = Safe200ResponseType<paths['/api/flow/tickets/{ticketId}/enqueue']['post']>
export type CreateFlowTicketsByTicketIdEnqueueRequest = SafeRequestType<paths['/api/flow/tickets/{ticketId}/enqueue']['post']>
export type CreateFlowTasksByTaskIdEnqueueResponse = Safe200ResponseType<paths['/api/flow/tasks/{taskId}/enqueue']['post']>
export type CreateFlowTasksByTaskIdEnqueueRequest = SafeRequestType<paths['/api/flow/tasks/{taskId}/enqueue']['post']>
export type CreateFlowTicketsByTicketIdDequeueResponse = Safe200ResponseType<paths['/api/flow/tickets/{ticketId}/dequeue']['post']>
export type CreateFlowTasksByTaskIdDequeueResponse = Safe200ResponseType<paths['/api/flow/tasks/{taskId}/dequeue']['post']>
export type CreateFlowMoveResponse = Safe200ResponseType<paths['/api/flow/move']['post']>
export type CreateFlowMoveRequest = SafeRequestType<paths['/api/flow/move']['post']>
export type CreateFlowReorderResponse = Safe200ResponseType<paths['/api/flow/reorder']['post']>
export type CreateFlowReorderRequest = SafeRequestType<paths['/api/flow/reorder']['post']>
export type CreateFlowProcessStartResponse = Safe200ResponseType<paths['/api/flow/process/start']['post']>
export type CreateFlowProcessStartRequest = SafeRequestType<paths['/api/flow/process/start']['post']>
export type CreateFlowProcessCompleteResponse = Safe200ResponseType<paths['/api/flow/process/complete']['post']>
export type CreateFlowProcessCompleteRequest = SafeRequestType<paths['/api/flow/process/complete']['post']>
export type CreateFlowProcessFailResponse = Safe200ResponseType<paths['/api/flow/process/fail']['post']>
export type CreateFlowProcessFailRequest = SafeRequestType<paths['/api/flow/process/fail']['post']>
export type CreateFlowBulkMoveResponse = Safe200ResponseType<paths['/api/flow/bulk-move']['post']>
export type CreateFlowBulkMoveRequest = SafeRequestType<paths['/api/flow/bulk-move']['post']>
export type CreateGenAiStreamResponse = { success: boolean; message?: string }
export type CreateGenAiStreamRequest = SafeRequestType<paths['/api/gen-ai/stream']['post']>
export type CreateGenAiTextResponse = Safe200ResponseType<paths['/api/gen-ai/text']['post']>
export type CreateGenAiTextRequest = SafeRequestType<paths['/api/gen-ai/text']['post']>
export type CreateGenAiStructuredResponse = Safe200ResponseType<paths['/api/gen-ai/structured']['post']>
export type CreateGenAiStructuredRequest = SafeRequestType<paths['/api/gen-ai/structured']['post']>
export type CreateBrowseDirectoryResponse = Safe200ResponseType<paths['/api/browse-directory']['post']>
export type CreateBrowseDirectoryRequest = SafeRequestType<paths['/api/browse-directory']['post']>
export type ListMcpServersResponse = Safe200ResponseType<paths['/api/mcp/servers']['get']>
export type CreateMcpServersResponse = Safe200ResponseType<paths['/api/mcp/servers']['post']>
export type CreateMcpServersRequest = SafeRequestType<paths['/api/mcp/servers']['post']>
export type ListMcpServersByServerIdResponse = Safe200ResponseType<paths['/api/mcp/servers/{serverId}']['get']>
export type UpdateMcpServersByServerIdResponse = Safe200ResponseType<paths['/api/mcp/servers/{serverId}']['patch']>
export type UpdateMcpServersByServerIdRequest = SafeRequestType<paths['/api/mcp/servers/{serverId}']['patch']>
export type DeleteMcpServersByServerIdResponse = Safe200ResponseType<paths['/api/mcp/servers/{serverId}']['delete']>
export type ListMcpToolsResponse = Safe200ResponseType<paths['/api/mcp/tools']['get']>
export type CreateMcpToolsExecuteResponse = Safe200ResponseType<paths['/api/mcp/tools/execute']['post']>
export type CreateMcpToolsExecuteRequest = SafeRequestType<paths['/api/mcp/tools/execute']['post']>
export type ListMcpResourcesResponse = Safe200ResponseType<paths['/api/mcp/resources']['get']>
export type CreateMcpResourcesReadResponse = Safe200ResponseType<paths['/api/mcp/resources/read']['post']>
export type CreateMcpResourcesReadRequest = SafeRequestType<paths['/api/mcp/resources/read']['post']>
export type ListMcpBuiltinToolsResponse = Safe200ResponseType<paths['/api/mcp/builtin-tools']['get']>
export type CreateMcpServersByServerIdStartResponse = Safe200ResponseType<paths['/api/mcp/servers/{serverId}/start']['post']>
export type CreateMcpServersByServerIdStopResponse = Safe200ResponseType<paths['/api/mcp/servers/{serverId}/stop']['post']>
export type ListMcpAnalyticsResponse = Safe200ResponseType<paths['/api/mcp/analytics']['get']>
export type ListMcpServersByServerIdStatsResponse = Safe200ResponseType<paths['/api/mcp/servers/{serverId}/stats']['get']>
export type ListMcpToolsStatsResponse = Safe200ResponseType<paths['/api/mcp/tools/stats']['get']>
export type ListMcpResourcesStatsResponse = Safe200ResponseType<paths['/api/mcp/resources/stats']['get']>
export type CreateMcpAnalyticsReportResponse = Safe200ResponseType<paths['/api/mcp/analytics/report']['post']>
export type CreateMcpAnalyticsReportRequest = SafeRequestType<paths['/api/mcp/analytics/report']['post']>
export type ListMcpSessionsStatsResponse = Safe200ResponseType<paths['/api/mcp/sessions/stats']['get']>
export type ListMcpAnalyticsPerformanceResponse = Safe200ResponseType<paths['/api/mcp/analytics/performance']['get']>
export type ListProjectsByProjectIdMcpAnalyticsOverviewResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/analytics/overview']['get']>
export type ListProjectsByProjectIdMcpAnalyticsStatisticsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/analytics/statistics']['get']>
export type ListProjectsByProjectIdMcpAnalyticsTimelineResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/analytics/timeline']['get']>
export type ListProjectsByProjectIdMcpAnalyticsErrorPatternsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/analytics/error-patterns']['get']>
export type ListProjectsByProjectIdMcpAnalyticsExecutionsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/analytics/executions']['get']>
export type CreateMcpTestConnectionResponse = Safe200ResponseType<paths['/api/mcp/test/connection']['post']>
export type CreateMcpTestConnectionRequest = SafeRequestType<paths['/api/mcp/test/connection']['post']>
export type CreateMcpTestInitializeResponse = Safe200ResponseType<paths['/api/mcp/test/initialize']['post']>
export type CreateMcpTestInitializeRequest = SafeRequestType<paths['/api/mcp/test/initialize']['post']>
export type CreateMcpTestToolResponse = Safe200ResponseType<paths['/api/mcp/test/tool']['post']>
export type CreateMcpTestToolRequest = SafeRequestType<paths['/api/mcp/test/tool']['post']>
export type CreateMcpTestValidateConfigResponse = Safe200ResponseType<paths['/api/mcp/test/validate-config']['post']>
export type CreateMcpTestValidateConfigRequest = SafeRequestType<paths['/api/mcp/test/validate-config']['post']>
export type CreateMcpTestDebugResponse = Safe200ResponseType<paths['/api/mcp/test/debug']['post']>
export type CreateMcpTestDebugRequest = SafeRequestType<paths['/api/mcp/test/debug']['post']>
export type ListMcpSessionsResponse = Safe200ResponseType<paths['/api/mcp/sessions']['get']>
export type CreateMcpSessionsResponse = Safe200ResponseType<paths['/api/mcp/sessions']['post']>
export type CreateMcpSessionsRequest = SafeRequestType<paths['/api/mcp/sessions']['post']>
export type ListMcpSessionsBySessionIdResponse = Safe200ResponseType<paths['/api/mcp/sessions/{sessionId}']['get']>
export type CreateMcpSessionsBySessionIdCloseResponse = Safe200ResponseType<paths['/api/mcp/sessions/{sessionId}/close']['post']>
export type CreateMcpSessionsBySessionIdCloseRequest = SafeRequestType<paths['/api/mcp/sessions/{sessionId}/close']['post']>
export type CreateMcpSessionsBySessionIdRefreshResponse = Safe200ResponseType<paths['/api/mcp/sessions/{sessionId}/refresh']['post']>
export type ListMcpSessionsBySessionIdHistoryResponse = Safe200ResponseType<paths['/api/mcp/sessions/{sessionId}/history']['get']>
export type CreateMcpSessionsCleanupResponse = Safe200ResponseType<paths['/api/mcp/sessions/cleanup']['post']>
export type CreateMcpSessionsCleanupRequest = SafeRequestType<paths['/api/mcp/sessions/cleanup']['post']>
export type ListProjectsByProjectIdGitStatusResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/status']['get']>
export type CreateProjectsByProjectIdGitStageResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/stage']['post']>
export type CreateProjectsByProjectIdGitStageRequest = SafeRequestType<paths['/api/projects/{projectId}/git/stage']['post']>
export type CreateProjectsByProjectIdGitUnstageResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/unstage']['post']>
export type CreateProjectsByProjectIdGitUnstageRequest = SafeRequestType<paths['/api/projects/{projectId}/git/unstage']['post']>
export type CreateProjectsByProjectIdGitStageAllResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/stage-all']['post']>
export type CreateProjectsByProjectIdGitUnstageAllResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/unstage-all']['post']>
export type CreateProjectsByProjectIdGitCommitResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/commit']['post']>
export type CreateProjectsByProjectIdGitCommitRequest = SafeRequestType<paths['/api/projects/{projectId}/git/commit']['post']>
export type ListProjectsByProjectIdGitLogResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/log']['get']>
export type ListProjectsByProjectIdGitLogEnhancedResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/log-enhanced']['get']>
export type ListProjectsByProjectIdGitCommitsByCommitHashResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/commits/{commitHash}']['get']>
export type ListProjectsByProjectIdGitDiffResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/diff']['get']>
export type ListProjectsByProjectIdGitBranchesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/branches']['get']>
export type CreateProjectsByProjectIdGitBranchesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/branches']['post']>
export type CreateProjectsByProjectIdGitBranchesRequest = SafeRequestType<paths['/api/projects/{projectId}/git/branches']['post']>
export type ListProjectsByProjectIdGitBranchesEnhancedResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/branches-enhanced']['get']>
export type CreateProjectsByProjectIdGitBranchesSwitchResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/branches/switch']['post']>
export type CreateProjectsByProjectIdGitBranchesSwitchRequest = SafeRequestType<paths['/api/projects/{projectId}/git/branches/switch']['post']>
export type DeleteProjectsByProjectIdGitBranchesByBranchNameResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/branches/{branchName}']['delete']>
export type ListProjectsByProjectIdGitStashResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/stash']['get']>
export type CreateProjectsByProjectIdGitStashResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/stash']['post']>
export type CreateProjectsByProjectIdGitStashRequest = SafeRequestType<paths['/api/projects/{projectId}/git/stash']['post']>
export type DeleteProjectsByProjectIdGitStashResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/stash']['delete']>
export type DeleteProjectsByProjectIdGitStashRequest = SafeRequestType<paths['/api/projects/{projectId}/git/stash']['delete']>
export type CreateProjectsByProjectIdGitStashApplyResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/stash/apply']['post']>
export type CreateProjectsByProjectIdGitStashApplyRequest = SafeRequestType<paths['/api/projects/{projectId}/git/stash/apply']['post']>
export type CreateProjectsByProjectIdGitStashPopResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/stash/pop']['post']>
export type CreateProjectsByProjectIdGitStashPopRequest = SafeRequestType<paths['/api/projects/{projectId}/git/stash/pop']['post']>
export type ListProjectsByProjectIdGitWorktreesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/worktrees']['get']>
export type CreateProjectsByProjectIdGitWorktreesResponse = Safe201ResponseType<paths['/api/projects/{projectId}/git/worktrees']['post']>
export type CreateProjectsByProjectIdGitWorktreesRequest = SafeRequestType<paths['/api/projects/{projectId}/git/worktrees']['post']>
export type DeleteProjectsByProjectIdGitWorktreesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/worktrees']['delete']>
export type DeleteProjectsByProjectIdGitWorktreesRequest = SafeRequestType<paths['/api/projects/{projectId}/git/worktrees']['delete']>
export type CreateProjectsByProjectIdGitWorktreesLockResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/worktrees/lock']['post']>
export type CreateProjectsByProjectIdGitWorktreesLockRequest = SafeRequestType<paths['/api/projects/{projectId}/git/worktrees/lock']['post']>
export type CreateProjectsByProjectIdGitWorktreesUnlockResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/worktrees/unlock']['post']>
export type CreateProjectsByProjectIdGitWorktreesUnlockRequest = SafeRequestType<paths['/api/projects/{projectId}/git/worktrees/unlock']['post']>
export type CreateProjectsByProjectIdGitWorktreesPruneResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/worktrees/prune']['post']>
export type ListProjectsByProjectIdGitRemotesResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/remotes']['get']>
export type CreateProjectsByProjectIdGitPushResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/push']['post']>
export type CreateProjectsByProjectIdGitPushRequest = SafeRequestType<paths['/api/projects/{projectId}/git/push']['post']>
export type CreateProjectsByProjectIdGitFetchResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/fetch']['post']>
export type CreateProjectsByProjectIdGitFetchRequest = SafeRequestType<paths['/api/projects/{projectId}/git/fetch']['post']>
export type CreateProjectsByProjectIdGitPullResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/pull']['post']>
export type CreateProjectsByProjectIdGitPullRequest = SafeRequestType<paths['/api/projects/{projectId}/git/pull']['post']>
export type ListProjectsByProjectIdGitTagsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/tags']['get']>
export type CreateProjectsByProjectIdGitTagsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/tags']['post']>
export type CreateProjectsByProjectIdGitTagsRequest = SafeRequestType<paths['/api/projects/{projectId}/git/tags']['post']>
export type CreateProjectsByProjectIdGitResetResponse = Safe200ResponseType<paths['/api/projects/{projectId}/git/reset']['post']>
export type CreateProjectsByProjectIdGitResetRequest = SafeRequestType<paths['/api/projects/{projectId}/git/reset']['post']>
export type ListProjectsByProjectIdActiveTabResponse = Safe200ResponseType<paths['/api/projects/{projectId}/active-tab']['get']>
export type CreateProjectsByProjectIdActiveTabResponse = Safe200ResponseType<paths['/api/projects/{projectId}/active-tab']['post']>
export type CreateProjectsByProjectIdActiveTabRequest = SafeRequestType<paths['/api/projects/{projectId}/active-tab']['post']>
export type DeleteProjectsByProjectIdActiveTabResponse = Safe200ResponseType<paths['/api/projects/{projectId}/active-tab']['delete']>
export type ListProjectsByProjectIdMcpConfigResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/config']['get']>
export type CreateProjectsByProjectIdMcpConfigResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/config']['post']>
export type CreateProjectsByProjectIdMcpConfigRequest = SafeRequestType<paths['/api/projects/{projectId}/mcp/config']['post']>
export type ListProjectsByProjectIdMcpConfigLocationsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/config/locations']['get']>
export type ListProjectsByProjectIdMcpConfigMergedResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/config/merged']['get']>
export type ListProjectsByProjectIdMcpConfigExpandedResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/config/expanded']['get']>
export type CreateProjectsByProjectIdMcpConfigSaveToLocationResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/config/save-to-location']['post']>
export type CreateProjectsByProjectIdMcpConfigSaveToLocationRequest = SafeRequestType<paths['/api/projects/{projectId}/mcp/config/save-to-location']['post']>
export type ListProjectsByProjectIdMcpConfigDefaultForLocationResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/config/default-for-location']['get']>
export type CreateProjectTabsByTabIdGenerateNameResponse = Safe200ResponseType<paths['/api/project-tabs/{tabId}/generate-name']['post']>
export type CreateProjectTabsByTabIdGenerateNameRequest = SafeRequestType<paths['/api/project-tabs/{tabId}/generate-name']['post']>
export type ListProjectsByProjectIdAgentFilesDetectResponse = Safe200ResponseType<paths['/api/projects/{projectId}/agent-files/detect']['get']>
export type CreateProjectsByProjectIdAgentFilesUpdateResponse = Safe200ResponseType<paths['/api/projects/{projectId}/agent-files/update']['post']>
export type CreateProjectsByProjectIdAgentFilesUpdateRequest = SafeRequestType<paths['/api/projects/{projectId}/agent-files/update']['post']>
export type CreateProjectsByProjectIdAgentFilesRemoveInstructionsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/agent-files/remove-instructions']['post']>
export type CreateProjectsByProjectIdAgentFilesRemoveInstructionsRequest = SafeRequestType<paths['/api/projects/{projectId}/agent-files/remove-instructions']['post']>
export type ListProjectsByProjectIdAgentFilesStatusResponse = Safe200ResponseType<paths['/api/projects/{projectId}/agent-files/status']['get']>
export type CreateProjectsByProjectIdAgentFilesCreateResponse = Safe200ResponseType<paths['/api/projects/{projectId}/agent-files/create']['post']>
export type CreateProjectsByProjectIdAgentFilesCreateRequest = SafeRequestType<paths['/api/projects/{projectId}/agent-files/create']['post']>
export type GetAgentsResponse = Safe200ResponseType<paths['/api/agents']['get']>
export type CreateAgentsResponse = Safe201ResponseType<paths['/api/agents']['post']>
export type CreateAgentsRequest = SafeRequestType<paths['/api/agents']['post']>
export type ListAgentsByAgentIdResponse = Safe200ResponseType<paths['/api/agents/{agentId}']['get']>
export type UpdateAgentsByAgentIdResponse = Safe200ResponseType<paths['/api/agents/{agentId}']['patch']>
export type UpdateAgentsByAgentIdRequest = SafeRequestType<paths['/api/agents/{agentId}']['patch']>
export type DeleteAgentsByAgentIdResponse = Safe200ResponseType<paths['/api/agents/{agentId}']['delete']>
export type ListProjectsByProjectIdCommandsResponse = Safe200ResponseType<paths['/api/projects/{projectId}/commands']['get']>
export type CreateProjectsByProjectIdCommandsResponse = Safe201ResponseType<paths['/api/projects/{projectId}/commands']['post']>
export type CreateProjectsByProjectIdCommandsRequest = SafeRequestType<paths['/api/projects/{projectId}/commands']['post']>
export type ListProjectsByProjectIdCommandsByCommandNameResponse = Safe200ResponseType<paths['/api/projects/{projectId}/commands/{commandName}']['get']>
export type UpdateProjectsByProjectIdCommandsByCommandNameResponse = Safe200ResponseType<paths['/api/projects/{projectId}/commands/{commandName}']['put']>
export type UpdateProjectsByProjectIdCommandsByCommandNameRequest = SafeRequestType<paths['/api/projects/{projectId}/commands/{commandName}']['put']>
export type DeleteProjectsByProjectIdCommandsByCommandNameResponse = Safe200ResponseType<paths['/api/projects/{projectId}/commands/{commandName}']['delete']>
export type CreateProjectsByProjectIdCommandsByCommandNameExecuteResponse = Safe200ResponseType<paths['/api/projects/{projectId}/commands/{commandName}/execute']['post']>
export type CreateProjectsByProjectIdCommandsByCommandNameExecuteRequest = SafeRequestType<paths['/api/projects/{projectId}/commands/{commandName}/execute']['post']>
export type CreateProjectsByProjectIdCommandsGenerateResponse = Safe200ResponseType<paths['/api/projects/{projectId}/commands/generate']['post']>
export type CreateProjectsByProjectIdCommandsGenerateRequest = SafeRequestType<paths['/api/projects/{projectId}/commands/generate']['post']>
export type CreateProjectsByProjectIdCommandsSuggestResponse = Safe200ResponseType<paths['/api/projects/{projectId}/commands/suggest']['post']>
export type CreateProjectsByProjectIdCommandsSuggestRequest = SafeRequestType<paths['/api/projects/{projectId}/commands/suggest']['post']>
export type ListClaudeCodeMcpStatusByProjectIdResponse = Safe200ResponseType<paths['/api/claude-code/mcp-status/{projectId}']['get']>
export type ListClaudeCodeSessionsByProjectIdMetadataResponse = Safe200ResponseType<paths['/api/claude-code/sessions/{projectId}/metadata']['get']>
export type ListClaudeCodeSessionsByProjectIdRecentResponse = Safe200ResponseType<paths['/api/claude-code/sessions/{projectId}/recent']['get']>
export type ListClaudeCodeSessionsByProjectIdPaginatedResponse = Safe200ResponseType<paths['/api/claude-code/sessions/{projectId}/paginated']['get']>
export type ListClaudeCodeSessionsByProjectIdBySessionIdFullResponse = Safe200ResponseType<paths['/api/claude-code/sessions/{projectId}/{sessionId}/full']['get']>
export type ListClaudeCodeSessionsByProjectIdBySessionIdResponse = Safe200ResponseType<paths['/api/claude-code/sessions/{projectId}/{sessionId}']['get']>
export type ListClaudeCodeSessionsByProjectIdResponse = Safe200ResponseType<paths['/api/claude-code/sessions/{projectId}']['get']>
export type ListClaudeCodeProjectDataByProjectIdResponse = Safe200ResponseType<paths['/api/claude-code/project-data/{projectId}']['get']>
export type CreateClaudeCodeImportSessionByProjectIdBySessionIdResponse = Safe200ResponseType<paths['/api/claude-code/import-session/{projectId}/{sessionId}']['post']>
export type ListClaudeHooksByProjectPathResponse = Safe200ResponseType<paths['/api/claude-hooks/{projectPath}']['get']>
export type CreateClaudeHooksByProjectPathResponse = Safe201ResponseType<paths['/api/claude-hooks/{projectPath}']['post']>
export type CreateClaudeHooksByProjectPathRequest = SafeRequestType<paths['/api/claude-hooks/{projectPath}']['post']>
export type ListClaudeHooksByProjectPathByEventNameByMatcherIndexResponse = Safe200ResponseType<paths['/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}']['get']>
export type UpdateClaudeHooksByProjectPathByEventNameByMatcherIndexResponse = Safe200ResponseType<paths['/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}']['put']>
export type UpdateClaudeHooksByProjectPathByEventNameByMatcherIndexRequest = SafeRequestType<paths['/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}']['put']>
export type DeleteClaudeHooksByProjectPathByEventNameByMatcherIndexResponse = Safe200ResponseType<paths['/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}']['delete']>
export type CreateClaudeHooksByProjectPathGenerateResponse = Safe200ResponseType<paths['/api/claude-hooks/{projectPath}/generate']['post']>
export type CreateClaudeHooksByProjectPathGenerateRequest = SafeRequestType<paths['/api/claude-hooks/{projectPath}/generate']['post']>
export type CreateClaudeHooksByProjectPathTestResponse = Safe200ResponseType<paths['/api/claude-hooks/{projectPath}/test']['post']>
export type CreateClaudeHooksByProjectPathTestRequest = SafeRequestType<paths['/api/claude-hooks/{projectPath}/test']['post']>
export type ListClaudeHooksByProjectPathSearchResponse = Safe200ResponseType<paths['/api/claude-hooks/{projectPath}/search']['get']>
export type ListMcpInstallationDetectResponse = Safe200ResponseType<paths['/api/mcp/installation/detect']['get']>
export type ListProjectsByProjectIdMcpInstallationStatusResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/installation/status']['get']>
export type CreateProjectsByProjectIdMcpInstallationInstallResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/installation/install']['post']>
export type CreateProjectsByProjectIdMcpInstallationInstallRequest = SafeRequestType<paths['/api/projects/{projectId}/mcp/installation/install']['post']>
export type CreateProjectsByProjectIdMcpInstallationUninstallResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/installation/uninstall']['post']>
export type CreateProjectsByProjectIdMcpInstallationUninstallRequest = SafeRequestType<paths['/api/projects/{projectId}/mcp/installation/uninstall']['post']>
export type ListMcpStatusResponse = Safe200ResponseType<paths['/api/mcp/status']['get']>
export type CreateProjectsByProjectIdMcpInstallationBatchInstallResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/installation/batch-install']['post']>
export type CreateProjectsByProjectIdMcpInstallationBatchInstallRequest = SafeRequestType<paths['/api/projects/{projectId}/mcp/installation/batch-install']['post']>
export type CreateProjectsByProjectIdMcpInstallProjectConfigResponse = Safe200ResponseType<paths['/api/projects/{projectId}/mcp/install-project-config']['post']>
export type CreateProjectsByProjectIdMcpInstallProjectConfigRequest = SafeRequestType<paths['/api/projects/{projectId}/mcp/install-project-config']['post']>
export type ListMcpGlobalConfigResponse = Safe200ResponseType<paths['/api/mcp/global/config']['get']>
export type CreateMcpGlobalConfigResponse = Safe200ResponseType<paths['/api/mcp/global/config']['post']>
export type CreateMcpGlobalConfigRequest = SafeRequestType<paths['/api/mcp/global/config']['post']>
export type ListMcpGlobalInstallationsResponse = Safe200ResponseType<paths['/api/mcp/global/installations']['get']>
export type CreateMcpGlobalInstallResponse = Safe200ResponseType<paths['/api/mcp/global/install']['post']>
export type CreateMcpGlobalInstallRequest = SafeRequestType<paths['/api/mcp/global/install']['post']>
export type CreateMcpGlobalUninstallResponse = Safe200ResponseType<paths['/api/mcp/global/uninstall']['post']>
export type CreateMcpGlobalUninstallRequest = SafeRequestType<paths['/api/mcp/global/uninstall']['post']>
export type ListMcpGlobalStatusResponse = Safe200ResponseType<paths['/api/mcp/global/status']['get']>


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
 * - Support for all 208 API endpoints
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
   * Internal request handler with proper error handling
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
      const response = await fetch(url.toString(), {
        method,
        headers: this.headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
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
      return responseText ? JSON.parse(responseText) : ({} as T)
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

  // ===== GENERATED API METHODS =====

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
  async createChats(data: CreateChatsRequest, options?: { timeout?: number }): Promise<CreateChatsResponse> {
    return this.request<CreateChatsResponse>('POST', `/api/chats`, { body: data, timeout: options?.timeout })
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
  async updateChatsByChatId(chatId: string | number, data: UpdateChatsByChatIdRequest, options?: { timeout?: number }): Promise<UpdateChatsByChatIdResponse> {
    return this.request<UpdateChatsByChatIdResponse>('PATCH', this.buildPath(`/api/chats/{chatId}`, { chatId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a chat session and its messages
   */
  async deleteChatsByChatId(chatId: string | number, options?: { timeout?: number }): Promise<DeleteChatsByChatIdResponse> {
    return this.request<DeleteChatsByChatIdResponse>('DELETE', this.buildPath(`/api/chats/{chatId}`, { chatId }), { timeout: options?.timeout })
  }


  // AI Operations
  /**
   * Chat completion (streaming, chat-associated)
   */
  async createAiChat(data: CreateAiChatRequest, options?: { timeout?: number }): Promise<CreateAiChatResponse> {
    return this.request<CreateAiChatResponse>('POST', `/api/ai/chat`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get all available providers including custom ones
   */
  async getProviders(options?: { timeout?: number }): Promise<GetProvidersResponse> {
    return this.request<GetProvidersResponse>('GET', `/api/providers`, { timeout: options?.timeout })
  }

  /**
   * List available AI models for a provider
   */
  async getModels(query?: { provider?: any }, options?: { timeout?: number }): Promise<GetModelsResponse> {
    return this.request<GetModelsResponse>('GET', `/api/models`, { params: query, timeout: options?.timeout })
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
  async createProviderSettings(data: CreateProviderSettingsRequest, options?: { timeout?: number }): Promise<CreateProviderSettingsResponse> {
    return this.request<CreateProviderSettingsResponse>('POST', `/api/provider-settings`, { body: data, timeout: options?.timeout })
  }


  // Messages Operations
  /**
   * Delete a specific message
   */
  async deleteChatsByChatIdMessagesByMessageId(chatId: string | number, messageId: string | number, options?: { timeout?: number }): Promise<DeleteChatsByChatIdMessagesByMessageIdResponse> {
    return this.request<DeleteChatsByChatIdMessagesByMessageIdResponse>('DELETE', this.buildPath(`/api/chats/{chatId}/messages/{messageId}`, { chatId, messageId }), { timeout: options?.timeout })
  }


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
  async createProjects(data: CreateProjectsRequest, options?: { timeout?: number }): Promise<CreateProjectsResponse> {
    return this.request<CreateProjectsResponse>('POST', `/api/projects`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a specific project by ID
   */
  async listProjectsByProjectId(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdResponse> {
    return this.request<ListProjectsByProjectIdResponse>('GET', this.buildPath(`/api/projects/{projectId}`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Update a project's details
   */
  async updateProjectsByProjectId(projectId: string | number, data: UpdateProjectsByProjectIdRequest, options?: { timeout?: number }): Promise<UpdateProjectsByProjectIdResponse> {
    return this.request<UpdateProjectsByProjectIdResponse>('PATCH', this.buildPath(`/api/projects/{projectId}`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a project and its associated data
   */
  async deleteProjectsByProjectId(projectId: string | number, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdResponse> {
    return this.request<DeleteProjectsByProjectIdResponse>('DELETE', this.buildPath(`/api/projects/{projectId}`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Manually trigger a full file sync for a project
   */
  async createProjectsByProjectIdSync(projectId: string | number, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdSyncResponse> {
    return this.request<CreateProjectsByProjectIdSyncResponse>('POST', this.buildPath(`/api/projects/{projectId}/sync`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Trigger a file sync with real-time progress updates via SSE
   */
  async listProjectsByProjectIdSyncStream(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdSyncStreamResponse> {
    return this.request<ListProjectsByProjectIdSyncStreamResponse>('GET', this.buildPath(`/api/projects/{projectId}/sync-stream`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Get the list of files associated with a project
   */
  async listProjectsByProjectIdFiles(projectId: string | number, query?: { includeAllVersions?: any; limit?: any; offset?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdFilesResponse> {
    return this.request<ListProjectsByProjectIdFilesResponse>('GET', this.buildPath(`/api/projects/{projectId}/files`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get project files metadata without content (for performance)
   */
  async listProjectsByProjectIdFilesMetadata(projectId: string | number, query?: { limit?: any; offset?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdFilesMetadataResponse> {
    return this.request<ListProjectsByProjectIdFilesMetadataResponse>('GET', this.buildPath(`/api/projects/{projectId}/files/metadata`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Update content of multiple files in a project (creates new versions)
   */
  async updateProjectsByProjectIdFilesBulk(projectId: string | number, data: UpdateProjectsByProjectIdFilesBulkRequest, options?: { timeout?: number }): Promise<UpdateProjectsByProjectIdFilesBulkResponse> {
    return this.request<UpdateProjectsByProjectIdFilesBulkResponse>('PUT', this.buildPath(`/api/projects/{projectId}/files/bulk`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Update the content of a specific file (creates new version)
   */
  async updateProjectsByProjectIdFilesByFileId(projectId: string | number, fileId: string | number, data: UpdateProjectsByProjectIdFilesByFileIdRequest, options?: { timeout?: number }): Promise<UpdateProjectsByProjectIdFilesByFileIdResponse> {
    return this.request<UpdateProjectsByProjectIdFilesByFileIdResponse>('PUT', this.buildPath(`/api/projects/{projectId}/files/{fileId}`, { projectId, fileId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Refresh project files (sync) optionally limited to a folder
   */
  async createProjectsByProjectIdRefresh(projectId: string | number, query?: { folder?: any }, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdRefreshResponse> {
    return this.request<CreateProjectsByProjectIdRefreshResponse>('POST', this.buildPath(`/api/projects/{projectId}/refresh`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get a combined summary of all files in the project
   */
  async listProjectsByProjectIdSummary(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdSummaryResponse> {
    return this.request<ListProjectsByProjectIdSummaryResponse>('GET', this.buildPath(`/api/projects/{projectId}/summary`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Get an advanced project summary with customizable options
   */
  async createProjectsByProjectIdSummaryAdvanced(projectId: string | number, data: CreateProjectsByProjectIdSummaryAdvancedRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdSummaryAdvancedResponse> {
    return this.request<CreateProjectsByProjectIdSummaryAdvancedResponse>('POST', this.buildPath(`/api/projects/{projectId}/summary/advanced`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get metrics about project summary generation
   */
  async listProjectsByProjectIdSummaryMetrics(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdSummaryMetricsResponse> {
    return this.request<ListProjectsByProjectIdSummaryMetricsResponse>('GET', this.buildPath(`/api/projects/{projectId}/summary/metrics`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Invalidate the project summary cache
   */
  async createProjectsByProjectIdSummaryInvalidate(projectId: string | number, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdSummaryInvalidateResponse> {
    return this.request<CreateProjectsByProjectIdSummaryInvalidateResponse>('POST', this.buildPath(`/api/projects/{projectId}/summary/invalidate`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Suggest relevant files based on user input and project context
   */
  async createProjectsByProjectIdSuggestFiles(projectId: string | number, data: CreateProjectsByProjectIdSuggestFilesRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdSuggestFilesResponse> {
    return this.request<CreateProjectsByProjectIdSuggestFilesResponse>('POST', this.buildPath(`/api/projects/{projectId}/suggest-files`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Summarize specified files in a project
   */
  async createProjectsByProjectIdFilesSummarize(projectId: string | number, data: CreateProjectsByProjectIdFilesSummarizeRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdFilesSummarizeResponse> {
    return this.request<CreateProjectsByProjectIdFilesSummarizeResponse>('POST', this.buildPath(`/api/projects/{projectId}/files/summarize`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Remove summaries from specified files
   */
  async createProjectsByProjectIdFilesRemoveSummaries(projectId: string | number, data: CreateProjectsByProjectIdFilesRemoveSummariesRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdFilesRemoveSummariesResponse> {
    return this.request<CreateProjectsByProjectIdFilesRemoveSummariesResponse>('POST', this.buildPath(`/api/projects/{projectId}/files/remove-summaries`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get comprehensive statistics for a project
   */
  async listProjectsByProjectIdStatistics(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdStatisticsResponse> {
    return this.request<ListProjectsByProjectIdStatisticsResponse>('GET', this.buildPath(`/api/projects/{projectId}/statistics`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Start batch summarization of unsummarized files
   */
  async createProjectsByProjectIdBatchSummarize(projectId: string | number, data: CreateProjectsByProjectIdBatchSummarizeRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdBatchSummarizeResponse> {
    return this.request<CreateProjectsByProjectIdBatchSummarizeResponse>('POST', this.buildPath(`/api/projects/{projectId}/batch-summarize`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get progress of a batch summarization operation
   */
  async listProjectsByProjectIdBatchSummarizeByBatchId(projectId: string | number, batchId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdBatchSummarizeByBatchIdResponse> {
    return this.request<ListProjectsByProjectIdBatchSummarizeByBatchIdResponse>('GET', this.buildPath(`/api/projects/{projectId}/batch-summarize/{batchId}`, { projectId, batchId }), { timeout: options?.timeout })
  }

  /**
   * Cancel a running batch summarization
   */
  async deleteProjectsByProjectIdBatchSummarizeByBatchId(projectId: string | number, batchId: string | number, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdBatchSummarizeByBatchIdResponse> {
    return this.request<DeleteProjectsByProjectIdBatchSummarizeByBatchIdResponse>('DELETE', this.buildPath(`/api/projects/{projectId}/batch-summarize/{batchId}`, { projectId, batchId }), { timeout: options?.timeout })
  }

  /**
   * Get file summarization statistics for a project
   */
  async listProjectsByProjectIdSummarizationStats(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdSummarizationStatsResponse> {
    return this.request<ListProjectsByProjectIdSummarizationStatsResponse>('GET', this.buildPath(`/api/projects/{projectId}/summarization-stats`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Preview how files would be grouped for summarization
   */
  async createProjectsByProjectIdPreviewFileGroups(projectId: string | number, data: CreateProjectsByProjectIdPreviewFileGroupsRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdPreviewFileGroupsResponse> {
    return this.request<CreateProjectsByProjectIdPreviewFileGroupsResponse>('POST', this.buildPath(`/api/projects/{projectId}/preview-file-groups`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * List prompts associated with a specific project
   */
  async listProjectsByProjectIdPrompts(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdPromptsResponse> {
    return this.request<ListProjectsByProjectIdPromptsResponse>('GET', this.buildPath(`/api/projects/{projectId}/prompts`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Get AI-suggested prompts based on user input
   */
  async createProjectsByProjectIdSuggestPrompts(projectId: string | number, data: CreateProjectsByProjectIdSuggestPromptsRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdSuggestPromptsResponse> {
    return this.request<CreateProjectsByProjectIdSuggestPromptsResponse>('POST', this.buildPath(`/api/projects/{projectId}/suggest-prompts`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Associate a prompt with a project
   */
  async createProjectsByProjectIdPromptsByPromptId(projectId: string | number, promptId: string | number, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdPromptsByPromptIdResponse> {
    return this.request<CreateProjectsByProjectIdPromptsByPromptIdResponse>('POST', this.buildPath(`/api/projects/{projectId}/prompts/{promptId}`, { projectId, promptId }), { timeout: options?.timeout })
  }

  /**
   * Disassociate a prompt from a project
   */
  async deleteProjectsByProjectIdPromptsByPromptId(projectId: string | number, promptId: string | number, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdPromptsByPromptIdResponse> {
    return this.request<DeleteProjectsByProjectIdPromptsByPromptIdResponse>('DELETE', this.buildPath(`/api/projects/{projectId}/prompts/{promptId}`, { projectId, promptId }), { timeout: options?.timeout })
  }

  /**
   * Export all prompts from a project
   */
  async listProjectsByProjectIdPromptsExport(projectId: string | number, query?: { format?: any; sortBy?: any; sortOrder?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdPromptsExportResponse> {
    return this.request<ListProjectsByProjectIdPromptsExportResponse>('GET', this.buildPath(`/api/projects/{projectId}/prompts/export`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * List all tickets for a project
   */
  async listProjectsByProjectIdTickets(projectId: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdTicketsResponse> {
    return this.request<ListProjectsByProjectIdTicketsResponse>('GET', this.buildPath(`/api/projects/{projectId}/tickets`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * List tickets with task counts
   */
  async listProjectsByProjectIdTicketsWithCount(projectId: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdTicketsWithCountResponse> {
    return this.request<ListProjectsByProjectIdTicketsWithCountResponse>('GET', this.buildPath(`/api/projects/{projectId}/tickets-with-count`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * List tickets with their tasks
   */
  async listProjectsByProjectIdTicketsWithTasks(projectId: string | number, query?: { status?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdTicketsWithTasksResponse> {
    return this.request<ListProjectsByProjectIdTicketsWithTasksResponse>('GET', this.buildPath(`/api/projects/{projectId}/tickets-with-tasks`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * List Claude agents associated with a specific project
   */
  async listProjectsByProjectIdAgents(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdAgentsResponse> {
    return this.request<ListProjectsByProjectIdAgentsResponse>('GET', this.buildPath(`/api/projects/{projectId}/agents`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Get AI-suggested Claude agents based on user input
   */
  async createProjectsByProjectIdSuggestAgents(projectId: string | number, data: CreateProjectsByProjectIdSuggestAgentsRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdSuggestAgentsResponse> {
    return this.request<CreateProjectsByProjectIdSuggestAgentsResponse>('POST', this.buildPath(`/api/projects/{projectId}/suggest-agents`, { projectId }), { body: data, timeout: options?.timeout })
  }


  // Prompts Operations
  /**
   * Optimize a user-provided prompt using an AI model
   */
  async createPromptOptimize(data: CreatePromptOptimizeRequest, options?: { timeout?: number }): Promise<CreatePromptOptimizeResponse> {
    return this.request<CreatePromptOptimizeResponse>('POST', `/api/prompt/optimize`, { body: data, timeout: options?.timeout })
  }

  /**
   * List all available prompts
   */
  async getPrompts(options?: { timeout?: number }): Promise<GetPromptsResponse> {
    return this.request<GetPromptsResponse>('GET', `/api/prompts`, { timeout: options?.timeout })
  }

  /**
   * Create a new prompt
   */
  async createPrompts(data: CreatePromptsRequest, options?: { timeout?: number }): Promise<CreatePromptsResponse> {
    return this.request<CreatePromptsResponse>('POST', `/api/prompts`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a specific prompt by its ID
   */
  async listPromptsByPromptId(promptId: string | number, options?: { timeout?: number }): Promise<ListPromptsByPromptIdResponse> {
    return this.request<ListPromptsByPromptIdResponse>('GET', this.buildPath(`/api/prompts/{promptId}`, { promptId }), { timeout: options?.timeout })
  }

  /**
   * Update a prompt's details
   */
  async updatePromptsByPromptId(promptId: string | number, data: UpdatePromptsByPromptIdRequest, options?: { timeout?: number }): Promise<UpdatePromptsByPromptIdResponse> {
    return this.request<UpdatePromptsByPromptIdResponse>('PATCH', this.buildPath(`/api/prompts/{promptId}`, { promptId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a prompt
   */
  async deletePromptsByPromptId(promptId: string | number, options?: { timeout?: number }): Promise<DeletePromptsByPromptIdResponse> {
    return this.request<DeletePromptsByPromptIdResponse>('DELETE', this.buildPath(`/api/prompts/{promptId}`, { promptId }), { timeout: options?.timeout })
  }

  /**
   * Export a single prompt as markdown
   */
  async listPromptsByPromptIdExport(promptId: string | number, options?: { timeout?: number }): Promise<ListPromptsByPromptIdExportResponse> {
    return this.request<ListPromptsByPromptIdExportResponse>('GET', this.buildPath(`/api/prompts/{promptId}/export`, { promptId }), { timeout: options?.timeout })
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
  async createKeys(data: CreateKeysRequest, options?: { timeout?: number }): Promise<CreateKeysResponse> {
    return this.request<CreateKeysResponse>('POST', `/api/keys`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a specific provider key by ID (including secret)
   */
  async listKeysByKeyId(keyId: string | number, options?: { timeout?: number }): Promise<ListKeysByKeyIdResponse> {
    return this.request<ListKeysByKeyIdResponse>('GET', this.buildPath(`/api/keys/{keyId}`, { keyId }), { timeout: options?.timeout })
  }

  /**
   * Update a provider key's details
   */
  async updateKeysByKeyId(keyId: string | number, data: UpdateKeysByKeyIdRequest, options?: { timeout?: number }): Promise<UpdateKeysByKeyIdResponse> {
    return this.request<UpdateKeysByKeyIdResponse>('PATCH', this.buildPath(`/api/keys/{keyId}`, { keyId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a provider key
   */
  async deleteKeysByKeyId(keyId: string | number, options?: { timeout?: number }): Promise<DeleteKeysByKeyIdResponse> {
    return this.request<DeleteKeysByKeyIdResponse>('DELETE', this.buildPath(`/api/keys/{keyId}`, { keyId }), { timeout: options?.timeout })
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


  // Tickets Operations
  /**
   * Create a new ticket
   */
  async createTickets(data: CreateTicketsRequest, options?: { timeout?: number }): Promise<CreateTicketsResponse> {
    return this.request<CreateTicketsResponse>('POST', `/api/tickets`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get a ticket by ID
   */
  async listTicketsByTicketId(ticketId: string | number, options?: { timeout?: number }): Promise<ListTicketsByTicketIdResponse> {
    return this.request<ListTicketsByTicketIdResponse>('GET', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), { timeout: options?.timeout })
  }

  /**
   * Update a ticket
   */
  async updateTicketsByTicketId(ticketId: string | number, data: UpdateTicketsByTicketIdRequest, options?: { timeout?: number }): Promise<UpdateTicketsByTicketIdResponse> {
    return this.request<UpdateTicketsByTicketIdResponse>('PATCH', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a ticket
   */
  async deleteTicketsByTicketId(ticketId: string | number, options?: { timeout?: number }): Promise<DeleteTicketsByTicketIdResponse> {
    return this.request<DeleteTicketsByTicketIdResponse>('DELETE', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), { timeout: options?.timeout })
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


  // Flow Operations
  /**
   * Get complete flow data for a project
   */
  async listProjectsByProjectIdFlow(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdFlowResponse> {
    return this.request<ListProjectsByProjectIdFlowResponse>('GET', this.buildPath(`/api/projects/{projectId}/flow`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Get all flow items as a flat list
   */
  async listProjectsByProjectIdFlowItems(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdFlowItemsResponse> {
    return this.request<ListProjectsByProjectIdFlowItemsResponse>('GET', this.buildPath(`/api/projects/{projectId}/flow/items`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Get all unqueued tickets and tasks
   */
  async listProjectsByProjectIdFlowUnqueued(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdFlowUnqueuedResponse> {
    return this.request<ListProjectsByProjectIdFlowUnqueuedResponse>('GET', this.buildPath(`/api/projects/{projectId}/flow/unqueued`, { projectId }), { timeout: options?.timeout })
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


  // System Operations
  /**
   * Browse directories on the file system
   */
  async createBrowseDirectory(data: CreateBrowseDirectoryRequest, options?: { timeout?: number }): Promise<CreateBrowseDirectoryResponse> {
    return this.request<CreateBrowseDirectoryResponse>('POST', `/api/browse-directory`, { body: data, timeout: options?.timeout })
  }


  // MCP Operations
  /**
   * List all MCP server configurations
   */
  async listMcpServers(options?: { timeout?: number }): Promise<ListMcpServersResponse> {
    return this.request<ListMcpServersResponse>('GET', `/api/mcp/servers`, { timeout: options?.timeout })
  }

  /**
   * Create MCP server configuration
   */
  async createMcpServers(data: CreateMcpServersRequest, options?: { timeout?: number }): Promise<CreateMcpServersResponse> {
    return this.request<CreateMcpServersResponse>('POST', `/api/mcp/servers`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get MCP server configuration by ID
   */
  async listMcpServersByServerId(serverId: string | number, options?: { timeout?: number }): Promise<ListMcpServersByServerIdResponse> {
    return this.request<ListMcpServersByServerIdResponse>('GET', this.buildPath(`/api/mcp/servers/{serverId}`, { serverId }), { timeout: options?.timeout })
  }

  /**
   * Update MCP server configuration
   */
  async updateMcpServersByServerId(serverId: string | number, data: UpdateMcpServersByServerIdRequest, options?: { timeout?: number }): Promise<UpdateMcpServersByServerIdResponse> {
    return this.request<UpdateMcpServersByServerIdResponse>('PATCH', this.buildPath(`/api/mcp/servers/{serverId}`, { serverId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete MCP server configuration
   */
  async deleteMcpServersByServerId(serverId: string | number, options?: { timeout?: number }): Promise<DeleteMcpServersByServerIdResponse> {
    return this.request<DeleteMcpServersByServerIdResponse>('DELETE', this.buildPath(`/api/mcp/servers/{serverId}`, { serverId }), { timeout: options?.timeout })
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
   * Get list of built-in MCP tools
   */
  async listMcpBuiltinTools(options?: { timeout?: number }): Promise<ListMcpBuiltinToolsResponse> {
    return this.request<ListMcpBuiltinToolsResponse>('GET', `/api/mcp/builtin-tools`, { timeout: options?.timeout })
  }

  /**
   * Start an MCP server
   */
  async createMcpServersByServerIdStart(serverId: string | number, options?: { timeout?: number }): Promise<CreateMcpServersByServerIdStartResponse> {
    return this.request<CreateMcpServersByServerIdStartResponse>('POST', this.buildPath(`/api/mcp/servers/{serverId}/start`, { serverId }), { timeout: options?.timeout })
  }

  /**
   * Stop an MCP server
   */
  async createMcpServersByServerIdStop(serverId: string | number, options?: { timeout?: number }): Promise<CreateMcpServersByServerIdStopResponse> {
    return this.request<CreateMcpServersByServerIdStopResponse>('POST', this.buildPath(`/api/mcp/servers/{serverId}/stop`, { serverId }), { timeout: options?.timeout })
  }

  /**
   * Get MCP usage analytics
   */
  async listMcpAnalytics(query?: { startDate?: any; endDate?: any; serverId?: any }, options?: { timeout?: number }): Promise<ListMcpAnalyticsResponse> {
    return this.request<ListMcpAnalyticsResponse>('GET', `/api/mcp/analytics`, { params: query, timeout: options?.timeout })
  }

  /**
   * Get statistics for a specific MCP server
   */
  async listMcpServersByServerIdStats(serverId: string | number, options?: { timeout?: number }): Promise<ListMcpServersByServerIdStatsResponse> {
    return this.request<ListMcpServersByServerIdStatsResponse>('GET', this.buildPath(`/api/mcp/servers/{serverId}/stats`, { serverId }), { timeout: options?.timeout })
  }

  /**
   * Get tool usage statistics
   */
  async listMcpToolsStats(query?: { period?: any; limit?: any }, options?: { timeout?: number }): Promise<ListMcpToolsStatsResponse> {
    return this.request<ListMcpToolsStatsResponse>('GET', `/api/mcp/tools/stats`, { params: query, timeout: options?.timeout })
  }

  /**
   * Get resource access statistics
   */
  async listMcpResourcesStats(query?: { period?: any }, options?: { timeout?: number }): Promise<ListMcpResourcesStatsResponse> {
    return this.request<ListMcpResourcesStatsResponse>('GET', `/api/mcp/resources/stats`, { params: query, timeout: options?.timeout })
  }

  /**
   * Generate MCP usage report
   */
  async createMcpAnalyticsReport(data: CreateMcpAnalyticsReportRequest, options?: { timeout?: number }): Promise<CreateMcpAnalyticsReportResponse> {
    return this.request<CreateMcpAnalyticsReportResponse>('POST', `/api/mcp/analytics/report`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get MCP session statistics
   */
  async listMcpSessionsStats(options?: { timeout?: number }): Promise<ListMcpSessionsStatsResponse> {
    return this.request<ListMcpSessionsStatsResponse>('GET', `/api/mcp/sessions/stats`, { timeout: options?.timeout })
  }

  /**
   * Get MCP performance metrics
   */
  async listMcpAnalyticsPerformance(query?: { metricType?: any; aggregation?: any }, options?: { timeout?: number }): Promise<ListMcpAnalyticsPerformanceResponse> {
    return this.request<ListMcpAnalyticsPerformanceResponse>('GET', `/api/mcp/analytics/performance`, { params: query, timeout: options?.timeout })
  }

  /**
   * Get MCP analytics overview for a project
   */
  async listProjectsByProjectIdMcpAnalyticsOverview(projectId: string | number, query?: { period?: any; toolNames?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpAnalyticsOverviewResponse> {
    return this.request<ListProjectsByProjectIdMcpAnalyticsOverviewResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/analytics/overview`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get MCP tool statistics for a project
   */
  async listProjectsByProjectIdMcpAnalyticsStatistics(projectId: string | number, query?: { period?: any; toolNames?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpAnalyticsStatisticsResponse> {
    return this.request<ListProjectsByProjectIdMcpAnalyticsStatisticsResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/analytics/statistics`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get MCP execution timeline for a project
   */
  async listProjectsByProjectIdMcpAnalyticsTimeline(projectId: string | number, query?: { period?: any; toolNames?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpAnalyticsTimelineResponse> {
    return this.request<ListProjectsByProjectIdMcpAnalyticsTimelineResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/analytics/timeline`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get MCP error patterns for a project
   */
  async listProjectsByProjectIdMcpAnalyticsErrorPatterns(projectId: string | number, query?: { period?: any; toolNames?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpAnalyticsErrorPatternsResponse> {
    return this.request<ListProjectsByProjectIdMcpAnalyticsErrorPatternsResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/analytics/error-patterns`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get MCP tool executions for a project
   */
  async listProjectsByProjectIdMcpAnalyticsExecutions(projectId: string | number, query?: { toolName?: any; status?: any; startDate?: any; endDate?: any; limit?: any; offset?: any; sortBy?: any; sortOrder?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpAnalyticsExecutionsResponse> {
    return this.request<ListProjectsByProjectIdMcpAnalyticsExecutionsResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/analytics/executions`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Test MCP server connection
   */
  async createMcpTestConnection(data: CreateMcpTestConnectionRequest, options?: { timeout?: number }): Promise<CreateMcpTestConnectionResponse> {
    return this.request<CreateMcpTestConnectionResponse>('POST', `/api/mcp/test/connection`, { body: data, timeout: options?.timeout })
  }

  /**
   * Test MCP initialize handshake
   */
  async createMcpTestInitialize(data: CreateMcpTestInitializeRequest, options?: { timeout?: number }): Promise<CreateMcpTestInitializeResponse> {
    return this.request<CreateMcpTestInitializeResponse>('POST', `/api/mcp/test/initialize`, { body: data, timeout: options?.timeout })
  }

  /**
   * Test MCP tool execution
   */
  async createMcpTestTool(data: CreateMcpTestToolRequest, options?: { timeout?: number }): Promise<CreateMcpTestToolResponse> {
    return this.request<CreateMcpTestToolResponse>('POST', `/api/mcp/test/tool`, { body: data, timeout: options?.timeout })
  }

  /**
   * Validate MCP server configuration
   */
  async createMcpTestValidateConfig(data: CreateMcpTestValidateConfigRequest, options?: { timeout?: number }): Promise<CreateMcpTestValidateConfigResponse> {
    return this.request<CreateMcpTestValidateConfigResponse>('POST', `/api/mcp/test/validate-config`, { body: data, timeout: options?.timeout })
  }

  /**
   * Debug MCP communication
   */
  async createMcpTestDebug(data: CreateMcpTestDebugRequest, options?: { timeout?: number }): Promise<CreateMcpTestDebugResponse> {
    return this.request<CreateMcpTestDebugResponse>('POST', `/api/mcp/test/debug`, { body: data, timeout: options?.timeout })
  }

  /**
   * List all MCP sessions
   */
  async listMcpSessions(query?: { status?: any; serverId?: any }, options?: { timeout?: number }): Promise<ListMcpSessionsResponse> {
    return this.request<ListMcpSessionsResponse>('GET', `/api/mcp/sessions`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create a new MCP session
   */
  async createMcpSessions(data: CreateMcpSessionsRequest, options?: { timeout?: number }): Promise<CreateMcpSessionsResponse> {
    return this.request<CreateMcpSessionsResponse>('POST', `/api/mcp/sessions`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get MCP session by ID
   */
  async listMcpSessionsBySessionId(sessionId: string | number, options?: { timeout?: number }): Promise<ListMcpSessionsBySessionIdResponse> {
    return this.request<ListMcpSessionsBySessionIdResponse>('GET', this.buildPath(`/api/mcp/sessions/{sessionId}`, { sessionId }), { timeout: options?.timeout })
  }

  /**
   * Close an MCP session
   */
  async createMcpSessionsBySessionIdClose(sessionId: string | number, data: CreateMcpSessionsBySessionIdCloseRequest, options?: { timeout?: number }): Promise<CreateMcpSessionsBySessionIdCloseResponse> {
    return this.request<CreateMcpSessionsBySessionIdCloseResponse>('POST', this.buildPath(`/api/mcp/sessions/{sessionId}/close`, { sessionId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Refresh/keep-alive an MCP session
   */
  async createMcpSessionsBySessionIdRefresh(sessionId: string | number, options?: { timeout?: number }): Promise<CreateMcpSessionsBySessionIdRefreshResponse> {
    return this.request<CreateMcpSessionsBySessionIdRefreshResponse>('POST', this.buildPath(`/api/mcp/sessions/{sessionId}/refresh`, { sessionId }), { timeout: options?.timeout })
  }

  /**
   * Get session command history
   */
  async listMcpSessionsBySessionIdHistory(sessionId: string | number, query?: { limit?: any; offset?: any }, options?: { timeout?: number }): Promise<ListMcpSessionsBySessionIdHistoryResponse> {
    return this.request<ListMcpSessionsBySessionIdHistoryResponse>('GET', this.buildPath(`/api/mcp/sessions/{sessionId}/history`, { sessionId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Cleanup idle MCP sessions
   */
  async createMcpSessionsCleanup(data: CreateMcpSessionsCleanupRequest, options?: { timeout?: number }): Promise<CreateMcpSessionsCleanupResponse> {
    return this.request<CreateMcpSessionsCleanupResponse>('POST', `/api/mcp/sessions/cleanup`, { body: data, timeout: options?.timeout })
  }


  // Git Operations
  /**
   * Get git status for a project
   */
  async listProjectsByProjectIdGitStatus(projectId: string | number, query?: { refresh?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitStatusResponse> {
    return this.request<ListProjectsByProjectIdGitStatusResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/status`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Stage files for commit
   */
  async createProjectsByProjectIdGitStage(projectId: string | number, data: CreateProjectsByProjectIdGitStageRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitStageResponse> {
    return this.request<CreateProjectsByProjectIdGitStageResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/stage`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Unstage files from commit
   */
  async createProjectsByProjectIdGitUnstage(projectId: string | number, data: CreateProjectsByProjectIdGitUnstageRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitUnstageResponse> {
    return this.request<CreateProjectsByProjectIdGitUnstageResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/unstage`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Stage all changes
   */
  async createProjectsByProjectIdGitStageAll(projectId: string | number, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitStageAllResponse> {
    return this.request<CreateProjectsByProjectIdGitStageAllResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/stage-all`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Unstage all changes
   */
  async createProjectsByProjectIdGitUnstageAll(projectId: string | number, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitUnstageAllResponse> {
    return this.request<CreateProjectsByProjectIdGitUnstageAllResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/unstage-all`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Create a new commit
   */
  async createProjectsByProjectIdGitCommit(projectId: string | number, data: CreateProjectsByProjectIdGitCommitRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitCommitResponse> {
    return this.request<CreateProjectsByProjectIdGitCommitResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/commit`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get commit history
   */
  async listProjectsByProjectIdGitLog(projectId: string | number, query?: { maxCount?: any; skip?: any; author?: any; since?: any; until?: any; grep?: any; branch?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitLogResponse> {
    return this.request<ListProjectsByProjectIdGitLogResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/log`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get enhanced commit history
   */
  async listProjectsByProjectIdGitLogEnhanced(projectId: string | number, query?: { maxCount?: any; skip?: any; author?: any; since?: any; until?: any; grep?: any; branch?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitLogEnhancedResponse> {
    return this.request<ListProjectsByProjectIdGitLogEnhancedResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/log-enhanced`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get commit details
   */
  async listProjectsByProjectIdGitCommitsByCommitHash(projectId: string | number, commitHash: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitCommitsByCommitHashResponse> {
    return this.request<ListProjectsByProjectIdGitCommitsByCommitHashResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/commits/{commitHash}`, { projectId, commitHash }), { timeout: options?.timeout })
  }

  /**
   * Get file diff
   */
  async listProjectsByProjectIdGitDiff(projectId: string | number, query?: { filePath?: any; cached?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitDiffResponse> {
    return this.request<ListProjectsByProjectIdGitDiffResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/diff`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * List all branches
   */
  async listProjectsByProjectIdGitBranches(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitBranchesResponse> {
    return this.request<ListProjectsByProjectIdGitBranchesResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/branches`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Create a new branch
   */
  async createProjectsByProjectIdGitBranches(projectId: string | number, data: CreateProjectsByProjectIdGitBranchesRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitBranchesResponse> {
    return this.request<CreateProjectsByProjectIdGitBranchesResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/branches`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * List branches with enhanced information
   */
  async listProjectsByProjectIdGitBranchesEnhanced(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitBranchesEnhancedResponse> {
    return this.request<ListProjectsByProjectIdGitBranchesEnhancedResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/branches-enhanced`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Switch to a different branch
   */
  async createProjectsByProjectIdGitBranchesSwitch(projectId: string | number, data: CreateProjectsByProjectIdGitBranchesSwitchRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitBranchesSwitchResponse> {
    return this.request<CreateProjectsByProjectIdGitBranchesSwitchResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/branches/switch`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete a branch
   */
  async deleteProjectsByProjectIdGitBranchesByBranchName(projectId: string | number, branchName: string | number, query?: { force?: any }, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdGitBranchesByBranchNameResponse> {
    return this.request<DeleteProjectsByProjectIdGitBranchesByBranchNameResponse>('DELETE', this.buildPath(`/api/projects/{projectId}/git/branches/{branchName}`, { projectId, branchName }), { params: query, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/git/stash
   */
  async listProjectsByProjectIdGitStash(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitStashResponse> {
    return this.request<ListProjectsByProjectIdGitStashResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/stash`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/git/stash
   */
  async createProjectsByProjectIdGitStash(projectId: string | number, data: CreateProjectsByProjectIdGitStashRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitStashResponse> {
    return this.request<CreateProjectsByProjectIdGitStashResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/stash`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Drop a stash
   */
  async deleteProjectsByProjectIdGitStash(projectId: string | number, data: DeleteProjectsByProjectIdGitStashRequest, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdGitStashResponse> {
    return this.request<DeleteProjectsByProjectIdGitStashResponse>('DELETE', this.buildPath(`/api/projects/{projectId}/git/stash`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/git/stash/apply
   */
  async createProjectsByProjectIdGitStashApply(projectId: string | number, data: CreateProjectsByProjectIdGitStashApplyRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitStashApplyResponse> {
    return this.request<CreateProjectsByProjectIdGitStashApplyResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/stash/apply`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Pop a stash
   */
  async createProjectsByProjectIdGitStashPop(projectId: string | number, data: CreateProjectsByProjectIdGitStashPopRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitStashPopResponse> {
    return this.request<CreateProjectsByProjectIdGitStashPopResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/stash/pop`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * List all worktrees
   */
  async listProjectsByProjectIdGitWorktrees(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitWorktreesResponse> {
    return this.request<ListProjectsByProjectIdGitWorktreesResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/worktrees`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Add a new worktree
   */
  async createProjectsByProjectIdGitWorktrees(projectId: string | number, data: CreateProjectsByProjectIdGitWorktreesRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitWorktreesResponse> {
    return this.request<CreateProjectsByProjectIdGitWorktreesResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/worktrees`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Remove a worktree
   */
  async deleteProjectsByProjectIdGitWorktrees(projectId: string | number, data: DeleteProjectsByProjectIdGitWorktreesRequest, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdGitWorktreesResponse> {
    return this.request<DeleteProjectsByProjectIdGitWorktreesResponse>('DELETE', this.buildPath(`/api/projects/{projectId}/git/worktrees`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Lock a worktree
   */
  async createProjectsByProjectIdGitWorktreesLock(projectId: string | number, data: CreateProjectsByProjectIdGitWorktreesLockRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitWorktreesLockResponse> {
    return this.request<CreateProjectsByProjectIdGitWorktreesLockResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/worktrees/lock`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Unlock a worktree
   */
  async createProjectsByProjectIdGitWorktreesUnlock(projectId: string | number, data: CreateProjectsByProjectIdGitWorktreesUnlockRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitWorktreesUnlockResponse> {
    return this.request<CreateProjectsByProjectIdGitWorktreesUnlockResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/worktrees/unlock`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Prune worktrees
   */
  async createProjectsByProjectIdGitWorktreesPrune(projectId: string | number, query?: { dryRun?: any }, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitWorktreesPruneResponse> {
    return this.request<CreateProjectsByProjectIdGitWorktreesPruneResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/worktrees/prune`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/git/remotes
   */
  async listProjectsByProjectIdGitRemotes(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitRemotesResponse> {
    return this.request<ListProjectsByProjectIdGitRemotesResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/remotes`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/git/push
   */
  async createProjectsByProjectIdGitPush(projectId: string | number, data: CreateProjectsByProjectIdGitPushRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitPushResponse> {
    return this.request<CreateProjectsByProjectIdGitPushResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/push`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/git/fetch
   */
  async createProjectsByProjectIdGitFetch(projectId: string | number, data: CreateProjectsByProjectIdGitFetchRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitFetchResponse> {
    return this.request<CreateProjectsByProjectIdGitFetchResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/fetch`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/git/pull
   */
  async createProjectsByProjectIdGitPull(projectId: string | number, data: CreateProjectsByProjectIdGitPullRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitPullResponse> {
    return this.request<CreateProjectsByProjectIdGitPullResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/pull`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/git/tags
   */
  async listProjectsByProjectIdGitTags(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdGitTagsResponse> {
    return this.request<ListProjectsByProjectIdGitTagsResponse>('GET', this.buildPath(`/api/projects/{projectId}/git/tags`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/git/tags
   */
  async createProjectsByProjectIdGitTags(projectId: string | number, data: CreateProjectsByProjectIdGitTagsRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitTagsResponse> {
    return this.request<CreateProjectsByProjectIdGitTagsResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/tags`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/git/reset
   */
  async createProjectsByProjectIdGitReset(projectId: string | number, data: CreateProjectsByProjectIdGitResetRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdGitResetResponse> {
    return this.request<CreateProjectsByProjectIdGitResetResponse>('POST', this.buildPath(`/api/projects/{projectId}/git/reset`, { projectId }), { body: data, timeout: options?.timeout })
  }


  // Default Operations
  /**
   * GET /api/projects/{projectId}/active-tab
   */
  async listProjectsByProjectIdActiveTab(projectId: string | number, query?: { clientId?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdActiveTabResponse> {
    return this.request<ListProjectsByProjectIdActiveTabResponse>('GET', this.buildPath(`/api/projects/{projectId}/active-tab`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/active-tab
   */
  async createProjectsByProjectIdActiveTab(projectId: string | number, data: CreateProjectsByProjectIdActiveTabRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdActiveTabResponse> {
    return this.request<CreateProjectsByProjectIdActiveTabResponse>('POST', this.buildPath(`/api/projects/{projectId}/active-tab`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * DELETE /api/projects/{projectId}/active-tab
   */
  async deleteProjectsByProjectIdActiveTab(projectId: string | number, query?: { clientId?: any }, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdActiveTabResponse> {
    return this.request<DeleteProjectsByProjectIdActiveTabResponse>('DELETE', this.buildPath(`/api/projects/{projectId}/active-tab`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/mcp/config
   */
  async listProjectsByProjectIdMcpConfig(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpConfigResponse> {
    return this.request<ListProjectsByProjectIdMcpConfigResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/config`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/mcp/config
   */
  async createProjectsByProjectIdMcpConfig(projectId: string | number, data: CreateProjectsByProjectIdMcpConfigRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdMcpConfigResponse> {
    return this.request<CreateProjectsByProjectIdMcpConfigResponse>('POST', this.buildPath(`/api/projects/{projectId}/mcp/config`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/mcp/config/locations
   */
  async listProjectsByProjectIdMcpConfigLocations(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpConfigLocationsResponse> {
    return this.request<ListProjectsByProjectIdMcpConfigLocationsResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/config/locations`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/mcp/config/merged
   */
  async listProjectsByProjectIdMcpConfigMerged(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpConfigMergedResponse> {
    return this.request<ListProjectsByProjectIdMcpConfigMergedResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/config/merged`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/mcp/config/expanded
   */
  async listProjectsByProjectIdMcpConfigExpanded(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpConfigExpandedResponse> {
    return this.request<ListProjectsByProjectIdMcpConfigExpandedResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/config/expanded`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/mcp/config/save-to-location
   */
  async createProjectsByProjectIdMcpConfigSaveToLocation(projectId: string | number, data: CreateProjectsByProjectIdMcpConfigSaveToLocationRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdMcpConfigSaveToLocationResponse> {
    return this.request<CreateProjectsByProjectIdMcpConfigSaveToLocationResponse>('POST', this.buildPath(`/api/projects/{projectId}/mcp/config/save-to-location`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/mcp/config/default-for-location
   */
  async listProjectsByProjectIdMcpConfigDefaultForLocation(projectId: string | number, query?: { location?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpConfigDefaultForLocationResponse> {
    return this.request<ListProjectsByProjectIdMcpConfigDefaultForLocationResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/config/default-for-location`, { projectId }), { params: query, timeout: options?.timeout })
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
   * GET /api/projects/{projectId}/agent-files/detect
   */
  async listProjectsByProjectIdAgentFilesDetect(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdAgentFilesDetectResponse> {
    return this.request<ListProjectsByProjectIdAgentFilesDetectResponse>('GET', this.buildPath(`/api/projects/{projectId}/agent-files/detect`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/agent-files/update
   */
  async createProjectsByProjectIdAgentFilesUpdate(projectId: string | number, data: CreateProjectsByProjectIdAgentFilesUpdateRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdAgentFilesUpdateResponse> {
    return this.request<CreateProjectsByProjectIdAgentFilesUpdateResponse>('POST', this.buildPath(`/api/projects/{projectId}/agent-files/update`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/agent-files/remove-instructions
   */
  async createProjectsByProjectIdAgentFilesRemoveInstructions(projectId: string | number, data: CreateProjectsByProjectIdAgentFilesRemoveInstructionsRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdAgentFilesRemoveInstructionsResponse> {
    return this.request<CreateProjectsByProjectIdAgentFilesRemoveInstructionsResponse>('POST', this.buildPath(`/api/projects/{projectId}/agent-files/remove-instructions`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/agent-files/status
   */
  async listProjectsByProjectIdAgentFilesStatus(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdAgentFilesStatusResponse> {
    return this.request<ListProjectsByProjectIdAgentFilesStatusResponse>('GET', this.buildPath(`/api/projects/{projectId}/agent-files/status`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/agent-files/create
   */
  async createProjectsByProjectIdAgentFilesCreate(projectId: string | number, data: CreateProjectsByProjectIdAgentFilesCreateRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdAgentFilesCreateResponse> {
    return this.request<CreateProjectsByProjectIdAgentFilesCreateResponse>('POST', this.buildPath(`/api/projects/{projectId}/agent-files/create`, { projectId }), { body: data, timeout: options?.timeout })
  }


  // Claude Agents Operations
  /**
   * List all available Claude agents
   */
  async getAgents(query?: { projectId?: any }, options?: { timeout?: number }): Promise<GetAgentsResponse> {
    return this.request<GetAgentsResponse>('GET', `/api/agents`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create a new Claude agent
   */
  async createAgents(data: CreateAgentsRequest, query?: { projectId?: any }, options?: { timeout?: number }): Promise<CreateAgentsResponse> {
    return this.request<CreateAgentsResponse>('POST', `/api/agents`, { params: query, body: data, timeout: options?.timeout })
  }

  /**
   * Get a specific Claude agent by its ID
   */
  async listAgentsByAgentId(agentId: string | number, query?: { projectId?: any }, options?: { timeout?: number }): Promise<ListAgentsByAgentIdResponse> {
    return this.request<ListAgentsByAgentIdResponse>('GET', this.buildPath(`/api/agents/{agentId}`, { agentId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Update a Claude agent's details
   */
  async updateAgentsByAgentId(agentId: string | number, data: UpdateAgentsByAgentIdRequest, query?: { projectId?: any }, options?: { timeout?: number }): Promise<UpdateAgentsByAgentIdResponse> {
    return this.request<UpdateAgentsByAgentIdResponse>('PATCH', this.buildPath(`/api/agents/{agentId}`, { agentId }), { params: query, body: data, timeout: options?.timeout })
  }

  /**
   * Delete a Claude agent
   */
  async deleteAgentsByAgentId(agentId: string | number, query?: { projectId?: any }, options?: { timeout?: number }): Promise<DeleteAgentsByAgentIdResponse> {
    return this.request<DeleteAgentsByAgentIdResponse>('DELETE', this.buildPath(`/api/agents/{agentId}`, { agentId }), { params: query, timeout: options?.timeout })
  }


  // Claude Commands Operations
  /**
   * List Claude commands for a project
   */
  async listProjectsByProjectIdCommands(projectId: string | number, query?: { query?: any; scope?: any; namespace?: any; includeGlobal?: any; limit?: any; offset?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdCommandsResponse> {
    return this.request<ListProjectsByProjectIdCommandsResponse>('GET', this.buildPath(`/api/projects/{projectId}/commands`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Create a new Claude command
   */
  async createProjectsByProjectIdCommands(projectId: string | number, data: CreateProjectsByProjectIdCommandsRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdCommandsResponse> {
    return this.request<CreateProjectsByProjectIdCommandsResponse>('POST', this.buildPath(`/api/projects/{projectId}/commands`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get a specific Claude command
   */
  async listProjectsByProjectIdCommandsByCommandName(projectId: string | number, commandName: string | number, query?: { namespace?: any }, options?: { timeout?: number }): Promise<ListProjectsByProjectIdCommandsByCommandNameResponse> {
    return this.request<ListProjectsByProjectIdCommandsByCommandNameResponse>('GET', this.buildPath(`/api/projects/{projectId}/commands/{commandName}`, { projectId, commandName }), { params: query, timeout: options?.timeout })
  }

  /**
   * Update a Claude command
   */
  async updateProjectsByProjectIdCommandsByCommandName(projectId: string | number, commandName: string | number, data: UpdateProjectsByProjectIdCommandsByCommandNameRequest, query?: { namespace?: any }, options?: { timeout?: number }): Promise<UpdateProjectsByProjectIdCommandsByCommandNameResponse> {
    return this.request<UpdateProjectsByProjectIdCommandsByCommandNameResponse>('PUT', this.buildPath(`/api/projects/{projectId}/commands/{commandName}`, { projectId, commandName }), { params: query, body: data, timeout: options?.timeout })
  }

  /**
   * Delete a Claude command
   */
  async deleteProjectsByProjectIdCommandsByCommandName(projectId: string | number, commandName: string | number, query?: { namespace?: any }, options?: { timeout?: number }): Promise<DeleteProjectsByProjectIdCommandsByCommandNameResponse> {
    return this.request<DeleteProjectsByProjectIdCommandsByCommandNameResponse>('DELETE', this.buildPath(`/api/projects/{projectId}/commands/{commandName}`, { projectId, commandName }), { params: query, timeout: options?.timeout })
  }

  /**
   * Execute a Claude command
   */
  async createProjectsByProjectIdCommandsByCommandNameExecute(projectId: string | number, commandName: string | number, data: CreateProjectsByProjectIdCommandsByCommandNameExecuteRequest, query?: { namespace?: any }, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdCommandsByCommandNameExecuteResponse> {
    return this.request<CreateProjectsByProjectIdCommandsByCommandNameExecuteResponse>('POST', this.buildPath(`/api/projects/{projectId}/commands/{commandName}/execute`, { projectId, commandName }), { params: query, body: data, timeout: options?.timeout })
  }

  /**
   * Generate a new Claude command using AI
   */
  async createProjectsByProjectIdCommandsGenerate(projectId: string | number, data: CreateProjectsByProjectIdCommandsGenerateRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdCommandsGenerateResponse> {
    return this.request<CreateProjectsByProjectIdCommandsGenerateResponse>('POST', this.buildPath(`/api/projects/{projectId}/commands/generate`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get AI-powered command suggestions
   */
  async createProjectsByProjectIdCommandsSuggest(projectId: string | number, data: CreateProjectsByProjectIdCommandsSuggestRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdCommandsSuggestResponse> {
    return this.request<CreateProjectsByProjectIdCommandsSuggestResponse>('POST', this.buildPath(`/api/projects/{projectId}/commands/suggest`, { projectId }), { body: data, timeout: options?.timeout })
  }


  // Claude Code Operations
  /**
   * Get MCP installation status for Claude Code and Claude Desktop
   */
  async listClaudeCodeMcpStatusByProjectId(projectId: string | number, options?: { timeout?: number }): Promise<ListClaudeCodeMcpStatusByProjectIdResponse> {
    return this.request<ListClaudeCodeMcpStatusByProjectIdResponse>('GET', this.buildPath(`/api/claude-code/mcp-status/{projectId}`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Get lightweight session metadata for a project
   */
  async listClaudeCodeSessionsByProjectIdMetadata(projectId: string | number, query?: { search?: any; branch?: any; startDate?: any; endDate?: any }, options?: { timeout?: number }): Promise<ListClaudeCodeSessionsByProjectIdMetadataResponse> {
    return this.request<ListClaudeCodeSessionsByProjectIdMetadataResponse>('GET', this.buildPath(`/api/claude-code/sessions/{projectId}/metadata`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get recent Claude Code sessions
   */
  async listClaudeCodeSessionsByProjectIdRecent(projectId: string | number, query?: { limit?: any }, options?: { timeout?: number }): Promise<ListClaudeCodeSessionsByProjectIdRecentResponse> {
    return this.request<ListClaudeCodeSessionsByProjectIdRecentResponse>('GET', this.buildPath(`/api/claude-code/sessions/{projectId}/recent`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get sessions with cursor-based pagination
   */
  async listClaudeCodeSessionsByProjectIdPaginated(projectId: string | number, query?: { cursor?: any; limit?: any; sortBy?: any; sortOrder?: any; search?: any; branch?: any; startDate?: any; endDate?: any }, options?: { timeout?: number }): Promise<ListClaudeCodeSessionsByProjectIdPaginatedResponse> {
    return this.request<ListClaudeCodeSessionsByProjectIdPaginatedResponse>('GET', this.buildPath(`/api/claude-code/sessions/{projectId}/paginated`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get complete Claude Code session with full message data
   */
  async listClaudeCodeSessionsByProjectIdBySessionIdFull(projectId: string | number, sessionId: string | number, options?: { timeout?: number }): Promise<ListClaudeCodeSessionsByProjectIdBySessionIdFullResponse> {
    return this.request<ListClaudeCodeSessionsByProjectIdBySessionIdFullResponse>('GET', this.buildPath(`/api/claude-code/sessions/{projectId}/{sessionId}/full`, { projectId, sessionId }), { timeout: options?.timeout })
  }

  /**
   * Get messages for a specific Claude Code session
   */
  async listClaudeCodeSessionsByProjectIdBySessionId(projectId: string | number, sessionId: string | number, query?: { search?: any; role?: any; limit?: any; offset?: any }, options?: { timeout?: number }): Promise<ListClaudeCodeSessionsByProjectIdBySessionIdResponse> {
    return this.request<ListClaudeCodeSessionsByProjectIdBySessionIdResponse>('GET', this.buildPath(`/api/claude-code/sessions/{projectId}/{sessionId}`, { projectId, sessionId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get all Claude Code chat sessions for a project
   */
  async listClaudeCodeSessionsByProjectId(projectId: string | number, query?: { search?: any; branch?: any; startDate?: any; endDate?: any; limit?: any; offset?: any; useCursor?: any; cursor?: any; sortBy?: any; sortOrder?: any }, options?: { timeout?: number }): Promise<ListClaudeCodeSessionsByProjectIdResponse> {
    return this.request<ListClaudeCodeSessionsByProjectIdResponse>('GET', this.buildPath(`/api/claude-code/sessions/{projectId}`, { projectId }), { params: query, timeout: options?.timeout })
  }

  /**
   * Get Claude Code project metadata
   */
  async listClaudeCodeProjectDataByProjectId(projectId: string | number, options?: { timeout?: number }): Promise<ListClaudeCodeProjectDataByProjectIdResponse> {
    return this.request<ListClaudeCodeProjectDataByProjectIdResponse>('GET', this.buildPath(`/api/claude-code/project-data/{projectId}`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * Import a Claude Code session into a Promptliano chat
   */
  async createClaudeCodeImportSessionByProjectIdBySessionId(projectId: string | number, sessionId: string | number, options?: { timeout?: number }): Promise<CreateClaudeCodeImportSessionByProjectIdBySessionIdResponse> {
    return this.request<CreateClaudeCodeImportSessionByProjectIdBySessionIdResponse>('POST', this.buildPath(`/api/claude-code/import-session/{projectId}/{sessionId}`, { projectId, sessionId }), { timeout: options?.timeout })
  }


  // Claude Hooks Operations
  /**
   * List all hooks for a project
   */
  async listClaudeHooksByProjectPath(projectPath: string | number, options?: { timeout?: number }): Promise<ListClaudeHooksByProjectPathResponse> {
    return this.request<ListClaudeHooksByProjectPathResponse>('GET', this.buildPath(`/api/claude-hooks/{projectPath}`, { projectPath }), { timeout: options?.timeout })
  }

  /**
   * Create new hook
   */
  async createClaudeHooksByProjectPath(projectPath: string | number, data: CreateClaudeHooksByProjectPathRequest, options?: { timeout?: number }): Promise<CreateClaudeHooksByProjectPathResponse> {
    return this.request<CreateClaudeHooksByProjectPathResponse>('POST', this.buildPath(`/api/claude-hooks/{projectPath}`, { projectPath }), { body: data, timeout: options?.timeout })
  }

  /**
   * Get specific hook configuration
   */
  async listClaudeHooksByProjectPathByEventNameByMatcherIndex(projectPath: string | number, eventName: string | number, matcherIndex: string | number, options?: { timeout?: number }): Promise<ListClaudeHooksByProjectPathByEventNameByMatcherIndexResponse> {
    return this.request<ListClaudeHooksByProjectPathByEventNameByMatcherIndexResponse>('GET', this.buildPath(`/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}`, { projectPath, eventName, matcherIndex }), { timeout: options?.timeout })
  }

  /**
   * Update hook configuration
   */
  async updateClaudeHooksByProjectPathByEventNameByMatcherIndex(projectPath: string | number, eventName: string | number, matcherIndex: string | number, data: UpdateClaudeHooksByProjectPathByEventNameByMatcherIndexRequest, options?: { timeout?: number }): Promise<UpdateClaudeHooksByProjectPathByEventNameByMatcherIndexResponse> {
    return this.request<UpdateClaudeHooksByProjectPathByEventNameByMatcherIndexResponse>('PUT', this.buildPath(`/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}`, { projectPath, eventName, matcherIndex }), { body: data, timeout: options?.timeout })
  }

  /**
   * Delete hook configuration
   */
  async deleteClaudeHooksByProjectPathByEventNameByMatcherIndex(projectPath: string | number, eventName: string | number, matcherIndex: string | number, options?: { timeout?: number }): Promise<DeleteClaudeHooksByProjectPathByEventNameByMatcherIndexResponse> {
    return this.request<DeleteClaudeHooksByProjectPathByEventNameByMatcherIndexResponse>('DELETE', this.buildPath(`/api/claude-hooks/{projectPath}/{eventName}/{matcherIndex}`, { projectPath, eventName, matcherIndex }), { timeout: options?.timeout })
  }

  /**
   * Generate hook from description
   */
  async createClaudeHooksByProjectPathGenerate(projectPath: string | number, data: CreateClaudeHooksByProjectPathGenerateRequest, options?: { timeout?: number }): Promise<CreateClaudeHooksByProjectPathGenerateResponse> {
    return this.request<CreateClaudeHooksByProjectPathGenerateResponse>('POST', this.buildPath(`/api/claude-hooks/{projectPath}/generate`, { projectPath }), { body: data, timeout: options?.timeout })
  }

  /**
   * Test hook (placeholder)
   */
  async createClaudeHooksByProjectPathTest(projectPath: string | number, data: CreateClaudeHooksByProjectPathTestRequest, options?: { timeout?: number }): Promise<CreateClaudeHooksByProjectPathTestResponse> {
    return this.request<CreateClaudeHooksByProjectPathTestResponse>('POST', this.buildPath(`/api/claude-hooks/{projectPath}/test`, { projectPath }), { body: data, timeout: options?.timeout })
  }

  /**
   * Search hooks
   */
  async listClaudeHooksByProjectPathSearch(projectPath: string | number, query?: { q?: any }, options?: { timeout?: number }): Promise<ListClaudeHooksByProjectPathSearchResponse> {
    return this.request<ListClaudeHooksByProjectPathSearchResponse>('GET', this.buildPath(`/api/claude-hooks/{projectPath}/search`, { projectPath }), { params: query, timeout: options?.timeout })
  }


  // MCP Installation Operations
  /**
   * GET /api/mcp/installation/detect
   */
  async listMcpInstallationDetect(options?: { timeout?: number }): Promise<ListMcpInstallationDetectResponse> {
    return this.request<ListMcpInstallationDetectResponse>('GET', `/api/mcp/installation/detect`, { timeout: options?.timeout })
  }

  /**
   * GET /api/projects/{projectId}/mcp/installation/status
   */
  async listProjectsByProjectIdMcpInstallationStatus(projectId: string | number, options?: { timeout?: number }): Promise<ListProjectsByProjectIdMcpInstallationStatusResponse> {
    return this.request<ListProjectsByProjectIdMcpInstallationStatusResponse>('GET', this.buildPath(`/api/projects/{projectId}/mcp/installation/status`, { projectId }), { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/mcp/installation/install
   */
  async createProjectsByProjectIdMcpInstallationInstall(projectId: string | number, data: CreateProjectsByProjectIdMcpInstallationInstallRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdMcpInstallationInstallResponse> {
    return this.request<CreateProjectsByProjectIdMcpInstallationInstallResponse>('POST', this.buildPath(`/api/projects/{projectId}/mcp/installation/install`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/mcp/installation/uninstall
   */
  async createProjectsByProjectIdMcpInstallationUninstall(projectId: string | number, data: CreateProjectsByProjectIdMcpInstallationUninstallRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdMcpInstallationUninstallResponse> {
    return this.request<CreateProjectsByProjectIdMcpInstallationUninstallResponse>('POST', this.buildPath(`/api/projects/{projectId}/mcp/installation/uninstall`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/mcp/status
   */
  async listMcpStatus(options?: { timeout?: number }): Promise<ListMcpStatusResponse> {
    return this.request<ListMcpStatusResponse>('GET', `/api/mcp/status`, { timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/mcp/installation/batch-install
   */
  async createProjectsByProjectIdMcpInstallationBatchInstall(projectId: string | number, data: CreateProjectsByProjectIdMcpInstallationBatchInstallRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdMcpInstallationBatchInstallResponse> {
    return this.request<CreateProjectsByProjectIdMcpInstallationBatchInstallResponse>('POST', this.buildPath(`/api/projects/{projectId}/mcp/installation/batch-install`, { projectId }), { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/projects/{projectId}/mcp/install-project-config
   */
  async createProjectsByProjectIdMcpInstallProjectConfig(projectId: string | number, data: CreateProjectsByProjectIdMcpInstallProjectConfigRequest, options?: { timeout?: number }): Promise<CreateProjectsByProjectIdMcpInstallProjectConfigResponse> {
    return this.request<CreateProjectsByProjectIdMcpInstallProjectConfigResponse>('POST', this.buildPath(`/api/projects/{projectId}/mcp/install-project-config`, { projectId }), { body: data, timeout: options?.timeout })
  }


  // MCP Global Operations
  /**
   * GET /api/mcp/global/config
   */
  async listMcpGlobalConfig(options?: { timeout?: number }): Promise<ListMcpGlobalConfigResponse> {
    return this.request<ListMcpGlobalConfigResponse>('GET', `/api/mcp/global/config`, { timeout: options?.timeout })
  }

  /**
   * POST /api/mcp/global/config
   */
  async createMcpGlobalConfig(data: CreateMcpGlobalConfigRequest, options?: { timeout?: number }): Promise<CreateMcpGlobalConfigResponse> {
    return this.request<CreateMcpGlobalConfigResponse>('POST', `/api/mcp/global/config`, { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/mcp/global/installations
   */
  async listMcpGlobalInstallations(options?: { timeout?: number }): Promise<ListMcpGlobalInstallationsResponse> {
    return this.request<ListMcpGlobalInstallationsResponse>('GET', `/api/mcp/global/installations`, { timeout: options?.timeout })
  }

  /**
   * POST /api/mcp/global/install
   */
  async createMcpGlobalInstall(data: CreateMcpGlobalInstallRequest, options?: { timeout?: number }): Promise<CreateMcpGlobalInstallResponse> {
    return this.request<CreateMcpGlobalInstallResponse>('POST', `/api/mcp/global/install`, { body: data, timeout: options?.timeout })
  }

  /**
   * POST /api/mcp/global/uninstall
   */
  async createMcpGlobalUninstall(data: CreateMcpGlobalUninstallRequest, options?: { timeout?: number }): Promise<CreateMcpGlobalUninstallResponse> {
    return this.request<CreateMcpGlobalUninstallResponse>('POST', `/api/mcp/global/uninstall`, { body: data, timeout: options?.timeout })
  }

  /**
   * GET /api/mcp/global/status
   */
  async listMcpGlobalStatus(options?: { timeout?: number }): Promise<ListMcpGlobalStatusResponse> {
    return this.request<ListMcpGlobalStatusResponse>('GET', `/api/mcp/global/status`, { timeout: options?.timeout })
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
