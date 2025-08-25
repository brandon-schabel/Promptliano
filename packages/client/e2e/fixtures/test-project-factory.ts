import { mkdir, writeFile, symlink, chmod } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { TestDataUtils } from './test-data'

export interface TestProjectConfig {
  name?: string
  template: 'web-app' | 'api-service' | 'library' | 'monorepo' | 'simple' | 'custom' | 'empty' | 'minimal' | 'with-symlinks' | 'with-permissions' | 'corrupted'
  includeGit?: boolean
  includeDependencies?: boolean
  fileCount?: number
  depth?: number
  addSymlinks?: boolean
  addBinaryFiles?: boolean
  // Additional options for performance/edge case testing
  structure?: string[]
  addLargeFiles?: boolean
  includeVariousFileTypes?: boolean
  includeSymlinks?: boolean
  includeReadOnlyFiles?: boolean
  includeCorruptedFiles?: boolean
}

export interface TestFile {
  path: string
  content: string
  executable?: boolean
}

export interface TestProject {
  name: string
  path: string
  files: TestFile[]
  structure: string[]
}

/**
 * Factory for creating realistic test project structures on disk
 */
export class TestProjectFactory {
  private static readonly BASE_PATH = '/tmp/e2e-test-projects'
  private static readonly MAX_RETRIES = 3

  /**
   * Create a test project with the specified configuration
   */
  static async createProject(config: TestProjectConfig): Promise<TestProject> {
    const projectName = config.name || `test-${config.template}-${Date.now()}`
    const projectPath = join(this.BASE_PATH, projectName)

    // Ensure base directory exists
    await this.ensureDirectory(this.BASE_PATH)

    // Generate project structure
    const files = this.generateProjectFiles(config, projectPath)
    
    // Create project on disk
    await this.createProjectOnDisk(projectPath, files)

    // Get directory structure for verification
    const structure = await this.getDirectoryStructure(projectPath)

    return {
      name: projectName,
      path: projectPath,
      files,
      structure
    }
  }

  /**
   * Create multiple test projects for testing
   */
  static async createMultipleProjects(configs: TestProjectConfig[]): Promise<TestProject[]> {
    const projects: TestProject[] = []
    
    for (const config of configs) {
      const project = await this.createProject(config)
      projects.push(project)
    }

    return projects
  }

  /**
   * Clean up test projects
   */
  static async cleanupProjects(projects?: TestProject[]): Promise<void> {
    if (projects) {
      // Clean up specific projects
      for (const project of projects) {
        await this.removeDirectory(project.path)
      }
    } else {
      // Clean up all test projects
      if (existsSync(this.BASE_PATH)) {
        await this.removeDirectory(this.BASE_PATH)
      }
    }
  }

  /**
   * Generate project files based on template
   */
  private static generateProjectFiles(config: TestProjectConfig, projectPath: string): TestFile[] {
    const files: TestFile[] = []

    switch (config.template) {
      case 'web-app':
        files.push(...this.generateWebAppFiles())
        break
      case 'api-service':
        files.push(...this.generateApiServiceFiles())
        break
      case 'library':
        files.push(...this.generateLibraryFiles())
        break
      case 'monorepo':
        files.push(...this.generateMonorepoFiles())
        break
      case 'simple':
        files.push(...this.generateSimpleProjectFiles())
        break
      case 'custom':
        files.push(...this.generateCustomProjectFiles(config))
        break
      case 'empty':
        // Empty project - no files generated
        break
      case 'minimal':
        files.push(...this.generateMinimalProjectFiles())
        break
      case 'with-symlinks':
        files.push(...this.generateProjectWithSymlinks())
        break
      case 'with-permissions':
        files.push(...this.generateProjectWithPermissions())
        break
      case 'corrupted':
        files.push(...this.generateCorruptedProjectFiles())
        break
    }

    // Add common files
    files.push(...this.generateCommonFiles(config))

    // Add binary files if requested
    if (config.addBinaryFiles) {
      files.push(...this.generateBinaryFiles())
    }

    // Generate additional files to reach target count
    if (config.fileCount && files.length < config.fileCount) {
      files.push(...this.generateAdditionalFiles(config.fileCount - files.length))
    }

    return files
  }

  /**
   * Generate web application project structure
   */
  private static generateWebAppFiles(): TestFile[] {
    return [
      {
        path: 'src/index.tsx',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`
      },
      {
        path: 'src/App.tsx',
        content: `import React from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { MainContent } from './components/MainContent'
import './App.css'

function App() {
  return (
    <div className="app">
      <Header />
      <MainContent />
      <Footer />
    </div>
  )
}

export default App
`
      },
      {
        path: 'src/components/Header.tsx',
        content: `import React from 'react'

export function Header() {
  return (
    <header className="header">
      <h1>Test Web Application</h1>
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    </header>
  )
}
`
      },
      {
        path: 'src/components/Footer.tsx',
        content: `import React from 'react'

export function Footer() {
  return (
    <footer className="footer">
      <p>&copy; 2024 Test Application. All rights reserved.</p>
    </footer>
  )
}
`
      },
      {
        path: 'src/components/MainContent.tsx',
        content: `import React, { useState, useEffect } from 'react'
import { fetchData } from '../utils/api'

export function MainContent() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchData()
        setData(result)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <main className="main-content">
      <h2>Welcome to our test application</h2>
      <p>This is a sample React application for E2E testing.</p>
    </main>
  )
}
`
      },
      {
        path: 'src/utils/api.ts',
        content: `const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001'

export async function fetchData() {
  const response = await fetch(\`\${API_BASE}/api/data\`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch data')
  }

  return response.json()
}

export async function postData(data: any) {
  const response = await fetch(\`\${API_BASE}/api/data\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Failed to post data')
  }

  return response.json()
}
`
      },
      {
        path: 'src/styles/index.css',
        content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #282c34;
  padding: 1rem;
  color: white;
}

.main-content {
  flex: 1;
  padding: 2rem;
}

.footer {
  background-color: #f5f5f5;
  padding: 1rem;
  text-align: center;
}
`
      },
      {
        path: 'src/App.css',
        content: `.App {
  text-align: center;
}

.App-logo {
  height: 40vmin;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .App-logo {
    animation: App-logo-spin infinite 20s linear;
  }
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
}
`
      },
      {
        path: 'tests/App.test.tsx',
        content: `import { render, screen } from '@testing-library/react'
import App from '../src/App'

test('renders main heading', () => {
  render(<App />)
  const heading = screen.getByText(/Test Web Application/i)
  expect(heading).toBeInTheDocument()
})

test('renders welcome message', () => {
  render(<App />)
  const welcomeMessage = screen.getByText(/Welcome to our test application/i)
  expect(welcomeMessage).toBeInTheDocument()
})
`
      },
      {
        path: 'public/index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Test web application for E2E testing" />
    <title>Test Web App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`
      }
    ]
  }

  /**
   * Generate API service project structure
   */
  private static generateApiServiceFiles(): TestFile[] {
    return [
      {
        path: 'src/index.js',
        content: `const express = require('express')
const cors = require('cors')
const { routes } = require('./routes')
const { errorHandler } = require('./middleware/errorHandler')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api', routes)

// Error handling
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`)
})
`
      },
      {
        path: 'src/routes/index.js',
        content: `const express = require('express')
const { userRoutes } = require('./users')
const { dataRoutes } = require('./data')

const router = express.Router()

router.use('/users', userRoutes)
router.use('/data', dataRoutes)

router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

module.exports = { routes: router }
`
      },
      {
        path: 'src/routes/users.js',
        content: `const express = require('express')
const { UserService } = require('../services/userService')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const users = await UserService.getAllUsers()
    res.json(users)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const user = await UserService.getUserById(req.params.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const user = await UserService.createUser(req.body)
    res.status(201).json(user)
  } catch (error) {
    next(error)
  }
})

module.exports = { userRoutes: router }
`
      },
      {
        path: 'src/services/userService.js',
        content: `const { db } = require('../config/database')

class UserService {
  static async getAllUsers() {
    return db.query('SELECT * FROM users')
  }

  static async getUserById(id) {
    const result = await db.query('SELECT * FROM users WHERE id = ?', [id])
    return result[0]
  }

  static async createUser(userData) {
    const { name, email } = userData
    
    if (!name || !email) {
      throw new Error('Name and email are required')
    }

    const result = await db.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    )

    return { id: result.insertId, name, email }
  }

  static async updateUser(id, userData) {
    const { name, email } = userData
    
    await db.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id]
    )

    return this.getUserById(id)
  }

  static async deleteUser(id) {
    await db.query('DELETE FROM users WHERE id = ?', [id])
  }
}

module.exports = { UserService }
`
      },
      {
        path: 'src/middleware/errorHandler.js',
        content: `function errorHandler(err, req, res, next) {
  console.error('Error:', err)

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    })
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized'
    })
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
}

module.exports = { errorHandler }
`
      }
    ]
  }

  /**
   * Generate library project structure
   */
  private static generateLibraryFiles(): TestFile[] {
    return [
      {
        path: 'src/index.ts',
        content: `export { Logger } from './logger'
export { Utils } from './utils'
export { Validator } from './validator'
export type { LogLevel, LogEntry, ValidationRule } from './types'
`
      },
      {
        path: 'src/logger.ts',
        content: `import { LogLevel, LogEntry } from './types'

export class Logger {
  private level: LogLevel = 'info'

  constructor(level: LogLevel = 'info') {
    this.level = level
  }

  log(message: string, level: LogLevel = 'info', meta?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    }

    if (this.shouldLog(level)) {
      console.log(JSON.stringify(entry))
    }
  }

  info(message: string, meta?: any): void {
    this.log(message, 'info', meta)
  }

  warn(message: string, meta?: any): void {
    this.log(message, 'warn', meta)
  }

  error(message: string, meta?: any): void {
    this.log(message, 'error', meta)
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.level)
  }
}
`
      },
      {
        path: 'src/types.ts',
        content: `export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  meta?: any
}

export interface ValidationRule {
  field: string
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern'
  value?: any
  message?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}
`
      }
    ]
  }

  /**
   * Generate simple project structure
   */
  private static generateSimpleProjectFiles(): TestFile[] {
    return [
      {
        path: 'index.js',
        content: `console.log('Hello, World!')

function greet(name) {
  return \`Hello, \${name}!\`
}

module.exports = { greet }
`
      },
      {
        path: 'utils.js',
        content: `function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function reverseString(str) {
  return str.split('').reverse().join('')
}

module.exports = {
  capitalize,
  reverseString
}
`
      }
    ]
  }

  /**
   * Generate monorepo structure
   */
  private static generateMonorepoFiles(): TestFile[] {
    return [
      {
        path: 'packages/core/src/index.ts',
        content: `export * from './core'
export * from './types'
`
      },
      {
        path: 'packages/core/src/core.ts',
        content: `export class Core {
  constructor(private options: CoreOptions = {}) {}

  initialize(): void {
    console.log('Core initialized')
  }
}

interface CoreOptions {
  debug?: boolean
}
`
      },
      {
        path: 'packages/ui/src/index.ts',
        content: `export { Button } from './Button'
export { Input } from './Input'
export { Modal } from './Modal'
`
      },
      {
        path: 'packages/ui/src/Button.tsx',
        content: `import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button 
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
`
      },
      {
        path: 'apps/web/src/App.tsx',
        content: `import React from 'react'
import { Button } from '@repo/ui'
import { Core } from '@repo/core'

const core = new Core({ debug: true })

function App() {
  return (
    <div className="app">
      <h1>Monorepo Web App</h1>
      <Button onClick={() => core.initialize()}>
        Initialize Core
      </Button>
    </div>
  )
}

export default App
`
      }
    ]
  }

  /**
   * Generate common files (package.json, README, etc.)
   */
  private static generateCommonFiles(config: TestProjectConfig): TestFile[] {
    const files: TestFile[] = []

    // package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify({
        name: config.name || `test-${config.template}`,
        version: '1.0.0',
        description: `Test ${config.template} project for E2E testing`,
        main: config.template === 'library' ? 'dist/index.js' : 'src/index.js',
        scripts: {
          start: 'node src/index.js',
          build: 'tsc',
          test: 'jest',
          lint: 'eslint src/**/*.{js,ts,tsx}'
        },
        dependencies: config.includeDependencies ? {
          react: '^18.0.0',
          express: '^4.18.0',
          typescript: '^5.0.0'
        } : {},
        devDependencies: config.includeDependencies ? {
          '@types/react': '^18.0.0',
          jest: '^29.0.0',
          eslint: '^8.0.0'
        } : {}
      }, null, 2)
    })

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${config.name || `Test ${config.template.charAt(0).toUpperCase() + config.template.slice(1)} Project`}

This is a test project created for E2E testing purposes.

## Project Type
${config.template}

## Structure
This project includes:
- Source code in \`src/\` directory
- Tests in \`tests/\` or \`__tests__\` directory  
- Configuration files
- Documentation

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`bash
npm start
\`\`\`

## Testing
\`\`\`bash
npm test
\`\`\`

## Generated for E2E Testing
This project was automatically generated for Playwright E2E testing.
Created at: ${new Date().toISOString()}
`
    })

    // .gitignore
    if (config.includeGit !== false) {
      files.push({
        path: '.gitignore',
        content: `node_modules/
dist/
build/
*.log
.env
.DS_Store
coverage/
*.test.js.snap
`
      })
    }

    // tsconfig.json for TypeScript projects
    if (config.template === 'web-app' || config.template === 'library') {
      files.push({
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'es5',
            lib: ['dom', 'dom.iterable', 'es6'],
            allowJs: true,
            skipLibCheck: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            moduleResolution: 'node',
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx'
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist', 'build']
        }, null, 2)
      })
    }

    return files
  }

  /**
   * Generate binary files for testing
   */
  private static generateBinaryFiles(): TestFile[] {
    return [
      {
        path: 'assets/logo.png',
        content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // 1x1 PNG
      },
      {
        path: 'assets/icon.svg',
        content: `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
</svg>`
      }
    ]
  }

  /**
   * Generate additional files to reach target count
   */
  private static generateAdditionalFiles(count: number): TestFile[] {
    const files: TestFile[] = []

    for (let i = 0; i < count; i++) {
      files.push({
        path: `generated/file-${i}.txt`,
        content: `This is generated file #${i}\nCreated for testing purposes.\nContent: ${TestDataUtils.randomString(50)}`
      })
    }

    return files
  }

  /**
   * Create project files on disk
   */
  private static async createProjectOnDisk(projectPath: string, files: TestFile[]): Promise<void> {
    for (const file of files) {
      const filePath = join(projectPath, file.path)
      const fileDir = dirname(filePath)

      // Ensure directory exists
      await this.ensureDirectory(fileDir)

      // Write file
      await writeFile(filePath, file.content, 'utf8')

      // Make executable if needed
      if (file.executable) {
        await chmod(filePath, 0o755)
      }
    }
  }

  /**
   * Ensure directory exists
   */
  private static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true })
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Remove directory recursively
   */
  private static async removeDirectory(dirPath: string): Promise<void> {
    if (existsSync(dirPath)) {
      const { rm } = await import('fs/promises')
      await rm(dirPath, { recursive: true, force: true })
    }
  }

  /**
   * Get directory structure for verification
   */
  private static async getDirectoryStructure(dirPath: string): Promise<string[]> {
    const { readdir, stat } = await import('fs/promises')
    const structure: string[] = []

    async function traverse(currentPath: string, relativePath: string = ''): Promise<void> {
      const entries = await readdir(currentPath)

      for (const entry of entries) {
        const fullPath = join(currentPath, entry)
        const relativeEntry = relativePath ? join(relativePath, entry) : entry
        const stats = await stat(fullPath)

        if (stats.isDirectory()) {
          structure.push(`${relativeEntry}/`)
          await traverse(fullPath, relativeEntry)
        } else {
          structure.push(relativeEntry)
        }
      }
    }

    await traverse(dirPath)
    return structure.sort()
  }

  /**
   * Create a realistic web application project for testing
   */
  static async createWebAppProject(): Promise<TestProject> {
    return this.createProject({
      template: 'web-app',
      includeDependencies: true,
      includeGit: true
    })
  }

  /**
   * Create a large project for performance testing
   */
  static async createLargeProject(): Promise<TestProject> {
    return this.createProject({
      template: 'monorepo',
      fileCount: 100,
      depth: 5,
      includeDependencies: true
    })
  }

  /**
   * Create a simple project for basic testing
   */
  static async createSimpleProject(): Promise<TestProject> {
    return this.createProject({
      template: 'simple',
      includeGit: false,
      includeDependencies: false
    })
  }

  /**
   * Generate custom project files based on structure config
   */
  private static generateCustomProjectFiles(config: TestProjectConfig): TestFile[] {
    const files: TestFile[] = []

    if (config.structure) {
      for (const filePath of config.structure) {
        if (!filePath.endsWith('/')) {
          files.push({
            path: filePath,
            content: `# ${filePath}\n\nThis is a custom test file generated for E2E testing.\nFile: ${filePath}\nGenerated at: ${new Date().toISOString()}\n`
          })
        }
      }
    }

    return files
  }

  /**
   * Generate minimal project files (just README)
   */
  private static generateMinimalProjectFiles(): TestFile[] {
    return [
      {
        path: 'README.md',
        content: `# Minimal Test Project\n\nThis is a minimal project for E2E testing.\n`
      }
    ]
  }

  /**
   * Generate project with symlinks
   */
  private static generateProjectWithSymlinks(): TestFile[] {
    return [
      {
        path: 'src/main.js',
        content: `console.log('Main file with symlinks');\n`
      },
      {
        path: 'lib/utils.js',
        content: `export function utility() { return 'utility'; }\n`
      },
      // Note: Actual symlinks would be created during project creation
      {
        path: 'README.md',
        content: `# Project with Symlinks\n\nThis project contains symlinks for testing.\n`
      }
    ]
  }

  /**
   * Generate project with permission restrictions
   */
  private static generateProjectWithPermissions(): TestFile[] {
    return [
      {
        path: 'readonly-file.txt',
        content: `This file is read-only for testing permissions.\n`
      },
      {
        path: 'normal-file.js',
        content: `console.log('Normal file with standard permissions');\n`
      },
      {
        path: 'README.md',
        content: `# Project with Permissions\n\nThis project has files with different permissions.\n`
      }
    ]
  }

  /**
   * Generate corrupted project files
   */
  private static generateCorruptedProjectFiles(): TestFile[] {
    return [
      {
        path: 'corrupted.json',
        content: `{ "invalid": json, "missing": quote }`
      },
      {
        path: 'incomplete.js',
        content: `function incomplete() {\n  // Missing closing brace`
      },
      {
        path: 'README.md',
        content: `# Corrupted Project\n\nThis project has intentionally corrupted files for testing.\n`
      }
    ]
  }
}