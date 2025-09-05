/**
 * Test data fixtures for project tests
 * Provides sample data for consistent testing
 */

export const testProjects = {
  simple: {
    name: 'Test Project Simple',
    path: '/tmp/test-project-simple',
    description: 'A simple test project for E2E testing'
  },
  
  webApp: {
    name: 'Test Web App',
    path: '/tmp/test-web-app',
    description: 'A web application project for testing'
  },
  
  apiProject: {
    name: 'Test API Project',
    path: '/tmp/test-api-project',
    description: 'An API project for testing backend features'
  }
}

export const testFiles = {
  simple: [
    {
      name: 'index.js',
      path: 'src/index.js',
      content: `// Main entry point
console.log('Hello, World!');

function main() {
  console.log('Application started');
}

main();`
    },
    {
      name: 'utils.js',
      path: 'src/utils.js',
      content: `// Utility functions
export function formatDate(date) {
  return date.toISOString();
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}`
    },
    {
      name: 'README.md',
      path: 'README.md',
      content: `# Test Project

This is a test project for E2E testing.

## Features
- Simple structure
- Easy to test
- Minimal dependencies`
    }
  ],
  
  webApp: [
    {
      name: 'App.tsx',
      path: 'src/App.tsx',
      content: `import React from 'react';

export function App() {
  return (
    <div className="app">
      <h1>Test Web App</h1>
      <p>Welcome to the test application</p>
    </div>
  );
}`
    },
    {
      name: 'index.tsx',
      path: 'src/index.tsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(<App />);`
    },
    {
      name: 'package.json',
      path: 'package.json',
      content: `{
  "name": "test-web-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}`
    }
  ]
}

export const testPrompts = [
  {
    name: 'Code Review',
    content: 'Please review the following code for best practices, potential bugs, and improvements.',
    tags: ['review', 'code-quality']
  },
  {
    name: 'Refactor Function',
    content: 'Refactor this function to be more readable and maintainable while preserving its functionality.',
    tags: ['refactoring', 'clean-code']
  },
  {
    name: 'Write Tests',
    content: 'Write comprehensive unit tests for the selected code, including edge cases.',
    tags: ['testing', 'quality-assurance']
  },
  {
    name: 'Add Documentation',
    content: 'Add clear documentation comments explaining the purpose, parameters, and return values.',
    tags: ['documentation', 'code-quality']
  },
  {
    name: 'Performance Optimization',
    content: 'Analyze and optimize this code for better performance.',
    tags: ['performance', 'optimization']
  }
]

export const testTickets = [
  {
    title: 'Setup project structure',
    description: 'Initialize the basic project structure with necessary folders and files',
    status: 'open',
    priority: 'high'
  },
  {
    title: 'Implement authentication',
    description: 'Add user authentication with login and registration',
    status: 'in_progress',
    priority: 'high'
  },
  {
    title: 'Create API endpoints',
    description: 'Develop RESTful API endpoints for CRUD operations',
    status: 'open',
    priority: 'medium'
  },
  {
    title: 'Add unit tests',
    description: 'Write unit tests for core functionality',
    status: 'open',
    priority: 'medium'
  },
  {
    title: 'Setup CI/CD pipeline',
    description: 'Configure continuous integration and deployment',
    status: 'open',
    priority: 'low'
  }
]

export const testQueues = [
  {
    name: 'Development Queue',
    description: 'Queue for development tasks',
    maxParallelItems: 3
  },
  {
    name: 'Testing Queue',
    description: 'Queue for testing and QA tasks',
    maxParallelItems: 2
  },
  {
    name: 'Deployment Queue',
    description: 'Queue for deployment and release tasks',
    maxParallelItems: 1
  }
]

export const testTasks = [
  {
    content: 'Review and merge pull request',
    description: 'Review the code changes and merge if approved',
    estimatedHours: 1
  },
  {
    content: 'Update documentation',
    description: 'Update the project documentation with new features',
    estimatedHours: 2
  },
  {
    content: 'Fix failing tests',
    description: 'Investigate and fix the failing unit tests',
    estimatedHours: 3
  },
  {
    content: 'Deploy to staging',
    description: 'Deploy the latest changes to staging environment',
    estimatedHours: 1
  }
]

export const testGitData = {
  branches: ['main', 'develop', 'feature/auth', 'bugfix/api-error'],
  
  commits: [
    {
      hash: 'abc123',
      message: 'Initial commit',
      author: 'Test User',
      date: '2024-01-01'
    },
    {
      hash: 'def456',
      message: 'Add authentication',
      author: 'Test User',
      date: '2024-01-02'
    },
    {
      hash: 'ghi789',
      message: 'Fix API error handling',
      author: 'Test User',
      date: '2024-01-03'
    }
  ],
  
  changedFiles: [
    {
      name: 'src/auth.js',
      status: 'modified',
      additions: 45,
      deletions: 12
    },
    {
      name: 'src/api.js',
      status: 'modified',
      additions: 23,
      deletions: 5
    },
    {
      name: 'src/newfile.js',
      status: 'added',
      additions: 100,
      deletions: 0
    }
  ]
}

/**
 * Helper function to get random test data
 */
export function getRandomProject() {
  const projects = Object.values(testProjects)
  return projects[Math.floor(Math.random() * projects.length)]
}

export function getRandomPrompts(count: number = 3) {
  const shuffled = [...testPrompts].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getRandomTickets(count: number = 3) {
  const shuffled = [...testTickets].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

/**
 * Generate unique test data with timestamp
 */
export function generateUniqueProject(suffix?: string) {
  const timestamp = Date.now()
  const nameSuffix = suffix || timestamp.toString()
  
  return {
    name: `Test Project ${nameSuffix}`,
    path: `/tmp/test-project-${nameSuffix}`,
    description: `Auto-generated test project ${nameSuffix}`
  }
}

/**
 * Create a complete test scenario
 */
export function createTestScenario() {
  return {
    project: generateUniqueProject(),
    files: testFiles.simple,
    prompts: getRandomPrompts(3),
    tickets: getRandomTickets(3),
    queues: testQueues,
    tasks: testTasks
  }
}