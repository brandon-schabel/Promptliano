import type { MCPToolDefinition } from '../tools-registry'
import { aiAssistantTool } from './content'
import { gitManagerTool } from './git'
import { projectManagerTool, promptManagerTool } from './project'
import { flowManagerTool } from './workflow'

export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = Object.freeze([
  projectManagerTool,
  promptManagerTool,
  flowManagerTool,
  aiAssistantTool,
  gitManagerTool
])

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
