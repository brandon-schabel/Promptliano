// Main aggregator for all tools

// Import all tool groups
import { flowManagerTool } from './workflow'
import { aiAssistantTool } from './content'
import { projectManagerTool, promptManagerTool } from './project'
import { gitManagerTool } from './git'

// Import types
import type { MCPToolDefinition } from '../tools-registry'

// Export the consolidated tools array
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  // Project tools
  projectManagerTool,
  promptManagerTool,
  // Workflow (unified)
  flowManagerTool,
  // Content tools
  aiAssistantTool,
  // Git tool
  gitManagerTool
] as const

// Helper functions
export type ConsolidatedToolNames = (typeof CONSOLIDATED_TOOLS)[number]['name']

export function getConsolidatedToolByName(name: string): MCPToolDefinition | undefined {
  return CONSOLIDATED_TOOLS.find((tool) => tool.name === name)
}

export function getAllConsolidatedToolNames(): string[] {
  return CONSOLIDATED_TOOLS.map((tool) => tool.name)
}

export function getAllConsolidatedTools(): readonly MCPToolDefinition[] {
  return CONSOLIDATED_TOOLS
}
