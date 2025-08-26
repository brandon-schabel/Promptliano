/**
 * Comprehensive Test Data Fixtures for Manage Project Modal E2E Tests
 *
 * This file contains all test data needed for comprehensive testing of the
 * Manage Project Modal functionality including project creation, file browser
 * integration, and project management operations.
 */

import { TestDataFactory, type ProjectData } from './test-data'

/**
 * Enhanced project data interface with metadata for comprehensive testing
 */
export interface ProjectWithMetadata extends ProjectData {
  id?: number
  createdAt?: string
  updatedAt?: string
  lastAccessed?: string
  fileCount?: number
  status?: 'active' | 'archived' | 'syncing' | 'error'
  gitBranch?: string
  size?: number
  type?: 'web' | 'mobile' | 'api' | 'desktop' | 'library'
}

/**
 * File system structure for mock file browser testing
 */
export interface MockFileSystemNode {
  type: 'file' | 'directory'
  size?: number
  children?: Record<string, MockFileSystemNode>
  permissions?: 'read' | 'write' | 'readwrite' | 'none'
  lastModified?: string
  isHidden?: boolean
  fileType?: string
}

/**
 * File browser navigation scenario for testing
 */
export interface FileBrowserScenario {
  name: string
  description: string
  startPath: string
  navigationPath: string[]
  expectedPath: string
  expectedFiles?: string[]
  expectedFolders?: string[]
  shouldSucceed?: boolean
  expectedError?: string
}

/**
 * Project creation test data with validation scenarios
 */
export interface ProjectCreationData {
  name: string
  path: string
  description?: string
  shouldValidate?: boolean
  expectedError?: string
  tags?: string[]
}

/**
 * Main test data export for Manage Project Modal tests
 */
export const ManageProjectModalTestData = {
  /**
   * Existing projects for testing project list display and management
   */
  existingProjects: [
    {
      id: 1,
      name: 'Promptliano Core',
      path: '/Users/developer/projects/promptliano',
      description: 'Core Promptliano application development',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T14:30:00Z',
      lastAccessed: '2024-01-20T14:30:00Z',
      fileCount: 245,
      status: 'active' as const,
      gitBranch: 'main',
      size: 2.4 * 1024 * 1024, // 2.4 MB
      type: 'web' as const
    },
    {
      id: 2,
      name: 'E-Commerce App',
      path: '/Users/developer/projects/ecommerce-app',
      description: 'React-based e-commerce platform with modern UI',
      createdAt: '2024-01-10T09:15:00Z',
      updatedAt: '2024-01-18T16:45:00Z',
      lastAccessed: '2024-01-18T16:45:00Z',
      fileCount: 156,
      status: 'active' as const,
      gitBranch: 'feature/checkout-flow',
      size: 1.8 * 1024 * 1024, // 1.8 MB
      type: 'web' as const
    },
    {
      id: 3,
      name: 'Legacy API',
      path: '/Users/developer/old-projects/legacy-api',
      description: 'Legacy Node.js API (needs migration to modern stack)',
      createdAt: '2023-12-01T11:20:00Z',
      updatedAt: '2023-12-15T09:30:00Z',
      lastAccessed: '2023-12-15T09:30:00Z',
      fileCount: 89,
      status: 'archived' as const,
      gitBranch: 'master',
      size: 0.9 * 1024 * 1024, // 0.9 MB
      type: 'api' as const
    },
    {
      id: 4,
      name: 'Mobile Fitness App',
      path: '/Users/developer/mobile/fitness-tracker',
      description: 'React Native fitness tracking application',
      createdAt: '2024-01-05T14:00:00Z',
      updatedAt: '2024-01-19T10:15:00Z',
      lastAccessed: '2024-01-19T10:15:00Z',
      fileCount: 178,
      status: 'syncing' as const,
      gitBranch: 'develop',
      size: 3.2 * 1024 * 1024, // 3.2 MB
      type: 'mobile' as const
    },
    {
      id: 5,
      name: 'Data Analysis Library',
      path: '/Users/developer/libraries/data-viz',
      description: 'TypeScript library for data visualization',
      createdAt: '2023-11-20T08:30:00Z',
      updatedAt: '2024-01-12T13:45:00Z',
      lastAccessed: '2024-01-12T13:45:00Z',
      fileCount: 67,
      status: 'active' as const,
      gitBranch: 'v2.0-beta',
      size: 0.5 * 1024 * 1024, // 0.5 MB
      type: 'library' as const
    }
  ] as ProjectWithMetadata[],

  /**
   * New project creation test data - valid scenarios
   */
  newProjectData: {
    valid: {
      complete: {
        name: 'New Test Project',
        path: '/tmp/test-projects/new-project',
        description: 'A comprehensive test project for E2E testing with all fields filled',
        shouldValidate: true,
        tags: ['test', 'complete']
      } as ProjectCreationData,

      minimal: {
        name: 'Minimal Project',
        path: '/tmp/test-projects/minimal',
        shouldValidate: true,
        tags: ['test', 'minimal']
      } as ProjectCreationData,

      withSpecialChars: {
        name: 'Project with Special-Characters & Symbols!',
        path: '/tmp/test-projects/special-chars-project',
        description: 'Testing special characters in project name & description',
        shouldValidate: true,
        tags: ['test', 'special-chars']
      } as ProjectCreationData,

      longName: {
        name: 'Very Long Project Name That Tests Maximum Length Handling And Display In UI Components',
        path: '/tmp/test-projects/long-name-project',
        description:
          'This project tests how the UI handles very long project names and descriptions that might overflow or need truncation in various display contexts.',
        shouldValidate: true,
        tags: ['test', 'long-name']
      } as ProjectCreationData,

      deepPath: {
        name: 'Deep Path Project',
        path: '/tmp/test-projects/very/deep/nested/directory/structure/project',
        description: 'Testing deeply nested directory paths',
        shouldValidate: true,
        tags: ['test', 'deep-path']
      } as ProjectCreationData
    },

    invalid: {
      emptyName: {
        name: '',
        path: '/tmp/test-projects/empty-name',
        description: 'Project with empty name should fail validation',
        shouldValidate: false,
        expectedError: 'Project name is required',
        tags: ['test', 'validation']
      } as ProjectCreationData,

      emptyPath: {
        name: 'No Path Project',
        path: '',
        description: 'Project with no path should fail validation',
        shouldValidate: false,
        expectedError: 'Project path is required',
        tags: ['test', 'validation']
      } as ProjectCreationData,

      invalidPath: {
        name: 'Invalid Path Project',
        path: '/nonexistent/invalid/path/that/does/not/exist',
        description: 'Project with invalid/non-existent path',
        shouldValidate: false,
        expectedError: 'Directory does not exist',
        tags: ['test', 'validation']
      } as ProjectCreationData,

      duplicateName: {
        name: 'Promptliano Core', // Same as existing project
        path: '/tmp/test-projects/duplicate',
        description: 'Project name already exists - should fail',
        shouldValidate: false,
        expectedError: 'Project name already exists',
        tags: ['test', 'validation']
      } as ProjectCreationData,

      duplicatePath: {
        name: 'Unique Name But Same Path',
        path: '/Users/developer/projects/promptliano', // Same as existing project
        description: 'Path already exists - should fail',
        shouldValidate: false,
        expectedError: 'Project path already exists',
        tags: ['test', 'validation']
      } as ProjectCreationData,

      relativePath: {
        name: 'Relative Path Project',
        path: './relative/path/project',
        description: 'Relative paths should not be allowed',
        shouldValidate: false,
        expectedError: 'Path must be absolute',
        tags: ['test', 'validation']
      } as ProjectCreationData,

      nameWithSlashes: {
        name: 'Project/With/Slashes',
        path: '/tmp/test-projects/slashes',
        description: 'Names with slashes should be handled properly',
        shouldValidate: false,
        expectedError: 'Project name cannot contain slashes',
        tags: ['test', 'validation']
      } as ProjectCreationData,

      tooLongName: {
        name: 'A'.repeat(256), // Very long name beyond typical limits
        path: '/tmp/test-projects/too-long',
        description: 'Name exceeds maximum length',
        shouldValidate: false,
        expectedError: 'Project name is too long',
        tags: ['test', 'validation']
      } as ProjectCreationData
    }
  },

  /**
   * Mock file system structure for file browser testing
   */
  mockDirectoryStructure: {
    '/': {
      type: 'directory',
      children: {
        tmp: {
          type: 'directory',
          children: {
            'test-projects': {
              type: 'directory',
              children: {
                'project-a': {
                  type: 'directory',
                  children: {
                    src: {
                      type: 'directory',
                      children: {
                        'main.js': { type: 'file', size: 1024, fileType: 'javascript' },
                        'utils.js': { type: 'file', size: 512, fileType: 'javascript' },
                        'styles.css': { type: 'file', size: 768, fileType: 'css' },
                        components: {
                          type: 'directory',
                          children: {
                            'Header.jsx': { type: 'file', size: 2048, fileType: 'javascript' },
                            'Footer.jsx': { type: 'file', size: 1536, fileType: 'javascript' }
                          }
                        }
                      }
                    },
                    tests: {
                      type: 'directory',
                      children: {
                        'main.test.js': { type: 'file', size: 1280, fileType: 'javascript' },
                        'utils.test.js': { type: 'file', size: 896, fileType: 'javascript' }
                      }
                    },
                    'package.json': { type: 'file', size: 256, fileType: 'json' },
                    'README.md': { type: 'file', size: 128, fileType: 'markdown' },
                    '.gitignore': { type: 'file', size: 64, fileType: 'text', isHidden: true }
                  }
                },
                'project-b': {
                  type: 'directory',
                  children: {
                    'index.html': { type: 'file', size: 2048, fileType: 'html' },
                    'styles.css': { type: 'file', size: 1536, fileType: 'css' },
                    'script.js': { type: 'file', size: 1024, fileType: 'javascript' },
                    assets: {
                      type: 'directory',
                      children: {
                        'logo.png': { type: 'file', size: 4096, fileType: 'image' },
                        'favicon.ico': { type: 'file', size: 256, fileType: 'image' }
                      }
                    }
                  }
                },
                'empty-folder': {
                  type: 'directory',
                  children: {}
                },
                'large-project': {
                  type: 'directory',
                  children: Array.from({ length: 100 }, (_, i) => [
                    `file${i + 1}.txt`,
                    {
                      type: 'file',
                      size: Math.random() * 2048,
                      fileType: 'text'
                    }
                  ]).reduce((acc, [name, data]) => ({ ...acc, [name]: data }), {} as Record<string, MockFileSystemNode>)
                }
              }
            }
          }
        },
        Users: {
          type: 'directory',
          children: {
            developer: {
              type: 'directory',
              children: {
                Documents: {
                  type: 'directory',
                  children: {
                    Projects: {
                      type: 'directory',
                      children: {
                        workspace: { type: 'directory', children: {} }
                      }
                    }
                  }
                },
                Desktop: { type: 'directory', children: {} },
                Downloads: {
                  type: 'directory',
                  children: {
                    'sample-project.zip': { type: 'file', size: 10240, fileType: 'archive' }
                  }
                }
              }
            },
            restricted: {
              type: 'directory',
              permissions: 'none',
              children: {
                'private-data': { type: 'file', size: 1024, permissions: 'none' }
              }
            }
          }
        },
        System: {
          type: 'directory',
          permissions: 'read',
          children: {
            Library: { type: 'directory', permissions: 'read', children: {} }
          }
        }
      }
    } as MockFileSystemNode
  } as Record<string, MockFileSystemNode>,

  /**
   * File browser navigation test scenarios
   */
  fileBrowserScenarios: [
    {
      name: 'navigate to nested directory',
      description: 'Test navigation through multiple directory levels',
      startPath: '/',
      navigationPath: ['Users', 'developer', 'Documents'],
      expectedPath: '/Users/developer/Documents',
      expectedFolders: ['Projects'],
      shouldSucceed: true
    },
    {
      name: 'select project directory with files',
      description: 'Navigate to a directory containing project files',
      startPath: '/tmp/test-projects',
      navigationPath: ['project-a'],
      expectedPath: '/tmp/test-projects/project-a',
      expectedFiles: ['package.json', 'README.md', '.gitignore'],
      expectedFolders: ['src', 'tests'],
      shouldSucceed: true
    },
    {
      name: 'handle empty directory',
      description: 'Test behavior when selecting an empty directory',
      startPath: '/tmp/test-projects',
      navigationPath: ['empty-folder'],
      expectedPath: '/tmp/test-projects/empty-folder',
      expectedFiles: [],
      expectedFolders: [],
      shouldSucceed: true
    },
    {
      name: 'navigate to directory with many files',
      description: 'Test performance and UI with large number of files',
      startPath: '/tmp/test-projects',
      navigationPath: ['large-project'],
      expectedPath: '/tmp/test-projects/large-project',
      expectedFiles: Array.from({ length: 100 }, (_, i) => `file${i + 1}.txt`),
      expectedFolders: [],
      shouldSucceed: true
    },
    {
      name: 'handle permission denied directory',
      description: 'Test error handling for directories without access permissions',
      startPath: '/Users',
      navigationPath: ['restricted'],
      expectedPath: '/Users/restricted',
      expectedError: 'Permission denied',
      shouldSucceed: false
    },
    {
      name: 'navigate with parent directory (..) functionality',
      description: 'Test parent directory navigation functionality',
      startPath: '/tmp/test-projects/project-a/src',
      navigationPath: ['..', '..', 'project-b'],
      expectedPath: '/tmp/test-projects/project-b',
      expectedFiles: ['index.html', 'styles.css', 'script.js'],
      expectedFolders: ['assets'],
      shouldSucceed: true
    },
    {
      name: 'select root directory',
      description: 'Test behavior when trying to select root directory',
      startPath: '/',
      navigationPath: [],
      expectedPath: '/',
      expectedFolders: ['tmp', 'Users', 'System'],
      shouldSucceed: true
    },
    {
      name: 'navigate to deep nested structure',
      description: 'Test navigation through very deep directory structure',
      startPath: '/tmp/test-projects/project-a',
      navigationPath: ['src', 'components'],
      expectedPath: '/tmp/test-projects/project-a/src/components',
      expectedFiles: ['Header.jsx', 'Footer.jsx'],
      expectedFolders: [],
      shouldSucceed: true
    }
  ] as FileBrowserScenario[],

  /**
   * Project management operation test data
   */
  projectOperations: {
    editScenarios: [
      {
        projectId: 2, // E-Commerce App
        originalName: 'E-Commerce App',
        changes: {
          name: 'Updated E-Commerce Platform',
          description: 'Modern e-commerce platform with enhanced features and performance optimizations'
        },
        shouldSucceed: true
      },
      {
        projectId: 3, // Legacy API
        originalName: 'Legacy API',
        changes: {
          name: 'Modernized API Service',
          description: 'Migrated legacy API to modern Node.js with TypeScript'
        },
        shouldSucceed: true
      },
      {
        projectId: 1, // Try to rename to existing name
        originalName: 'Promptliano Core',
        changes: {
          name: 'E-Commerce App' // Name already exists
        },
        shouldSucceed: false,
        expectedError: 'Project name already exists'
      }
    ],

    deleteScenarios: [
      {
        projectId: 5, // Data Analysis Library
        projectName: 'Data Analysis Library',
        hasActiveSessions: false,
        shouldSucceed: true,
        confirmationRequired: true
      },
      {
        projectId: 1, // Promptliano Core - simulate active session
        projectName: 'Promptliano Core',
        hasActiveSessions: true,
        shouldSucceed: false,
        expectedError: 'Cannot delete project with active sessions',
        confirmationRequired: true
      }
    ],

    archiveScenarios: [
      {
        projectId: 4, // Mobile Fitness App
        projectName: 'Mobile Fitness App',
        currentStatus: 'active',
        targetStatus: 'archived',
        shouldSucceed: true
      },
      {
        projectId: 3, // Legacy API - restore from archived
        projectName: 'Legacy API',
        currentStatus: 'archived',
        targetStatus: 'active',
        shouldSucceed: true
      }
    ]
  },

  /**
   * Project sync and import test data
   */
  syncOperations: {
    successScenarios: [
      {
        name: 'small project sync',
        projectPath: '/tmp/test-projects/project-b',
        expectedFileCount: 5,
        expectedDuration: 1000, // 1 second
        shouldShowProgress: false
      },
      {
        name: 'medium project sync',
        projectPath: '/tmp/test-projects/project-a',
        expectedFileCount: 9,
        expectedDuration: 2000, // 2 seconds
        shouldShowProgress: true
      },
      {
        name: 'large project sync',
        projectPath: '/tmp/test-projects/large-project',
        expectedFileCount: 100,
        expectedDuration: 5000, // 5 seconds
        shouldShowProgress: true,
        progressUpdates: [25, 50, 75, 100] // Percent complete milestones
      }
    ],

    errorScenarios: [
      {
        name: 'permission denied during sync',
        projectPath: '/Users/restricted',
        errorType: 'permission_denied',
        expectedError: 'Permission denied accessing project files',
        retryable: true
      },
      {
        name: 'network timeout during sync',
        projectPath: '/tmp/test-projects/project-a',
        errorType: 'timeout',
        expectedError: 'Sync operation timed out',
        retryable: true
      },
      {
        name: 'invalid project structure',
        projectPath: '/tmp/invalid-project',
        errorType: 'invalid_structure',
        expectedError: 'Not a valid project directory',
        retryable: false
      }
    ]
  },

  /**
   * Performance test data for large-scale testing
   */
  performanceData: {
    largeProjectList: Array.from({ length: 50 }, (_, i) => ({
      id: 100 + i,
      name: `Performance Test Project ${i + 1}`,
      path: `/tmp/perf-test/project-${i + 1}`,
      description: `Performance testing project ${i + 1} for modal rendering and scrolling`,
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastAccessed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      fileCount: Math.floor(Math.random() * 500) + 10,
      status: ['active', 'archived', 'syncing'][Math.floor(Math.random() * 3)] as 'active' | 'archived' | 'syncing',
      gitBranch: ['main', 'develop', 'feature/test', 'hotfix/bug'][Math.floor(Math.random() * 4)],
      size: Math.random() * 10 * 1024 * 1024, // Random size up to 10MB
      type: ['web', 'mobile', 'api', 'desktop', 'library'][Math.floor(Math.random() * 5)] as ProjectWithMetadata['type']
    })) as ProjectWithMetadata[],

    massiveFileStructure: {
      '/tmp/massive-project': {
        type: 'directory',
        children: Array.from({ length: 1000 }, (_, i) => [
          `massive-file-${i + 1}.js`,
          {
            type: 'file',
            size: Math.floor(Math.random() * 10240) + 512,
            fileType: 'javascript'
          }
        ]).reduce((acc, [name, data]) => ({ ...acc, [name]: data }), {} as Record<string, MockFileSystemNode>)
      } as MockFileSystemNode
    }
  },

  /**
   * Accessibility test data
   */
  accessibilityData: {
    keyboardNavigation: {
      modalTrigger: 'manage-projects-button',
      firstFocusableElement: 'project-list',
      lastFocusableElement: 'add-project-button',
      escapeKeyCloses: true,
      tabTrapping: true
    },

    ariaLabels: {
      modal: 'Manage Projects',
      projectList: 'List of available projects',
      addButton: 'Add new project',
      closeButton: 'Close modal',
      fileBrowser: 'Browse for project directory'
    },

    screenReaderContent: {
      projectCount: (count: number) => `${count} projects available`,
      syncStatus: (status: string) => `Project sync status: ${status}`,
      fileCount: (count: number) => `Project contains ${count} files`
    }
  },

  /**
   * Error handling test data
   */
  errorHandling: {
    networkErrors: [
      {
        type: 'connection_failed',
        message: 'Failed to connect to project service',
        recovery: 'Check network connection and try again'
      },
      {
        type: 'timeout',
        message: 'Request timed out',
        recovery: 'Operation took too long, please try again'
      },
      {
        type: 'server_error',
        message: 'Internal server error occurred',
        recovery: 'Please contact support if this continues'
      }
    ],

    validationErrors: [
      {
        field: 'name',
        message: 'Project name is required',
        value: ''
      },
      {
        field: 'path',
        message: 'Project path must be absolute',
        value: './relative/path'
      },
      {
        field: 'name',
        message: 'Project name already exists',
        value: 'Promptliano Core'
      }
    ],

    fileSystemErrors: [
      {
        code: 'ENOENT',
        message: 'Directory does not exist',
        path: '/nonexistent/path'
      },
      {
        code: 'EACCES',
        message: 'Permission denied',
        path: '/restricted/directory'
      },
      {
        code: 'EMFILE',
        message: 'Too many open files',
        path: '/tmp/project-with-many-files'
      }
    ]
  }
}

/**
 * Utility functions for test data manipulation
 */
export const ManageProjectModalTestUtils = {
  /**
   * Get projects by status
   */
  getProjectsByStatus(status: ProjectWithMetadata['status']) {
    return ManageProjectModalTestData.existingProjects.filter((p) => p.status === status)
  },

  /**
   * Get projects by type
   */
  getProjectsByType(type: ProjectWithMetadata['type']) {
    return ManageProjectModalTestData.existingProjects.filter((p) => p.type === type)
  },

  /**
   * Create isolated test project with unique identifiers
   */
  createIsolatedTestProject(testName: string): ProjectWithMetadata {
    const timestamp = Date.now()
    const testId = Math.random().toString(36).substr(2, 9)

    return {
      id: timestamp,
      name: `${testName}-${testId}`,
      path: `/tmp/isolated-test/${testName.toLowerCase().replace(/\s+/g, '-')}-${testId}`,
      description: `Isolated test project for ${testName}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      fileCount: Math.floor(Math.random() * 50) + 5,
      status: 'active',
      gitBranch: 'main',
      size: Math.random() * 1024 * 1024,
      type: 'web'
    }
  },

  /**
   * Generate file browser test data for specific scenario
   */
  generateFileBrowserData(scenario: string): MockFileSystemNode {
    switch (scenario) {
      case 'simple':
        return {
          type: 'directory',
          children: {
            'README.md': { type: 'file', size: 1024 },
            src: {
              type: 'directory',
              children: {
                'index.js': { type: 'file', size: 512 }
              }
            }
          }
        }

      case 'complex':
        return ManageProjectModalTestData.mockDirectoryStructure['/tmp/test-projects/project-a']

      case 'empty':
        return {
          type: 'directory',
          children: {}
        }

      default:
        return ManageProjectModalTestData.mockDirectoryStructure['/tmp/test-projects/project-a']
    }
  },

  /**
   * Create validation test data for specific scenario
   */
  createValidationTestData(scenario: 'valid' | 'invalid', field?: string): ProjectCreationData {
    if (scenario === 'valid') {
      return ManageProjectModalTestData.newProjectData.valid.complete
    } else {
      const invalidData = ManageProjectModalTestData.newProjectData.invalid
      if (field && field in invalidData) {
        return invalidData[field as keyof typeof invalidData]
      }
      return invalidData.emptyName
    }
  },

  /**
   * Get expected file count for directory
   */
  getExpectedFileCount(directoryPath: string): number {
    // This would calculate based on mockDirectoryStructure
    // For now, return test values
    const pathCounts: Record<string, number> = {
      '/tmp/test-projects/project-a': 9,
      '/tmp/test-projects/project-b': 5,
      '/tmp/test-projects/large-project': 100,
      '/tmp/test-projects/empty-folder': 0
    }

    return pathCounts[directoryPath] || 0
  }
}

/**
 * Export for easy access in tests
 */
export default ManageProjectModalTestData
