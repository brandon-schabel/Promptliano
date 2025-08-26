/**
 * Test data factories for creating consistent test data
 */

export interface ProjectData {
  name: string
  path: string
  description?: string
}

export interface PromptData {
  title: string // Changed from 'name' to 'title' to match schema
  content: string
  description?: string
  tags?: string[]
}

export interface TicketData {
  title: string
  overview?: string // Changed from 'description' to 'overview' to match schema
  priority?: 'low' | 'normal' | 'high' // Removed 'urgent' as it's not in schema
  projectId?: number
  tasks?: string[]
}

export interface QueueData {
  name: string
  description?: string
  maxParallelItems?: number
}

export interface TaskData {
  content: string
  description?: string
  done?: boolean
}

/**
 * Test data factories
 */
export class TestDataFactory {
  private static counter = 0

  private static getUniqueId(): number {
    return ++this.counter + Date.now()
  }

  static createProject(overrides: Partial<ProjectData> = {}): ProjectData {
    const id = this.getUniqueId()
    return {
      name: `Test Project ${id}`,
      path: `/tmp/test-project-${id}`,
      description: `Test project for E2E testing ${id}`,
      ...overrides
    }
  }

  static createPrompt(overrides: Partial<PromptData> = {}): PromptData {
    const id = this.getUniqueId()
    return {
      title: `Test Prompt ${id}`, // Changed from 'name' to 'title'
      content: `You are a helpful assistant for test case ${id}.\n\nPlease help with the following task: {{task}}`,
      description: `Test prompt for E2E testing ${id}`,
      tags: ['test', 'e2e'],
      ...overrides
    }
  }

  static createTicket(overrides: Partial<TicketData> = {}): TicketData {
    const id = this.getUniqueId()
    return {
      title: `Test Ticket ${id}`,
      overview: `Test ticket for E2E testing ${id}`, // Changed from 'description' to 'overview'
      priority: 'normal',
      tasks: [`Task 1 for ticket ${id}`, `Task 2 for ticket ${id}`, `Task 3 for ticket ${id}`],
      ...overrides
    }
  }

  static createQueue(overrides: Partial<QueueData> = {}): QueueData {
    const id = this.getUniqueId()
    return {
      name: `Test Queue ${id}`,
      description: `Test queue for E2E testing ${id}`,
      maxParallelItems: 3,
      ...overrides
    }
  }

  static createTask(overrides: Partial<TaskData> = {}): TaskData {
    const id = this.getUniqueId()
    return {
      content: `Test task ${id}`,
      description: `Test task for E2E testing ${id}`,
      done: false,
      ...overrides
    }
  }

  /**
   * Create a set of related test data for complex scenarios
   */
  static createProjectWithTickets(ticketCount = 3): {
    project: ProjectData
    tickets: TicketData[]
  } {
    const project = this.createProject()
    const tickets = Array.from({ length: ticketCount }, (_, index) =>
      this.createTicket({
        title: `${project.name} Ticket ${index + 1}`,
        overview: `Ticket ${index + 1} for project ${project.name}` // Changed from 'description' to 'overview'
      })
    )

    return { project, tickets }
  }

  /**
   * Create prompts with different categories
   */
  static createPromptSet(): PromptData[] {
    return [
      this.createPrompt({
        title: 'Code Review Prompt', // Changed from 'name' to 'title'
        content: 'Review the following code and provide feedback:\n\n{{code}}',
        tags: ['code', 'review']
      }),
      this.createPrompt({
        title: 'Documentation Prompt', // Changed from 'name' to 'title'
        content: 'Create documentation for the following feature:\n\n{{feature}}',
        tags: ['docs', 'writing']
      }),
      this.createPrompt({
        title: 'Testing Prompt', // Changed from 'name' to 'title'
        content: 'Generate test cases for:\n\n{{functionality}}',
        tags: ['test', 'qa']
      })
    ]
  }

  /**
   * Create a complete workflow scenario
   */
  static createWorkflowScenario(): {
    project: ProjectData
    prompts: PromptData[]
    tickets: TicketData[]
    queue: QueueData
  } {
    const project = this.createProject({
      name: 'E2E Workflow Project'
    })

    const prompts = this.createPromptSet()

    const tickets = [
      this.createTicket({
        title: 'Setup Project Structure',
        overview: 'Initialize the project with basic structure', // Changed from 'description' to 'overview'
        priority: 'high',
        tasks: ['Create directory structure', 'Initialize package.json', 'Setup build configuration']
      }),
      this.createTicket({
        title: 'Implement Core Features',
        overview: 'Develop the main application features', // Changed from 'description' to 'overview'
        priority: 'normal',
        tasks: ['Create user interface', 'Implement business logic', 'Add error handling']
      }),
      this.createTicket({
        title: 'Add Testing',
        overview: 'Create comprehensive test suite', // Changed from 'description' to 'overview'
        priority: 'normal',
        tasks: ['Write unit tests', 'Add integration tests', 'Setup E2E tests']
      })
    ]

    const queue = this.createQueue({
      name: 'Development Queue',
      description: 'Queue for development tasks',
      maxParallelItems: 2
    })

    return { project, prompts, tickets, queue }
  }
}

/**
 * Realistic test data for specific scenarios
 */
export const TestDataTemplates = {
  // Real-world project examples
  projects: {
    webApp: TestDataFactory.createProject({
      name: 'Web Application',
      description: 'A modern web application built with React and TypeScript',
      path: '/projects/web-app'
    }),

    mobileApp: TestDataFactory.createProject({
      name: 'Mobile App',
      description: 'Cross-platform mobile application using React Native',
      path: '/projects/mobile-app'
    }),

    apiService: TestDataFactory.createProject({
      name: 'API Service',
      description: 'RESTful API service built with Node.js and Express',
      path: '/projects/api-service'
    })
  },

  // Common prompt templates
  prompts: {
    codeGeneration: TestDataFactory.createPrompt({
      title: 'Code Generator', // Changed from 'name' to 'title'
      content:
        'Generate {{language}} code for the following requirements:\n\n{{requirements}}\n\nInclude error handling and comments.',
      tags: ['code', 'generation', 'development']
    }),

    bugAnalysis: TestDataFactory.createPrompt({
      title: 'Bug Analysis', // Changed from 'name' to 'title'
      content:
        'Analyze the following bug report and provide a solution:\n\n{{bugReport}}\n\nInclude steps to reproduce and potential fixes.',
      tags: ['bug', 'analysis', 'debugging']
    }),

    documentationWriter: TestDataFactory.createPrompt({
      title: 'Documentation Writer', // Changed from 'name' to 'title'
      content: 'Create comprehensive documentation for:\n\n{{feature}}\n\nInclude usage examples and best practices.',
      tags: ['docs', 'writing', 'examples']
    })
  },

  // Common ticket scenarios
  tickets: {
    bugFix: TestDataFactory.createTicket({
      title: 'Fix login authentication issue',
      overview: 'Users are unable to login with valid credentials', // Changed from 'description' to 'overview' and priority to valid enum
      priority: 'high', // Changed from 'urgent' to 'high' (valid enum value)
      tasks: [
        'Investigate authentication flow',
        'Check database connection',
        'Verify JWT token generation',
        'Test fix with multiple users'
      ]
    }),

    feature: TestDataFactory.createTicket({
      title: 'Add user profile management',
      overview: 'Allow users to update their profile information', // Changed from 'description' to 'overview'
      priority: 'normal',
      tasks: [
        'Design profile UI/UX',
        'Create API endpoints',
        'Implement frontend forms',
        'Add validation logic',
        'Write tests'
      ]
    }),

    improvement: TestDataFactory.createTicket({
      title: 'Optimize database queries',
      overview: 'Improve application performance by optimizing slow queries', // Changed from 'description' to 'overview'
      priority: 'low',
      tasks: [
        'Profile current query performance',
        'Identify bottlenecks',
        'Add database indexes',
        'Refactor complex queries',
        'Measure performance improvements'
      ]
    })
  },

  // Queue configurations
  queues: {
    development: TestDataFactory.createQueue({
      name: 'Development Tasks',
      description: 'Queue for development-related work items',
      maxParallelItems: 3
    }),

    bugTriage: TestDataFactory.createQueue({
      name: 'Bug Triage',
      description: 'Queue for processing and prioritizing bug reports',
      maxParallelItems: 5
    }),

    codeReview: TestDataFactory.createQueue({
      name: 'Code Review',
      description: 'Queue for code review requests',
      maxParallelItems: 2
    })
  }
}

/**
 * Utility functions for test data
 */
export const TestDataUtils = {
  /**
   * Generate random string for unique identifiers
   */
  randomString(length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },

  /**
   * Create unique name with timestamp
   */
  uniqueName(prefix = 'Test'): string {
    return `${prefix} ${Date.now()}`
  },

  /**
   * Create realistic file paths
   */
  createFilePath(projectName: string): string {
    const sanitized = projectName.toLowerCase().replace(/\s+/g, '-')
    return `/tmp/e2e-test-projects/${sanitized}-${this.randomString()}`
  },

  /**
   * Generate markdown content for prompts
   */
  generateMarkdownPrompt(title: string, description: string): string {
    return `# ${title}

${description}

## Instructions
{{instructions}}

## Context
{{context}}

## Expected Output
{{expected_output}}

## Examples
{{examples}}
`
  },

  /**
   * Create realistic task lists
   */
  createTaskList(theme: string, count = 5): string[] {
    const themes = {
      development: [
        'Setup development environment',
        'Create project structure',
        'Implement core functionality',
        'Write unit tests',
        'Add error handling',
        'Update documentation',
        'Perform code review'
      ],
      design: [
        'Create wireframes',
        'Design user interface',
        'Create style guide',
        'Design icons and assets',
        'Test usability',
        'Create responsive layouts',
        'Review accessibility'
      ],
      testing: [
        'Write test plan',
        'Create test cases',
        'Setup test environment',
        'Execute manual tests',
        'Automate regression tests',
        'Performance testing',
        'Security testing'
      ]
    }

    const taskList = themes[theme as keyof typeof themes] || themes.development
    return Array.from({ length: Math.min(count, taskList.length) }, (_, i) => taskList[i])
  }
}
