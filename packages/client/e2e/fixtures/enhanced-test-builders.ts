/**
 * Enhanced test data builders and scenario generators
 * Provides fluent API for creating complex test scenarios with relationships
 */

import { TestDataFactory, type ProjectData, type PromptData, type TicketData, type QueueData, type TaskData } from './test-data'

// ========================================
// BUILDER BASE CLASS
// ========================================

abstract class BaseBuilder<T> {
  protected data: Partial<T> = {}
  protected testId: string

  constructor(testId?: string) {
    this.testId = testId || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  abstract build(): T

  /**
   * Reset the builder to start fresh
   */
  reset(): this {
    this.data = {}
    return this
  }

  /**
   * Apply a partial update to the data
   */
  with(partialData: Partial<T>): this {
    Object.assign(this.data, partialData)
    return this
  }
}

// ========================================
// PROJECT BUILDER
// ========================================

export class ProjectBuilder extends BaseBuilder<ProjectData> {
  /**
   * Set project name with test isolation
   */
  name(name: string): this {
    this.data.name = `${this.testId}_${name}`
    return this
  }

  /**
   * Set project path with test isolation
   */
  path(path: string): this {
    this.data.path = `/tmp/e2e-tests/${this.testId}${path}`
    return this
  }

  /**
   * Set project description
   */
  description(description: string): this {
    this.data.description = description
    return this
  }

  /**
   * Create a web application project
   */
  asWebApp(): this {
    return this
      .name('Web Application')
      .description('A modern React web application with TypeScript')
      .path('/web-app')
  }

  /**
   * Create an API service project
   */
  asAPIService(): this {
    return this
      .name('API Service')
      .description('RESTful API service built with Hono and Bun')
      .path('/api-service')
  }

  /**
   * Create a mobile app project
   */
  asMobileApp(): this {
    return this
      .name('Mobile App')
      .description('Cross-platform mobile application')
      .path('/mobile-app')
  }

  /**
   * Create a library project
   */
  asLibrary(): this {
    return this
      .name('JavaScript Library')
      .description('Reusable JavaScript/TypeScript library')
      .path('/library')
  }

  build(): ProjectData {
    return TestDataFactory.createProject({
      name: this.data.name || `${this.testId}_project`,
      path: this.data.path || `/tmp/e2e-tests/${this.testId}/project`,
      description: this.data.description || `Test project ${this.testId}`,
      ...this.data
    })
  }
}

// ========================================
// PROMPT BUILDER
// ========================================

export class PromptBuilder extends BaseBuilder<PromptData> {
  /**
   * Set prompt title with test isolation
   */
  title(title: string): this {
    this.data.title = `${this.testId}_${title}`
    return this
  }

  /**
   * Set prompt content
   */
  content(content: string): this {
    this.data.content = content
    return this
  }

  /**
   * Set description
   */
  description(description: string): this {
    this.data.description = description
    return this
  }

  /**
   * Add tags
   */
  tags(...tags: string[]): this {
    this.data.tags = [...(this.data.tags || []), ...tags]
    return this
  }

  /**
   * Create a code review prompt
   */
  asCodeReview(): this {
    return this
      .title('Code Review Prompt')
      .content('Please review the following code and provide feedback:\n\n{{code}}\n\nFocus on:\n- Code quality\n- Performance\n- Security\n- Best practices')
      .description('Comprehensive code review assistant')
      .tags('code', 'review', 'quality')
  }

  /**
   * Create a documentation prompt
   */
  asDocumentation(): this {
    return this
      .title('Documentation Generator')
      .content('Create comprehensive documentation for:\n\n{{feature}}\n\nInclude:\n- Overview\n- Usage examples\n- API reference\n- Best practices')
      .description('Generates technical documentation')
      .tags('docs', 'writing', 'technical')
  }

  /**
   * Create a testing prompt
   */
  asTesting(): this {
    return this
      .title('Test Generator')
      .content('Generate comprehensive tests for:\n\n{{functionality}}\n\nInclude:\n- Unit tests\n- Integration tests\n- Edge cases\n- Error scenarios')
      .description('Creates automated test suites')
      .tags('test', 'qa', 'automation')
  }

  /**
   * Create a bug analysis prompt
   */
  asBugAnalysis(): this {
    return this
      .title('Bug Analysis Expert')
      .content('Analyze the following bug report:\n\n{{bugReport}}\n\nProvide:\n- Root cause analysis\n- Steps to reproduce\n- Proposed solution\n- Prevention strategies')
      .description('Analyzes and helps resolve bugs')
      .tags('bug', 'analysis', 'debugging')
  }

  /**
   * Create a refactoring prompt
   */
  asRefactoring(): this {
    return this
      .title('Code Refactoring Assistant')
      .content('Refactor the following code to improve:\n\n{{code}}\n\nFocus on:\n- Clean code principles\n- Performance optimization\n- Maintainability\n- Design patterns')
      .description('Helps refactor and improve existing code')
      .tags('refactor', 'clean-code', 'optimization')
  }

  build(): PromptData {
    return TestDataFactory.createPrompt({
      title: this.data.title || `${this.testId}_prompt`,
      content: this.data.content || `Test prompt content for ${this.testId}`,
      description: this.data.description || `Test prompt description`,
      tags: this.data.tags || ['test'],
      ...this.data
    })
  }
}

// ========================================
// TICKET BUILDER
// ========================================

export class TicketBuilder extends BaseBuilder<TicketData> {
  /**
   * Set ticket title with test isolation
   */
  title(title: string): this {
    this.data.title = `${this.testId}_${title}`
    return this
  }

  /**
   * Set ticket overview
   */
  overview(overview: string): this {
    this.data.overview = overview
    return this
  }

  /**
   * Set priority
   */
  priority(priority: 'low' | 'normal' | 'high'): this {
    this.data.priority = priority
    return this
  }

  /**
   * Add tasks
   */
  tasks(...tasks: string[]): this {
    this.data.tasks = [...(this.data.tasks || []), ...tasks]
    return this
  }

  /**
   * Set project ID
   */
  forProject(projectId: number): this {
    this.data.projectId = projectId
    return this
  }

  /**
   * Create a bug fix ticket
   */
  asBugFix(): this {
    return this
      .title('Bug Fix')
      .overview('Critical bug affecting user experience')
      .priority('high')
      .tasks(
        'Investigate root cause',
        'Implement fix',
        'Add regression tests',
        'Verify fix in staging',
        'Deploy to production'
      )
  }

  /**
   * Create a feature ticket
   */
  asFeature(): this {
    return this
      .title('New Feature')
      .overview('Implement new functionality to enhance user experience')
      .priority('normal')
      .tasks(
        'Design feature specification',
        'Create UI mockups',
        'Implement backend logic',
        'Build frontend interface',
        'Write comprehensive tests',
        'Update documentation'
      )
  }

  /**
   * Create a refactoring ticket
   */
  asRefactoring(): this {
    return this
      .title('Code Refactoring')
      .overview('Improve code quality and maintainability')
      .priority('normal')
      .tasks(
        'Analyze current code structure',
        'Identify refactoring opportunities',
        'Plan refactoring strategy',
        'Implement improvements',
        'Update tests and documentation'
      )
  }

  /**
   * Create a performance improvement ticket
   */
  asPerformanceImprovement(): this {
    return this
      .title('Performance Optimization')
      .overview('Optimize application performance and response times')
      .priority('normal')
      .tasks(
        'Profile current performance',
        'Identify bottlenecks',
        'Implement optimizations',
        'Measure improvements',
        'Monitor production performance'
      )
  }

  /**
   * Create a security ticket
   */
  asSecurity(): this {
    return this
      .title('Security Enhancement')
      .overview('Improve application security and fix vulnerabilities')
      .priority('high')
      .tasks(
        'Conduct security audit',
        'Identify vulnerabilities',
        'Implement security fixes',
        'Update security policies',
        'Verify security improvements'
      )
  }

  build(): TicketData {
    return TestDataFactory.createTicket({
      title: this.data.title || `${this.testId}_ticket`,
      overview: this.data.overview || `Test ticket overview for ${this.testId}`,
      priority: this.data.priority || 'normal',
      tasks: this.data.tasks || [`Task 1 for ${this.testId}`, `Task 2 for ${this.testId}`],
      projectId: this.data.projectId,
      ...this.data
    })
  }
}

// ========================================
// SCENARIO BUILDER
// ========================================

export class ScenarioBuilder {
  private testId: string
  private projectData?: ProjectData
  private promptsData: PromptData[] = []
  private ticketsData: TicketData[] = []
  private queuesData: QueueData[] = []

  constructor(name?: string) {
    this.testId = `scenario_${name || 'default'}_${Date.now()}`
  }

  /**
   * Set the project for this scenario
   */
  withProject(builder: (p: ProjectBuilder) => ProjectBuilder): this {
    const projectBuilder = new ProjectBuilder(this.testId)
    this.projectData = builder(projectBuilder).build()
    return this
  }

  /**
   * Add prompts to the scenario
   */
  withPrompts(...builders: Array<(p: PromptBuilder) => PromptBuilder>): this {
    builders.forEach(builderFn => {
      const promptBuilder = new PromptBuilder(this.testId)
      this.promptsData.push(builderFn(promptBuilder).build())
    })
    return this
  }

  /**
   * Add tickets to the scenario
   */
  withTickets(...builders: Array<(t: TicketBuilder) => TicketBuilder>): this {
    builders.forEach(builderFn => {
      const ticketBuilder = new TicketBuilder(this.testId)
      this.ticketsData.push(builderFn(ticketBuilder).build())
    })
    return this
  }

  /**
   * Add queues to the scenario
   */
  withQueues(...queues: Partial<QueueData>[]): this {
    queues.forEach(queueData => {
      this.queuesData.push(TestDataFactory.createQueue({
        name: `${this.testId}_${queueData.name || 'queue'}`,
        ...queueData
      }))
    })
    return this
  }

  /**
   * Build the complete scenario
   */
  build() {
    return {
      testId: this.testId,
      project: this.projectData || new ProjectBuilder(this.testId).build(),
      prompts: this.promptsData,
      tickets: this.ticketsData,
      queues: this.queuesData
    }
  }
}

// ========================================
// PREDEFINED SCENARIOS
// ========================================

export class PredefinedScenarios {
  /**
   * Web development project scenario
   */
  static webDevelopment(): ScenarioBuilder {
    return new ScenarioBuilder('web_dev')
      .withProject(p => p.asWebApp())
      .withPrompts(
        p => p.asCodeReview(),
        p => p.asTesting(),
        p => p.asDocumentation()
      )
      .withTickets(
        t => t.asFeature().title('User Authentication'),
        t => t.asFeature().title('Dashboard Implementation'),
        t => t.asBugFix().title('Login Form Validation')
      )
      .withQueues(
        { name: 'Development', description: 'Active development tasks', maxParallelItems: 3 },
        { name: 'Review', description: 'Code review queue', maxParallelItems: 2 }
      )
  }

  /**
   * API development scenario
   */
  static apiDevelopment(): ScenarioBuilder {
    return new ScenarioBuilder('api_dev')
      .withProject(p => p.asAPIService())
      .withPrompts(
        p => p.asCodeReview(),
        p => p.asTesting().tags('api', 'integration'),
        p => p.asDocumentation().tags('api', 'swagger')
      )
      .withTickets(
        t => t.asFeature().title('REST API Endpoints'),
        t => t.asSecurity().title('Authentication Middleware'),
        t => t.asPerformanceImprovement().title('Database Query Optimization')
      )
      .withQueues(
        { name: 'Backend', description: 'Backend development tasks', maxParallelItems: 2 },
        { name: 'Testing', description: 'API testing queue', maxParallelItems: 3 }
      )
  }

  /**
   * Bug fixing and maintenance scenario
   */
  static maintenance(): ScenarioBuilder {
    return new ScenarioBuilder('maintenance')
      .withProject(p => p.name('Legacy System').description('Existing system requiring maintenance'))
      .withPrompts(
        p => p.asBugAnalysis(),
        p => p.asRefactoring(),
        p => p.asTesting().tags('regression', 'qa')
      )
      .withTickets(
        t => t.asBugFix().title('Memory Leak Issue').priority('high'),
        t => t.asRefactoring().title('Legacy Code Modernization'),
        t => t.asSecurity().title('Security Vulnerability Fix')
      )
      .withQueues(
        { name: 'Urgent', description: 'Critical bug fixes', maxParallelItems: 1 },
        { name: 'Maintenance', description: 'Regular maintenance tasks', maxParallelItems: 2 }
      )
  }

  /**
   * Full-stack development scenario
   */
  static fullStack(): ScenarioBuilder {
    return new ScenarioBuilder('fullstack')
      .withProject(p => p.name('E-commerce Platform').description('Full-stack e-commerce application'))
      .withPrompts(
        p => p.asCodeReview(),
        p => p.asDocumentation(),
        p => p.asTesting(),
        p => p.asRefactoring(),
        p => p.asBugAnalysis()
      )
      .withTickets(
        t => t.asFeature().title('Product Catalog').priority('high'),
        t => t.asFeature().title('Shopping Cart'),
        t => t.asFeature().title('Payment Integration'),
        t => t.asSecurity().title('User Data Protection'),
        t => t.asPerformanceImprovement().title('Page Load Optimization')
      )
      .withQueues(
        { name: 'Frontend', description: 'Frontend development', maxParallelItems: 2 },
        { name: 'Backend', description: 'Backend development', maxParallelItems: 2 },
        { name: 'Integration', description: 'Integration tasks', maxParallelItems: 1 },
        { name: 'QA', description: 'Quality assurance', maxParallelItems: 3 }
      )
  }

  /**
   * Minimal testing scenario
   */
  static minimal(): ScenarioBuilder {
    return new ScenarioBuilder('minimal')
      .withProject(p => p.name('Simple Test Project'))
      .withPrompts(p => p.title('Simple Prompt').content('Test content'))
      .withTickets(t => t.title('Test Ticket').overview('Simple test ticket'))
      .withQueues({ name: 'Test Queue', maxParallelItems: 1 })
  }
}

// ========================================
// FACTORY FUNCTIONS FOR EASY USE
// ========================================

/**
 * Create a new project builder
 */
export function createProject(testId?: string): ProjectBuilder {
  return new ProjectBuilder(testId)
}

/**
 * Create a new prompt builder
 */
export function createPrompt(testId?: string): PromptBuilder {
  return new PromptBuilder(testId)
}

/**
 * Create a new ticket builder
 */
export function createTicket(testId?: string): TicketBuilder {
  return new TicketBuilder(testId)
}

/**
 * Create a new scenario builder
 */
export function createScenario(name?: string): ScenarioBuilder {
  return new ScenarioBuilder(name)
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Generate realistic file structure for a project type
 */
export function generateFileStructure(projectType: 'web' | 'api' | 'mobile' | 'library'): string[] {
  const common = [
    'package.json',
    'README.md',
    'tsconfig.json',
    '.gitignore',
    '.env.example'
  ]

  const structures = {
    web: [
      ...common,
      'src/index.tsx',
      'src/App.tsx',
      'src/components/Header.tsx',
      'src/pages/Home.tsx',
      'src/utils/api.ts',
      'src/hooks/useAuth.ts',
      'public/index.html',
      'public/favicon.ico',
      'tailwind.config.js',
      'vite.config.ts'
    ],
    api: [
      ...common,
      'src/index.ts',
      'src/routes/auth.ts',
      'src/routes/users.ts',
      'src/middleware/cors.ts',
      'src/models/User.ts',
      'src/utils/database.ts',
      'src/utils/validation.ts',
      'tests/auth.test.ts',
      'docker-compose.yml'
    ],
    mobile: [
      ...common,
      'App.tsx',
      'src/screens/Home.tsx',
      'src/components/Button.tsx',
      'src/navigation/AppNavigator.tsx',
      'src/services/api.ts',
      'src/store/index.ts',
      'android/app/build.gradle',
      'ios/Podfile'
    ],
    library: [
      ...common,
      'src/index.ts',
      'src/core/main.ts',
      'src/utils/helpers.ts',
      'src/types/index.ts',
      'tests/main.test.ts',
      'examples/basic.ts',
      'rollup.config.js'
    ]
  }

  return structures[projectType]
}

/**
 * Generate realistic prompt variables based on prompt type
 */
export function generatePromptVariables(promptType: 'code' | 'docs' | 'test' | 'bug' | 'refactor'): string[] {
  const variables = {
    code: ['code', 'language', 'context', 'requirements'],
    docs: ['feature', 'api_endpoint', 'example_usage', 'target_audience'],
    test: ['functionality', 'test_type', 'expected_behavior', 'edge_cases'],
    bug: ['bug_report', 'steps_to_reproduce', 'expected_result', 'actual_result'],
    refactor: ['code', 'improvement_goals', 'constraints', 'design_patterns']
  }

  return variables[promptType] || ['input', 'context', 'output']
}