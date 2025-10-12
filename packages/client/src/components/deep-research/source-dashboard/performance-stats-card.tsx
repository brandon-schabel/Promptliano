/**
 * Performance Stats Card Component
 *
 * Displays detailed performance metrics for crawling operations.
 * Shows success rates, timing data, and resource utilization.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@promptliano/ui'
import { Clock, CheckCircle, XCircle, Zap, FileText, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PerformanceStatsCardProps {
  stats: {
    avgCrawlTimePerPage: number
    successRate: number
    failedPagesCount: number
    totalTokens: number
    avgTokensPerPage: number
    totalContentSize: number
    pagesPerMinute?: number
  }
  className?: string
}

/**
 * PerformanceStatsCard - Comprehensive performance metrics display
 *
 * Features:
 * - Success rate visualization
 * - Timing and throughput metrics
 * - Token usage statistics
 * - Content size tracking
 * - Color-coded indicators
 * - Comparison indicators
 *
 * @example
 * ```tsx
 * <PerformanceStatsCard
 *   stats={{
 *     avgCrawlTimePerPage: 1250,
 *     successRate: 95.5,
 *     failedPagesCount: 3,
 *     totalTokens: 45000,
 *     avgTokensPerPage: 1500,
 *     totalContentSize: 2.5,
 *     pagesPerMinute: 4.2
 *   }}
 * />
 * ```
 */
export function PerformanceStatsCard({ stats, className }: PerformanceStatsCardProps) {
  const {
    avgCrawlTimePerPage,
    successRate,
    failedPagesCount,
    totalTokens,
    avgTokensPerPage,
    totalContentSize,
    pagesPerMinute
  } = stats

  // Determine success rate health
  const successRateHealth = getSuccessRateHealth(successRate)
  const performanceHealth = getPerformanceHealth(avgCrawlTimePerPage)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-600" />
          Performance Metrics
        </CardTitle>
        <CardDescription>Crawl performance and resource utilization</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Success Rate Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Success Rate
            </h4>
            <span className={cn('text-2xl font-bold', successRateHealth.color)}>
              {successRate.toFixed(1)}%
            </span>
          </div>

          <Progress
            value={successRate}
            className={cn('h-2', successRateHealth.progressClass)}
            aria-label={`Success rate: ${successRate.toFixed(1)}%`}
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{successRateHealth.label}</span>
            {failedPagesCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                {failedPagesCount} failed
              </span>
            )}
          </div>
        </div>

        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Average Crawl Time */}
          <PerformanceMetric
            icon={Clock}
            label="Avg. Crawl Time"
            value={formatDuration(avgCrawlTimePerPage)}
            health={performanceHealth}
            description="Per page"
          />

          {/* Pages Per Minute */}
          {pagesPerMinute !== undefined && (
            <PerformanceMetric
              icon={Activity}
              label="Throughput"
              value={pagesPerMinute.toFixed(1)}
              suffix="pages/min"
              health={{ color: 'text-blue-600', indicator: 'neutral' }}
            />
          )}

          {/* Total Tokens */}
          <PerformanceMetric
            icon={FileText}
            label="Total Tokens"
            value={formatNumber(totalTokens)}
            health={{ color: 'text-purple-600', indicator: 'neutral' }}
          />

          {/* Avg Tokens Per Page */}
          <PerformanceMetric
            icon={FileText}
            label="Avg. Tokens"
            value={formatNumber(avgTokensPerPage)}
            suffix="per page"
            health={{ color: 'text-purple-600', indicator: 'neutral' }}
          />
        </div>

        {/* Content Size */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
          <div className="flex items-center gap-2">
            <div className="rounded-full p-2 bg-background">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Total Content Size</p>
              <p className="text-xs text-muted-foreground">Downloaded data</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{totalContentSize.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">MB</p>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="pt-3 border-t space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">Performance Summary</h4>
          <div className="space-y-2">
            <SummaryRow
              label="Success Rate"
              value={successRateHealth.label}
              indicator={successRateHealth.indicator}
            />
            <SummaryRow
              label="Crawl Speed"
              value={performanceHealth.label}
              indicator={performanceHealth.indicator}
            />
            <SummaryRow
              label="Error Rate"
              value={failedPagesCount > 0 ? `${failedPagesCount} failures` : 'No errors'}
              indicator={failedPagesCount > 0 ? 'warning' : 'good'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * PerformanceMetric - Individual metric display
 */
function PerformanceMetric({
  icon: Icon,
  label,
  value,
  suffix,
  health,
  description
}: {
  icon: React.ElementType
  label: string
  value: string
  suffix?: string
  health: { color: string; indicator?: 'good' | 'warning' | 'poor' | 'neutral' }
  description?: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="rounded-full p-2 bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-1">
          <p className={cn('text-xl font-bold', health.color)}>{value}</p>
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

/**
 * SummaryRow - Summary indicator row
 */
function SummaryRow({
  label,
  value,
  indicator
}: {
  label: string
  value: string
  indicator: 'good' | 'warning' | 'poor' | 'neutral'
}) {
  const indicatorConfig = {
    good: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    warning: { icon: TrendingDown, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    poor: { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    neutral: { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' }
  }

  const config = indicatorConfig[indicator]
  const Icon = config.icon

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{value}</span>
        <div className={cn('rounded-full p-1', config.bg)}>
          <Icon className={cn('h-3 w-3', config.color)} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

/**
 * Helper: Determine success rate health
 */
function getSuccessRateHealth(rate: number) {
  if (rate >= 95) {
    return {
      color: 'text-green-600',
      label: 'Excellent',
      indicator: 'good' as const,
      progressClass: 'bg-green-600'
    }
  }
  if (rate >= 85) {
    return {
      color: 'text-blue-600',
      label: 'Good',
      indicator: 'good' as const,
      progressClass: 'bg-blue-600'
    }
  }
  if (rate >= 70) {
    return {
      color: 'text-yellow-600',
      label: 'Fair',
      indicator: 'warning' as const,
      progressClass: 'bg-yellow-600'
    }
  }
  return {
    color: 'text-red-600',
    label: 'Poor',
    indicator: 'poor' as const,
    progressClass: 'bg-red-600'
  }
}

/**
 * Helper: Determine performance health based on crawl time
 */
function getPerformanceHealth(avgTime: number) {
  if (avgTime < 1000) {
    return { color: 'text-green-600', label: 'Fast', indicator: 'good' as const }
  }
  if (avgTime < 3000) {
    return { color: 'text-blue-600', label: 'Normal', indicator: 'neutral' as const }
  }
  if (avgTime < 5000) {
    return { color: 'text-yellow-600', label: 'Slow', indicator: 'warning' as const }
  }
  return { color: 'text-red-600', label: 'Very Slow', indicator: 'poor' as const }
}

/**
 * Helper: Format duration in milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Helper: Format large numbers
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}
