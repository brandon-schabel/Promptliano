/**
 * AUTO-GENERATED TYPE-SAFE API CLIENT
 * Generated at: 2025-09-06T07:28:47.270Z
 * Generated from: 174 API endpoints
 *
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 */

import type { paths } from './api-types'

// Re-export all paths for external usage
export type ApiPaths = paths

// ===== GENERATED TYPES FOR ALL ENDPOINTS =====

export type GetProjectsResponse = paths['/api/projects']['get']['responses']['200']['content']['application/json']
export type CreateProjectResponse = paths['/api/projects']['post']['responses']['201']['content']['application/json']
export type CreateProjectRequest = NonNullable<
  paths['/api/projects']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdPromptsResponse =
  paths['/api/projects/{id}/prompts']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSuggestPromptsResponse =
  paths['/api/projects/{id}/suggest-prompts']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSuggestPromptsRequest = NonNullable<
  paths['/api/projects/{id}/suggest-prompts']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdTicketsResponse =
  paths['/api/projects/{id}/tickets']['get']['responses']['200']['content']['application/json']
export type GetProjectResponse = paths['/api/projects/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateProjectResponse =
  paths['/api/projects/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateProjectRequest = NonNullable<
  paths['/api/projects/{id}']['put']['requestBody']
>['content']['application/json']
export type DeleteProjectResponse =
  paths['/api/projects/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSyncResponse =
  paths['/api/projects/{id}/sync']['post']['responses']['200']['content']['application/json']
export type GetProjectsByIdSyncStreamResponse = { success: boolean; message?: string }
export type GetProjectsByIdFilesResponse =
  paths['/api/projects/{id}/files']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdSummaryResponse =
  paths['/api/projects/{id}/summary']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdFilesSummarizeResponse =
  paths['/api/projects/{id}/files/summarize']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdFilesSummarizeRequest = NonNullable<
  paths['/api/projects/{id}/files/summarize']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdStatisticsResponse =
  paths['/api/projects/{id}/statistics']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdRefreshResponse =
  paths['/api/projects/{id}/refresh']['post']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdFilesByFileIdResponse =
  paths['/api/projects/{id}/files/{fileId}']['put']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdFilesByFileIdRequest = NonNullable<
  paths['/api/projects/{id}/files/{fileId}']['put']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdSuggestFilesResponse =
  paths['/api/projects/{id}/suggest-files']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdSuggestFilesRequest = NonNullable<
  paths['/api/projects/{id}/suggest-files']['post']['requestBody']
>['content']['application/json']
export type GetProjectProjectResponse =
  paths['/api/projects/{projectId}']['get']['responses']['200']['content']['application/json']
export type UpdateProjectProjectResponse =
  paths['/api/projects/{projectId}']['put']['responses']['200']['content']['application/json']
export type UpdateProjectProjectRequest = NonNullable<
  paths['/api/projects/{projectId}']['put']['requestBody']
>['content']['application/json']
export type DeleteProjectProjectResponse =
  paths['/api/projects/{projectId}']['delete']['responses']['200']['content']['application/json']
export type ListProjectsByProjectIdQueuesResponse =
  paths['/api/projects/{projectId}/queues']['get']['responses']['200']['content']['application/json']
export type GetTicketsResponse = paths['/api/tickets']['get']['responses']['200']['content']['application/json']
export type CreateTicketResponse = paths['/api/tickets']['post']['responses']['201']['content']['application/json']
export type CreateTicketRequest = NonNullable<
  paths['/api/tickets']['post']['requestBody']
>['content']['application/json']
export type GetTicketResponse = paths['/api/tickets/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateTicketResponse = paths['/api/tickets/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateTicketRequest = NonNullable<
  paths['/api/tickets/{id}']['put']['requestBody']
>['content']['application/json']
export type DeleteTicketResponse =
  paths['/api/tickets/{id}']['delete']['responses']['200']['content']['application/json']
export type ListTicketsByTicketIdTasksResponse =
  paths['/api/tickets/{ticketId}/tasks']['get']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdTasksResponse =
  paths['/api/tickets/{ticketId}/tasks']['post']['responses']['201']['content']['application/json']
export type CreateTicketsByTicketIdTasksRequest = NonNullable<
  paths['/api/tickets/{ticketId}/tasks']['post']['requestBody']
>['content']['application/json']
export type CreateTicketsByTicketIdSuggestTasksResponse =
  paths['/api/tickets/{ticketId}/suggest-tasks']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdAutoGenerateTasksResponse =
  paths['/api/tickets/{ticketId}/auto-generate-tasks']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdSuggestFilesResponse =
  paths['/api/tickets/{ticketId}/suggest-files']['post']['responses']['200']['content']['application/json']
export type CreateTicketsByTicketIdSuggestFilesRequest = NonNullable<
  paths['/api/tickets/{ticketId}/suggest-files']['post']['requestBody']
>['content']['application/json']
export type CreateTicketsByTicketIdCompleteResponse =
  paths['/api/tickets/{ticketId}/complete']['post']['responses']['200']['content']['application/json']
export type GetTicketTicketResponse =
  paths['/api/tickets/{ticketId}']['get']['responses']['200']['content']['application/json']
export type UpdateTicketTicketResponse =
  paths['/api/tickets/{ticketId}']['put']['responses']['200']['content']['application/json']
export type UpdateTicketTicketRequest = NonNullable<
  paths['/api/tickets/{ticketId}']['put']['requestBody']
>['content']['application/json']
export type DeleteTicketTicketResponse =
  paths['/api/tickets/{ticketId}']['delete']['responses']['200']['content']['application/json']
export type GetTickettasksResponse = paths['/api/tickettasks']['get']['responses']['200']['content']['application/json']
export type CreateTickettaskResponse =
  paths['/api/tickettasks']['post']['responses']['201']['content']['application/json']
export type CreateTickettaskRequest = NonNullable<
  paths['/api/tickettasks']['post']['requestBody']
>['content']['application/json']
export type GetTickettaskResponse =
  paths['/api/tickettasks/{tickettaskId}']['get']['responses']['200']['content']['application/json']
export type UpdateTickettaskResponse =
  paths['/api/tickettasks/{tickettaskId}']['put']['responses']['200']['content']['application/json']
export type UpdateTickettaskRequest = NonNullable<
  paths['/api/tickettasks/{tickettaskId}']['put']['requestBody']
>['content']['application/json']
export type DeleteTickettaskResponse =
  paths['/api/tickettasks/{tickettaskId}']['delete']['responses']['200']['content']['application/json']
export type GetChatsResponse = paths['/api/chats']['get']['responses']['200']['content']['application/json']
export type CreateChatResponse = paths['/api/chats']['post']['responses']['201']['content']['application/json']
export type CreateChatRequest = NonNullable<paths['/api/chats']['post']['requestBody']>['content']['application/json']
export type ListChatsByChatIdMessagesResponse =
  paths['/api/chats/{chatId}/messages']['get']['responses']['200']['content']['application/json']
export type GetChatResponse = paths['/api/chats/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateChatResponse = paths['/api/chats/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateChatRequest = NonNullable<
  paths['/api/chats/{id}']['put']['requestBody']
>['content']['application/json']
export type DeleteChatResponse = paths['/api/chats/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateChatsByChatIdForkResponse =
  paths['/api/chats/{chatId}/fork']['post']['responses']['200']['content']['application/json']
export type CreateChatsByChatIdForkRequest = NonNullable<
  paths['/api/chats/{chatId}/fork']['post']['requestBody']
>['content']['application/json']
export type CreateChatsByChatIdMessagesByMessageIdForkResponse =
  paths['/api/chats/{chatId}/messages/{messageId}/fork']['post']['responses']['200']['content']['application/json']
export type DeleteChatsByChatIdMessagesByMessageIdResponse =
  paths['/api/chats/{chatId}/messages/{messageId}']['delete']['responses']['200']['content']['application/json']
export type GetChatChatResponse = paths['/api/chats/{chatId}']['get']['responses']['200']['content']['application/json']
export type UpdateChatChatResponse =
  paths['/api/chats/{chatId}']['put']['responses']['200']['content']['application/json']
export type UpdateChatChatRequest = NonNullable<
  paths['/api/chats/{chatId}']['put']['requestBody']
>['content']['application/json']
export type DeleteChatChatResponse =
  paths['/api/chats/{chatId}']['delete']['responses']['200']['content']['application/json']
export type CreateChatsByChatIdMessagesResponse =
  paths['/api/chats/{chatId}/messages']['post']['responses']['200']['content']['application/json']
export type CreateChatsByChatIdMessagesRequest = NonNullable<
  paths['/api/chats/{chatId}/messages']['post']['requestBody']
>['content']['application/json']
export type GetChatmessagesResponse =
  paths['/api/chatmessages']['get']['responses']['200']['content']['application/json']
export type CreateChatmessageResponse =
  paths['/api/chatmessages']['post']['responses']['201']['content']['application/json']
export type CreateChatmessageRequest = NonNullable<
  paths['/api/chatmessages']['post']['requestBody']
>['content']['application/json']
export type GetChatmessageResponse =
  paths['/api/chatmessages/{chatmessageId}']['get']['responses']['200']['content']['application/json']
export type UpdateChatmessageResponse =
  paths['/api/chatmessages/{chatmessageId}']['put']['responses']['200']['content']['application/json']
export type UpdateChatmessageRequest = NonNullable<
  paths['/api/chatmessages/{chatmessageId}']['put']['requestBody']
>['content']['application/json']
export type DeleteChatmessageResponse =
  paths['/api/chatmessages/{chatmessageId}']['delete']['responses']['200']['content']['application/json']
export type GetPromptsResponse = paths['/api/prompts']['get']['responses']['200']['content']['application/json']
export type CreatePromptResponse = paths['/api/prompts']['post']['responses']['201']['content']['application/json']
export type CreatePromptRequest = NonNullable<
  paths['/api/prompts']['post']['requestBody']
>['content']['application/json']
export type GetPromptResponse = paths['/api/prompts/{id}']['get']['responses']['200']['content']['application/json']
export type UpdatePromptResponse = paths['/api/prompts/{id}']['put']['responses']['200']['content']['application/json']
export type UpdatePromptRequest = NonNullable<
  paths['/api/prompts/{id}']['put']['requestBody']
>['content']['application/json']
export type UpdatePromptPromptsResponse =
  paths['/api/prompts/{id}']['patch']['responses']['200']['content']['application/json']
export type UpdatePromptPromptsRequest = NonNullable<
  paths['/api/prompts/{id}']['patch']['requestBody']
>['content']['application/json']
export type DeletePromptResponse =
  paths['/api/prompts/{id}']['delete']['responses']['200']['content']['application/json']
export type ListPromptsByPromptIdExportResponse = { success: boolean; message?: string }
export type CreatePromptsExportBatchResponse =
  paths['/api/prompts/export-batch']['post']['responses']['200']['content']['application/json']
export type CreatePromptsExportBatchRequest = NonNullable<
  paths['/api/prompts/export-batch']['post']['requestBody']
>['content']['application/json']
export type CreatePromptsValidateMarkdownResponse =
  paths['/api/prompts/validate-markdown']['post']['responses']['200']['content']['application/json']
export type CreatePromptsValidateMarkdownRequest = NonNullable<
  paths['/api/prompts/validate-markdown']['post']['requestBody']
>['content']['application/json']
export type GetPromptPromptResponse =
  paths['/api/prompts/{promptId}']['get']['responses']['200']['content']['application/json']
export type UpdatePromptPromptResponse =
  paths['/api/prompts/{promptId}']['put']['responses']['200']['content']['application/json']
export type UpdatePromptPromptRequest = NonNullable<
  paths['/api/prompts/{promptId}']['put']['requestBody']
>['content']['application/json']
export type DeletePromptPromptResponse =
  paths['/api/prompts/{promptId}']['delete']['responses']['200']['content']['application/json']
export type GetProviderkeiesResponse =
  paths['/api/providerkeies']['get']['responses']['200']['content']['application/json']
export type CreateProviderkeieResponse =
  paths['/api/providerkeies']['post']['responses']['201']['content']['application/json']
export type CreateProviderkeieRequest = NonNullable<
  paths['/api/providerkeies']['post']['requestBody']
>['content']['application/json']
export type GetProviderkeieResponse =
  paths['/api/providerkeies/{providerkeyId}']['get']['responses']['200']['content']['application/json']
export type UpdateProviderkeieResponse =
  paths['/api/providerkeies/{providerkeyId}']['put']['responses']['200']['content']['application/json']
export type UpdateProviderkeieRequest = NonNullable<
  paths['/api/providerkeies/{providerkeyId}']['put']['requestBody']
>['content']['application/json']
export type DeleteProviderkeieResponse =
  paths['/api/providerkeies/{providerkeyId}']['delete']['responses']['200']['content']['application/json']
export type GetFilesResponse = paths['/api/files']['get']['responses']['200']['content']['application/json']
export type CreateFileResponse = paths['/api/files']['post']['responses']['201']['content']['application/json']
export type CreateFileRequest = NonNullable<paths['/api/files']['post']['requestBody']>['content']['application/json']
export type GetFileResponse = paths['/api/files/{fileId}']['get']['responses']['200']['content']['application/json']
export type UpdateFileResponse = paths['/api/files/{fileId}']['put']['responses']['200']['content']['application/json']
export type UpdateFileRequest = NonNullable<
  paths['/api/files/{fileId}']['put']['requestBody']
>['content']['application/json']
export type DeleteFileResponse =
  paths['/api/files/{fileId}']['delete']['responses']['200']['content']['application/json']
export type GetSelectedfilesResponse =
  paths['/api/selectedfiles']['get']['responses']['200']['content']['application/json']
export type CreateSelectedfileResponse =
  paths['/api/selectedfiles']['post']['responses']['201']['content']['application/json']
export type CreateSelectedfileRequest = NonNullable<
  paths['/api/selectedfiles']['post']['requestBody']
>['content']['application/json']
export type GetSelectedfileResponse =
  paths['/api/selectedfiles/{selectedfileId}']['get']['responses']['200']['content']['application/json']
export type UpdateSelectedfileResponse =
  paths['/api/selectedfiles/{selectedfileId}']['put']['responses']['200']['content']['application/json']
export type UpdateSelectedfileRequest = NonNullable<
  paths['/api/selectedfiles/{selectedfileId}']['put']['requestBody']
>['content']['application/json']
export type DeleteSelectedfileResponse =
  paths['/api/selectedfiles/{selectedfileId}']['delete']['responses']['200']['content']['application/json']
export type GetActivetabsResponse = paths['/api/activetabs']['get']['responses']['200']['content']['application/json']
export type CreateActivetabResponse =
  paths['/api/activetabs']['post']['responses']['201']['content']['application/json']
export type CreateActivetabRequest = NonNullable<
  paths['/api/activetabs']['post']['requestBody']
>['content']['application/json']
export type GetActivetabResponse =
  paths['/api/activetabs/{activetabId}']['get']['responses']['200']['content']['application/json']
export type UpdateActivetabResponse =
  paths['/api/activetabs/{activetabId}']['put']['responses']['200']['content']['application/json']
export type UpdateActivetabRequest = NonNullable<
  paths['/api/activetabs/{activetabId}']['put']['requestBody']
>['content']['application/json']
export type DeleteActivetabResponse =
  paths['/api/activetabs/{activetabId}']['delete']['responses']['200']['content']['application/json']
export type GetProviderKeysResponse =
  paths['/api/provider-keys']['get']['responses']['200']['content']['application/json']
export type CreateProviderKeyResponse =
  paths['/api/provider-keys']['post']['responses']['201']['content']['application/json']
export type CreateProviderKeyRequest = NonNullable<
  paths['/api/provider-keys']['post']['requestBody']
>['content']['application/json']
export type GetProviderKeyResponse =
  paths['/api/provider-keys/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateProviderKeyResponse =
  paths['/api/provider-keys/{id}']['put']['responses']['200']['content']['application/json']
export type UpdateProviderKeyRequest = NonNullable<
  paths['/api/provider-keys/{id}']['put']['requestBody']
>['content']['application/json']
export type DeleteProviderKeyResponse =
  paths['/api/provider-keys/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateProviderKeysByProviderKeyIdTestResponse =
  paths['/api/provider-keys/{providerKeyId}/test']['post']['responses']['200']['content']['application/json']
export type CreateProviderKeysByProviderKeyIdTestRequest = NonNullable<
  paths['/api/provider-keys/{providerKeyId}/test']['post']['requestBody']
>['content']['application/json']
export type ListProviderKeysTypesResponse =
  paths['/api/provider-keys/types']['get']['responses']['200']['content']['application/json']
export type GetKeysResponse = paths['/api/keys']['get']['responses']['200']['content']['application/json']
export type CreateKeyResponse = paths['/api/keys']['post']['responses']['201']['content']['application/json']
export type CreateKeyRequest = NonNullable<paths['/api/keys']['post']['requestBody']>['content']['application/json']
export type GetKeyResponse = paths['/api/keys/{id}']['get']['responses']['200']['content']['application/json']
export type UpdateKeyResponse = paths['/api/keys/{id}']['patch']['responses']['200']['content']['application/json']
export type UpdateKeyRequest = NonNullable<
  paths['/api/keys/{id}']['patch']['requestBody']
>['content']['application/json']
export type DeleteKeyResponse = paths['/api/keys/{id}']['delete']['responses']['200']['content']['application/json']
export type CreateKeysValidateCustomResponse =
  paths['/api/keys/validate-custom']['post']['responses']['200']['content']['application/json']
export type CreateKeysValidateCustomRequest = NonNullable<
  paths['/api/keys/validate-custom']['post']['requestBody']
>['content']['application/json']
export type CreateProvidersTestResponse =
  paths['/api/providers/test']['post']['responses']['200']['content']['application/json']
export type CreateProvidersTestRequest = NonNullable<
  paths['/api/providers/test']['post']['requestBody']
>['content']['application/json']
export type CreateProvidersBatchTestResponse =
  paths['/api/providers/batch-test']['post']['responses']['200']['content']['application/json']
export type CreateProvidersBatchTestRequest = NonNullable<
  paths['/api/providers/batch-test']['post']['requestBody']
>['content']['application/json']
export type ListProvidersHealthResponse =
  paths['/api/providers/health']['get']['responses']['200']['content']['application/json']
export type UpdateProvidersSettingsResponse =
  paths['/api/providers/settings']['put']['responses']['200']['content']['application/json']
export type UpdateProvidersSettingsRequest = NonNullable<
  paths['/api/providers/settings']['put']['requestBody']
>['content']['application/json']
export type GetActiveTabResponse = paths['/api/active-tab']['get']['responses']['200']['content']['application/json']
export type CreateActiveTaResponse = paths['/api/active-tab']['post']['responses']['200']['content']['application/json']
export type CreateActiveTaRequest = NonNullable<
  paths['/api/active-tab']['post']['requestBody']
>['content']['application/json']
export type DeleteActiveTaResponse =
  paths['/api/active-tab']['delete']['responses']['200']['content']['application/json']
export type ListMcpGlobalConfigResponse =
  paths['/api/mcp/global/config']['get']['responses']['200']['content']['application/json']
export type CreateMcpGlobalConfigResponse =
  paths['/api/mcp/global/config']['post']['responses']['200']['content']['application/json']
export type CreateMcpGlobalConfigRequest = NonNullable<
  paths['/api/mcp/global/config']['post']['requestBody']
>['content']['application/json']
export type ListMcpGlobalInstallationsResponse =
  paths['/api/mcp/global/installations']['get']['responses']['200']['content']['application/json']
export type CreateMcpGlobalInstallResponse =
  paths['/api/mcp/global/install']['post']['responses']['200']['content']['application/json']
export type CreateMcpGlobalInstallRequest = NonNullable<
  paths['/api/mcp/global/install']['post']['requestBody']
>['content']['application/json']
export type CreateMcpGlobalUninstallResponse =
  paths['/api/mcp/global/uninstall']['post']['responses']['200']['content']['application/json']
export type CreateMcpGlobalUninstallRequest = NonNullable<
  paths['/api/mcp/global/uninstall']['post']['requestBody']
>['content']['application/json']
export type ListMcpGlobalStatusResponse =
  paths['/api/mcp/global/status']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigLocationsResponse =
  paths['/api/projects/{id}/mcp/config/locations']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigMergedResponse =
  paths['/api/projects/{id}/mcp/config/merged']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigExpandedResponse =
  paths['/api/projects/{id}/mcp/config/expanded']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpConfigResponse =
  paths['/api/projects/{id}/mcp/config']['get']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdMcpConfigResponse =
  paths['/api/projects/{id}/mcp/config']['put']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdMcpConfigRequest = NonNullable<
  paths['/api/projects/{id}/mcp/config']['put']['requestBody']
>['content']['application/json']
export type DeleteProjectsByIdMcpConfigResponse =
  paths['/api/projects/{id}/mcp/config']['delete']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigSaveToLocationResponse =
  paths['/api/projects/{id}/mcp/config/save-to-location']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigSaveToLocationRequest = NonNullable<
  paths['/api/projects/{id}/mcp/config/save-to-location']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdMcpConfigDefaultForLocationResponse =
  paths['/api/projects/{id}/mcp/config/default-for-location']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigResponse =
  paths['/api/projects/{id}/mcp/config']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpConfigRequest = NonNullable<
  paths['/api/projects/{id}/mcp/config']['post']['requestBody']
>['content']['application/json']
export type ListMcpInstallationDetectResponse =
  paths['/api/mcp/installation/detect']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpInstallationStatusResponse =
  paths['/api/projects/{id}/mcp/installation/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationInstallResponse =
  paths['/api/projects/{id}/mcp/installation/install']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationInstallRequest = NonNullable<
  paths['/api/projects/{id}/mcp/installation/install']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdMcpInstallationUninstallResponse =
  paths['/api/projects/{id}/mcp/installation/uninstall']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationUninstallRequest = NonNullable<
  paths['/api/projects/{id}/mcp/installation/uninstall']['post']['requestBody']
>['content']['application/json']
export type ListMcpStatusResponse = paths['/api/mcp/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationBatchInstallResponse =
  paths['/api/projects/{id}/mcp/installation/batch-install']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallationBatchInstallRequest = NonNullable<
  paths['/api/projects/{id}/mcp/installation/batch-install']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdMcpInstallProjectConfigResponse =
  paths['/api/projects/{id}/mcp/install-project-config']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpInstallProjectConfigRequest = NonNullable<
  paths['/api/projects/{id}/mcp/install-project-config']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdFlowResponse =
  paths['/api/projects/{id}/flow']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdFlowItemsResponse =
  paths['/api/projects/{id}/flow/items']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdFlowUnqueuedResponse =
  paths['/api/projects/{id}/flow/unqueued']['get']['responses']['200']['content']['application/json']
export type CreateFlowQueuesResponse =
  paths['/api/flow/queues']['post']['responses']['200']['content']['application/json']
export type CreateFlowQueuesRequest = NonNullable<
  paths['/api/flow/queues']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdFlowQueuesResponse =
  paths['/api/projects/{id}/flow/queues']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdFlowQueuesWithStatsResponse =
  paths['/api/projects/{id}/flow/queues-with-stats']['get']['responses']['200']['content']['application/json']
export type ListFlowQueuesByQueueIdItemsResponse =
  paths['/api/flow/queues/{queueId}/items']['get']['responses']['200']['content']['application/json']
export type ListFlowQueuesByQueueIdStatsResponse =
  paths['/api/flow/queues/{queueId}/stats']['get']['responses']['200']['content']['application/json']
export type UpdateFlowQueuesByQueueIdResponse =
  paths['/api/flow/queues/{queueId}']['patch']['responses']['200']['content']['application/json']
export type UpdateFlowQueuesByQueueIdRequest = NonNullable<
  paths['/api/flow/queues/{queueId}']['patch']['requestBody']
>['content']['application/json']
export type DeleteFlowQueuesByQueueIdResponse =
  paths['/api/flow/queues/{queueId}']['delete']['responses']['200']['content']['application/json']
export type CreateFlowTicketsByTicketIdEnqueueResponse =
  paths['/api/flow/tickets/{ticketId}/enqueue']['post']['responses']['200']['content']['application/json']
export type CreateFlowTicketsByTicketIdEnqueueRequest = NonNullable<
  paths['/api/flow/tickets/{ticketId}/enqueue']['post']['requestBody']
>['content']['application/json']
export type CreateFlowTasksByTaskIdEnqueueResponse =
  paths['/api/flow/tasks/{taskId}/enqueue']['post']['responses']['200']['content']['application/json']
export type CreateFlowTasksByTaskIdEnqueueRequest = NonNullable<
  paths['/api/flow/tasks/{taskId}/enqueue']['post']['requestBody']
>['content']['application/json']
export type CreateFlowTicketsByTicketIdDequeueResponse =
  paths['/api/flow/tickets/{ticketId}/dequeue']['post']['responses']['200']['content']['application/json']
export type CreateFlowTasksByTaskIdDequeueResponse =
  paths['/api/flow/tasks/{taskId}/dequeue']['post']['responses']['200']['content']['application/json']
export type CreateFlowMoveResponse = paths['/api/flow/move']['post']['responses']['200']['content']['application/json']
export type CreateFlowMoveRequest = NonNullable<
  paths['/api/flow/move']['post']['requestBody']
>['content']['application/json']
export type CreateFlowReorderResponse =
  paths['/api/flow/reorder']['post']['responses']['200']['content']['application/json']
export type CreateFlowReorderRequest = NonNullable<
  paths['/api/flow/reorder']['post']['requestBody']
>['content']['application/json']
export type CreateFlowProcessStartResponse =
  paths['/api/flow/process/start']['post']['responses']['200']['content']['application/json']
export type CreateFlowProcessStartRequest = NonNullable<
  paths['/api/flow/process/start']['post']['requestBody']
>['content']['application/json']
export type CreateFlowProcessCompleteResponse =
  paths['/api/flow/process/complete']['post']['responses']['200']['content']['application/json']
export type CreateFlowProcessCompleteRequest = NonNullable<
  paths['/api/flow/process/complete']['post']['requestBody']
>['content']['application/json']
export type CreateFlowProcessFailResponse =
  paths['/api/flow/process/fail']['post']['responses']['200']['content']['application/json']
export type CreateFlowProcessFailRequest = NonNullable<
  paths['/api/flow/process/fail']['post']['requestBody']
>['content']['application/json']
export type CreateFlowBulkMoveResponse =
  paths['/api/flow/bulk-move']['post']['responses']['200']['content']['application/json']
export type CreateFlowBulkMoveRequest = NonNullable<
  paths['/api/flow/bulk-move']['post']['requestBody']
>['content']['application/json']
export type CreateAiChatResponse = { success: boolean; message?: string }
export type CreateAiChatRequest = NonNullable<
  paths['/api/ai/chat']['post']['requestBody']
>['content']['application/json']
export type GetProvidersResponse = paths['/api/providers']['get']['responses']['200']['content']['application/json']
export type GetModelsResponse = paths['/api/models']['get']['responses']['200']['content']['application/json']
export type ListProviders_debugConfigResponse =
  paths['/api/providers/_debug-config']['get']['responses']['200']['content']['application/json']
export type CreateAiGenerateTextResponse =
  paths['/api/ai/generate/text']['post']['responses']['200']['content']['application/json']
export type CreateAiGenerateTextRequest = NonNullable<
  paths['/api/ai/generate/text']['post']['requestBody']
>['content']['application/json']
export type CreateProviderSettingResponse =
  paths['/api/provider-settings']['post']['responses']['200']['content']['application/json']
export type CreateProviderSettingRequest = NonNullable<
  paths['/api/provider-settings']['post']['requestBody']
>['content']['application/json']
export type CreateGenAiStreamResponse = { success: boolean; message?: string }
export type CreateGenAiStreamRequest = NonNullable<
  paths['/api/gen-ai/stream']['post']['requestBody']
>['content']['application/json']
export type CreateGenAiTextResponse =
  paths['/api/gen-ai/text']['post']['responses']['200']['content']['application/json']
export type CreateGenAiTextRequest = NonNullable<
  paths['/api/gen-ai/text']['post']['requestBody']
>['content']['application/json']
export type CreateGenAiStructuredResponse =
  paths['/api/gen-ai/structured']['post']['responses']['200']['content']['application/json']
export type CreateGenAiStructuredRequest = NonNullable<
  paths['/api/gen-ai/structured']['post']['requestBody']
>['content']['application/json']
export type CreateBrowseDirectorResponse =
  paths['/api/browse-directory']['post']['responses']['200']['content']['application/json']
export type CreateBrowseDirectorRequest = NonNullable<
  paths['/api/browse-directory']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdMcpServersResponse =
  paths['/api/projects/{id}/mcp/servers']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpServersResponse =
  paths['/api/projects/{id}/mcp/servers']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdMcpServersRequest = NonNullable<
  paths['/api/projects/{id}/mcp/servers']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdMcpServersByServerIdResponse =
  paths['/api/projects/{id}/mcp/servers/{serverId}']['get']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdMcpServersByServerIdResponse =
  paths['/api/projects/{id}/mcp/servers/{serverId}']['patch']['responses']['200']['content']['application/json']
export type UpdateProjectsByIdMcpServersByServerIdRequest = NonNullable<
  paths['/api/projects/{id}/mcp/servers/{serverId}']['patch']['requestBody']
>['content']['application/json']
export type DeleteProjectsByIdMcpServersByServerIdResponse =
  paths['/api/projects/{id}/mcp/servers/{serverId}']['delete']['responses']['200']['content']['application/json']
export type ListMcpToolsResponse = paths['/api/mcp/tools']['get']['responses']['200']['content']['application/json']
export type CreateMcpToolsExecuteResponse =
  paths['/api/mcp/tools/execute']['post']['responses']['200']['content']['application/json']
export type CreateMcpToolsExecuteRequest = NonNullable<
  paths['/api/mcp/tools/execute']['post']['requestBody']
>['content']['application/json']
export type ListMcpResourcesResponse =
  paths['/api/mcp/resources']['get']['responses']['200']['content']['application/json']
export type CreateMcpResourcesReadResponse =
  paths['/api/mcp/resources/read']['post']['responses']['200']['content']['application/json']
export type CreateMcpResourcesReadRequest = NonNullable<
  paths['/api/mcp/resources/read']['post']['requestBody']
>['content']['application/json']
export type ListMcpBuiltinToolsResponse =
  paths['/api/mcp/builtin-tools']['get']['responses']['200']['content']['application/json']
export type CreateMcpServersByServerIdStartResponse =
  paths['/api/mcp/servers/{serverId}/start']['post']['responses']['200']['content']['application/json']
export type CreateMcpServersByServerIdStopResponse =
  paths['/api/mcp/servers/{serverId}/stop']['post']['responses']['200']['content']['application/json']
export type ListMcpAnalyticsResponse =
  paths['/api/mcp/analytics']['get']['responses']['200']['content']['application/json']
export type ListMcpServersByServerIdStatsResponse =
  paths['/api/mcp/servers/{serverId}/stats']['get']['responses']['200']['content']['application/json']
export type ListMcpToolsStatsResponse =
  paths['/api/mcp/tools/stats']['get']['responses']['200']['content']['application/json']
export type ListMcpResourcesStatsResponse =
  paths['/api/mcp/resources/stats']['get']['responses']['200']['content']['application/json']
export type CreateMcpAnalyticsReportResponse =
  paths['/api/mcp/analytics/report']['post']['responses']['200']['content']['application/json']
export type CreateMcpAnalyticsReportRequest = NonNullable<
  paths['/api/mcp/analytics/report']['post']['requestBody']
>['content']['application/json']
export type ListMcpSessionsStatsResponse =
  paths['/api/mcp/sessions/stats']['get']['responses']['200']['content']['application/json']
export type ListMcpAnalyticsPerformanceResponse =
  paths['/api/mcp/analytics/performance']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsOverviewResponse =
  paths['/api/projects/{id}/mcp/analytics/overview']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsStatisticsResponse =
  paths['/api/projects/{id}/mcp/analytics/statistics']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsTimelineResponse =
  paths['/api/projects/{id}/mcp/analytics/timeline']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsErrorPatternsResponse =
  paths['/api/projects/{id}/mcp/analytics/error-patterns']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdMcpAnalyticsExecutionsResponse =
  paths['/api/projects/{id}/mcp/analytics/executions']['get']['responses']['200']['content']['application/json']
export type CreateMcpTestConnectionResponse =
  paths['/api/mcp/test/connection']['post']['responses']['200']['content']['application/json']
export type CreateMcpTestConnectionRequest = NonNullable<
  paths['/api/mcp/test/connection']['post']['requestBody']
>['content']['application/json']
export type CreateMcpTestInitializeResponse =
  paths['/api/mcp/test/initialize']['post']['responses']['200']['content']['application/json']
export type CreateMcpTestInitializeRequest = NonNullable<
  paths['/api/mcp/test/initialize']['post']['requestBody']
>['content']['application/json']
export type CreateMcpTestToolResponse =
  paths['/api/mcp/test/tool']['post']['responses']['200']['content']['application/json']
export type CreateMcpTestToolRequest = NonNullable<
  paths['/api/mcp/test/tool']['post']['requestBody']
>['content']['application/json']
export type CreateMcpTestValidateConfigResponse =
  paths['/api/mcp/test/validate-config']['post']['responses']['200']['content']['application/json']
export type CreateMcpTestValidateConfigRequest = NonNullable<
  paths['/api/mcp/test/validate-config']['post']['requestBody']
>['content']['application/json']
export type CreateMcpTestDebugResponse =
  paths['/api/mcp/test/debug']['post']['responses']['200']['content']['application/json']
export type CreateMcpTestDebugRequest = NonNullable<
  paths['/api/mcp/test/debug']['post']['requestBody']
>['content']['application/json']
export type ListMcpSessionsResponse =
  paths['/api/mcp/sessions']['get']['responses']['200']['content']['application/json']
export type CreateMcpSessionsResponse =
  paths['/api/mcp/sessions']['post']['responses']['200']['content']['application/json']
export type CreateMcpSessionsRequest = NonNullable<
  paths['/api/mcp/sessions']['post']['requestBody']
>['content']['application/json']
export type ListMcpSessionsBySessionIdResponse =
  paths['/api/mcp/sessions/{sessionId}']['get']['responses']['200']['content']['application/json']
export type CreateMcpSessionsBySessionIdCloseResponse =
  paths['/api/mcp/sessions/{sessionId}/close']['post']['responses']['200']['content']['application/json']
export type CreateMcpSessionsBySessionIdCloseRequest = NonNullable<
  paths['/api/mcp/sessions/{sessionId}/close']['post']['requestBody']
>['content']['application/json']
export type CreateMcpSessionsBySessionIdRefreshResponse =
  paths['/api/mcp/sessions/{sessionId}/refresh']['post']['responses']['200']['content']['application/json']
export type ListMcpSessionsBySessionIdHistoryResponse =
  paths['/api/mcp/sessions/{sessionId}/history']['get']['responses']['200']['content']['application/json']
export type CreateMcpSessionsCleanupResponse =
  paths['/api/mcp/sessions/cleanup']['post']['responses']['200']['content']['application/json']
export type CreateMcpSessionsCleanupRequest = NonNullable<
  paths['/api/mcp/sessions/cleanup']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdGitStatusResponse =
  paths['/api/projects/{id}/git/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStageResponse =
  paths['/api/projects/{id}/git/stage']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStageRequest = NonNullable<
  paths['/api/projects/{id}/git/stage']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitUnstageResponse =
  paths['/api/projects/{id}/git/unstage']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitUnstageRequest = NonNullable<
  paths['/api/projects/{id}/git/unstage']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitStageAllResponse =
  paths['/api/projects/{id}/git/stage-all']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitUnstageAllResponse =
  paths['/api/projects/{id}/git/unstage-all']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitCommitResponse =
  paths['/api/projects/{id}/git/commit']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitCommitRequest = NonNullable<
  paths['/api/projects/{id}/git/commit']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdGitLogResponse =
  paths['/api/projects/{id}/git/log']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitLogEnhancedResponse =
  paths['/api/projects/{id}/git/log-enhanced']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitCommitsByCommitHashResponse =
  paths['/api/projects/{id}/git/commits/{commitHash}']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitDiffResponse =
  paths['/api/projects/{id}/git/diff']['get']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitBranchesResponse =
  paths['/api/projects/{id}/git/branches']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesResponse =
  paths['/api/projects/{id}/git/branches']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesRequest = NonNullable<
  paths['/api/projects/{id}/git/branches']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdGitBranchesEnhancedResponse =
  paths['/api/projects/{id}/git/branches-enhanced']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesSwitchResponse =
  paths['/api/projects/{id}/git/branches/switch']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitBranchesSwitchRequest = NonNullable<
  paths['/api/projects/{id}/git/branches/switch']['post']['requestBody']
>['content']['application/json']
export type DeleteProjectsByIdGitBranchesByBranchNameResponse =
  paths['/api/projects/{id}/git/branches/{branchName}']['delete']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitStashResponse =
  paths['/api/projects/{id}/git/stash']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashResponse =
  paths['/api/projects/{id}/git/stash']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashRequest = NonNullable<
  paths['/api/projects/{id}/git/stash']['post']['requestBody']
>['content']['application/json']
export type DeleteProjectsByIdGitStashResponse =
  paths['/api/projects/{id}/git/stash']['delete']['responses']['200']['content']['application/json']
export type DeleteProjectsByIdGitStashRequest = NonNullable<
  paths['/api/projects/{id}/git/stash']['delete']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitStashApplyResponse =
  paths['/api/projects/{id}/git/stash/apply']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashApplyRequest = NonNullable<
  paths['/api/projects/{id}/git/stash/apply']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitStashPopResponse =
  paths['/api/projects/{id}/git/stash/pop']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitStashPopRequest = NonNullable<
  paths['/api/projects/{id}/git/stash/pop']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdGitWorktreesResponse =
  paths['/api/projects/{id}/git/worktrees']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitWorktreesResponse =
  paths['/api/projects/{id}/git/worktrees']['post']['responses']['201']['content']['application/json']
export type CreateProjectsByIdGitWorktreesRequest = NonNullable<
  paths['/api/projects/{id}/git/worktrees']['post']['requestBody']
>['content']['application/json']
export type DeleteProjectsByIdGitWorktreesResponse =
  paths['/api/projects/{id}/git/worktrees']['delete']['responses']['200']['content']['application/json']
export type DeleteProjectsByIdGitWorktreesRequest = NonNullable<
  paths['/api/projects/{id}/git/worktrees']['delete']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitWorktreesLockResponse =
  paths['/api/projects/{id}/git/worktrees/lock']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitWorktreesLockRequest = NonNullable<
  paths['/api/projects/{id}/git/worktrees/lock']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitWorktreesUnlockResponse =
  paths['/api/projects/{id}/git/worktrees/unlock']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitWorktreesUnlockRequest = NonNullable<
  paths['/api/projects/{id}/git/worktrees/unlock']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitWorktreesPruneResponse =
  paths['/api/projects/{id}/git/worktrees/prune']['post']['responses']['200']['content']['application/json']
export type GetProjectsByIdGitRemotesResponse =
  paths['/api/projects/{id}/git/remotes']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitPushResponse =
  paths['/api/projects/{id}/git/push']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitPushRequest = NonNullable<
  paths['/api/projects/{id}/git/push']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitFetchResponse =
  paths['/api/projects/{id}/git/fetch']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitFetchRequest = NonNullable<
  paths['/api/projects/{id}/git/fetch']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitPullResponse =
  paths['/api/projects/{id}/git/pull']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitPullRequest = NonNullable<
  paths['/api/projects/{id}/git/pull']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdGitTagsResponse =
  paths['/api/projects/{id}/git/tags']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitTagsResponse =
  paths['/api/projects/{id}/git/tags']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitTagsRequest = NonNullable<
  paths['/api/projects/{id}/git/tags']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdGitResetResponse =
  paths['/api/projects/{id}/git/reset']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdGitResetRequest = NonNullable<
  paths['/api/projects/{id}/git/reset']['post']['requestBody']
>['content']['application/json']
export type CreateProjectTabsByTabIdGenerateNameResponse =
  paths['/api/project-tabs/{tabId}/generate-name']['post']['responses']['200']['content']['application/json']
export type CreateProjectTabsByTabIdGenerateNameRequest = NonNullable<
  paths['/api/project-tabs/{tabId}/generate-name']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdAgentFilesDetectResponse =
  paths['/api/projects/{id}/agent-files/detect']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesUpdateResponse =
  paths['/api/projects/{id}/agent-files/update']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesUpdateRequest = NonNullable<
  paths['/api/projects/{id}/agent-files/update']['post']['requestBody']
>['content']['application/json']
export type CreateProjectsByIdAgentFilesRemoveInstructionsResponse =
  paths['/api/projects/{id}/agent-files/remove-instructions']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesRemoveInstructionsRequest = NonNullable<
  paths['/api/projects/{id}/agent-files/remove-instructions']['post']['requestBody']
>['content']['application/json']
export type GetProjectsByIdAgentFilesStatusResponse =
  paths['/api/projects/{id}/agent-files/status']['get']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesCreateResponse =
  paths['/api/projects/{id}/agent-files/create']['post']['responses']['200']['content']['application/json']
export type CreateProjectsByIdAgentFilesCreateRequest = NonNullable<
  paths['/api/projects/{id}/agent-files/create']['post']['requestBody']
>['content']['application/json']

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
 * - Support for all 174 API endpoints
 */
export class TypeSafeApiClient {
  private baseUrl: string
  private timeout: number
  private headers: Record<string, string>

  constructor(config?: { baseUrl?: string; timeout?: number; headers?: Record<string, string> }) {
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

  // ===== GENERATED API METHODS =====

  // Projects Operations
  /**
   * List Projects
   */
  async getProjects(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsResponse> {
    return this.request<GetProjectsResponse>('GET', `/api/projects`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create a new project and sync its files
   */
  async createProject(data: CreateProjectRequest, options?: { timeout?: number }): Promise<CreateProjectResponse> {
    return this.request<CreateProjectResponse>('POST', `/api/projects`, { body: data, timeout: options?.timeout })
  }

  /**
   * List prompts associated with a specific project
   */
  async getProjectsByIdPrompts(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdPromptsResponse> {
    return this.request<GetProjectsByIdPromptsResponse>('GET', this.buildPath(`/api/projects/{id}/prompts`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Get AI-suggested prompts based on user input
   */
  async createProjectsByIdSuggestPrompts(
    id: string | number,
    data: CreateProjectsByIdSuggestPromptsRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdSuggestPromptsResponse> {
    return this.request<CreateProjectsByIdSuggestPromptsResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/suggest-prompts`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * List tickets for a specific project
   */
  async getProjectsByIdTickets(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdTicketsResponse> {
    return this.request<GetProjectsByIdTicketsResponse>('GET', this.buildPath(`/api/projects/{id}/tickets`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Get Project by ID
   */
  async getProject(id: string | number, options?: { timeout?: number }): Promise<GetProjectResponse> {
    return this.request<GetProjectResponse>('GET', this.buildPath(`/api/projects/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Project
   */
  async updateProject(
    id: string | number,
    data: UpdateProjectRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProjectResponse> {
    return this.request<UpdateProjectResponse>('PUT', this.buildPath(`/api/projects/{id}`, { id }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete a project and its associated data
   */
  async deleteProject(id: string | number, options?: { timeout?: number }): Promise<DeleteProjectResponse> {
    return this.request<DeleteProjectResponse>('DELETE', this.buildPath(`/api/projects/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Manually trigger a full file sync for a project
   */
  async createProjectsByIdSync(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdSyncResponse> {
    return this.request<CreateProjectsByIdSyncResponse>('POST', this.buildPath(`/api/projects/{id}/sync`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Trigger a file sync with real-time progress updates via SSE
   */
  async getProjectsByIdSyncStream(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdSyncStreamResponse> {
    return this.request<GetProjectsByIdSyncStreamResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/sync-stream`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get the list of files associated with a project
   */
  async getProjectsByIdFiles(
    id: string | number,
    query?: { includeAllVersions?: any; limit?: any; offset?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdFilesResponse> {
    return this.request<GetProjectsByIdFilesResponse>('GET', this.buildPath(`/api/projects/{id}/files`, { id }), {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Get a combined summary of all files in the project
   */
  async getProjectsByIdSummary(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdSummaryResponse> {
    return this.request<GetProjectsByIdSummaryResponse>('GET', this.buildPath(`/api/projects/{id}/summary`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Summarize specified files in a project
   */
  async createProjectsByIdFilesSummarize(
    id: string | number,
    data: CreateProjectsByIdFilesSummarizeRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdFilesSummarizeResponse> {
    return this.request<CreateProjectsByIdFilesSummarizeResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/files/summarize`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Get comprehensive statistics for a project
   */
  async getProjectsByIdStatistics(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdStatisticsResponse> {
    return this.request<GetProjectsByIdStatisticsResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/statistics`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Refresh project files (sync) optionally limited to a folder
   */
  async createProjectsByIdRefresh(
    id: string | number,
    query?: { folder?: any },
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdRefreshResponse> {
    return this.request<CreateProjectsByIdRefreshResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/refresh`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Update the content of a specific file
   */
  async updateProjectsByIdFilesByFileId(
    id: string | number,
    fileId: string | number,
    data: UpdateProjectsByIdFilesByFileIdRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProjectsByIdFilesByFileIdResponse> {
    return this.request<UpdateProjectsByIdFilesByFileIdResponse>(
      'PUT',
      this.buildPath(`/api/projects/{id}/files/{fileId}`, { id, fileId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Suggest relevant files based on user input and project context
   */
  async createProjectsByIdSuggestFiles(
    id: string | number,
    data: CreateProjectsByIdSuggestFilesRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdSuggestFilesResponse> {
    return this.request<CreateProjectsByIdSuggestFilesResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/suggest-files`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  // Project Operations
  /**
   * Get Project by ID
   */
  async getProjectProject(
    projectId: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectProjectResponse> {
    return this.request<GetProjectProjectResponse>('GET', this.buildPath(`/api/projects/{projectId}`, { projectId }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Project
   */
  async updateProjectProject(
    projectId: string | number,
    data: UpdateProjectProjectRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProjectProjectResponse> {
    return this.request<UpdateProjectProjectResponse>(
      'PUT',
      this.buildPath(`/api/projects/{projectId}`, { projectId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete Project
   */
  async deleteProjectProject(
    projectId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteProjectProjectResponse> {
    return this.request<DeleteProjectProjectResponse>(
      'DELETE',
      this.buildPath(`/api/projects/{projectId}`, { projectId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get Queue for Project
   */
  async listProjectsByProjectIdQueues(
    projectId: string | number,
    options?: { timeout?: number }
  ): Promise<ListProjectsByProjectIdQueuesResponse> {
    return this.request<ListProjectsByProjectIdQueuesResponse>(
      'GET',
      this.buildPath(`/api/projects/{projectId}/queues`, { projectId }),
      { timeout: options?.timeout }
    )
  }

  // Tickets Operations
  /**
   * List Tickets
   */
  async getTickets(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetTicketsResponse> {
    return this.request<GetTicketsResponse>('GET', `/api/tickets`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create Ticket
   */
  async createTicket(data: CreateTicketRequest, options?: { timeout?: number }): Promise<CreateTicketResponse> {
    return this.request<CreateTicketResponse>('POST', `/api/tickets`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get Ticket by ID
   */
  async getTicket(id: string | number, options?: { timeout?: number }): Promise<GetTicketResponse> {
    return this.request<GetTicketResponse>('GET', this.buildPath(`/api/tickets/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Ticket
   */
  async updateTicket(
    id: string | number,
    data: UpdateTicketRequest,
    options?: { timeout?: number }
  ): Promise<UpdateTicketResponse> {
    return this.request<UpdateTicketResponse>('PUT', this.buildPath(`/api/tickets/{id}`, { id }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete Ticket
   */
  async deleteTicket(id: string | number, options?: { timeout?: number }): Promise<DeleteTicketResponse> {
    return this.request<DeleteTicketResponse>('DELETE', this.buildPath(`/api/tickets/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Get tasks for a specific ticket
   */
  async listTicketsByTicketIdTasks(
    ticketId: string | number,
    options?: { timeout?: number }
  ): Promise<ListTicketsByTicketIdTasksResponse> {
    return this.request<ListTicketsByTicketIdTasksResponse>(
      'GET',
      this.buildPath(`/api/tickets/{ticketId}/tasks`, { ticketId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Create a new task for a ticket
   */
  async createTicketsByTicketIdTasks(
    ticketId: string | number,
    data: CreateTicketsByTicketIdTasksRequest,
    options?: { timeout?: number }
  ): Promise<CreateTicketsByTicketIdTasksResponse> {
    return this.request<CreateTicketsByTicketIdTasksResponse>(
      'POST',
      this.buildPath(`/api/tickets/{ticketId}/tasks`, { ticketId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Get AI-suggested tasks for a ticket
   */
  async createTicketsByTicketIdSuggestTasks(
    ticketId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateTicketsByTicketIdSuggestTasksResponse> {
    return this.request<CreateTicketsByTicketIdSuggestTasksResponse>(
      'POST',
      this.buildPath(`/api/tickets/{ticketId}/suggest-tasks`, { ticketId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Auto-generate tasks from overview
   */
  async createTicketsByTicketIdAutoGenerateTasks(
    ticketId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateTicketsByTicketIdAutoGenerateTasksResponse> {
    return this.request<CreateTicketsByTicketIdAutoGenerateTasksResponse>(
      'POST',
      this.buildPath(`/api/tickets/{ticketId}/auto-generate-tasks`, { ticketId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get AI-suggested files for a ticket
   */
  async createTicketsByTicketIdSuggestFiles(
    ticketId: string | number,
    data: CreateTicketsByTicketIdSuggestFilesRequest,
    options?: { timeout?: number }
  ): Promise<CreateTicketsByTicketIdSuggestFilesResponse> {
    return this.request<CreateTicketsByTicketIdSuggestFilesResponse>(
      'POST',
      this.buildPath(`/api/tickets/{ticketId}/suggest-files`, { ticketId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Mark a ticket as completed
   */
  async createTicketsByTicketIdComplete(
    ticketId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateTicketsByTicketIdCompleteResponse> {
    return this.request<CreateTicketsByTicketIdCompleteResponse>(
      'POST',
      this.buildPath(`/api/tickets/{ticketId}/complete`, { ticketId }),
      { timeout: options?.timeout }
    )
  }

  // Ticket Operations
  /**
   * Get Ticket by ID
   */
  async getTicketTicket(ticketId: string | number, options?: { timeout?: number }): Promise<GetTicketTicketResponse> {
    return this.request<GetTicketTicketResponse>('GET', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Ticket
   */
  async updateTicketTicket(
    ticketId: string | number,
    data: UpdateTicketTicketRequest,
    options?: { timeout?: number }
  ): Promise<UpdateTicketTicketResponse> {
    return this.request<UpdateTicketTicketResponse>('PUT', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete Ticket
   */
  async deleteTicketTicket(
    ticketId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteTicketTicketResponse> {
    return this.request<DeleteTicketTicketResponse>('DELETE', this.buildPath(`/api/tickets/{ticketId}`, { ticketId }), {
      timeout: options?.timeout
    })
  }

  // TicketTask Operations
  /**
   * List tickettasks
   */
  async getTickettasks(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetTickettasksResponse> {
    return this.request<GetTickettasksResponse>('GET', `/api/tickettasks`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create TicketTask
   */
  async createTickettask(
    data: CreateTickettaskRequest,
    options?: { timeout?: number }
  ): Promise<CreateTickettaskResponse> {
    return this.request<CreateTickettaskResponse>('POST', `/api/tickettasks`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get TicketTask by ID
   */
  async getTickettask(tickettaskId: string | number, options?: { timeout?: number }): Promise<GetTickettaskResponse> {
    return this.request<GetTickettaskResponse>(
      'GET',
      this.buildPath(`/api/tickettasks/{tickettaskId}`, { tickettaskId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Update TicketTask
   */
  async updateTickettask(
    tickettaskId: string | number,
    data: UpdateTickettaskRequest,
    options?: { timeout?: number }
  ): Promise<UpdateTickettaskResponse> {
    return this.request<UpdateTickettaskResponse>(
      'PUT',
      this.buildPath(`/api/tickettasks/{tickettaskId}`, { tickettaskId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete TicketTask
   */
  async deleteTickettask(
    tickettaskId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteTickettaskResponse> {
    return this.request<DeleteTickettaskResponse>(
      'DELETE',
      this.buildPath(`/api/tickettasks/{tickettaskId}`, { tickettaskId }),
      { timeout: options?.timeout }
    )
  }

  // Chats Operations
  /**
   * List Chats
   */
  async getChats(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetChatsResponse> {
    return this.request<GetChatsResponse>('GET', `/api/chats`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create Chat
   */
  async createChat(data: CreateChatRequest, options?: { timeout?: number }): Promise<CreateChatResponse> {
    return this.request<CreateChatResponse>('POST', `/api/chats`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get messages for a specific chat
   */
  async listChatsByChatIdMessages(
    chatId: string | number,
    query?: { limit?: any; offset?: any },
    options?: { timeout?: number }
  ): Promise<ListChatsByChatIdMessagesResponse> {
    return this.request<ListChatsByChatIdMessagesResponse>(
      'GET',
      this.buildPath(`/api/chats/{chatId}/messages`, { chatId }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Get Chat by ID
   */
  async getChat(id: string | number, options?: { timeout?: number }): Promise<GetChatResponse> {
    return this.request<GetChatResponse>('GET', this.buildPath(`/api/chats/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Chat
   */
  async updateChat(
    id: string | number,
    data: UpdateChatRequest,
    options?: { timeout?: number }
  ): Promise<UpdateChatResponse> {
    return this.request<UpdateChatResponse>('PUT', this.buildPath(`/api/chats/{id}`, { id }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete Chat
   */
  async deleteChat(id: string | number, options?: { timeout?: number }): Promise<DeleteChatResponse> {
    return this.request<DeleteChatResponse>('DELETE', this.buildPath(`/api/chats/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Fork a chat to create a new branch
   */
  async createChatsByChatIdFork(
    chatId: string | number,
    data: CreateChatsByChatIdForkRequest,
    options?: { timeout?: number }
  ): Promise<CreateChatsByChatIdForkResponse> {
    return this.request<CreateChatsByChatIdForkResponse>(
      'POST',
      this.buildPath(`/api/chats/{chatId}/fork`, { chatId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Fork a chat from a specific message point
   */
  async createChatsByChatIdMessagesByMessageIdFork(
    chatId: string | number,
    messageId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateChatsByChatIdMessagesByMessageIdForkResponse> {
    return this.request<CreateChatsByChatIdMessagesByMessageIdForkResponse>(
      'POST',
      this.buildPath(`/api/chats/{chatId}/messages/{messageId}/fork`, { chatId, messageId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Delete a message from a chat
   */
  async deleteChatsByChatIdMessagesByMessageId(
    chatId: string | number,
    messageId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteChatsByChatIdMessagesByMessageIdResponse> {
    return this.request<DeleteChatsByChatIdMessagesByMessageIdResponse>(
      'DELETE',
      this.buildPath(`/api/chats/{chatId}/messages/{messageId}`, { chatId, messageId }),
      { timeout: options?.timeout }
    )
  }

  // Chat Operations
  /**
   * Get Chat by ID
   */
  async getChatChat(chatId: string | number, options?: { timeout?: number }): Promise<GetChatChatResponse> {
    return this.request<GetChatChatResponse>('GET', this.buildPath(`/api/chats/{chatId}`, { chatId }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Chat
   */
  async updateChatChat(
    chatId: string | number,
    data: UpdateChatChatRequest,
    options?: { timeout?: number }
  ): Promise<UpdateChatChatResponse> {
    return this.request<UpdateChatChatResponse>('PUT', this.buildPath(`/api/chats/{chatId}`, { chatId }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete Chat
   */
  async deleteChatChat(chatId: string | number, options?: { timeout?: number }): Promise<DeleteChatChatResponse> {
    return this.request<DeleteChatChatResponse>('DELETE', this.buildPath(`/api/chats/{chatId}`, { chatId }), {
      timeout: options?.timeout
    })
  }

  /**
   * Add message
   */
  async createChatsByChatIdMessages(
    chatId: string | number,
    data: CreateChatsByChatIdMessagesRequest,
    options?: { timeout?: number }
  ): Promise<CreateChatsByChatIdMessagesResponse> {
    return this.request<CreateChatsByChatIdMessagesResponse>(
      'POST',
      this.buildPath(`/api/chats/{chatId}/messages`, { chatId }),
      { body: data, timeout: options?.timeout }
    )
  }

  // ChatMessage Operations
  /**
   * List chatmessages
   */
  async getChatmessages(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetChatmessagesResponse> {
    return this.request<GetChatmessagesResponse>('GET', `/api/chatmessages`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Create ChatMessage
   */
  async createChatmessage(
    data: CreateChatmessageRequest,
    options?: { timeout?: number }
  ): Promise<CreateChatmessageResponse> {
    return this.request<CreateChatmessageResponse>('POST', `/api/chatmessages`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get ChatMessage by ID
   */
  async getChatmessage(
    chatmessageId: string | number,
    options?: { timeout?: number }
  ): Promise<GetChatmessageResponse> {
    return this.request<GetChatmessageResponse>(
      'GET',
      this.buildPath(`/api/chatmessages/{chatmessageId}`, { chatmessageId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Update ChatMessage
   */
  async updateChatmessage(
    chatmessageId: string | number,
    data: UpdateChatmessageRequest,
    options?: { timeout?: number }
  ): Promise<UpdateChatmessageResponse> {
    return this.request<UpdateChatmessageResponse>(
      'PUT',
      this.buildPath(`/api/chatmessages/{chatmessageId}`, { chatmessageId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete ChatMessage
   */
  async deleteChatmessage(
    chatmessageId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteChatmessageResponse> {
    return this.request<DeleteChatmessageResponse>(
      'DELETE',
      this.buildPath(`/api/chatmessages/{chatmessageId}`, { chatmessageId }),
      { timeout: options?.timeout }
    )
  }

  // Prompts Operations
  /**
   * List Prompts
   */
  async getPrompts(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetPromptsResponse> {
    return this.request<GetPromptsResponse>('GET', `/api/prompts`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create Prompt
   */
  async createPrompt(data: CreatePromptRequest, options?: { timeout?: number }): Promise<CreatePromptResponse> {
    return this.request<CreatePromptResponse>('POST', `/api/prompts`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get Prompt by ID
   */
  async getPrompt(id: string | number, options?: { timeout?: number }): Promise<GetPromptResponse> {
    return this.request<GetPromptResponse>('GET', this.buildPath(`/api/prompts/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Prompt
   */
  async updatePrompt(
    id: string | number,
    data: UpdatePromptRequest,
    options?: { timeout?: number }
  ): Promise<UpdatePromptResponse> {
    return this.request<UpdatePromptResponse>('PUT', this.buildPath(`/api/prompts/{id}`, { id }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Update Prompt (PATCH alias)
   */
  async updatePromptPrompts(
    id: string | number,
    data: UpdatePromptPromptsRequest,
    options?: { timeout?: number }
  ): Promise<UpdatePromptPromptsResponse> {
    return this.request<UpdatePromptPromptsResponse>('PATCH', this.buildPath(`/api/prompts/{id}`, { id }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete Prompt
   */
  async deletePrompt(id: string | number, options?: { timeout?: number }): Promise<DeletePromptResponse> {
    return this.request<DeletePromptResponse>('DELETE', this.buildPath(`/api/prompts/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Export a single prompt as markdown
   */
  async listPromptsByPromptIdExport(
    promptId: string | number,
    options?: { timeout?: number }
  ): Promise<ListPromptsByPromptIdExportResponse> {
    return this.request<ListPromptsByPromptIdExportResponse>(
      'GET',
      this.buildPath(`/api/prompts/{promptId}/export`, { promptId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Export multiple prompts as markdown
   */
  async createPromptsExportBatch(
    data: CreatePromptsExportBatchRequest,
    options?: { timeout?: number }
  ): Promise<CreatePromptsExportBatchResponse> {
    return this.request<CreatePromptsExportBatchResponse>('POST', `/api/prompts/export-batch`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Validate markdown content for prompt import
   */
  async createPromptsValidateMarkdown(
    data: CreatePromptsValidateMarkdownRequest,
    options?: { timeout?: number }
  ): Promise<CreatePromptsValidateMarkdownResponse> {
    return this.request<CreatePromptsValidateMarkdownResponse>('POST', `/api/prompts/validate-markdown`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // Prompt Operations
  /**
   * Get Prompt by ID
   */
  async getPromptPrompt(promptId: string | number, options?: { timeout?: number }): Promise<GetPromptPromptResponse> {
    return this.request<GetPromptPromptResponse>('GET', this.buildPath(`/api/prompts/{promptId}`, { promptId }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Prompt
   */
  async updatePromptPrompt(
    promptId: string | number,
    data: UpdatePromptPromptRequest,
    options?: { timeout?: number }
  ): Promise<UpdatePromptPromptResponse> {
    return this.request<UpdatePromptPromptResponse>('PUT', this.buildPath(`/api/prompts/{promptId}`, { promptId }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete Prompt
   */
  async deletePromptPrompt(
    promptId: string | number,
    options?: { timeout?: number }
  ): Promise<DeletePromptPromptResponse> {
    return this.request<DeletePromptPromptResponse>('DELETE', this.buildPath(`/api/prompts/{promptId}`, { promptId }), {
      timeout: options?.timeout
    })
  }

  // ProviderKey Operations
  /**
   * List providerkeies
   */
  async getProviderkeies(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetProviderkeiesResponse> {
    return this.request<GetProviderkeiesResponse>('GET', `/api/providerkeies`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Create ProviderKey
   */
  async createProviderkeie(
    data: CreateProviderkeieRequest,
    options?: { timeout?: number }
  ): Promise<CreateProviderkeieResponse> {
    return this.request<CreateProviderkeieResponse>('POST', `/api/providerkeies`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get ProviderKey by ID
   */
  async getProviderkeie(
    providerkeyId: string | number,
    options?: { timeout?: number }
  ): Promise<GetProviderkeieResponse> {
    return this.request<GetProviderkeieResponse>(
      'GET',
      this.buildPath(`/api/providerkeies/{providerkeyId}`, { providerkeyId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Update ProviderKey
   */
  async updateProviderkeie(
    providerkeyId: string | number,
    data: UpdateProviderkeieRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProviderkeieResponse> {
    return this.request<UpdateProviderkeieResponse>(
      'PUT',
      this.buildPath(`/api/providerkeies/{providerkeyId}`, { providerkeyId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete ProviderKey
   */
  async deleteProviderkeie(
    providerkeyId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteProviderkeieResponse> {
    return this.request<DeleteProviderkeieResponse>(
      'DELETE',
      this.buildPath(`/api/providerkeies/{providerkeyId}`, { providerkeyId }),
      { timeout: options?.timeout }
    )
  }

  // File Operations
  /**
   * List files
   */
  async getFiles(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetFilesResponse> {
    return this.request<GetFilesResponse>('GET', `/api/files`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create File
   */
  async createFile(data: CreateFileRequest, options?: { timeout?: number }): Promise<CreateFileResponse> {
    return this.request<CreateFileResponse>('POST', `/api/files`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get File by ID
   */
  async getFile(fileId: string | number, options?: { timeout?: number }): Promise<GetFileResponse> {
    return this.request<GetFileResponse>('GET', this.buildPath(`/api/files/{fileId}`, { fileId }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update File
   */
  async updateFile(
    fileId: string | number,
    data: UpdateFileRequest,
    options?: { timeout?: number }
  ): Promise<UpdateFileResponse> {
    return this.request<UpdateFileResponse>('PUT', this.buildPath(`/api/files/{fileId}`, { fileId }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete File
   */
  async deleteFile(fileId: string | number, options?: { timeout?: number }): Promise<DeleteFileResponse> {
    return this.request<DeleteFileResponse>('DELETE', this.buildPath(`/api/files/{fileId}`, { fileId }), {
      timeout: options?.timeout
    })
  }

  // SelectedFile Operations
  /**
   * List selectedfiles
   */
  async getSelectedfiles(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetSelectedfilesResponse> {
    return this.request<GetSelectedfilesResponse>('GET', `/api/selectedfiles`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Create SelectedFile
   */
  async createSelectedfile(
    data: CreateSelectedfileRequest,
    options?: { timeout?: number }
  ): Promise<CreateSelectedfileResponse> {
    return this.request<CreateSelectedfileResponse>('POST', `/api/selectedfiles`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get SelectedFile by ID
   */
  async getSelectedfile(
    selectedfileId: string | number,
    options?: { timeout?: number }
  ): Promise<GetSelectedfileResponse> {
    return this.request<GetSelectedfileResponse>(
      'GET',
      this.buildPath(`/api/selectedfiles/{selectedfileId}`, { selectedfileId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Update SelectedFile
   */
  async updateSelectedfile(
    selectedfileId: string | number,
    data: UpdateSelectedfileRequest,
    options?: { timeout?: number }
  ): Promise<UpdateSelectedfileResponse> {
    return this.request<UpdateSelectedfileResponse>(
      'PUT',
      this.buildPath(`/api/selectedfiles/{selectedfileId}`, { selectedfileId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete SelectedFile
   */
  async deleteSelectedfile(
    selectedfileId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteSelectedfileResponse> {
    return this.request<DeleteSelectedfileResponse>(
      'DELETE',
      this.buildPath(`/api/selectedfiles/{selectedfileId}`, { selectedfileId }),
      { timeout: options?.timeout }
    )
  }

  // ActiveTab Operations
  /**
   * List activetabs
   */
  async getActivetabs(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetActivetabsResponse> {
    return this.request<GetActivetabsResponse>('GET', `/api/activetabs`, { params: query, timeout: options?.timeout })
  }

  /**
   * Create ActiveTab
   */
  async createActivetab(
    data: CreateActivetabRequest,
    options?: { timeout?: number }
  ): Promise<CreateActivetabResponse> {
    return this.request<CreateActivetabResponse>('POST', `/api/activetabs`, { body: data, timeout: options?.timeout })
  }

  /**
   * Get ActiveTab by ID
   */
  async getActivetab(activetabId: string | number, options?: { timeout?: number }): Promise<GetActivetabResponse> {
    return this.request<GetActivetabResponse>('GET', this.buildPath(`/api/activetabs/{activetabId}`, { activetabId }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update ActiveTab
   */
  async updateActivetab(
    activetabId: string | number,
    data: UpdateActivetabRequest,
    options?: { timeout?: number }
  ): Promise<UpdateActivetabResponse> {
    return this.request<UpdateActivetabResponse>(
      'PUT',
      this.buildPath(`/api/activetabs/{activetabId}`, { activetabId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete ActiveTab
   */
  async deleteActivetab(
    activetabId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteActivetabResponse> {
    return this.request<DeleteActivetabResponse>(
      'DELETE',
      this.buildPath(`/api/activetabs/{activetabId}`, { activetabId }),
      { timeout: options?.timeout }
    )
  }

  // Providers Operations
  /**
   * List Provider Keys
   */
  async getProviderKeys(
    query?: { page?: any; limit?: any; sort?: any; order?: any },
    options?: { timeout?: number }
  ): Promise<GetProviderKeysResponse> {
    return this.request<GetProviderKeysResponse>('GET', `/api/provider-keys`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Create Provider Key
   */
  async createProviderKey(
    data: CreateProviderKeyRequest,
    options?: { timeout?: number }
  ): Promise<CreateProviderKeyResponse> {
    return this.request<CreateProviderKeyResponse>('POST', `/api/provider-keys`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get Provider Key by ID
   */
  async getProviderKey(id: string | number, options?: { timeout?: number }): Promise<GetProviderKeyResponse> {
    return this.request<GetProviderKeyResponse>('GET', this.buildPath(`/api/provider-keys/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Update Provider Key
   */
  async updateProviderKey(
    id: string | number,
    data: UpdateProviderKeyRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProviderKeyResponse> {
    return this.request<UpdateProviderKeyResponse>('PUT', this.buildPath(`/api/provider-keys/{id}`, { id }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete Provider Key
   */
  async deleteProviderKey(id: string | number, options?: { timeout?: number }): Promise<DeleteProviderKeyResponse> {
    return this.request<DeleteProviderKeyResponse>('DELETE', this.buildPath(`/api/provider-keys/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Test provider key connection
   */
  async createProviderKeysByProviderKeyIdTest(
    providerKeyId: string | number,
    data: CreateProviderKeysByProviderKeyIdTestRequest,
    options?: { timeout?: number }
  ): Promise<CreateProviderKeysByProviderKeyIdTestResponse> {
    return this.request<CreateProviderKeysByProviderKeyIdTestResponse>(
      'POST',
      this.buildPath(`/api/provider-keys/{providerKeyId}/test`, { providerKeyId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Get available provider types
   */
  async listProviderKeysTypes(options?: { timeout?: number }): Promise<ListProviderKeysTypesResponse> {
    return this.request<ListProviderKeysTypesResponse>('GET', `/api/provider-keys/types`, { timeout: options?.timeout })
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
   * Get a specific provider key by ID (including secret)
   */
  async getKey(id: string | number, options?: { timeout?: number }): Promise<GetKeyResponse> {
    return this.request<GetKeyResponse>('GET', this.buildPath(`/api/keys/{id}`, { id }), { timeout: options?.timeout })
  }

  /**
   * Update a provider key's details
   */
  async updateKey(
    id: string | number,
    data: UpdateKeyRequest,
    options?: { timeout?: number }
  ): Promise<UpdateKeyResponse> {
    return this.request<UpdateKeyResponse>('PATCH', this.buildPath(`/api/keys/{id}`, { id }), {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Delete a provider key
   */
  async deleteKey(id: string | number, options?: { timeout?: number }): Promise<DeleteKeyResponse> {
    return this.request<DeleteKeyResponse>('DELETE', this.buildPath(`/api/keys/{id}`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Validate a custom OpenAI-compatible provider
   */
  async createKeysValidateCustom(
    data: CreateKeysValidateCustomRequest,
    options?: { timeout?: number }
  ): Promise<CreateKeysValidateCustomResponse> {
    return this.request<CreateKeysValidateCustomResponse>('POST', `/api/keys/validate-custom`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // Provider Testing Operations
  /**
   * Test a single provider connection
   */
  async createProvidersTest(
    data: CreateProvidersTestRequest,
    options?: { timeout?: number }
  ): Promise<CreateProvidersTestResponse> {
    return this.request<CreateProvidersTestResponse>('POST', `/api/providers/test`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Test multiple providers at once
   */
  async createProvidersBatchTest(
    data: CreateProvidersBatchTestRequest,
    options?: { timeout?: number }
  ): Promise<CreateProvidersBatchTestResponse> {
    return this.request<CreateProvidersBatchTestResponse>('POST', `/api/providers/batch-test`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get health status of all configured providers
   */
  async listProvidersHealth(
    query?: { refresh?: any },
    options?: { timeout?: number }
  ): Promise<ListProvidersHealthResponse> {
    return this.request<ListProvidersHealthResponse>('GET', `/api/providers/health`, {
      params: query,
      timeout: options?.timeout
    })
  }

  // Provider Settings Operations
  /**
   * Update provider settings (URLs for local providers)
   */
  async updateProvidersSettings(
    data: UpdateProvidersSettingsRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProvidersSettingsResponse> {
    return this.request<UpdateProvidersSettingsResponse>('PUT', `/api/providers/settings`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // Active Tab Operations
  /**
   * Get the currently active tab
   */
  async getActiveTab(
    query?: { projectId?: any; clientId?: any },
    options?: { timeout?: number }
  ): Promise<GetActiveTabResponse> {
    return this.request<GetActiveTabResponse>('GET', `/api/active-tab`, { params: query, timeout: options?.timeout })
  }

  /**
   * Set the active tab
   */
  async createActiveTa(data: CreateActiveTaRequest, options?: { timeout?: number }): Promise<CreateActiveTaResponse> {
    return this.request<CreateActiveTaResponse>('POST', `/api/active-tab`, { body: data, timeout: options?.timeout })
  }

  /**
   * Clear the active tab
   */
  async deleteActiveTa(
    query?: { projectId?: any; clientId?: any },
    options?: { timeout?: number }
  ): Promise<DeleteActiveTaResponse> {
    return this.request<DeleteActiveTaResponse>('DELETE', `/api/active-tab`, {
      params: query,
      timeout: options?.timeout
    })
  }

  // MCP Global Operations
  /**
   * Get global MCP configuration
   */
  async listMcpGlobalConfig(options?: { timeout?: number }): Promise<ListMcpGlobalConfigResponse> {
    return this.request<ListMcpGlobalConfigResponse>('GET', `/api/mcp/global/config`, { timeout: options?.timeout })
  }

  /**
   * Update global MCP configuration
   */
  async createMcpGlobalConfig(
    data: CreateMcpGlobalConfigRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpGlobalConfigResponse> {
    return this.request<CreateMcpGlobalConfigResponse>('POST', `/api/mcp/global/config`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get all global MCP installations
   */
  async listMcpGlobalInstallations(options?: { timeout?: number }): Promise<ListMcpGlobalInstallationsResponse> {
    return this.request<ListMcpGlobalInstallationsResponse>('GET', `/api/mcp/global/installations`, {
      timeout: options?.timeout
    })
  }

  /**
   * Install Promptliano MCP globally for a tool
   */
  async createMcpGlobalInstall(
    data: CreateMcpGlobalInstallRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpGlobalInstallResponse> {
    return this.request<CreateMcpGlobalInstallResponse>('POST', `/api/mcp/global/install`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Uninstall global Promptliano MCP for a tool
   */
  async createMcpGlobalUninstall(
    data: CreateMcpGlobalUninstallRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpGlobalUninstallResponse> {
    return this.request<CreateMcpGlobalUninstallResponse>('POST', `/api/mcp/global/uninstall`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get global MCP installation status
   */
  async listMcpGlobalStatus(options?: { timeout?: number }): Promise<ListMcpGlobalStatusResponse> {
    return this.request<ListMcpGlobalStatusResponse>('GET', `/api/mcp/global/status`, { timeout: options?.timeout })
  }

  // MCP Project Operations
  /**
   * Get project MCP configuration locations
   */
  async getProjectsByIdMcpConfigLocations(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpConfigLocationsResponse> {
    return this.request<GetProjectsByIdMcpConfigLocationsResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/config/locations`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get merged project MCP configuration
   */
  async getProjectsByIdMcpConfigMerged(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpConfigMergedResponse> {
    return this.request<GetProjectsByIdMcpConfigMergedResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/config/merged`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get expanded project MCP configuration (variables resolved)
   */
  async getProjectsByIdMcpConfigExpanded(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpConfigExpandedResponse> {
    return this.request<GetProjectsByIdMcpConfigExpandedResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/config/expanded`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get project-specific MCP configuration
   */
  async getProjectsByIdMcpConfig(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpConfigResponse> {
    return this.request<GetProjectsByIdMcpConfigResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/config`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Update project-specific MCP configuration
   */
  async updateProjectsByIdMcpConfig(
    id: string | number,
    data: UpdateProjectsByIdMcpConfigRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProjectsByIdMcpConfigResponse> {
    return this.request<UpdateProjectsByIdMcpConfigResponse>(
      'PUT',
      this.buildPath(`/api/projects/{id}/mcp/config`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete project-specific MCP configuration
   */
  async deleteProjectsByIdMcpConfig(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteProjectsByIdMcpConfigResponse> {
    return this.request<DeleteProjectsByIdMcpConfigResponse>(
      'DELETE',
      this.buildPath(`/api/projects/{id}/mcp/config`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Save project MCP configuration to a specific location
   */
  async createProjectsByIdMcpConfigSaveToLocation(
    id: string | number,
    data: CreateProjectsByIdMcpConfigSaveToLocationRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdMcpConfigSaveToLocationResponse> {
    return this.request<CreateProjectsByIdMcpConfigSaveToLocationResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/mcp/config/save-to-location`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Get default project MCP configuration for a given location
   */
  async getProjectsByIdMcpConfigDefaultForLocation(
    id: string | number,
    query?: { location?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpConfigDefaultForLocationResponse> {
    return this.request<GetProjectsByIdMcpConfigDefaultForLocationResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/config/default-for-location`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  // MCP Installation Operations
  /**
   * POST /api/projects/{id}/mcp/config
   */
  async createProjectsByIdMcpConfig(
    id: string | number,
    data: CreateProjectsByIdMcpConfigRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdMcpConfigResponse> {
    return this.request<CreateProjectsByIdMcpConfigResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/mcp/config`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * GET /api/mcp/installation/detect
   */
  async listMcpInstallationDetect(options?: { timeout?: number }): Promise<ListMcpInstallationDetectResponse> {
    return this.request<ListMcpInstallationDetectResponse>('GET', `/api/mcp/installation/detect`, {
      timeout: options?.timeout
    })
  }

  /**
   * GET /api/projects/{id}/mcp/installation/status
   */
  async getProjectsByIdMcpInstallationStatus(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpInstallationStatusResponse> {
    return this.request<GetProjectsByIdMcpInstallationStatusResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/installation/status`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/mcp/installation/install
   */
  async createProjectsByIdMcpInstallationInstall(
    id: string | number,
    data: CreateProjectsByIdMcpInstallationInstallRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdMcpInstallationInstallResponse> {
    return this.request<CreateProjectsByIdMcpInstallationInstallResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/mcp/installation/install`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/mcp/installation/uninstall
   */
  async createProjectsByIdMcpInstallationUninstall(
    id: string | number,
    data: CreateProjectsByIdMcpInstallationUninstallRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdMcpInstallationUninstallResponse> {
    return this.request<CreateProjectsByIdMcpInstallationUninstallResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/mcp/installation/uninstall`, { id }),
      { body: data, timeout: options?.timeout }
    )
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
  async createProjectsByIdMcpInstallationBatchInstall(
    id: string | number,
    data: CreateProjectsByIdMcpInstallationBatchInstallRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdMcpInstallationBatchInstallResponse> {
    return this.request<CreateProjectsByIdMcpInstallationBatchInstallResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/mcp/installation/batch-install`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/mcp/install-project-config
   */
  async createProjectsByIdMcpInstallProjectConfig(
    id: string | number,
    data: CreateProjectsByIdMcpInstallProjectConfigRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdMcpInstallProjectConfigResponse> {
    return this.request<CreateProjectsByIdMcpInstallProjectConfigResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/mcp/install-project-config`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  // Flow Operations
  /**
   * Get complete flow data for a project
   */
  async getProjectsByIdFlow(id: string | number, options?: { timeout?: number }): Promise<GetProjectsByIdFlowResponse> {
    return this.request<GetProjectsByIdFlowResponse>('GET', this.buildPath(`/api/projects/{id}/flow`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * Get all flow items as a flat list
   */
  async getProjectsByIdFlowItems(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdFlowItemsResponse> {
    return this.request<GetProjectsByIdFlowItemsResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/flow/items`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get all unqueued tickets and tasks
   */
  async getProjectsByIdFlowUnqueued(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdFlowUnqueuedResponse> {
    return this.request<GetProjectsByIdFlowUnqueuedResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/flow/unqueued`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Create a queue (Flow)
   */
  async createFlowQueues(
    data: CreateFlowQueuesRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowQueuesResponse> {
    return this.request<CreateFlowQueuesResponse>('POST', `/api/flow/queues`, { body: data, timeout: options?.timeout })
  }

  /**
   * List queues for a project (Flow)
   */
  async getProjectsByIdFlowQueues(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdFlowQueuesResponse> {
    return this.request<GetProjectsByIdFlowQueuesResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/flow/queues`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get queues with stats (Flow)
   */
  async getProjectsByIdFlowQueuesWithStats(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdFlowQueuesWithStatsResponse> {
    return this.request<GetProjectsByIdFlowQueuesWithStatsResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/flow/queues-with-stats`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get items in a queue (Flow)
   */
  async listFlowQueuesByQueueIdItems(
    queueId: string | number,
    query?: { status?: any },
    options?: { timeout?: number }
  ): Promise<ListFlowQueuesByQueueIdItemsResponse> {
    return this.request<ListFlowQueuesByQueueIdItemsResponse>(
      'GET',
      this.buildPath(`/api/flow/queues/{queueId}/items`, { queueId }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Get queue statistics (Flow)
   */
  async listFlowQueuesByQueueIdStats(
    queueId: string | number,
    options?: { timeout?: number }
  ): Promise<ListFlowQueuesByQueueIdStatsResponse> {
    return this.request<ListFlowQueuesByQueueIdStatsResponse>(
      'GET',
      this.buildPath(`/api/flow/queues/{queueId}/stats`, { queueId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Update queue (Flow)
   */
  async updateFlowQueuesByQueueId(
    queueId: string | number,
    data: UpdateFlowQueuesByQueueIdRequest,
    options?: { timeout?: number }
  ): Promise<UpdateFlowQueuesByQueueIdResponse> {
    return this.request<UpdateFlowQueuesByQueueIdResponse>(
      'PATCH',
      this.buildPath(`/api/flow/queues/{queueId}`, { queueId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete queue (Flow)
   */
  async deleteFlowQueuesByQueueId(
    queueId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteFlowQueuesByQueueIdResponse> {
    return this.request<DeleteFlowQueuesByQueueIdResponse>(
      'DELETE',
      this.buildPath(`/api/flow/queues/{queueId}`, { queueId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Enqueue a ticket to a queue
   */
  async createFlowTicketsByTicketIdEnqueue(
    ticketId: string | number,
    data: CreateFlowTicketsByTicketIdEnqueueRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowTicketsByTicketIdEnqueueResponse> {
    return this.request<CreateFlowTicketsByTicketIdEnqueueResponse>(
      'POST',
      this.buildPath(`/api/flow/tickets/{ticketId}/enqueue`, { ticketId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Enqueue a task to a queue
   */
  async createFlowTasksByTaskIdEnqueue(
    taskId: string | number,
    data: CreateFlowTasksByTaskIdEnqueueRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowTasksByTaskIdEnqueueResponse> {
    return this.request<CreateFlowTasksByTaskIdEnqueueResponse>(
      'POST',
      this.buildPath(`/api/flow/tasks/{taskId}/enqueue`, { taskId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Remove a ticket from its queue
   */
  async createFlowTicketsByTicketIdDequeue(
    ticketId: string | number,
    query?: { includeTasks?: any },
    options?: { timeout?: number }
  ): Promise<CreateFlowTicketsByTicketIdDequeueResponse> {
    return this.request<CreateFlowTicketsByTicketIdDequeueResponse>(
      'POST',
      this.buildPath(`/api/flow/tickets/{ticketId}/dequeue`, { ticketId }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Remove a task from its queue
   */
  async createFlowTasksByTaskIdDequeue(
    taskId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateFlowTasksByTaskIdDequeueResponse> {
    return this.request<CreateFlowTasksByTaskIdDequeueResponse>(
      'POST',
      this.buildPath(`/api/flow/tasks/{taskId}/dequeue`, { taskId }),
      { timeout: options?.timeout }
    )
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
  async createFlowReorder(
    data: CreateFlowReorderRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowReorderResponse> {
    return this.request<CreateFlowReorderResponse>('POST', `/api/flow/reorder`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Mark an item as being processed
   */
  async createFlowProcessStart(
    data: CreateFlowProcessStartRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowProcessStartResponse> {
    return this.request<CreateFlowProcessStartResponse>('POST', `/api/flow/process/start`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Mark an item as completed
   */
  async createFlowProcessComplete(
    data: CreateFlowProcessCompleteRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowProcessCompleteResponse> {
    return this.request<CreateFlowProcessCompleteResponse>('POST', `/api/flow/process/complete`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Mark an item as failed
   */
  async createFlowProcessFail(
    data: CreateFlowProcessFailRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowProcessFailResponse> {
    return this.request<CreateFlowProcessFailResponse>('POST', `/api/flow/process/fail`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Move multiple items to a queue or unqueued
   */
  async createFlowBulkMove(
    data: CreateFlowBulkMoveRequest,
    options?: { timeout?: number }
  ): Promise<CreateFlowBulkMoveResponse> {
    return this.request<CreateFlowBulkMoveResponse>('POST', `/api/flow/bulk-move`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // AI Operations
  /**
   * Chat completion (Vercel AI SDK compatible, streaming)
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
  async getModels(
    query?: { provider?: any; includeDisabled?: any },
    options?: { timeout?: number }
  ): Promise<GetModelsResponse> {
    return this.request<GetModelsResponse>('GET', `/api/models`, { params: query, timeout: options?.timeout })
  }

  /**
   * Debug provider key resolution (no secrets)
   */
  async listProviders_debugConfig(options?: { timeout?: number }): Promise<ListProviders_debugConfigResponse> {
    return this.request<ListProviders_debugConfigResponse>('GET', `/api/providers/_debug-config`, {
      timeout: options?.timeout
    })
  }

  /**
   * Generate text (one-off, non-streaming)
   */
  async createAiGenerateText(
    data: CreateAiGenerateTextRequest,
    options?: { timeout?: number }
  ): Promise<CreateAiGenerateTextResponse> {
    return this.request<CreateAiGenerateTextResponse>('POST', `/api/ai/generate/text`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Update provider settings
   */
  async createProviderSetting(
    data: CreateProviderSettingRequest,
    options?: { timeout?: number }
  ): Promise<CreateProviderSettingResponse> {
    return this.request<CreateProviderSettingResponse>('POST', `/api/provider-settings`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // GenAI Operations
  /**
   * Generate text using a specified model and prompt
   */
  async createGenAiStream(
    data: CreateGenAiStreamRequest,
    options?: { timeout?: number }
  ): Promise<CreateGenAiStreamResponse> {
    return this.request<CreateGenAiStreamResponse>('POST', `/api/gen-ai/stream`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Generate text using a specified model and prompt
   */
  async createGenAiText(
    data: CreateGenAiTextRequest,
    options?: { timeout?: number }
  ): Promise<CreateGenAiTextResponse> {
    return this.request<CreateGenAiTextResponse>('POST', `/api/gen-ai/text`, { body: data, timeout: options?.timeout })
  }

  /**
   * Generate structured data based on a predefined schema key and user input
   */
  async createGenAiStructured(
    data: CreateGenAiStructuredRequest,
    options?: { timeout?: number }
  ): Promise<CreateGenAiStructuredResponse> {
    return this.request<CreateGenAiStructuredResponse>('POST', `/api/gen-ai/structured`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // System Operations
  /**
   * Browse directories on the file system
   */
  async createBrowseDirector(
    data: CreateBrowseDirectorRequest,
    options?: { timeout?: number }
  ): Promise<CreateBrowseDirectorResponse> {
    return this.request<CreateBrowseDirectorResponse>('POST', `/api/browse-directory`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // MCP Operations
  /**
   * List all MCP server configurations for a project
   */
  async getProjectsByIdMcpServers(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpServersResponse> {
    return this.request<GetProjectsByIdMcpServersResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/servers`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Create MCP server configuration
   */
  async createProjectsByIdMcpServers(
    id: string | number,
    data: CreateProjectsByIdMcpServersRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdMcpServersResponse> {
    return this.request<CreateProjectsByIdMcpServersResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/mcp/servers`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Get MCP server configuration by ID
   */
  async getProjectsByIdMcpServersByServerId(
    id: string | number,
    serverId: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpServersByServerIdResponse> {
    return this.request<GetProjectsByIdMcpServersByServerIdResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/servers/{serverId}`, { id, serverId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Update MCP server configuration
   */
  async updateProjectsByIdMcpServersByServerId(
    id: string | number,
    serverId: string | number,
    data: UpdateProjectsByIdMcpServersByServerIdRequest,
    options?: { timeout?: number }
  ): Promise<UpdateProjectsByIdMcpServersByServerIdResponse> {
    return this.request<UpdateProjectsByIdMcpServersByServerIdResponse>(
      'PATCH',
      this.buildPath(`/api/projects/{id}/mcp/servers/{serverId}`, { id, serverId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete MCP server configuration
   */
  async deleteProjectsByIdMcpServersByServerId(
    id: string | number,
    serverId: string | number,
    options?: { timeout?: number }
  ): Promise<DeleteProjectsByIdMcpServersByServerIdResponse> {
    return this.request<DeleteProjectsByIdMcpServersByServerIdResponse>(
      'DELETE',
      this.buildPath(`/api/projects/{id}/mcp/servers/{serverId}`, { id, serverId }),
      { timeout: options?.timeout }
    )
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
  async createMcpToolsExecute(
    data: CreateMcpToolsExecuteRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpToolsExecuteResponse> {
    return this.request<CreateMcpToolsExecuteResponse>('POST', `/api/mcp/tools/execute`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * List available MCP resources
   */
  async listMcpResources(
    query?: { serverId?: any },
    options?: { timeout?: number }
  ): Promise<ListMcpResourcesResponse> {
    return this.request<ListMcpResourcesResponse>('GET', `/api/mcp/resources`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Read MCP resource content
   */
  async createMcpResourcesRead(
    data: CreateMcpResourcesReadRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpResourcesReadResponse> {
    return this.request<CreateMcpResourcesReadResponse>('POST', `/api/mcp/resources/read`, {
      body: data,
      timeout: options?.timeout
    })
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
  async createMcpServersByServerIdStart(
    serverId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateMcpServersByServerIdStartResponse> {
    return this.request<CreateMcpServersByServerIdStartResponse>(
      'POST',
      this.buildPath(`/api/mcp/servers/{serverId}/start`, { serverId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Stop an MCP server
   */
  async createMcpServersByServerIdStop(
    serverId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateMcpServersByServerIdStopResponse> {
    return this.request<CreateMcpServersByServerIdStopResponse>(
      'POST',
      this.buildPath(`/api/mcp/servers/{serverId}/stop`, { serverId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get MCP usage analytics
   */
  async listMcpAnalytics(
    query?: { startDate?: any; endDate?: any; serverId?: any },
    options?: { timeout?: number }
  ): Promise<ListMcpAnalyticsResponse> {
    return this.request<ListMcpAnalyticsResponse>('GET', `/api/mcp/analytics`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Get statistics for a specific MCP server
   */
  async listMcpServersByServerIdStats(
    serverId: string | number,
    options?: { timeout?: number }
  ): Promise<ListMcpServersByServerIdStatsResponse> {
    return this.request<ListMcpServersByServerIdStatsResponse>(
      'GET',
      this.buildPath(`/api/mcp/servers/{serverId}/stats`, { serverId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get tool usage statistics
   */
  async listMcpToolsStats(
    query?: { period?: any; limit?: any },
    options?: { timeout?: number }
  ): Promise<ListMcpToolsStatsResponse> {
    return this.request<ListMcpToolsStatsResponse>('GET', `/api/mcp/tools/stats`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Get resource access statistics
   */
  async listMcpResourcesStats(
    query?: { period?: any },
    options?: { timeout?: number }
  ): Promise<ListMcpResourcesStatsResponse> {
    return this.request<ListMcpResourcesStatsResponse>('GET', `/api/mcp/resources/stats`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Generate MCP usage report
   */
  async createMcpAnalyticsReport(
    data: CreateMcpAnalyticsReportRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpAnalyticsReportResponse> {
    return this.request<CreateMcpAnalyticsReportResponse>('POST', `/api/mcp/analytics/report`, {
      body: data,
      timeout: options?.timeout
    })
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
  async listMcpAnalyticsPerformance(
    query?: { metricType?: any; aggregation?: any },
    options?: { timeout?: number }
  ): Promise<ListMcpAnalyticsPerformanceResponse> {
    return this.request<ListMcpAnalyticsPerformanceResponse>('GET', `/api/mcp/analytics/performance`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Get MCP analytics overview for a project
   */
  async getProjectsByIdMcpAnalyticsOverview(
    id: string | number,
    query?: { period?: any; toolNames?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpAnalyticsOverviewResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsOverviewResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/analytics/overview`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Get MCP tool statistics for a project
   */
  async getProjectsByIdMcpAnalyticsStatistics(
    id: string | number,
    query?: { period?: any; toolNames?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpAnalyticsStatisticsResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsStatisticsResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/analytics/statistics`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Get MCP execution timeline for a project
   */
  async getProjectsByIdMcpAnalyticsTimeline(
    id: string | number,
    query?: { period?: any; toolNames?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpAnalyticsTimelineResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsTimelineResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/analytics/timeline`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Get MCP error patterns for a project
   */
  async getProjectsByIdMcpAnalyticsErrorPatterns(
    id: string | number,
    query?: { period?: any; toolNames?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpAnalyticsErrorPatternsResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsErrorPatternsResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/analytics/error-patterns`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Get MCP tool executions for a project
   */
  async getProjectsByIdMcpAnalyticsExecutions(
    id: string | number,
    query?: {
      toolName?: any
      status?: any
      startDate?: any
      endDate?: any
      limit?: any
      offset?: any
      sortBy?: any
      sortOrder?: any
    },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdMcpAnalyticsExecutionsResponse> {
    return this.request<GetProjectsByIdMcpAnalyticsExecutionsResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/mcp/analytics/executions`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Test MCP server connection
   */
  async createMcpTestConnection(
    data: CreateMcpTestConnectionRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpTestConnectionResponse> {
    return this.request<CreateMcpTestConnectionResponse>('POST', `/api/mcp/test/connection`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Test MCP initialize handshake
   */
  async createMcpTestInitialize(
    data: CreateMcpTestInitializeRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpTestInitializeResponse> {
    return this.request<CreateMcpTestInitializeResponse>('POST', `/api/mcp/test/initialize`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Test MCP tool execution
   */
  async createMcpTestTool(
    data: CreateMcpTestToolRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpTestToolResponse> {
    return this.request<CreateMcpTestToolResponse>('POST', `/api/mcp/test/tool`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Validate MCP server configuration
   */
  async createMcpTestValidateConfig(
    data: CreateMcpTestValidateConfigRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpTestValidateConfigResponse> {
    return this.request<CreateMcpTestValidateConfigResponse>('POST', `/api/mcp/test/validate-config`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Debug MCP communication
   */
  async createMcpTestDebug(
    data: CreateMcpTestDebugRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpTestDebugResponse> {
    return this.request<CreateMcpTestDebugResponse>('POST', `/api/mcp/test/debug`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * List all MCP sessions
   */
  async listMcpSessions(
    query?: { status?: any; serverId?: any },
    options?: { timeout?: number }
  ): Promise<ListMcpSessionsResponse> {
    return this.request<ListMcpSessionsResponse>('GET', `/api/mcp/sessions`, {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Create a new MCP session
   */
  async createMcpSessions(
    data: CreateMcpSessionsRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpSessionsResponse> {
    return this.request<CreateMcpSessionsResponse>('POST', `/api/mcp/sessions`, {
      body: data,
      timeout: options?.timeout
    })
  }

  /**
   * Get MCP session by ID
   */
  async listMcpSessionsBySessionId(
    sessionId: string | number,
    options?: { timeout?: number }
  ): Promise<ListMcpSessionsBySessionIdResponse> {
    return this.request<ListMcpSessionsBySessionIdResponse>(
      'GET',
      this.buildPath(`/api/mcp/sessions/{sessionId}`, { sessionId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Close an MCP session
   */
  async createMcpSessionsBySessionIdClose(
    sessionId: string | number,
    data: CreateMcpSessionsBySessionIdCloseRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpSessionsBySessionIdCloseResponse> {
    return this.request<CreateMcpSessionsBySessionIdCloseResponse>(
      'POST',
      this.buildPath(`/api/mcp/sessions/{sessionId}/close`, { sessionId }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Refresh/keep-alive an MCP session
   */
  async createMcpSessionsBySessionIdRefresh(
    sessionId: string | number,
    options?: { timeout?: number }
  ): Promise<CreateMcpSessionsBySessionIdRefreshResponse> {
    return this.request<CreateMcpSessionsBySessionIdRefreshResponse>(
      'POST',
      this.buildPath(`/api/mcp/sessions/{sessionId}/refresh`, { sessionId }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get session command history
   */
  async listMcpSessionsBySessionIdHistory(
    sessionId: string | number,
    query?: { limit?: any; offset?: any },
    options?: { timeout?: number }
  ): Promise<ListMcpSessionsBySessionIdHistoryResponse> {
    return this.request<ListMcpSessionsBySessionIdHistoryResponse>(
      'GET',
      this.buildPath(`/api/mcp/sessions/{sessionId}/history`, { sessionId }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Cleanup idle MCP sessions
   */
  async createMcpSessionsCleanup(
    data: CreateMcpSessionsCleanupRequest,
    options?: { timeout?: number }
  ): Promise<CreateMcpSessionsCleanupResponse> {
    return this.request<CreateMcpSessionsCleanupResponse>('POST', `/api/mcp/sessions/cleanup`, {
      body: data,
      timeout: options?.timeout
    })
  }

  // Git Operations
  /**
   * Get git status for a project
   */
  async getProjectsByIdGitStatus(
    id: string | number,
    query?: { refresh?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitStatusResponse> {
    return this.request<GetProjectsByIdGitStatusResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/status`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Stage files for commit
   */
  async createProjectsByIdGitStage(
    id: string | number,
    data: CreateProjectsByIdGitStageRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitStageResponse> {
    return this.request<CreateProjectsByIdGitStageResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/stage`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Unstage files from commit
   */
  async createProjectsByIdGitUnstage(
    id: string | number,
    data: CreateProjectsByIdGitUnstageRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitUnstageResponse> {
    return this.request<CreateProjectsByIdGitUnstageResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/unstage`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Stage all changes
   */
  async createProjectsByIdGitStageAll(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitStageAllResponse> {
    return this.request<CreateProjectsByIdGitStageAllResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/stage-all`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Unstage all changes
   */
  async createProjectsByIdGitUnstageAll(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitUnstageAllResponse> {
    return this.request<CreateProjectsByIdGitUnstageAllResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/unstage-all`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Create a new commit
   */
  async createProjectsByIdGitCommit(
    id: string | number,
    data: CreateProjectsByIdGitCommitRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitCommitResponse> {
    return this.request<CreateProjectsByIdGitCommitResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/commit`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Get commit history
   */
  async getProjectsByIdGitLog(
    id: string | number,
    query?: { maxCount?: any; skip?: any; author?: any; since?: any; until?: any; grep?: any; branch?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitLogResponse> {
    return this.request<GetProjectsByIdGitLogResponse>('GET', this.buildPath(`/api/projects/{id}/git/log`, { id }), {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * Get enhanced commit history
   */
  async getProjectsByIdGitLogEnhanced(
    id: string | number,
    query?: { maxCount?: any; skip?: any; author?: any; since?: any; until?: any; grep?: any; branch?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitLogEnhancedResponse> {
    return this.request<GetProjectsByIdGitLogEnhancedResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/log-enhanced`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * Get commit details
   */
  async getProjectsByIdGitCommitsByCommitHash(
    id: string | number,
    commitHash: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitCommitsByCommitHashResponse> {
    return this.request<GetProjectsByIdGitCommitsByCommitHashResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/commits/{commitHash}`, { id, commitHash }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Get file diff
   */
  async getProjectsByIdGitDiff(
    id: string | number,
    query?: { filePath?: any; cached?: any },
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitDiffResponse> {
    return this.request<GetProjectsByIdGitDiffResponse>('GET', this.buildPath(`/api/projects/{id}/git/diff`, { id }), {
      params: query,
      timeout: options?.timeout
    })
  }

  /**
   * List all branches
   */
  async getProjectsByIdGitBranches(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitBranchesResponse> {
    return this.request<GetProjectsByIdGitBranchesResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/branches`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Create a new branch
   */
  async createProjectsByIdGitBranches(
    id: string | number,
    data: CreateProjectsByIdGitBranchesRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitBranchesResponse> {
    return this.request<CreateProjectsByIdGitBranchesResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/branches`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * List branches with enhanced information
   */
  async getProjectsByIdGitBranchesEnhanced(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitBranchesEnhancedResponse> {
    return this.request<GetProjectsByIdGitBranchesEnhancedResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/branches-enhanced`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Switch to a different branch
   */
  async createProjectsByIdGitBranchesSwitch(
    id: string | number,
    data: CreateProjectsByIdGitBranchesSwitchRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitBranchesSwitchResponse> {
    return this.request<CreateProjectsByIdGitBranchesSwitchResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/branches/switch`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Delete a branch
   */
  async deleteProjectsByIdGitBranchesByBranchName(
    id: string | number,
    branchName: string | number,
    query?: { force?: any },
    options?: { timeout?: number }
  ): Promise<DeleteProjectsByIdGitBranchesByBranchNameResponse> {
    return this.request<DeleteProjectsByIdGitBranchesByBranchNameResponse>(
      'DELETE',
      this.buildPath(`/api/projects/{id}/git/branches/{branchName}`, { id, branchName }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * GET /api/projects/{id}/git/stash
   */
  async getProjectsByIdGitStash(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitStashResponse> {
    return this.request<GetProjectsByIdGitStashResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/stash`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/git/stash
   */
  async createProjectsByIdGitStash(
    id: string | number,
    data: CreateProjectsByIdGitStashRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitStashResponse> {
    return this.request<CreateProjectsByIdGitStashResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/stash`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Drop a stash
   */
  async deleteProjectsByIdGitStash(
    id: string | number,
    data: DeleteProjectsByIdGitStashRequest,
    options?: { timeout?: number }
  ): Promise<DeleteProjectsByIdGitStashResponse> {
    return this.request<DeleteProjectsByIdGitStashResponse>(
      'DELETE',
      this.buildPath(`/api/projects/{id}/git/stash`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/git/stash/apply
   */
  async createProjectsByIdGitStashApply(
    id: string | number,
    data: CreateProjectsByIdGitStashApplyRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitStashApplyResponse> {
    return this.request<CreateProjectsByIdGitStashApplyResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/stash/apply`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Pop a stash
   */
  async createProjectsByIdGitStashPop(
    id: string | number,
    data: CreateProjectsByIdGitStashPopRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitStashPopResponse> {
    return this.request<CreateProjectsByIdGitStashPopResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/stash/pop`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * List all worktrees
   */
  async getProjectsByIdGitWorktrees(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitWorktreesResponse> {
    return this.request<GetProjectsByIdGitWorktreesResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/worktrees`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * Add a new worktree
   */
  async createProjectsByIdGitWorktrees(
    id: string | number,
    data: CreateProjectsByIdGitWorktreesRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitWorktreesResponse> {
    return this.request<CreateProjectsByIdGitWorktreesResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/worktrees`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Remove a worktree
   */
  async deleteProjectsByIdGitWorktrees(
    id: string | number,
    data: DeleteProjectsByIdGitWorktreesRequest,
    options?: { timeout?: number }
  ): Promise<DeleteProjectsByIdGitWorktreesResponse> {
    return this.request<DeleteProjectsByIdGitWorktreesResponse>(
      'DELETE',
      this.buildPath(`/api/projects/{id}/git/worktrees`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Lock a worktree
   */
  async createProjectsByIdGitWorktreesLock(
    id: string | number,
    data: CreateProjectsByIdGitWorktreesLockRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitWorktreesLockResponse> {
    return this.request<CreateProjectsByIdGitWorktreesLockResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/worktrees/lock`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Unlock a worktree
   */
  async createProjectsByIdGitWorktreesUnlock(
    id: string | number,
    data: CreateProjectsByIdGitWorktreesUnlockRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitWorktreesUnlockResponse> {
    return this.request<CreateProjectsByIdGitWorktreesUnlockResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/worktrees/unlock`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * Prune worktrees
   */
  async createProjectsByIdGitWorktreesPrune(
    id: string | number,
    query?: { dryRun?: any },
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitWorktreesPruneResponse> {
    return this.request<CreateProjectsByIdGitWorktreesPruneResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/worktrees/prune`, { id }),
      { params: query, timeout: options?.timeout }
    )
  }

  /**
   * GET /api/projects/{id}/git/remotes
   */
  async getProjectsByIdGitRemotes(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitRemotesResponse> {
    return this.request<GetProjectsByIdGitRemotesResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/git/remotes`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/git/push
   */
  async createProjectsByIdGitPush(
    id: string | number,
    data: CreateProjectsByIdGitPushRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitPushResponse> {
    return this.request<CreateProjectsByIdGitPushResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/push`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/git/fetch
   */
  async createProjectsByIdGitFetch(
    id: string | number,
    data: CreateProjectsByIdGitFetchRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitFetchResponse> {
    return this.request<CreateProjectsByIdGitFetchResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/fetch`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/git/pull
   */
  async createProjectsByIdGitPull(
    id: string | number,
    data: CreateProjectsByIdGitPullRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitPullResponse> {
    return this.request<CreateProjectsByIdGitPullResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/pull`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * GET /api/projects/{id}/git/tags
   */
  async getProjectsByIdGitTags(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdGitTagsResponse> {
    return this.request<GetProjectsByIdGitTagsResponse>('GET', this.buildPath(`/api/projects/{id}/git/tags`, { id }), {
      timeout: options?.timeout
    })
  }

  /**
   * POST /api/projects/{id}/git/tags
   */
  async createProjectsByIdGitTags(
    id: string | number,
    data: CreateProjectsByIdGitTagsRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitTagsResponse> {
    return this.request<CreateProjectsByIdGitTagsResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/tags`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/git/reset
   */
  async createProjectsByIdGitReset(
    id: string | number,
    data: CreateProjectsByIdGitResetRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdGitResetResponse> {
    return this.request<CreateProjectsByIdGitResetResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/git/reset`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  // Project Tabs Operations
  /**
   * Generate an AI-powered name for a project tab
   */
  async createProjectTabsByTabIdGenerateName(
    tabId: string | number,
    data: CreateProjectTabsByTabIdGenerateNameRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectTabsByTabIdGenerateNameResponse> {
    return this.request<CreateProjectTabsByTabIdGenerateNameResponse>(
      'POST',
      this.buildPath(`/api/project-tabs/{tabId}/generate-name`, { tabId }),
      { body: data, timeout: options?.timeout }
    )
  }

  // Agent Files Operations
  /**
   * GET /api/projects/{id}/agent-files/detect
   */
  async getProjectsByIdAgentFilesDetect(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdAgentFilesDetectResponse> {
    return this.request<GetProjectsByIdAgentFilesDetectResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/agent-files/detect`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/agent-files/update
   */
  async createProjectsByIdAgentFilesUpdate(
    id: string | number,
    data: CreateProjectsByIdAgentFilesUpdateRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdAgentFilesUpdateResponse> {
    return this.request<CreateProjectsByIdAgentFilesUpdateResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/agent-files/update`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/agent-files/remove-instructions
   */
  async createProjectsByIdAgentFilesRemoveInstructions(
    id: string | number,
    data: CreateProjectsByIdAgentFilesRemoveInstructionsRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdAgentFilesRemoveInstructionsResponse> {
    return this.request<CreateProjectsByIdAgentFilesRemoveInstructionsResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/agent-files/remove-instructions`, { id }),
      { body: data, timeout: options?.timeout }
    )
  }

  /**
   * GET /api/projects/{id}/agent-files/status
   */
  async getProjectsByIdAgentFilesStatus(
    id: string | number,
    options?: { timeout?: number }
  ): Promise<GetProjectsByIdAgentFilesStatusResponse> {
    return this.request<GetProjectsByIdAgentFilesStatusResponse>(
      'GET',
      this.buildPath(`/api/projects/{id}/agent-files/status`, { id }),
      { timeout: options?.timeout }
    )
  }

  /**
   * POST /api/projects/{id}/agent-files/create
   */
  async createProjectsByIdAgentFilesCreate(
    id: string | number,
    data: CreateProjectsByIdAgentFilesCreateRequest,
    options?: { timeout?: number }
  ): Promise<CreateProjectsByIdAgentFilesCreateResponse> {
    return this.request<CreateProjectsByIdAgentFilesCreateResponse>(
      'POST',
      this.buildPath(`/api/projects/{id}/agent-files/create`, { id }),
      { body: data, timeout: options?.timeout }
    )
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
