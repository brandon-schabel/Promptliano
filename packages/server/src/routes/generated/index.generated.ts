/**
 * AUTO-GENERATED ROUTE INDEX
 * Generated at: 2025-08-22T23:50:50.385Z
 *
 * ⚠️  DO NOT EDIT MANUALLY - Changes will be overwritten
 * 📊 Consolidates 15 entity route modules
 * 🎯 Achieves 40% reduction in route boilerplate
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { registerProjectRoutes } from './project-routes.generated'
import { registerTicketRoutes } from './ticket-routes.generated'
import { registerTicketTaskRoutes } from './tickettask-routes.generated'
import { registerChatRoutes } from './chat-routes.generated'
import { registerChatMessageRoutes } from './chatmessage-routes.generated'
import { registerPromptRoutes } from './prompt-routes.generated'
import { registerQueueRoutes } from './queue-routes.generated'
import { registerQueueItemRoutes } from './queueitem-routes.generated'
import { registerClaudeAgentRoutes } from './claudeagent-routes.generated'
import { registerClaudeCommandRoutes } from './claudecommand-routes.generated'
import { registerClaudeHookRoutes } from './claudehook-routes.generated'
import { registerProviderKeyRoutes } from './providerkey-routes.generated'
import { registerFileRoutes } from './file-routes.generated'
import { registerSelectedFileRoutes } from './selectedfile-routes.generated'
import { registerActiveTabRoutes } from './activetab-routes.generated'
import type { ProjectRouteTypes } from './project-routes.generated'
import type { TicketRouteTypes } from './ticket-routes.generated'
import type { TicketTaskRouteTypes } from './tickettask-routes.generated'
import type { ChatRouteTypes } from './chat-routes.generated'
import type { ChatMessageRouteTypes } from './chatmessage-routes.generated'
import type { PromptRouteTypes } from './prompt-routes.generated'
import type { QueueRouteTypes } from './queue-routes.generated'
import type { QueueItemRouteTypes } from './queueitem-routes.generated'
import type { ClaudeAgentRouteTypes } from './claudeagent-routes.generated'
import type { ClaudeCommandRouteTypes } from './claudecommand-routes.generated'
import type { ClaudeHookRouteTypes } from './claudehook-routes.generated'
import type { ProviderKeyRouteTypes } from './providerkey-routes.generated'
import type { FileRouteTypes } from './file-routes.generated'
import type { SelectedFileRouteTypes } from './selectedfile-routes.generated'
import type { ActiveTabRouteTypes } from './activetab-routes.generated'

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all auto-generated entity routes
 * Replaces individual route files with factory-generated equivalents
 */
export function registerAllGeneratedRoutes(app: OpenAPIHono): OpenAPIHono {
  console.log('🏭 Registering auto-generated routes...')

  registerProjectRoutes(app)
  registerTicketRoutes(app)
  registerTicketTaskRoutes(app)
  registerChatRoutes(app)
  registerChatMessageRoutes(app)
  registerPromptRoutes(app)
  registerQueueRoutes(app)
  registerQueueItemRoutes(app)
  registerClaudeAgentRoutes(app)
  registerClaudeCommandRoutes(app)
  registerClaudeHookRoutes(app)
  registerProviderKeyRoutes(app)
  registerFileRoutes(app)
  registerSelectedFileRoutes(app)
  registerActiveTabRoutes(app)

  console.log('✅ All generated routes registered successfully')
  return app
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type AllRouteTypes = {
  Project: ProjectRouteTypes
  Ticket: TicketRouteTypes
  TicketTask: TicketTaskRouteTypes
  Chat: ChatRouteTypes
  ChatMessage: ChatMessageRouteTypes
  Prompt: PromptRouteTypes
  Queue: QueueRouteTypes
  QueueItem: QueueItemRouteTypes
  ClaudeAgent: ClaudeAgentRouteTypes
  ClaudeCommand: ClaudeCommandRouteTypes
  ClaudeHook: ClaudeHookRouteTypes
  ProviderKey: ProviderKeyRouteTypes
  File: FileRouteTypes
  SelectedFile: SelectedFileRouteTypes
  ActiveTab: ActiveTabRouteTypes
}

// =============================================================================
// ROUTE STATISTICS
// =============================================================================

export const routeStats = {
  totalEntities: 15,
  totalRoutes: 90,
  codeReduction: '~40%',
  generatedAt: '2025-08-22T23:50:50.385Z'
} as const
