import { BaseApiClient } from '../base-client'
import type { DataResponseSchema } from '../types'

// Agent Files types based on API routes
export interface DetectedAgentFile {
  type: string
  name: string
  path: string
  scope: 'global' | 'project'
  exists: boolean
  writable: boolean
  hasInstructions?: boolean
  instructionVersion?: string
  metadata?: Record<string, any>
}

export interface AgentFilesDetectionData {
  projectFiles: DetectedAgentFile[]
  globalFiles: DetectedAgentFile[]
  suggestedFiles: Array<{
    type: string
    name: string
    suggestedPath: string
  }>
}

export interface AgentFileStatusData {
  currentVersion: string
  files: Array<{
    path: string
    exists: boolean
    hasInstructions: boolean
    instructionVersion?: string
    isOutdated: boolean
  }>
}

export interface AgentFileUpdateData {
  message: string
  backedUp?: boolean
  filePath: string
}

export interface AgentFileCreateData {
  message: string
  filePath: string
}

export interface AgentFileRemoveData {
  message: string
}

export interface UpdateAgentFileBody {
  filePath: string
  includeExamples?: boolean
  customInstructions?: string
}

export interface CreateAgentFileBody {
  type: string
  includeExamples?: boolean
  customInstructions?: string
}

export interface RemoveInstructionsBody {
  filePath: string
}

/**
 * Agent Files API client for managing AI agent configuration files
 */
export class AgentFilesClient extends BaseApiClient {
  /**
   * Detect agent instruction files for a project
   */
  async detectFiles(projectId: number): Promise<DataResponseSchema<AgentFilesDetectionData>> {
    return this.get(`/projects/${projectId}/agent-files/detect`)
  }

  /**
   * Get status of agent files and instruction versions
   */
  async getStatus(projectId: number): Promise<DataResponseSchema<AgentFileStatusData>> {
    return this.get(`/projects/${projectId}/agent-files/status`)
  }

  /**
   * Update an agent file with Promptliano instructions
   */
  async updateFile(projectId: number, data: UpdateAgentFileBody): Promise<DataResponseSchema<AgentFileUpdateData>> {
    return this.post(`/projects/${projectId}/agent-files/update`, data)
  }

  /**
   * Create a new agent file with instructions
   */
  async createFile(projectId: number, data: CreateAgentFileBody): Promise<DataResponseSchema<AgentFileCreateData>> {
    return this.post(`/projects/${projectId}/agent-files/create`, data)
  }

  /**
   * Remove Promptliano instructions from an agent file
   */
  async removeInstructions(projectId: number, data: RemoveInstructionsBody): Promise<DataResponseSchema<AgentFileRemoveData>> {
    return this.post(`/projects/${projectId}/agent-files/remove-instructions`, data)
  }
}