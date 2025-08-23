/**
 * Basic Integration Example
 * 
 * Demonstrates how to integrate the intelligent loading system
 * with existing Promptliano components and hooks.
 */

import React from 'react'
import { useProjects } from '@/hooks/api-hooks'
import { 
  LoadingOrchestrator,
  TableOrchestrator,
  useLoadingState,
  ProjectTableSkeleton,
  ProjectEmptyState
} from '../index'

// Example 1: Basic Loading Orchestration
export function ProjectListExample() {
  const { data: projects, isLoading, error, refetch } = useProjects()
  
  return (
    <LoadingOrchestrator
      isLoading={isLoading}
      hasData={!!projects?.length}
      hasError={!!error}
      error={error}
      contentType="table"
      totalItems={projects?.length || 0}
      onRetry={refetch}
      onCreateItem={() => console.log('Create project')}
      loadingConfig={{
        minLoadingTime: 300,
        loadingDelay: 150,
        enableTransitions: true
      }}
      skeletonConfig={{
        rows: 8,
        columns: 5
      }}
    >
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Projects</h2>
        <div className="rounded-lg border">
          {/* Your existing project table component */}
          <div className="p-4">
            {projects?.map((project: any) => (
              <div key={project.id} className="p-2 border-b">
                {project.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingOrchestrator>
  )
}

// Example 2: Table-Specific Orchestration
export function ProjectTableExample() {
  const { data: projects, isLoading, error, refetch } = useProjects()
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded">
          New Project
        </button>
      </div>
      
      <TableOrchestrator
        isLoading={isLoading}
        hasData={!!projects?.length}
        hasError={!!error}
        error={error}
        totalItems={projects?.length || 0}
        onRetry={refetch}
        onCreateItem={() => console.log('Create project')}
        rows={10}
        columns={6}
        dense={false}
      >
        {/* Your existing table component */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-4 py-2 text-left">Name</th>
                <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                <th className="border border-gray-200 px-4 py-2 text-left">Created</th>
                <th className="border border-gray-200 px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects?.map((project: any) => (
                <tr key={project.id}>
                  <td className="border border-gray-200 px-4 py-2">{project.name}</td>
                  <td className="border border-gray-200 px-4 py-2">{project.status}</td>
                  <td className="border border-gray-200 px-4 py-2">{project.createdAt}</td>
                  <td className="border border-gray-200 px-4 py-2">
                    <button className="text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableOrchestrator>
    </div>
  )
}

// Example 3: Smart Loading States with Search
export function SearchableProjectListExample() {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filterCount, setFilterCount] = React.useState(0)
  
  const { data: projects, isLoading, error } = useProjects()
  
  // Filter projects based on search
  const filteredProjects = React.useMemo(() => {
    if (!projects) return []
    if (!searchTerm) return projects
    return projects.filter((project: any) => 
      project.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [projects, searchTerm])
  
  const hasSearchResults = filteredProjects.length > 0
  const hasSearchTerm = searchTerm.length > 0
  
  return (
    <div className="space-y-4">
      {/* Search Controls */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border rounded-md flex-1"
        />
        <button
          onClick={() => setFilterCount(prev => prev + 1)}
          className="px-3 py-2 border rounded-md"
        >
          Add Filter ({filterCount})
        </button>
      </div>
      
      {/* Results */}
      <LoadingOrchestrator
        isLoading={isLoading}
        hasData={hasSearchResults}
        hasError={!!error}
        error={error}
        contentType="card"
        totalItems={filteredProjects.length}
        searchTerm={hasSearchTerm ? searchTerm : undefined}
        filterCount={filterCount}
        onRetry={() => window.location.reload()}
        onClearSearch={() => setSearchTerm('')}
        onClearFilters={() => setFilterCount(0)}
        onCreateItem={() => console.log('Create project')}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project: any) => (
            <div key={project.id} className="p-4 border rounded-lg">
              <h3 className="font-semibold">{project.name}</h3>
              <p className="text-sm text-gray-600">{project.description}</p>
              <div className="mt-2 text-xs text-gray-500">
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </LoadingOrchestrator>
    </div>
  )
}

// Example 4: Custom Loading State Hook Integration
export function AdvancedLoadingExample() {
  const { data: projects, isLoading: isLoadingProjects } = useProjects()
  
  // Use the intelligent loading state hook
  const loadingState = useLoadingState({
    minLoadingTime: 400,
    loadingDelay: 200,
    queryKeys: ['projects'],
    showRefetchLoading: false
  })
  
  // Custom skeleton based on loading state
  if (loadingState.isLoading) {
    return (
      <div className="space-y-4">
        <ProjectTableSkeleton rows={8} />
        
        {loadingState.isStableLoading && (
          <div className="text-center text-sm text-gray-500">
            This is taking longer than usual...
          </div>
        )}
      </div>
    )
  }
  
  // Custom empty state
  if (!projects?.length) {
    return (
      <ProjectEmptyState
        onCreateProject={() => console.log('Create project')}
        onImportProject={() => console.log('Import project')}
      />
    )
  }
  
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Advanced Loading Example</h2>
      <div className="grid gap-4">
        {projects.map((project: any) => (
          <div key={project.id} className="p-4 border rounded">
            <h3 className="font-semibold">{project.name}</h3>
            <p className="text-gray-600">{project.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Example 5: Error Handling with Retry
export function ErrorHandlingExample() {
  const [retryCount, setRetryCount] = React.useState(0)
  
  // Simulate an API call that might fail
  const { data: projects, isLoading, error, refetch } = useProjects()
  
  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    refetch()
  }
  
  return (
    <LoadingOrchestrator
      isLoading={isLoading}
      hasData={!!projects?.length}
      hasError={!!error}
      error={error}
      contentType="table"
      onRetry={handleRetry}
      loadingConfig={{
        minLoadingTime: 300,
        enableTransitions: true
      }}
      customErrorState={
        <div className="text-center p-8 border rounded-lg">
          <h3 className="text-lg font-semibold text-red-600 mb-2">
            Failed to load projects
          </h3>
          <p className="text-gray-600 mb-4">
            {error?.message || 'An unexpected error occurred'}
          </p>
          <div className="space-x-2">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry {retryCount > 0 && `(Attempt ${retryCount + 1})`}
            </button>
            <button
              onClick={() => console.log('Contact support')}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Contact Support
            </button>
          </div>
        </div>
      }
    >
      <div>
        {/* Your project content */}
        Project list content here...
      </div>
    </LoadingOrchestrator>
  )
}