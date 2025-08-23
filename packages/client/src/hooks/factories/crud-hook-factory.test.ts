/**
 * Comprehensive tests for the CRUD Hook Factory
 * Tests the revolutionary hook factory pattern that eliminates 44,000+ lines of hook code
 */

import { describe, test, expect, beforeEach, jest, mock } from 'bun:test'
import {
  createCrudHooks,
  type CrudHookConfig,
  type CrudApiClient,
  type QueryKeyFactory,
  type EntityIdentifiable,
  type PaginatedResponse,
  type PaginationParams
} from './crud-hook-factory'

// Mock React Query hooks
const mockUseQuery = jest.fn()
const mockUseInfiniteQuery = jest.fn()
const mockUseMutation = jest.fn()
const mockUseQueryClient = jest.fn()
const mockQueryClient = {
  invalidateQueries: jest.fn(),
  setQueryData: jest.fn(),
  removeQueries: jest.fn(),
  getQueryData: jest.fn(),
  cancelQueries: jest.fn(),
  setQueriesData: jest.fn(),
  getQueriesData: jest.fn(),
  prefetchQuery: jest.fn()
}

const mockToast = {
  success: jest.fn(),
  error: jest.fn()
}

// Mock dependencies
mock.module('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useInfiniteQuery: mockUseInfiniteQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient
}))

mock.module('sonner', () => ({
  toast: mockToast
}))

// Test entity types
interface TestProject extends EntityIdentifiable {
  id: number
  name: string
  description: string
  created: number
  updated: number
}

interface CreateProjectData {
  name: string
  description: string
}

interface UpdateProjectData {
  name?: string
  description?: string
}

interface ProjectListParams {
  search?: string
  status?: 'active' | 'archived'
  limit?: number
}

// Mock data
const mockProject: TestProject = {
  id: 1,
  name: 'Test Project',
  description: 'Test Description',
  created: Date.now(),
  updated: Date.now()
}

const mockCreateData: CreateProjectData = {
  name: 'New Project',
  description: 'New Description'
}

const mockUpdateData: UpdateProjectData = {
  name: 'Updated Project'
}

// Mock API client
const createMockApiClient = (): CrudApiClient<TestProject, CreateProjectData, UpdateProjectData, ProjectListParams> => ({
  list: jest.fn(),
  listPaginated: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  batchCreate: jest.fn(),
  batchUpdate: jest.fn(),
  batchDelete: jest.fn()
})

// Query keys factory
const createProjectQueryKeys = (): QueryKeyFactory<ProjectListParams> => ({
  all: ['projects'] as const,
  lists: () => ['projects', 'list'] as const,
  list: (params?: ProjectListParams) => ['projects', 'list', params] as const,
  details: () => ['projects', 'detail'] as const,
  detail: (id: number) => ['projects', 'detail', id] as const,
  infinite: (params?: ProjectListParams) => ['projects', 'infinite', params] as const
})

describe('CRUD Hook Factory', () => {
  let mockApiClient: CrudApiClient<TestProject, CreateProjectData, UpdateProjectData, ProjectListParams>
  let queryKeys: QueryKeyFactory<ProjectListParams>
  let config: CrudHookConfig<TestProject, CreateProjectData, UpdateProjectData, ProjectListParams>

  beforeEach(() => {
    mockApiClient = createMockApiClient()
    queryKeys = createProjectQueryKeys()
    config = {
      entityName: 'Project',
      queryKeys,
      apiClient: mockApiClient,
      optimistic: { enabled: true }
    }
    jest.clearAllMocks()
    mockUseQueryClient.mockReturnValue(mockQueryClient)
  })

  describe('Hook Factory Creation', () => {
    test('should create all required hooks', () => {
      const hooks = createCrudHooks(config)
      
      expect(hooks.useList).toBeDefined()
      expect(hooks.useGetById).toBeDefined()
      expect(hooks.useInfiniteList).toBeDefined()
      expect(hooks.useCreate).toBeDefined()
      expect(hooks.useUpdate).toBeDefined()
      expect(hooks.useDelete).toBeDefined()
      expect(hooks.useBatchCreate).toBeDefined()
      expect(hooks.useBatchUpdate).toBeDefined()
      expect(hooks.useBatchDelete).toBeDefined()
      expect(hooks.usePrefetch).toBeDefined()
      expect(hooks.useInvalidate).toBeDefined()
      expect(typeof hooks.useList).toBe('function')
      expect(typeof hooks.useGetById).toBe('function')
      expect(typeof hooks.useCreate).toBe('function')
      expect(typeof hooks.useUpdate).toBe('function')
      expect(typeof hooks.useDelete).toBe('function')
    })

    test('should include metadata', () => {
      const hooks = createCrudHooks(config)
      
      expect(hooks.entityName).toBe('Project')
      expect(hooks.queryKeys).toBe(queryKeys)
    })

    test('should use default configuration when not specified', () => {
      const minimalConfig = {
        entityName: 'Project',
        queryKeys,
        apiClient: mockApiClient
      }
      
      expect(() => createCrudHooks(minimalConfig)).not.toThrow()
    })
  })

  describe('Query Hooks', () => {
    describe('useList', () => {
      test('should call useQuery with correct parameters', () => {
        const hooks = createCrudHooks(config)
        const params: ProjectListParams = { search: 'test', status: 'active' }
        
        hooks.useList(params)
        
        expect(mockUseQuery).toHaveBeenCalledWith({
          queryKey: queryKeys.list(params),
          queryFn: expect.any(Function),
          staleTime: 5 * 60 * 1000, // Default stale time
          gcTime: 10 * 60 * 1000, // Default cache time
        })
      })

      test('should call API client list method when queryFn is executed', () => {
        const hooks = createCrudHooks(config)
        const params: ProjectListParams = { search: 'test' }
        
        hooks.useList(params)
        const queryConfig = mockUseQuery.mock.calls[0][0]
        
        queryConfig.queryFn({ signal: undefined })
        expect(mockApiClient.list).toHaveBeenCalledWith(undefined, params)
      })
    })

    describe('useGetById', () => {
      test('should call useQuery with correct parameters', () => {
        const hooks = createCrudHooks(config)
        const id = 123
        
        hooks.useGetById(id)
        
        expect(mockUseQuery).toHaveBeenCalledWith({
          queryKey: queryKeys.detail(id),
          queryFn: expect.any(Function),
          enabled: true,
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
        })
      })

      test('should disable query for invalid IDs', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useGetById(0)
        expect(mockUseQuery).toHaveBeenCalledWith(
          expect.objectContaining({ enabled: false })
        )
        
        hooks.useGetById(-1)
        expect(mockUseQuery).toHaveBeenCalledWith(
          expect.objectContaining({ enabled: false })
        )
      })

      test('should call API client getById when queryFn is executed', () => {
        const hooks = createCrudHooks(config)
        const id = 123
        
        hooks.useGetById(id)
        const queryConfig = mockUseQuery.mock.calls[0][0]
        
        queryConfig.queryFn({ signal: undefined })
        expect(mockApiClient.getById).toHaveBeenCalledWith(undefined, id)
      })
    })

    describe('useInfiniteList', () => {
      test('should call useInfiniteQuery with correct parameters', () => {
        const hooks = createCrudHooks(config)
        const params: ProjectListParams = { search: 'test' }
        
        hooks.useInfiniteList(params)
        
        expect(mockUseInfiniteQuery).toHaveBeenCalledWith({
          queryKey: queryKeys.infinite(params),
          queryFn: expect.any(Function),
          getNextPageParam: expect.any(Function),
          initialPageParam: 1,
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
        })
      })

      test('should throw error if listPaginated not provided', () => {
        const configWithoutPagination = {
          ...config,
          apiClient: { ...mockApiClient, listPaginated: undefined }
        }
        
        const hooks = createCrudHooks(configWithoutPagination)
        
        expect(() => hooks.useInfiniteList()).toThrow('Infinite queries not supported for Project')
      })

      test('should call listPaginated when queryFn is executed', () => {
        const hooks = createCrudHooks(config)
        const params: ProjectListParams = { search: 'test' }
        
        hooks.useInfiniteList(params)
        const queryConfig = mockUseInfiniteQuery.mock.calls[0][0]
        
        queryConfig.queryFn({ pageParam: 2, signal: undefined })
        expect(mockApiClient.listPaginated).toHaveBeenCalledWith(
          undefined, 
          { ...params, page: 2 }
        )
      })

      test('should determine next page correctly', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useInfiniteList()
        const queryConfig = mockUseInfiniteQuery.mock.calls[0][0]
        
        // Test has more pages
        const lastPageWithMore: PaginatedResponse<TestProject> = {
          data: [mockProject],
          total: 20,
          page: 1,
          limit: 10,
          hasMore: true
        }
        expect(queryConfig.getNextPageParam(lastPageWithMore, [lastPageWithMore])).toBe(2)
        
        // Test no more pages
        const lastPageNoMore: PaginatedResponse<TestProject> = {
          data: [mockProject],
          total: 10,
          page: 1,
          limit: 10,
          hasMore: false
        }
        expect(queryConfig.getNextPageParam(lastPageNoMore, [lastPageNoMore])).toBeUndefined()
      })
    })
  })

  describe('Mutation Hooks with Optimistic Updates', () => {
    describe('useCreate', () => {
      test('should call useMutation with correct parameters', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useCreate()
        
        expect(mockUseMutation).toHaveBeenCalledWith({
          mutationFn: expect.any(Function),
          onMutate: expect.any(Function),
          onError: expect.any(Function),
          onSuccess: expect.any(Function),
          onSettled: expect.any(Function)
        })
      })

      test('should call API create method', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useCreate()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        mutationConfig.mutationFn(mockCreateData)
        expect(mockApiClient.create).toHaveBeenCalledWith(undefined, mockCreateData)
      })

      test('should perform optimistic update on mutate', async () => {
        const hooks = createCrudHooks(config)
        
        hooks.useCreate()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        const existingData = [mockProject]
        mockQueryClient.getQueriesData.mockReturnValue([
          [queryKeys.list(), existingData]
        ])
        
        const context = await mutationConfig.onMutate(mockCreateData)
        
        expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
          queryKey: queryKeys.lists()
        })
        expect(mockQueryClient.setQueriesData).toHaveBeenCalled()
        expect(context).toHaveProperty('optimisticEntity')
        expect(context.optimisticEntity.id).toBeLessThan(0) // Temporary ID
      })

      test('should rollback on error', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useCreate()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        const previousLists = [[queryKeys.list(), [mockProject]]]
        const context = { previousLists }
        const error = { message: 'Create failed' }
        
        mutationConfig.onError(error, mockCreateData, context)
        
        expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
          queryKeys.list(),
          [mockProject]
        )
        expect(mockToast.error).toHaveBeenCalled()
      })

      test('should update cache on success', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useCreate()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        const optimisticEntity = { ...mockProject, id: -123 }
        const context = { optimisticEntity }
        
        mutationConfig.onSuccess(mockProject, mockCreateData, context)
        
        expect(mockQueryClient.setQueriesData).toHaveBeenCalled()
        expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
          queryKeys.detail(mockProject.id),
          mockProject
        )
        expect(mockToast.success).toHaveBeenCalled()
      })
    })

    describe('useUpdate', () => {
      test('should call useMutation with correct parameters', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useUpdate()
        
        expect(mockUseMutation).toHaveBeenCalledWith({
          mutationFn: expect.any(Function),
          onMutate: expect.any(Function),
          onError: expect.any(Function),
          onSuccess: expect.any(Function),
          onSettled: expect.any(Function)
        })
      })

      test('should call API update method', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useUpdate()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        const variables = { id: 1, data: mockUpdateData }
        mutationConfig.mutationFn(variables)
        expect(mockApiClient.update).toHaveBeenCalledWith(undefined, 1, mockUpdateData)
      })

      test('should perform optimistic update', async () => {
        const hooks = createCrudHooks(config)
        
        hooks.useUpdate()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        mockQueryClient.getQueryData.mockReturnValue(mockProject)
        mockQueryClient.getQueriesData.mockReturnValue([
          [queryKeys.list(), [mockProject]]
        ])
        
        const variables = { id: 1, data: mockUpdateData }
        const context = await mutationConfig.onMutate(variables)
        
        expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
          queryKey: queryKeys.detail(1)
        })
        expect(mockQueryClient.setQueryData).toHaveBeenCalled()
        expect(mockQueryClient.setQueriesData).toHaveBeenCalled()
        expect(context).toHaveProperty('previousEntity', mockProject)
      })
    })

    describe('useDelete', () => {
      test('should call useMutation with correct parameters', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useDelete()
        
        expect(mockUseMutation).toHaveBeenCalledWith({
          mutationFn: expect.any(Function),
          onMutate: expect.any(Function),
          onError: expect.any(Function),
          onSuccess: expect.any(Function),
          onSettled: expect.any(Function)
        })
      })

      test('should call API delete method', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useDelete()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        mutationConfig.mutationFn(1)
        expect(mockApiClient.delete).toHaveBeenCalledWith(undefined, 1)
      })

      test('should perform optimistic delete', async () => {
        const hooks = createCrudHooks(config)
        
        hooks.useDelete()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        const existingData = [mockProject, { ...mockProject, id: 2 }]
        mockQueryClient.getQueriesData.mockReturnValue([
          [queryKeys.list(), existingData]
        ])
        
        const context = await mutationConfig.onMutate(1)
        
        expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
          queryKey: queryKeys.lists()
        })
        expect(mockQueryClient.setQueriesData).toHaveBeenCalled()
        expect(context).toHaveProperty('deletedId', 1)
      })

      test('should remove from cache on success', () => {
        const hooks = createCrudHooks(config)
        
        hooks.useDelete()
        const mutationConfig = mockUseMutation.mock.calls[0][0]
        
        mutationConfig.onSuccess(undefined, 1)
        
        expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({
          queryKey: queryKeys.detail(1)
        })
        expect(mockToast.success).toHaveBeenCalled()
      })
    })
  })

  describe('Batch Operations', () => {
    test('useBatchCreate should work when supported', () => {
      const hooks = createCrudHooks(config)
      
      hooks.useBatchCreate()
      
      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
        onSettled: expect.any(Function)
      })
    })

    test('should throw error when batch operations not supported', () => {
      const configWithoutBatch = {
        ...config,
        apiClient: { ...mockApiClient, batchCreate: undefined }
      }
      
      const hooks = createCrudHooks(configWithoutBatch)
      
      expect(() => hooks.useBatchCreate()).toThrow('Batch create not supported for Project')
    })
  })

  describe('Prefetching Utilities', () => {
    test('should provide prefetch functions', () => {
      const hooks = createCrudHooks(config)
      
      hooks.usePrefetch()
      
      // Should return an object with prefetch methods
      const prefetchUtils = hooks.usePrefetch()
      expect(prefetchUtils).toHaveProperty('prefetchList')
      expect(prefetchUtils).toHaveProperty('prefetchById')
      expect(prefetchUtils).toHaveProperty('prefetchOnHover')
    })

    test('should call queryClient.prefetchQuery for list', () => {
      const hooks = createCrudHooks(config)
      
      const prefetchUtils = hooks.usePrefetch()
      const params: ProjectListParams = { search: 'test' }
      
      prefetchUtils.prefetchList(params)
      
      expect(mockQueryClient.prefetchQuery).toHaveBeenCalledWith({
        queryKey: queryKeys.list(params),
        queryFn: expect.any(Function),
        staleTime: expect.any(Number)
      })
    })
  })

  describe('Cache Management', () => {
    test('should provide invalidation utilities', () => {
      const hooks = createCrudHooks(config)
      
      const invalidateUtils = hooks.useInvalidate()
      
      expect(invalidateUtils).toHaveProperty('invalidateAll')
      expect(invalidateUtils).toHaveProperty('invalidateLists')
      expect(invalidateUtils).toHaveProperty('invalidateList')
      expect(invalidateUtils).toHaveProperty('invalidateDetail')
      expect(invalidateUtils).toHaveProperty('setDetail')
      expect(invalidateUtils).toHaveProperty('removeDetail')
      expect(invalidateUtils).toHaveProperty('reset')
    })

    test('should set detail data directly', () => {
      const hooks = createCrudHooks(config)
      
      const invalidateUtils = hooks.useInvalidate()
      invalidateUtils.setDetail(mockProject)
      
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        queryKeys.detail(mockProject.id),
        mockProject
      )
    })
  })

  describe('Configuration Options', () => {
    test('should use custom stale time', () => {
      const customConfig = { ...config, staleTime: 1000 }
      const hooks = createCrudHooks(customConfig)
      
      hooks.useList()
      
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({ staleTime: 1000 })
      )
    })

    test('should use custom messages', () => {
      const customMessages = {
        createSuccess: 'Custom create success!',
        createError: 'Custom create error!'
      }
      const customConfig = { ...config, messages: customMessages }
      
      const hooks = createCrudHooks(customConfig)
      hooks.useCreate()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onSuccess(mockProject, mockCreateData, {})
      
      expect(mockToast.success).toHaveBeenCalledWith('Custom create success!')
    })

    test('should disable optimistic updates when configured', () => {
      const configWithoutOptimistic = {
        ...config,
        optimistic: { enabled: false }
      }
      
      const hooks = createCrudHooks(configWithoutOptimistic)
      hooks.useCreate()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      // onMutate should be undefined when optimistic updates are disabled
      expect(mutationConfig.onMutate).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    test('should show error toast on mutation failure', () => {
      const hooks = createCrudHooks(config)
      
      hooks.useCreate()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      const error = { message: 'Create failed' }
      mutationConfig.onError(error, mockCreateData, {})
      
      expect(mockToast.error).toHaveBeenCalled()
    })

    test('should handle missing error message', () => {
      const hooks = createCrudHooks(config)
      
      hooks.useCreate()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      const errorWithoutMessage = {}
      mutationConfig.onError(errorWithoutMessage, mockCreateData, {})
      
      expect(mockToast.error).toHaveBeenCalled()
    })
  })

  describe('Performance and Pattern Benefits', () => {
    test('should demonstrate massive code reduction', () => {
      // One factory call replaces 300+ lines of manual hook code
      const hooks = createCrudHooks(config)
      
      // Verify we get all standard CRUD operations
      expect(Object.keys(hooks)).toEqual([
        'useList',
        'useGetById',
        'useInfiniteList',
        'useCreate',
        'useUpdate',
        'useDelete',
        'useBatchCreate',
        'useBatchUpdate',
        'useBatchDelete',
        'usePrefetch',
        'useInvalidate',
        'queryKeys',
        'entityName'
      ])
    })

    test('should provide consistent patterns across entities', () => {
      // Different entity types should have identical hook interfaces
      const projectHooks = createCrudHooks(config)
      
      const ticketConfig = {
        entityName: 'Ticket',
        queryKeys: createProjectQueryKeys(), // Using same structure for test
        apiClient: createMockApiClient()
      }
      const ticketHooks = createCrudHooks(ticketConfig)
      
      // Both should have identical hook methods
      expect(Object.keys(projectHooks)).toEqual(Object.keys(ticketHooks))
    })

    test('should eliminate boilerplate while maintaining flexibility', () => {
      // Factory provides default behavior but allows customization
      const customConfig = {
        entityName: 'Project',
        queryKeys,
        apiClient: mockApiClient,
        staleTime: 60000,
        optimistic: { enabled: false },
        messages: {
          createSuccess: 'Project created!',
          updateSuccess: 'Project updated!'
        }
      }
      
      const hooks = createCrudHooks(customConfig)
      
      // Should still provide all standard hooks with custom configuration
      expect(hooks.useCreate).toBeDefined()
      expect(hooks.useUpdate).toBeDefined()
      expect(hooks.entityName).toBe('Project')
    })

    test('should create hooks efficiently', () => {
      const start = performance.now()
      
      // Create hooks 100 times
      for (let i = 0; i < 100; i++) {
        createCrudHooks(config)
      }
      
      const end = performance.now()
      const duration = end - start
      
      // Should be very fast
      expect(duration).toBeLessThan(100)
    })
  })
})