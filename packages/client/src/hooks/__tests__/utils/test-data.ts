/**
 * Test Data Factory
 * Generates consistent test data for hook factory testing
 */

import type { 
  Project, 
  Ticket, 
  Chat, 
  Prompt,
  ClaudeAgent,
  TaskQueue,
  ProviderKey,
  CreateProjectBody,
  CreateTicketBody,
  CreateChatBody,
  CreatePromptBody,
  CreateClaudeAgentBody,
  CreateQueueBody,
  CreateProviderKeyBody
} from '@promptliano/schemas'

export interface TestDataOptions {
  offset?: number
  projectId?: number
}

export const createTestData = {
  projects: (count: number, options: TestDataOptions = {}): Project[] => {
    const { offset = 0 } = options
    
    return Array.from({ length: count }, (_, index) => ({
      id: offset + index + 1,
      name: `Test Project ${offset + index + 1}`,
      description: `Description for test project ${offset + index + 1}`,
      path: `/test/project${offset + index + 1}`,
      created: Date.now() - (count - index) * 60000,
      updated: Date.now() - (count - index) * 30000,
    }))
  },

  createProjectBody: (): CreateProjectBody => ({
    name: `New Test Project`,
    description: `Generated test project description`,
    path: `/test/new-project`,
  }),

  ticketsForProject: (projectId: number, count: number): Ticket[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: projectId * 1000 + index + 1,
      projectId,
      title: `Test Ticket ${index + 1} for Project ${projectId}`,
      description: `Description for test ticket ${index + 1}`,
      status: ['open', 'in_progress', 'completed'][index % 3],
      priority: ['low', 'medium', 'high'][index % 3],
      created: Date.now() - (count - index) * 60000,
      updated: Date.now() - (count - index) * 30000,
    }))
  },

  createTicketBody: (projectId: number = 1): CreateTicketBody => ({
    projectId,
    title: `New Test Ticket`,
    description: `Generated test ticket description`,
    status: 'open',
    priority: 'medium',
  }),

  chats: (count: number): Chat[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      title: `Test Chat ${index + 1}`,
      model: 'claude-3-sonnet',
      provider: 'anthropic',
      created: Date.now() - (count - index) * 60000,
      updated: Date.now() - (count - index) * 30000,
      messageCount: Math.floor(Math.random() * 50) + 1,
    }))
  },

  createChatBody: (): CreateChatBody => ({
    title: `New Test Chat`,
    model: 'claude-3-sonnet',
    provider: 'anthropic',
  }),

  prompts: (count: number, projectId?: number): Prompt[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      projectId,
      title: `Test Prompt ${index + 1}`,
      content: `Test prompt content ${index + 1}`,
      tags: [`tag${index % 3}`, `category${index % 2}`],
      created: Date.now() - (count - index) * 60000,
      updated: Date.now() - (count - index) * 30000,
    }))
  },

  createPromptBody: (projectId?: number): CreatePromptBody => ({
    projectId,
    title: `New Test Prompt`,
    content: `Generated test prompt content`,
    tags: ['test', 'generated'],
  }),

  agents: (count: number, projectId?: number): ClaudeAgent[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      projectId,
      name: `Test Agent ${index + 1}`,
      description: `Test agent description ${index + 1}`,
      instructions: `Test instructions for agent ${index + 1}`,
      model: 'claude-3-sonnet',
      temperature: 0.7,
      maxTokens: 4096,
      created: Date.now() - (count - index) * 60000,
      updated: Date.now() - (count - index) * 30000,
    }))
  },

  createAgentBody: (projectId?: number): CreateClaudeAgentBody => ({
    projectId,
    name: `New Test Agent`,
    description: `Generated test agent description`,
    instructions: `Generated test instructions`,
    model: 'claude-3-sonnet',
    temperature: 0.7,
    maxTokens: 4096,
  }),

  queues: (count: number, projectId: number): TaskQueue[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      projectId,
      name: `Test Queue ${index + 1}`,
      description: `Test queue description ${index + 1}`,
      maxParallelItems: 3,
      itemCount: Math.floor(Math.random() * 20),
      created: Date.now() - (count - index) * 60000,
      updated: Date.now() - (count - index) * 30000,
    }))
  },

  createQueueBody: (projectId: number): CreateQueueBody => ({
    projectId,
    name: `New Test Queue`,
    description: `Generated test queue description`,
    maxParallelItems: 3,
  }),

  keys: (count: number): ProviderKey[] => {
    const providers = ['anthropic', 'openai', 'google', 'azure']
    
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name: `${providers[index % providers.length]}_key_${index + 1}`,
      provider: providers[index % providers.length],
      keyType: 'api_key',
      isActive: index % 3 !== 0, // Most keys active
      created: Date.now() - (count - index) * 60000,
      updated: Date.now() - (count - index) * 30000,
    }))
  },

  createKeyBody: (): CreateProviderKeyBody => ({
    name: `new_test_key`,
    provider: 'anthropic',
    keyType: 'api_key',
    keyValue: 'sk-test-key-value',
    isActive: true,
  }),

  // Utility functions for bulk data generation
  generateLargeDataset: (entityType: string, count: number, options: TestDataOptions = {}) => {
    switch (entityType) {
      case 'projects':
        return createTestData.projects(count, options)
      case 'tickets':
        return createTestData.ticketsForProject(options.projectId || 1, count)
      case 'chats':
        return createTestData.chats(count)
      case 'prompts':
        return createTestData.prompts(count, options.projectId)
      case 'agents':
        return createTestData.agents(count, options.projectId)
      case 'queues':
        return createTestData.queues(count, options.projectId || 1)
      case 'keys':
        return createTestData.keys(count)
      default:
        throw new Error(`Unknown entity type: ${entityType}`)
    }
  },

  // Helper for creating related entity sets
  createProjectEcosystem: (projectCount: number = 1, ticketsPerProject: number = 10) => {
    const projects = createTestData.projects(projectCount)
    const allTickets = projects.flatMap(project => 
      createTestData.ticketsForProject(project.id, ticketsPerProject)
    )
    const prompts = createTestData.prompts(projectCount * 3, projects[0]?.id)
    const agents = createTestData.agents(projectCount * 2, projects[0]?.id)
    const queues = createTestData.queues(projectCount, projects[0]?.id)

    return {
      projects,
      tickets: allTickets,
      prompts,
      agents,
      queues
    }
  }
}