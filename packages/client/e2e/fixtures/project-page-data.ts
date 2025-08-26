/**
 * Test data factory for Project Page comprehensive testing
 * Provides realistic project structures, prompts, queues, and tickets
 */

import { TestDataFactory } from './test-data'
import type { ProjectData, PromptData, QueueData, TicketData } from './test-data'

export interface ProjectPageTestContext {
  testProject: ProjectData
  testPrompts: PromptData[]
  testQueues: QueueData[]
  testTickets: TicketData[]
  fileStructure: FileStructureData
}

export interface FileStructureData {
  [key: string]: string | FileStructureData
}

export interface TaskData {
  content: string
  description?: string
  ticketId?: number
  status?: 'pending' | 'in_progress' | 'completed'
  priority?: 'low' | 'normal' | 'high'
}

/**
 * Comprehensive test data for Project Page functionality
 */
export const ProjectPageTestData = {
  // Test project with realistic file structure
  testProject: TestDataFactory.createProject({
    name: 'Project Page Test Suite',
    path: '/tmp/project-page-tests',
    description:
      'Comprehensive test project for Project Page features including context management, file tree navigation, prompt organization, flow features, and task queue management.'
  }),

  // Sample prompts for management testing with varied content and purposes
  testPrompts: [
    TestDataFactory.createPrompt({
      title: 'Code Review Assistant',
      content:
        'Review the following {{language}} code for quality, performance, and best practices:\n\n```{{language}}\n{{code}}\n```\n\nProvide specific feedback on:\n- Code structure and organization\n- Performance considerations\n- Security implications\n- Best practice recommendations\n- Potential bugs or issues',
      description: 'AI assistant for comprehensive code reviews',
      tags: ['code-review', 'quality', 'best-practices']
    }),
    TestDataFactory.createPrompt({
      title: 'Documentation Generator',
      content:
        'Generate comprehensive documentation for {{feature_type}}:\n\n**Feature Name:** {{feature_name}}\n**Requirements:** {{requirements}}\n**Technical Details:** {{technical_details}}\n\nPlease include:\n1. Overview and purpose\n2. Installation/setup instructions\n3. Usage examples with code snippets\n4. Configuration options\n5. Troubleshooting guide\n6. Best practices',
      description: 'Automated documentation generation for features and APIs',
      tags: ['documentation', 'automation', 'technical-writing']
    }),
    TestDataFactory.createPrompt({
      title: 'Test Case Creator',
      content:
        'Create comprehensive test cases for the following functionality:\n\n**Functionality:** {{functionality}}\n**Requirements:** {{requirements}}\n**Acceptance Criteria:** {{criteria}}\n\nGenerate test cases covering:\n- Happy path scenarios\n- Edge cases and boundary conditions\n- Error handling\n- Performance considerations\n- Security testing\n- Accessibility compliance\n\nFormat as: Test ID, Description, Steps, Expected Result',
      description: 'Generate thorough test cases for quality assurance',
      tags: ['testing', 'qa', 'test-cases']
    }),
    TestDataFactory.createPrompt({
      title: 'Bug Report Analyzer',
      content:
        'Analyze this bug report and provide a comprehensive solution:\n\n**Bug Report:**\n{{bug_report}}\n\n**Environment:**\n{{environment}}\n\n**Steps to Reproduce:**\n{{steps}}\n\nPlease provide:\n1. Root cause analysis\n2. Potential solutions\n3. Risk assessment\n4. Testing recommendations\n5. Prevention strategies',
      description: 'AI-powered bug analysis and solution recommendations',
      tags: ['debugging', 'bug-analysis', 'troubleshooting']
    }),
    TestDataFactory.createPrompt({
      title: 'API Design Consultant',
      content:
        'Design a RESTful API for the following requirements:\n\n**Service:** {{service_name}}\n**Requirements:** {{requirements}}\n**Data Model:** {{data_model}}\n\nProvide:\n1. Endpoint design (URLs, HTTP methods)\n2. Request/response schemas\n3. Authentication strategy\n4. Error handling approach\n5. Rate limiting considerations\n6. Documentation structure',
      description: 'Expert guidance for API architecture and design',
      tags: ['api-design', 'architecture', 'rest']
    })
  ],

  // Queue system test data with different characteristics
  testQueues: [
    TestDataFactory.createQueue({
      name: 'Features',
      description: 'New feature development and enhancements',
      maxParallelItems: 3
    }),
    TestDataFactory.createQueue({
      name: 'Bugs',
      description: 'Bug fixes and critical issues',
      maxParallelItems: 2
    }),
    TestDataFactory.createQueue({
      name: 'Improvements',
      description: 'Performance optimizations and code improvements',
      maxParallelItems: 1
    }),
    TestDataFactory.createQueue({
      name: 'Research',
      description: 'Research tasks and proof-of-concepts',
      maxParallelItems: 2
    })
  ],

  // Test tickets with realistic tasks and varying complexity
  testTickets: [
    TestDataFactory.createTicket({
      title: 'Implement User Authentication',
      overview: 'Add secure user authentication system with JWT tokens, password validation, and session management',
      priority: 'high',
      tasks: [
        'Design login and registration UI components',
        'Implement JWT token generation and validation',
        'Add password strength validation and hashing',
        'Create user session management system',
        'Add logout functionality with token invalidation',
        'Implement password reset workflow',
        'Add two-factor authentication support',
        'Write comprehensive authentication tests'
      ]
    }),
    TestDataFactory.createTicket({
      title: 'Fix Navigation Bug',
      overview: 'Resolve issue with sidebar navigation causing page refreshes and route conflicts',
      priority: 'normal',
      tasks: [
        'Reproduce navigation issue across browsers',
        'Identify root cause in routing logic',
        'Fix route conflict resolution',
        'Test navigation with deep-linked URLs',
        'Verify browser back/forward functionality',
        'Update navigation-related tests'
      ]
    }),
    TestDataFactory.createTicket({
      title: 'Performance Optimization',
      overview: 'Improve application load times and runtime performance through code splitting and caching',
      priority: 'low',
      tasks: [
        'Profile current performance with web vitals',
        'Identify performance bottlenecks',
        'Implement code splitting for routes',
        'Optimize bundle size with tree shaking',
        'Implement lazy loading for components',
        'Add service worker caching strategy',
        'Measure and document performance improvements'
      ]
    }),
    TestDataFactory.createTicket({
      title: 'Database Migration System',
      overview: 'Create robust database migration system for schema changes and data updates',
      priority: 'normal',
      tasks: [
        'Design migration system architecture',
        'Implement migration runner and versioning',
        'Create rollback mechanism for failed migrations',
        'Add migration status tracking',
        'Write migration creation tooling',
        'Add comprehensive migration tests',
        'Document migration best practices'
      ]
    }),
    TestDataFactory.createTicket({
      title: 'Real-time Notifications',
      overview: 'Add WebSocket-based real-time notifications for user actions and system events',
      priority: 'normal',
      tasks: [
        'Design notification system architecture',
        'Implement WebSocket connection management',
        'Create notification UI components',
        'Add notification persistence and history',
        'Implement notification preferences',
        'Add push notification support',
        'Test notification delivery and reliability'
      ]
    })
  ],

  // Realistic file structure for testing file tree operations
  fileStructure: {
    'src/': {
      'auth/': {
        'login.ts': 'User login functionality',
        'register.ts': 'User registration logic',
        'auth.service.ts': 'Authentication service layer',
        'jwt.utils.ts': 'JWT token utilities',
        'password.utils.ts': 'Password hashing and validation'
      },
      'components/': {
        'ui/': {
          'Button.tsx': 'Reusable button component',
          'Input.tsx': 'Form input component',
          'Modal.tsx': 'Modal dialog component',
          'Toast.tsx': 'Toast notification component'
        },
        'forms/': {
          'LoginForm.tsx': 'User login form',
          'RegistrationForm.tsx': 'User registration form',
          'ProfileForm.tsx': 'User profile editing form'
        },
        'layout/': {
          'Header.tsx': 'Application header',
          'Sidebar.tsx': 'Navigation sidebar',
          'Footer.tsx': 'Application footer'
        }
      },
      'pages/': {
        'HomePage.tsx': 'Landing page component',
        'LoginPage.tsx': 'Login page container',
        'DashboardPage.tsx': 'User dashboard',
        'ProfilePage.tsx': 'User profile page'
      },
      'services/': {
        'api.service.ts': 'HTTP API service layer',
        'websocket.service.ts': 'WebSocket connection service',
        'notification.service.ts': 'Notification management'
      },
      'utils/': {
        'helpers.ts': 'General utility functions',
        'constants.ts': 'Application constants',
        'validation.ts': 'Data validation utilities',
        'formatting.ts': 'Data formatting functions'
      },
      'hooks/': {
        'useAuth.ts': 'Authentication hook',
        'useApi.ts': 'API interaction hook',
        'useLocalStorage.ts': 'Local storage hook'
      },
      'types/': {
        'auth.types.ts': 'Authentication type definitions',
        'api.types.ts': 'API response type definitions',
        'user.types.ts': 'User data type definitions'
      }
    },
    'tests/': {
      'unit/': {
        'auth.test.ts': 'Authentication unit tests',
        'components.test.ts': 'Component unit tests',
        'utils.test.ts': 'Utility function tests'
      },
      'integration/': {
        'api.test.ts': 'API integration tests',
        'auth-flow.test.ts': 'Authentication flow tests'
      },
      'e2e/': {
        'login.spec.ts': 'Login E2E tests',
        'navigation.spec.ts': 'Navigation E2E tests'
      }
    },
    'docs/': {
      'README.md': 'Project documentation',
      'API.md': 'API documentation',
      'CONTRIBUTING.md': 'Contribution guidelines',
      'DEPLOYMENT.md': 'Deployment instructions'
    },
    'config/': {
      'webpack.config.js': 'Webpack configuration',
      'tsconfig.json': 'TypeScript configuration',
      'jest.config.js': 'Jest test configuration',
      'eslint.config.js': 'ESLint configuration'
    },
    'package.json': 'Project dependencies and scripts',
    '.gitignore': 'Git ignore patterns',
    '.env.example': 'Environment variable template',
    'docker-compose.yml': 'Docker compose configuration'
  }
}

/**
 * Factory functions for creating test scenarios
 */
export class ProjectPageDataFactory {
  /**
   * Create a complete project page test context
   */
  static createTestContext(overrides: Partial<ProjectPageTestContext> = {}): ProjectPageTestContext {
    return {
      testProject: ProjectPageTestData.testProject,
      testPrompts: ProjectPageTestData.testPrompts,
      testQueues: ProjectPageTestData.testQueues,
      testTickets: ProjectPageTestData.testTickets,
      fileStructure: ProjectPageTestData.fileStructure,
      ...overrides
    }
  }

  /**
   * Create a minimal test context for specific features
   */
  static createMinimalContext(feature: 'prompts' | 'files' | 'queues' | 'tickets'): Partial<ProjectPageTestContext> {
    const base = {
      testProject: ProjectPageTestData.testProject
    }

    switch (feature) {
      case 'prompts':
        return { ...base, testPrompts: ProjectPageTestData.testPrompts.slice(0, 3) }
      case 'files':
        return { ...base, fileStructure: { 'src/': { 'test.ts': 'Test file' } } }
      case 'queues':
        return { ...base, testQueues: ProjectPageTestData.testQueues.slice(0, 2) }
      case 'tickets':
        return { ...base, testTickets: ProjectPageTestData.testTickets.slice(0, 2) }
      default:
        return base
    }
  }

  /**
   * Create test data for drag-and-drop scenarios
   */
  static createDragDropScenario() {
    return {
      testProject: ProjectPageTestData.testProject,
      testQueues: ProjectPageTestData.testQueues,
      testTickets: ProjectPageTestData.testTickets,
      // Add some unqueued tickets for testing
      unqueuedTickets: [
        TestDataFactory.createTicket({
          title: 'Unqueued Feature Request',
          overview: 'Feature that needs to be assigned to a queue',
          priority: 'normal',
          tasks: ['Analyze requirements', 'Design solution', 'Implement feature']
        }),
        TestDataFactory.createTicket({
          title: 'Unqueued Bug Report',
          overview: 'Bug that needs triage and queue assignment',
          priority: 'high',
          tasks: ['Reproduce bug', 'Identify cause', 'Fix issue']
        })
      ]
    }
  }

  /**
   * Create test data for file operations
   */
  static createFileOperationScenario() {
    return {
      testProject: ProjectPageTestData.testProject,
      fileStructure: ProjectPageTestData.fileStructure,
      // Add git-specific scenarios
      gitModifiedFiles: ['src/auth/login.ts', 'src/components/ui/Button.tsx', 'package.json'],
      stagedFiles: ['src/auth/register.ts', 'docs/README.md']
    }
  }

  /**
   * Create test data for prompt management scenarios
   */
  static createPromptManagementScenario() {
    return {
      testProject: ProjectPageTestData.testProject,
      testPrompts: ProjectPageTestData.testPrompts,
      // Additional prompts for testing edge cases
      largePrompt: TestDataFactory.createPrompt({
        title: 'Complex Architectural Review',
        content: `Perform a comprehensive architectural review of the {{system_type}} system.

**System Overview:**
{{system_overview}}

**Current Architecture:**
{{current_architecture}}

**Requirements and Constraints:**
{{requirements}}

**Review Areas:**

1. **Scalability Analysis**
   - Horizontal and vertical scaling capabilities
   - Bottleneck identification
   - Load distribution strategies
   - Database scaling considerations

2. **Security Assessment**
   - Authentication and authorization flows
   - Data encryption at rest and in transit
   - API security measures
   - Vulnerability assessment

3. **Performance Evaluation**
   - Response time optimization
   - Caching strategies
   - Database query optimization
   - Resource utilization

4. **Maintainability Review**
   - Code organization and structure
   - Documentation quality
   - Testing coverage
   - Deployment processes

5. **Technology Stack Evaluation**
   - Technology choices justification
   - Alternative considerations
   - Migration paths
   - Technical debt assessment

**Deliverables:**
Please provide a detailed report with recommendations for each area.`,
        description: 'Comprehensive architectural review template',
        tags: ['architecture', 'review', 'scalability', 'security', 'performance']
      }),
      emptyPrompt: TestDataFactory.createPrompt({
        title: 'Empty Template',
        content: '',
        description: 'Empty prompt for testing edge cases',
        tags: ['template', 'empty']
      })
    }
  }

  /**
   * Create test data for flow and queue scenarios
   */
  static createFlowScenario() {
    return {
      testProject: ProjectPageTestData.testProject,
      testQueues: ProjectPageTestData.testQueues,
      testTickets: ProjectPageTestData.testTickets,
      queueStatistics: {
        activeQueues: 3,
        totalQueues: 4,
        inProgressItems: 5,
        pendingItems: 12,
        completedItems: 8
      }
    }
  }

  /**
   * Generate realistic file content for testing
   */
  static generateFileContent(filePath: string, fileType?: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase()

    switch (extension) {
      case 'ts':
      case 'tsx':
        return `/**
 * ${filePath}
 * Generated for testing purposes
 */

export interface TestInterface {
  id: number
  name: string
  timestamp: Date
}

export class TestClass {
  private readonly data: TestInterface[]

  constructor(initialData: TestInterface[] = []) {
    this.data = initialData
  }

  public getData(): TestInterface[] {
    return [...this.data]
  }

  public addItem(item: TestInterface): void {
    this.data.push(item)
  }
}

export default TestClass
`
      case 'js':
        return `/**
 * ${filePath}
 * Generated for testing purposes
 */

class TestClass {
  constructor(initialData = []) {
    this.data = initialData
  }

  getData() {
    return [...this.data]
  }

  addItem(item) {
    this.data.push(item)
  }
}

module.exports = TestClass
`
      case 'json':
        return JSON.stringify(
          {
            name: filePath,
            version: '1.0.0',
            description: 'Test configuration file',
            main: 'index.js',
            scripts: {
              test: 'jest',
              build: 'webpack',
              dev: 'webpack-dev-server'
            }
          },
          null,
          2
        )

      case 'md':
        return `# ${filePath}

This is a test markdown file generated for testing purposes.

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

\`\`\`bash
npm install
npm run dev
\`\`\`

## Contributing

Please read CONTRIBUTING.md for details.
`
      default:
        return `// ${filePath}
// Generated test file content
// File type: ${extension || 'unknown'}

console.log('Test file content for ${filePath}')
`
    }
  }

  /**
   * Create realistic task data for tickets
   */
  static createTasksForTicket(ticketTitle: string, taskCount: number = 5): TaskData[] {
    const taskTemplates = {
      authentication: [
        'Design authentication UI components',
        'Implement JWT token handling',
        'Add password validation',
        'Create session management',
        'Write authentication tests'
      ],
      bug: [
        'Reproduce issue in test environment',
        'Identify root cause',
        'Implement fix',
        'Test fix across browsers',
        'Update related documentation'
      ],
      performance: [
        'Profile current performance',
        'Identify bottlenecks',
        'Implement optimizations',
        'Measure improvements',
        'Document performance gains'
      ],
      database: [
        'Design database schema changes',
        'Create migration scripts',
        'Test migrations on staging',
        'Update application code',
        'Document schema changes'
      ],
      notification: [
        'Design notification system',
        'Implement WebSocket connections',
        'Create notification UI',
        'Add notification preferences',
        'Test notification delivery'
      ]
    }

    // Determine task type based on ticket title
    let taskType = 'default'
    const title = ticketTitle.toLowerCase()
    if (title.includes('auth')) taskType = 'authentication'
    else if (title.includes('bug') || title.includes('fix')) taskType = 'bug'
    else if (title.includes('performance') || title.includes('optimiz')) taskType = 'performance'
    else if (title.includes('database') || title.includes('migration')) taskType = 'database'
    else if (title.includes('notification')) taskType = 'notification'

    const templates = taskTemplates[taskType] || [
      'Analyze requirements',
      'Design solution',
      'Implement feature',
      'Write tests',
      'Update documentation'
    ]

    return Array.from({ length: Math.min(taskCount, templates.length) }, (_, index) => ({
      content: templates[index],
      description: `Task ${index + 1} for ${ticketTitle}`,
      status: index === 0 ? ('in_progress' as const) : ('pending' as const),
      priority: index < 2 ? ('high' as const) : ('normal' as const)
    }))
  }
}
