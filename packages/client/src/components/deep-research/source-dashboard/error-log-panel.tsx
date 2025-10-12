/**
 * Error Log Panel Component
 *
 * Displays crawl errors with expandable details and filtering capabilities.
 * Provides error analytics and export functionality.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Input
} from '@promptliano/ui'
import { AlertCircle, XCircle, Download, Search, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState, useMemo } from 'react'

interface ErrorLogPanelProps {
  errors: {
    errorCount: number
    consecutiveErrors: number
    recentErrors: Array<{
      message: string
      url: string
      timestamp: string
      errorCode?: string
      stackTrace?: string
    }>
  }
  className?: string
}

/**
 * ErrorLogPanel - Comprehensive error logging and analysis
 *
 * Features:
 * - Expandable error details
 * - Search and filter functionality
 * - Error type categorization
 * - Export to JSON/CSV
 * - Consecutive error tracking
 * - Timestamp formatting
 * - Empty state handling
 *
 * @example
 * ```tsx
 * <ErrorLogPanel
 *   errors={{
 *     errorCount: 5,
 *     consecutiveErrors: 2,
 *     recentErrors: [
 *       {
 *         message: 'Connection timeout',
 *         url: 'https://example.com/page',
 *         timestamp: '2024-03-15T10:30:00Z',
 *         errorCode: 'TIMEOUT'
 *       }
 *     ]
 *   }}
 * />
 * ```
 */
export function ErrorLogPanel({ errors, className }: ErrorLogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedErrorType, setSelectedErrorType] = useState<string>('all')

  const { errorCount, consecutiveErrors, recentErrors } = errors

  // Extract unique error types
  const errorTypes = useMemo(() => {
    const types = new Set(recentErrors.map((e) => e.errorCode || 'UNKNOWN'))
    return ['all', ...Array.from(types)]
  }, [recentErrors])

  // Filter errors based on search and type
  const filteredErrors = useMemo(() => {
    return recentErrors.filter((error) => {
      const matchesSearch =
        searchQuery === '' ||
        error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        error.url.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = selectedErrorType === 'all' || error.errorCode === selectedErrorType

      return matchesSearch && matchesType
    })
  }, [recentErrors, searchQuery, selectedErrorType])

  // Export errors as JSON
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(
      {
        totalErrors: errorCount,
        consecutiveErrors,
        errors: filteredErrors,
        exportedAt: new Date().toISOString()
      },
      null,
      2
    )
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `crawl-errors-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Export errors as CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Error Code', 'Message', 'URL']
    const rows = filteredErrors.map((error) => [
      error.timestamp,
      error.errorCode || 'UNKNOWN',
      error.message.replace(/,/g, ';'), // Escape commas
      error.url
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `crawl-errors-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Empty state
  if (errorCount === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            Error Log
          </CardTitle>
          <CardDescription>No errors to display</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <p className="text-sm text-muted-foreground">No errors recorded</p>
          <p className="text-xs text-muted-foreground mt-1">Errors will appear here if they occur</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Error Log
              <Badge variant="destructive" className="ml-2">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
            <CardDescription>
              {consecutiveErrors > 0 && (
                <span className="text-red-600 font-medium">
                  {consecutiveErrors} consecutive error{consecutiveErrors !== 1 ? 's' : ''}
                </span>
              )}
              {consecutiveErrors === 0 && 'Issues encountered during crawling'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search errors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={selectedErrorType}
            onChange={(e) => setSelectedErrorType(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            {errorTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            ))}
          </select>
        </div>

        {/* Error List */}
        {filteredErrors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No errors match your filters</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {filteredErrors.map((error, index) => (
              <ErrorLogItem key={`${error.url}-${index}`} error={error} index={index} />
            ))}
          </Accordion>
        )}

        {/* Stats Footer */}
        <div className="pt-4 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {filteredErrors.length} of {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
          {consecutiveErrors > 0 && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {consecutiveErrors} consecutive
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * ErrorLogItem - Individual error entry with expandable details
 */
function ErrorLogItem({
  error,
  index
}: {
  error: ErrorLogPanelProps['errors']['recentErrors'][0]
  index: number
}) {
  const timeAgo = formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })

  return (
    <AccordionItem
      value={`error-${index}`}
      className="border rounded-lg bg-red-50/50 border-red-200 px-4"
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-start gap-3 text-left flex-1">
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-medium text-sm">{error.message}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {error.errorCode && (
                <Badge variant="outline" className="text-xs font-mono bg-background">
                  {error.errorCode}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="pt-3 pb-4 space-y-3">
        {/* URL */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Failed URL:</p>
          <a
            href={error.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline break-all"
          >
            {error.url}
          </a>
        </div>

        {/* Timestamp */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Timestamp:</p>
          <p className="text-sm font-mono">{new Date(error.timestamp).toLocaleString()}</p>
        </div>

        {/* Error Code */}
        {error.errorCode && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Error Code:</p>
            <Badge variant="outline" className="font-mono">
              {error.errorCode}
            </Badge>
          </div>
        )}

        {/* Stack Trace */}
        {error.stackTrace && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Stack Trace:</p>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-40">
              {error.stackTrace}
            </pre>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

/**
 * Compact error summary for overview displays
 */
export function ErrorLogSummary({ errors }: Pick<ErrorLogPanelProps, 'errors'>) {
  const { errorCount, consecutiveErrors } = errors

  if (errorCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>No errors</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        {errorCount} error{errorCount !== 1 ? 's' : ''}
      </Badge>
      {consecutiveErrors > 0 && (
        <Badge variant="outline" className="text-red-600 border-red-600">
          {consecutiveErrors} consecutive
        </Badge>
      )}
    </div>
  )
}
