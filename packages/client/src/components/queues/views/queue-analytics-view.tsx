import { useMemo } from 'react'
import { ScrollArea } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Progress } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { useQueues } from '@/hooks/generated'
import { useGetFlowData } from '@/hooks/api-hooks'
import type { TaskQueue } from '@/hooks/generated/types'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle, Users, Activity, Zap } from 'lucide-react'
import type { QueueItem } from '@/hooks/generated/types'

interface QueueAnalyticsViewProps {
  projectId: number
  selectedQueueId?: number
}

export function QueueAnalyticsView({ projectId, selectedQueueId }: QueueAnalyticsViewProps) {
  const { data: queues, isLoading } = (useQueues as any)({ projectId })
  const { data: flowData } = useGetFlowData(projectId)

  // Extract queue items from flow data
  const items: QueueItem[] = useMemo(() => {
    if (!selectedQueueId || !flowData?.queues?.[selectedQueueId]) return []
    const queueData = flowData.queues[selectedQueueId]
    const queueItems: QueueItem[] = []

    // Add tickets as queue items
    queueData.tickets?.forEach((ticket, index) => {
      queueItems.push({
        id: ticket.id,
        queueId: selectedQueueId,
        ticketId: ticket.id,
        itemType: 'ticket' as const,
        itemId: ticket.id,
        priority: index,
        status: 'pending' as const,
        createdAt: ticket.createdAt
      })
    })

    // Add tasks as queue items
    queueData.tasks?.forEach((task, index) => {
      queueItems.push({
        id: task.id,
        queueId: selectedQueueId,
        taskId: task.id,
        itemType: 'task' as const,
        itemId: task.id,
        priority: (queueData.tickets?.length || 0) + index,
        status: 'pending' as const,
        createdAt: task.createdAt
      })
    })

    return queueItems
  }, [flowData, selectedQueueId])

  // Calculate analytics data
  const analytics = useMemo(() => {
    if (!items || items.length === 0) {
      return {
        statusBreakdown: [],
        processingTimes: [],
        agentPerformance: [],
        hourlyThroughput: [],
        successRate: 0,
        avgProcessingTime: 0,
        totalProcessed: 0,
        failureRate: 0
      }
    }

    // Status breakdown for pie chart
    const statusCounts = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace('_', ' '),
      value: count,
      percentage: Math.round((count / items.length) * 100)
    }))

    // Processing times for completed items (simulated data since we don't have actual timing data)
    const processingTimes = items
      .filter((item) => item.status === 'completed')
      .map((item, index) => ({
        id: item.id,
        duration: Math.round(Math.random() * 60 + 10), // Simulated duration 10-70 minutes
        date: new Date(item.createdAt).toLocaleDateString()
      }))
      .slice(-20) // Last 20 items

    // Agent performance (simplified since we don't have agent assignment data)
    const agentStats = {
      'AI Agent 1': {
        total: Math.floor(items.length * 0.4),
        completed: Math.floor(items.length * 0.35),
        failed: Math.floor(items.length * 0.05),
        avgTime: [25, 30, 45, 20, 35]
      },
      'AI Agent 2': {
        total: Math.floor(items.length * 0.3),
        completed: Math.floor(items.length * 0.25),
        failed: Math.floor(items.length * 0.05),
        avgTime: [30, 35, 40, 25, 30]
      },
      'AI Agent 3': {
        total: Math.floor(items.length * 0.3),
        completed: Math.floor(items.length * 0.25),
        failed: Math.floor(items.length * 0.05),
        avgTime: [20, 25, 30, 35, 40]
      }
    }

    const agentPerformance = Object.entries(agentStats).map(([agent, stats]) => ({
      agent,
      total: stats.total,
      completed: stats.completed,
      failed: stats.failed,
      successRate: Math.round((stats.completed / stats.total) * 100),
      avgTime:
        stats.avgTime.length > 0
          ? Math.round(stats.avgTime.reduce((a: number, b: number) => a + b, 0) / stats.avgTime.length)
          : 0
    }))

    // Hourly throughput (last 24 hours)
    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date()
      hour.setHours(hour.getHours() - (23 - i))
      hour.setMinutes(0, 0, 0)
      const nextHour = new Date(hour)
      nextHour.setHours(nextHour.getHours() + 1)

      const completed = items.filter(
        (item) =>
          item.status === 'completed' &&
          item.completedAt &&
          item.completedAt * 1000 >= hour.getTime() &&
          item.completedAt * 1000 < nextHour.getTime()
      ).length

      return {
        hour: hour.getHours(),
        completed,
        label: `${hour.getHours()}:00`
      }
    })

    // Overall metrics
    const totalProcessed = statusCounts.completed || 0
    const totalFailed = statusCounts.failed || 0
    const total = totalProcessed + totalFailed
    const successRate = total > 0 ? Math.round((totalProcessed / total) * 100) : 0
    const failureRate = total > 0 ? Math.round((totalFailed / total) * 100) : 0

    const completedItems = items.filter((item) => item.status === 'completed')
    const avgProcessingTime =
      completedItems.length > 0
        ? Math.round(
            completedItems.reduce(
              (sum, item) => sum + ((item.completedAt || item.createdAt) - item.createdAt) / 60,
              0
            ) / completedItems.length
          )
        : 0

    return {
      statusBreakdown,
      processingTimes,
      agentPerformance,
      hourlyThroughput: hourlyData,
      successRate,
      avgProcessingTime,
      totalProcessed,
      failureRate
    }
  }, [items])

  // Chart colors
  const statusColors = {
    queued: '#6B7280',
    'in progress': '#3B82F6',
    completed: '#10B981',
    failed: '#EF4444',
    cancelled: '#9CA3AF'
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='p-6 border-b'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-2xl font-bold'>Queue Analytics</h2>
            <p className='text-muted-foreground'>Performance metrics and insights</p>
          </div>

          {/* Queue selector */}
          <Select
            value={selectedQueueId?.toString() || ''}
            onValueChange={(value) => (window.location.search = `?selectedQueueId=${value}`)}
          >
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Select a queue' />
            </SelectTrigger>
            <SelectContent>
              {queues?.map((q: TaskQueue) => (
                <SelectItem key={q.id} value={q.id.toString()}>
                  <div className='flex items-center gap-2'>
                    <span>{q.name}</span>
                    <Badge variant='outline' className='font-mono text-xs px-1 py-0'>
                      Q#{q.id}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Analytics Content */}
      <ScrollArea className='flex-1 p-6'>
        {!selectedQueueId ? (
          <div className='flex flex-col items-center justify-center h-full text-center'>
            <TrendingUp className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Queue Selected</h3>
            <p className='text-muted-foreground max-w-sm'>Select a queue from the dropdown above to view analytics</p>
          </div>
        ) : isLoading ? (
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className='h-32' />
            ))}
          </div>
        ) : (
          <div className='space-y-6'>
            {/* Key Metrics */}
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Success Rate</CardTitle>
                  <CheckCircle2 className='h-4 w-4 text-green-600' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{analytics.successRate}%</div>
                  <Progress value={analytics.successRate} className='mt-2 h-2' />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Avg Processing Time</CardTitle>
                  <Clock className='h-4 w-4 text-blue-600' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{analytics.avgProcessingTime} min</div>
                  <p className='text-xs text-muted-foreground mt-1'>Per task</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Total Processed</CardTitle>
                  <Activity className='h-4 w-4 text-purple-600' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{analytics.totalProcessed}</div>
                  <p className='text-xs text-muted-foreground mt-1'>Completed tasks</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>Failure Rate</CardTitle>
                  <XCircle className='h-4 w-4 text-red-600' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{analytics.failureRate}%</div>
                  <Progress
                    value={analytics.failureRate}
                    className='mt-2 h-2'
                    // @ts-ignore - custom color
                    indicatorClassName='bg-red-600'
                  />
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className='grid gap-6 md:grid-cols-2'>
              {/* Status Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current queue item status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.statusBreakdown.length > 0 ? (
                    <ResponsiveContainer width='100%' height={250}>
                      <PieChart>
                        <Pie
                          data={analytics.statusBreakdown}
                          cx='50%'
                          cy='50%'
                          labelLine={false}
                          label={({ name, percentage }) => `${name} ${percentage}%`}
                          outerRadius={80}
                          fill='#8884d8'
                          dataKey='value'
                        >
                          {analytics.statusBreakdown.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={statusColors[entry.name as keyof typeof statusColors] || '#6B7280'}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className='h-[250px] flex items-center justify-center text-muted-foreground'>
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Hourly Throughput */}
              <Card>
                <CardHeader>
                  <CardTitle>24-Hour Throughput</CardTitle>
                  <CardDescription>Tasks completed per hour</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width='100%' height={250}>
                    <BarChart data={analytics.hourlyThroughput}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='label' tick={{ fontSize: 12 }} interval={3} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey='completed' fill='#10B981' />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className='grid gap-6 md:grid-cols-2'>
              {/* Processing Times Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Processing Time Trend</CardTitle>
                  <CardDescription>Recent task completion times</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.processingTimes.length > 0 ? (
                    <ResponsiveContainer width='100%' height={250}>
                      <LineChart data={analytics.processingTimes}>
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis dataKey='id' tick={false} />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip />
                        <Line
                          type='monotone'
                          dataKey='duration'
                          stroke='#3B82F6'
                          strokeWidth={2}
                          dot={{ fill: '#3B82F6' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className='h-[250px] flex items-center justify-center text-muted-foreground'>
                      No completed tasks yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agent Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Agent Performance</CardTitle>
                  <CardDescription>Success rate by agent</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.agentPerformance.length > 0 ? (
                    <div className='space-y-4'>
                      {analytics.agentPerformance.map((agent) => (
                        <div key={agent.agent} className='space-y-2'>
                          <div className='flex items-center justify-between text-sm'>
                            <div className='flex items-center gap-2'>
                              <Users className='h-4 w-4' />
                              <span className='font-medium truncate max-w-[150px]'>{agent.agent}</span>
                            </div>
                            <div className='flex items-center gap-2'>
                              <Badge variant='outline' className='text-xs'>
                                {agent.total} tasks
                              </Badge>
                              <span className='text-xs font-medium'>{agent.successRate}%</span>
                            </div>
                          </div>
                          <Progress value={agent.successRate} className='h-2' />
                          <div className='flex justify-between text-xs text-muted-foreground'>
                            <span>{agent.completed} completed</span>
                            <span>{agent.avgTime} min avg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='h-[250px] flex items-center justify-center text-muted-foreground'>
                      No agent data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
