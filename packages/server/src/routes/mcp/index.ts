/**
import { createStandardResponses, createStandardResponsesWithStatus, standardResponses } from '../../utils/route-helpers'
 * MCP Routes Consolidation
 * Combines all MCP-related routes into a single export
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { mcpConfigRoutes } from './config-routes'
import { mcpExecutionRoutes } from './execution-routes'
import { mcpAnalyticsRoutes } from './analytics-routes'

// Create consolidated MCP routes
export const mcpRoutes = new OpenAPIHono()
  .route('/', mcpConfigRoutes)
  .route('/', mcpExecutionRoutes)
  .route('/', mcpAnalyticsRoutes)

export type MCPRoutesType = typeof mcpRoutes

// Re-export individual route types for specific imports
export type { MCPConfigRouteTypes } from './config-routes'
export type { MCPExecutionRouteTypes } from './execution-routes'
export type { MCPAnalyticsRouteTypes } from './analytics-routes'
