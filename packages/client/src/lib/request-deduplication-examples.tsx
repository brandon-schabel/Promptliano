/**
 * Request Deduplication Integration Examples
 * 
 * Comprehensive examples showing how to integrate the request deduplication system
 * with existing Promptliano components and patterns.
 * 
 * Examples include:
 * - Basic integration with existing hooks
 * - Dashboard optimization
 * - Form handling with deduplication
 * - Real-time updates with deduplication
 * - Performance monitoring components
 * - Development tools integration
 */

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  useDeduplicationStats, 
  useApiPerformanceMetrics,
  useDeduplicationControl,
  useDeduplicationTest,
  useDeduplicationHealthCheck
} from '../hooks/use-request-deduplication'
import { 
  DeduplicationProvider,
  useDeduplicationContext,
  withDeduplicationCleanup,
  DeduplicationErrorBoundary,
  MemoryMonitor
} from './request-deduplication-context'
import { useApiClient } from '../hooks/api/use-api-client'

// ============================================================================
// Example 1: Enhanced Project Dashboard with Deduplication
// ============================================================================

/**
 * Example showing how existing project hooks benefit from automatic deduplication
 */
function ProjectDashboardExample() {
  const { stats } = useDeduplicationContext()
  
  // These hooks will automatically benefit from deduplication
  // Multiple components requesting the same data will share requests
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const client = useApiClient()
      if (!client) throw new Error('No client')
      return client.projects.listProjects()
    }
  })

  const { data: recentTickets } = useQuery({
    queryKey: ['tickets', 'recent'],
    queryFn: async () => {
      const client = useApiClient()
      if (!client) throw new Error('No client')
      return client.tickets.getRecentTickets()
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Project Dashboard</h1>
        
        {/* Real-time deduplication stats */}
        <div className="text-sm text-gray-600">
          Requests saved: {stats.duplicatesPrevented} / {stats.totalRequests}
          ({(stats.averageDeduplicationRate).toFixed(1)}% efficiency)
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Projects widget */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Recent Projects</h2>
          {projects?.data?.slice(0, 5).map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
        
        {/* Tickets widget */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Recent Tickets</h2>
          {recentTickets?.data?.slice(0, 5).map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Individual cards that might make duplicate requests
function ProjectCard({ project }: { project: any }) {
  // This query might be requested by multiple ProjectCard components
  // Deduplication ensures only one actual API call
  const { data: projectStats } = useQuery({
    queryKey: ['projects', project.id, 'stats'],
    queryFn: async () => {
      const client = useApiClient()
      if (!client) throw new Error('No client')
      return client.projects.getProjectStatistics(project.id)
    }
  })

  return (
    <div className="p-3 border rounded mb-2">
      <h3 className="font-medium">{project.name}</h3>
      <div className="text-sm text-gray-600">
        {projectStats?.data ? (
          <>Files: {projectStats.data.fileCount} | Tickets: {projectStats.data.ticketCount}</>
        ) : (
          'Loading stats...'
        )}
      </div>
    </div>
  )
}

function TicketCard({ ticket }: { ticket: any }) {
  return (
    <div className="p-3 border rounded mb-2">
      <h3 className="font-medium">{ticket.title}</h3>
      <div className="text-sm text-gray-600">{ticket.status}</div>
    </div>
  )
}

// ============================================================================
// Example 2: Smart Form with Deduplication
// ============================================================================

/**
 * Form component that prevents duplicate submissions and optimizes option loading
 */
function SmartCreateTicketForm({ projectId }: { projectId: number }) {
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium' })
  const { clearCache } = useDeduplicationContext()
  
  // These queries might be called by multiple form instances
  // Deduplication ensures efficient loading
  const { data: projectOptions } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: async () => {
      const client = useApiClient()
      if (!client) throw new Error('No client')
      return client.projects.listProjects()
    }
  })

  const { data: ticketTemplate } = useQuery({
    queryKey: ['tickets', 'template', projectId],
    queryFn: async () => {
      const client = useApiClient()
      if (!client) throw new Error('No client')
      return client.tickets.getTemplate(projectId)
    },
    enabled: !!projectId
  })

  const createTicket = useMutation({
    mutationFn: async (data: any) => {
      const client = useApiClient()
      if (!client) throw new Error('No client')
      return client.tickets.createTicket(data)
    },
    onSuccess: () => {
      // Clear cache to ensure fresh data after creation
      clearCache()
      setFormData({ title: '', description: '', priority: 'medium' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createTicket.mutate({
      ...formData,
      projectId
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold">Create New Ticket</h2>
      
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full p-2 border rounded"
          placeholder={ticketTemplate?.data?.titleTemplate || 'Enter ticket title'}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full p-2 border rounded h-32"
          placeholder={ticketTemplate?.data?.descriptionTemplate || 'Enter description'}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Priority</label>
        <select
          value={formData.priority}
          onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
          className="w-full p-2 border rounded"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      
      <button
        type="submit"
        disabled={createTicket.isPending || !formData.title.trim()}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
      </button>
      
      {createTicket.error && (
        <div className="text-red-600 text-sm">
          Error: {createTicket.error.message}
        </div>
      )}
    </form>
  )
}

// ============================================================================
// Example 3: Performance Monitoring Dashboard
// ============================================================================

/**
 * Development tool for monitoring deduplication performance
 */
function DeduplicationPerformanceDashboard() {
  const stats = useDeduplicationStats(1000) // Update every second
  const { metrics, aggregate } = useApiPerformanceMetrics()
  const { isEnabled, toggle } = useDeduplicationControl()
  const { runTest, analysis, isRunning } = useDeduplicationTest()
  const { warnings, isHealthy } = useDeduplicationHealthCheck()

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Deduplication Performance</h1>
          <button
            onClick={toggle}
            className={`px-4 py-2 rounded ${
              isEnabled 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}
          >
            Deduplication: {isEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Health Status */}
        <div className={`p-4 rounded-lg ${isHealthy ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <h2 className="font-semibold mb-2">
            System Health: {isHealthy ? '✅ Healthy' : '⚠️ Warnings'}
          </h2>
          {warnings.length > 0 && (
            <ul className="list-disc list-inside text-sm">
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Real-time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Requests"
            value={stats.totalRequests}
            subtitle="All time"
          />
          <StatCard
            title="Duplicates Prevented"
            value={stats.duplicatesPrevented}
            subtitle={`${stats.averageDeduplicationRate.toFixed(1)}% saved`}
            color="green"
          />
          <StatCard
            title="Cache Hit Rate"
            value={`${stats.cacheHits > 0 ? ((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(1) : 0}%`}
            subtitle={`${stats.cacheHits} hits`}
            color="blue"
          />
          <StatCard
            title="Active Requests"
            value={stats.activeRequests}
            subtitle={`Cache size: ${stats.cacheSize}`}
            color="purple"
          />
        </div>

        {/* Aggregate Performance */}
        {aggregate && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Aggregate Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold">{aggregate.totalRequests}</div>
                <div className="text-sm text-gray-600">Total Requests</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {aggregate.averageDeduplicationRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Avg Deduplication Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {aggregate.averageResponseTime.toFixed(1)}ms
                </div>
                <div className="text-sm text-gray-600">Avg Response Time</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {aggregate.errorRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Error Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Performance Test</h2>
          <div className="flex gap-4 items-center mb-4">
            <button
              onClick={() => runTest('/projects')}
              disabled={isRunning}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunning ? 'Running Test...' : 'Run Performance Test'}
            </button>
          </div>
          
          {analysis && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-lg font-semibold text-green-600">
                  {analysis.averageTimeWithDeduplication.toFixed(1)}ms
                </div>
                <div className="text-sm text-gray-600">With Deduplication</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-600">
                  {analysis.averageTimeWithoutDeduplication.toFixed(1)}ms
                </div>
                <div className="text-sm text-gray-600">Without Deduplication</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-600">
                  {analysis.improvementPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Improvement</div>
              </div>
            </div>
          )}
        </div>

        {/* Endpoint Metrics */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Endpoint Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Endpoint</th>
                  <th className="text-left p-2">Requests</th>
                  <th className="text-left p-2">Avg Time (ms)</th>
                  <th className="text-left p-2">Deduplication Rate</th>
                  <th className="text-left p-2">Error Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics).map(([endpoint, metric]) => (
                  <tr key={endpoint} className="border-b">
                    <td className="p-2 font-mono text-xs">{endpoint}</td>
                    <td className="p-2">{metric.requestCount}</td>
                    <td className="p-2">{metric.averageTime.toFixed(1)}</td>
                    <td className="p-2">
                      <span className={`${metric.deduplicationRate > 50 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {metric.deduplicationRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`${metric.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {metric.errorRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  color = 'gray' 
}: { 
  title: string
  value: string | number
  subtitle?: string
  color?: 'gray' | 'green' | 'blue' | 'purple' | 'red'
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    red: 'bg-red-100 text-red-800'
  }

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{title}</div>
      {subtitle && <div className="text-xs opacity-75">{subtitle}</div>}
    </div>
  )
}

// ============================================================================
// Example 4: HOC Integration for Automatic Cleanup
// ============================================================================

/**
 * Example of using HOC for automatic cleanup
 */
const OptimizedProjectView = withDeduplicationCleanup(
  function ProjectView({ projectId }: { projectId: number }) {
    const { data: project } = useQuery({
      queryKey: ['projects', projectId],
      queryFn: async () => {
        const client = useApiClient()
        if (!client) throw new Error('No client')
        return client.projects.getProject(projectId)
      }
    })

    const { data: files } = useQuery({
      queryKey: ['projects', projectId, 'files'],
      queryFn: async () => {
        const client = useApiClient()
        if (!client) throw new Error('No client')
        return client.projects.getProjectFiles(projectId)
      }
    })

    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{project?.data?.name}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Project Details</h2>
            <div className="space-y-2">
              <div><strong>Description:</strong> {project?.data?.description}</div>
              <div><strong>Status:</strong> {project?.data?.status}</div>
              <div><strong>Created:</strong> {new Date(project?.data?.created || '').toLocaleDateString()}</div>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Files ({files?.data?.length || 0})</h2>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {files?.data?.map((file: any) => (
                <div key={file.id} className="text-sm p-2 bg-gray-50 rounded">
                  {file.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    clearOnUnmount: true,
    clearOnPropsChange: true,
    watchProps: ['projectId']
  }
)

// ============================================================================
// Example 5: Complete App Integration
// ============================================================================

/**
 * Example of complete app setup with deduplication
 */
export function DeduplicationExampleApp() {
  return (
    <DeduplicationErrorBoundary>
      <DeduplicationProvider
        config={{
          debug: process.env.NODE_ENV === 'development',
          cacheTtl: 5000,
          maxCacheSize: 1000,
          enableCombining: true
        }}
        enableRouteInvalidation={true}
        enableDevTools={true}
      >
        <MemoryMonitor warningThreshold={150}>
          <div className="min-h-screen bg-gray-50">
            {/* Development tools - only in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="fixed top-4 right-4 z-50">
                <button
                  onClick={() => {
                    const dashboard = document.getElementById('perf-dashboard')
                    if (dashboard) {
                      dashboard.style.display = dashboard.style.display === 'none' ? 'block' : 'none'
                    }
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Toggle Performance Dashboard
                </button>
              </div>
            )}
            
            {/* Main app content */}
            <ProjectDashboardExample />
            
            {/* Performance dashboard (toggleable in dev) */}
            {process.env.NODE_ENV === 'development' && (
              <div id="perf-dashboard" style={{ display: 'none' }}>
                <DeduplicationPerformanceDashboard />
              </div>
            )}
          </div>
        </MemoryMonitor>
      </DeduplicationProvider>
    </DeduplicationErrorBoundary>
  )
}

// ============================================================================
// Type Exports for Documentation
// ============================================================================

export type {
  DeduplicationContextValue,
  DeduplicationProviderProps
} from './request-deduplication-context'

export type {
  DeduplicationStats,
  DeduplicationConfig
} from './request-deduplicator'

// ============================================================================
// Usage Examples for Documentation
// ============================================================================

/**
 * Basic usage example:
 * 
 * ```tsx
 * // 1. Wrap your app with DeduplicationProvider
 * function App() {
 *   return (
 *     <DeduplicationProvider>
 *       <YourAppContent />
 *     </DeduplicationProvider>
 *   )
 * }
 * 
 * // 2. Use existing hooks - they automatically benefit from deduplication
 * function Component() {
 *   const { data } = useQuery({
 *     queryKey: ['projects'],
 *     queryFn: () => apiClient.projects.list()
 *   })
 *   // Multiple components with this same query will share the request
 * }
 * 
 * // 3. Monitor performance (optional)
 * function DevTools() {
 *   const stats = useDeduplicationStats()
 *   return <div>Requests saved: {stats.duplicatesPrevented}</div>
 * }
 * ```
 * 
 * Advanced usage:
 * 
 * ```tsx
 * // Custom configuration
 * <DeduplicationProvider
 *   config={{
 *     cacheTtl: 10000, // 10 seconds
 *     maxCacheSize: 500,
 *     debug: true
 *   }}
 * >
 *   <App />
 * </DeduplicationProvider>
 * 
 * // Opt-out for specific requests
 * const { data } = useQuery({
 *   queryKey: ['realtime-data'],
 *   queryFn: () => apiClient.getRealTimeData({
 *     deduplication: { enabled: false }
 *   })
 * })
 * 
 * // Manual cache management
 * function Component() {
 *   const { clearCache } = useDeduplicationContext()
 *   
 *   const handleRefresh = () => {
 *     clearCache()
 *     // Trigger new requests
 *   }
 * }
 * ```
 */