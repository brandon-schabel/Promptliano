// Main aggregator for all tools

// Import all tool groups
import { documentationSearchTool, websiteDemoRunnerTool } from './website'
import { mcpConfigGeneratorTool, mcpCompatibilityCheckerTool, mcpSetupValidatorTool } from './setup'
import { tabManagerTool } from './ui'
import { aiAssistantTool } from './content'
import { projectManagerTool, promptManagerTool, markdownPromptManagerTool } from './project'
import { ticketManagerTool, taskManagerTool, queueManagerTool, queueProcessorTool } from './workflow'
import { gitManagerTool } from './git'

// Import types
import type { MCPToolDefinition } from '../tools-registry'

// Export the consolidated tools array
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  // Project tools
  projectManagerTool,
  promptManagerTool,
  markdownPromptManagerTool,
  // Workflow tools
  ticketManagerTool,
  taskManagerTool,
  queueManagerTool,
  queueProcessorTool,
  // Content tools
  aiAssistantTool,
  // Website tools
  documentationSearchTool,
  websiteDemoRunnerTool,
  // Setup tools
  mcpConfigGeneratorTool,
  mcpCompatibilityCheckerTool,
  mcpSetupValidatorTool,
  // UI tools
  tabManagerTool,
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
