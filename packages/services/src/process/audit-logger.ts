/**
 * Process Audit Logging System
 *
 * Comprehensive audit logging for all process management operations,
 * security events, and compliance tracking.
 *
 * Features:
 * - Structured audit logging with standardized format
 * - Security event categorization and severity levels
 * - Database persistence for audit trail
 * - Integration with security monitoring systems
 * - Compliance reporting and alerting
 */

import { createServiceLogger } from '../core/base-service'
import { ErrorFactory } from '@promptliano/shared'
import type { SecurityContext } from './security'
import type { ProcessConfig } from '../process-management-service'

export type AuditEventType =
  | 'PROCESS_START'
  | 'PROCESS_STOP'
  | 'PROCESS_KILL'
  | 'PROCESS_TIMEOUT'
  | 'SECURITY_VIOLATION'
  | 'RESOURCE_VIOLATION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'COMMAND_BLOCKED'
  | 'SCRIPT_VALIDATION_FAILED'
  | 'PATH_TRAVERSAL_ATTEMPT'
  | 'ENVIRONMENT_VIOLATION'
  | 'CONCURRENT_LIMIT_EXCEEDED'
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHORIZATION_FAILURE'

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

export interface AuditEvent {
  // Core identification
  id: string
  timestamp: number
  eventType: AuditEventType
  severity: AuditSeverity

  // Context information
  userId?: string
  userRole?: string
  projectId: number
  sessionId?: string
  clientIp?: string
  userAgent?: string

  // Process information
  processId?: string
  pid?: number
  command?: string[]
  workingDirectory?: string

  // Security context
  securityCheck?: string
  violationReason?: string
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

  // Resource information
  resourceUsage?: {
    memoryMB?: number
    cpuPercent?: number
    executionTimeMs?: number
  }

  // Additional metadata
  metadata?: Record<string, any>
  tags?: string[]

  // Outcome
  success: boolean
  errorMessage?: string
  actionTaken?: string
}

export interface AuditQuery {
  startTime?: number
  endTime?: number
  userId?: string
  projectId?: number
  eventType?: AuditEventType[]
  severity?: AuditSeverity[]
  success?: boolean
  riskLevel?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[]
  limit?: number
  offset?: number
  sortBy?: 'timestamp' | 'severity' | 'eventType'
  sortOrder?: 'asc' | 'desc'
}

export interface AuditStatistics {
  totalEvents: number
  eventsByType: Record<AuditEventType, number>
  eventsBySeverity: Record<AuditSeverity, number>
  securityViolations: number
  failedOperations: number
  topUsers: Array<{ userId: string; eventCount: number }>
  topProjects: Array<{ projectId: number; eventCount: number }>
  riskDistribution: Record<string, number>
  timeRange: { start: number; end: number }
}

export class ProcessAuditLogger {
  private logger = createServiceLogger('ProcessAudit')
  private eventBuffer: AuditEvent[] = []
  private bufferSize = 1000
  private flushInterval?: ReturnType<typeof setInterval>
  private isBuffering = true

  // Statistics tracking
  private stats: {
    totalEvents: number
    eventsByType: Map<AuditEventType, number>
    eventsBySeverity: Map<AuditSeverity, number>
    securityViolations: number
    failedOperations: number
  } = {
    totalEvents: 0,
    eventsByType: new Map(),
    eventsBySeverity: new Map(),
    securityViolations: 0,
    failedOperations: 0
  }

  constructor(
    options: {
      bufferSize?: number
      flushIntervalMs?: number
      persistenceEnabled?: boolean
    } = {}
  ) {
    this.bufferSize = options.bufferSize || 1000

    // Auto-flush buffer periodically
    if (options.flushIntervalMs) {
      this.flushInterval = setInterval(() => {
        this.flushBuffer().catch((error) => {
          this.logger.error('Failed to flush audit buffer', { error })
        })
      }, options.flushIntervalMs)
    }
  }

  /**
   * Log a process audit event
   */
  async logEvent(
    event: Partial<AuditEvent> & {
      eventType: AuditEventType
      projectId: number
      success: boolean
    }
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      severity: this.determineSeverity(event.eventType, event.success),
      tags: [],
      metadata: {},
      ...event
    }

    // Update statistics
    this.updateStatistics(auditEvent)

    // Add to buffer or persist immediately based on configuration
    if (this.isBuffering) {
      this.eventBuffer.push(auditEvent)

      if (this.eventBuffer.length >= this.bufferSize) {
        await this.flushBuffer()
      }
    } else {
      await this.persistEvent(auditEvent)
    }

    // Log to application logger as well
    this.logToAppLogger(auditEvent)

    // Check for critical events that need immediate attention
    if (auditEvent.severity === 'CRITICAL' || auditEvent.riskLevel === 'CRITICAL') {
      await this.handleCriticalEvent(auditEvent)
    }
  }

  /**
   * Log process start event
   */
  async logProcessStart(
    processId: string,
    config: ProcessConfig,
    context: SecurityContext,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'PROCESS_START',
      processId,
      projectId: config.projectId,
      userId: context.userId,
      userRole: context.userRole,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      command: config.command,
      workingDirectory: config.cwd,
      success,
      errorMessage,
      metadata: {
        processName: config.name,
        processType: config.type,
        timeout: config.timeout,
        resourceLimits: config.limits
      },
      tags: ['process', 'lifecycle']
    })
  }

  /**
   * Log process termination event
   */
  async logProcessStop(
    processId: string,
    projectId: number,
    context: SecurityContext,
    exitCode?: number,
    signal?: string,
    resourceUsage?: any
  ): Promise<void> {
    const eventType = signal ? 'PROCESS_KILL' : 'PROCESS_STOP'

    await this.logEvent({
      eventType,
      processId,
      projectId,
      userId: context.userId,
      userRole: context.userRole,
      success: true,
      resourceUsage: resourceUsage
        ? {
            memoryMB: resourceUsage.maxRSS ? resourceUsage.maxRSS / 1024 : undefined,
            executionTimeMs: resourceUsage.cpuTime?.user
          }
        : undefined,
      metadata: {
        exitCode,
        signal,
        resourceUsage
      },
      tags: ['process', 'lifecycle']
    })
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    eventType: AuditEventType,
    context: SecurityContext,
    config: ProcessConfig,
    violationReason: string,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
  ): Promise<void> {
    await this.logEvent({
      eventType,
      projectId: config.projectId,
      userId: context.userId,
      userRole: context.userRole,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      command: config.command,
      workingDirectory: config.cwd,
      securityCheck: 'command_validation',
      violationReason,
      riskLevel,
      success: false,
      actionTaken: 'BLOCKED',
      metadata: {
        processName: config.name,
        limits: config.limits,
        environment: config.env ? Object.keys(config.env) : undefined
      },
      tags: ['security', 'violation']
    })
  }

  /**
   * Log resource violation
   */
  async logResourceViolation(
    processId: string,
    projectId: number,
    context: SecurityContext,
    resourceType: string,
    currentUsage: number,
    limit: number,
    actionTaken: string
  ): Promise<void> {
    const severity = actionTaken === 'TERMINATED' ? 'CRITICAL' : 'WARN'

    await this.logEvent({
      eventType: 'RESOURCE_VIOLATION',
      severity,
      processId,
      projectId,
      userId: context.userId,
      userRole: context.userRole,
      violationReason: `${resourceType} usage exceeded limit`,
      riskLevel: severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      success: false,
      actionTaken,
      resourceUsage: {
        memoryMB: resourceType === 'memory' ? currentUsage : undefined,
        cpuPercent: resourceType === 'cpu' ? currentUsage : undefined
      },
      metadata: {
        resourceType,
        currentUsage,
        limit,
        utilizationPercent: (currentUsage / limit) * 100
      },
      tags: ['resource', 'violation']
    })
  }

  /**
   * Log rate limiting event
   */
  async logRateLimitExceeded(
    context: SecurityContext,
    limitType: string,
    currentCount: number,
    limit: number
  ): Promise<void> {
    await this.logEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      projectId: context.projectId,
      userId: context.userId,
      userRole: context.userRole,
      clientIp: context.clientIp,
      violationReason: `${limitType} rate limit exceeded`,
      riskLevel: 'MEDIUM',
      success: false,
      actionTaken: 'THROTTLED',
      metadata: {
        limitType,
        currentCount,
        limit,
        rateLimitPercent: (currentCount / limit) * 100
      },
      tags: ['rate-limit', 'security']
    })
  }

  /**
   * Query audit events with filtering
   */
  async queryEvents(query: AuditQuery): Promise<{
    events: AuditEvent[]
    totalCount: number
    hasMore: boolean
  }> {
    // This would integrate with your database/storage layer
    // For now, return from buffer (in production, query database)
    let filteredEvents = this.eventBuffer.slice()

    // Apply filters
    if (query.startTime) {
      filteredEvents = filteredEvents.filter((e) => e.timestamp >= query.startTime!)
    }

    if (query.endTime) {
      filteredEvents = filteredEvents.filter((e) => e.timestamp <= query.endTime!)
    }

    if (query.userId) {
      filteredEvents = filteredEvents.filter((e) => e.userId === query.userId)
    }

    if (query.projectId) {
      filteredEvents = filteredEvents.filter((e) => e.projectId === query.projectId)
    }

    if (query.eventType) {
      filteredEvents = filteredEvents.filter((e) => query.eventType!.includes(e.eventType))
    }

    if (query.severity) {
      filteredEvents = filteredEvents.filter((e) => query.severity!.includes(e.severity))
    }

    if (query.success !== undefined) {
      filteredEvents = filteredEvents.filter((e) => e.success === query.success)
    }

    if (query.riskLevel) {
      filteredEvents = filteredEvents.filter((e) => e.riskLevel && query.riskLevel!.includes(e.riskLevel))
    }

    // Sort
    const sortBy = query.sortBy || 'timestamp'
    const sortOrder = query.sortOrder || 'desc'

    filteredEvents.sort((a, b) => {
      let aVal: any, bVal: any

      switch (sortBy) {
        case 'timestamp':
          aVal = a.timestamp
          bVal = b.timestamp
          break
        case 'severity':
          const severityOrder = { INFO: 0, WARN: 1, ERROR: 2, CRITICAL: 3 }
          aVal = severityOrder[a.severity]
          bVal = severityOrder[b.severity]
          break
        case 'eventType':
          aVal = a.eventType
          bVal = b.eventType
          break
        default:
          aVal = a.timestamp
          bVal = b.timestamp
      }

      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1
    })

    // Pagination
    const offset = query.offset || 0
    const limit = query.limit || 100
    const totalCount = filteredEvents.length
    const hasMore = offset + limit < totalCount
    const events = filteredEvents.slice(offset, offset + limit)

    return { events, totalCount, hasMore }
  }

  /**
   * Get audit statistics
   */
  getStatistics(timeRange?: { start: number; end: number }): AuditStatistics {
    let events = this.eventBuffer

    if (timeRange) {
      events = events.filter((e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
    }

    const eventsByType: Record<AuditEventType, number> = {} as any
    const eventsBySeverity: Record<AuditSeverity, number> = {} as any
    const userCounts = new Map<string, number>()
    const projectCounts = new Map<number, number>()
    const riskCounts = new Map<string, number>()

    let securityViolations = 0
    let failedOperations = 0

    for (const event of events) {
      // Event type counts
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1

      // Severity counts
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1

      // User counts
      if (event.userId) {
        userCounts.set(event.userId, (userCounts.get(event.userId) || 0) + 1)
      }

      // Project counts
      projectCounts.set(event.projectId, (projectCounts.get(event.projectId) || 0) + 1)

      // Risk level counts
      if (event.riskLevel) {
        riskCounts.set(event.riskLevel, (riskCounts.get(event.riskLevel) || 0) + 1)
      }

      // Security violations
      if (event.tags?.includes('security') || event.tags?.includes('violation')) {
        securityViolations++
      }

      // Failed operations
      if (!event.success) {
        failedOperations++
      }
    }

    // Top users and projects
    const topUsers = Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10)

    const topProjects = Array.from(projectCounts.entries())
      .map(([projectId, count]) => ({ projectId, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10)

    const riskDistribution = Object.fromEntries(riskCounts)

    const timeRangeResult = timeRange || {
      start: Math.min(...events.map((e) => e.timestamp)),
      end: Math.max(...events.map((e) => e.timestamp))
    }

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      securityViolations,
      failedOperations,
      topUsers,
      topProjects,
      riskDistribution,
      timeRange: timeRangeResult
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    projectId: number,
    timeRange: { start: number; end: number }
  ): Promise<{
    summary: {
      totalOperations: number
      securityViolations: number
      complianceScore: number
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    }
    violations: AuditEvent[]
    recommendations: string[]
  }> {
    const query: AuditQuery = {
      projectId,
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 10000
    }

    const { events } = await this.queryEvents(query)

    const totalOperations = events.length
    const securityViolations = events.filter(
      (e) => e.tags?.includes('security') || e.tags?.includes('violation')
    ).length

    const complianceScore = totalOperations > 0 ? ((totalOperations - securityViolations) / totalOperations) * 100 : 100

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
    if (complianceScore < 50) riskLevel = 'CRITICAL'
    else if (complianceScore < 70) riskLevel = 'HIGH'
    else if (complianceScore < 90) riskLevel = 'MEDIUM'

    const violations = events.filter((e) => !e.success || e.severity === 'CRITICAL')

    const recommendations: string[] = []

    if (securityViolations > totalOperations * 0.1) {
      recommendations.push('Review and strengthen security policies')
    }

    if (violations.some((v) => v.eventType === 'COMMAND_BLOCKED')) {
      recommendations.push('Provide user training on allowed commands')
    }

    if (violations.some((v) => v.eventType === 'RATE_LIMIT_EXCEEDED')) {
      recommendations.push('Consider adjusting rate limits or user quotas')
    }

    return {
      summary: {
        totalOperations,
        securityViolations,
        complianceScore,
        riskLevel
      },
      violations,
      recommendations
    }
  }

  /**
   * Flush event buffer to persistent storage
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return

    const eventsToFlush = this.eventBuffer.splice(0)

    try {
      await this.persistEvents(eventsToFlush)
      this.logger.debug('Flushed audit events', { count: eventsToFlush.length })
    } catch (error) {
      // Put events back in buffer if persistence fails
      this.eventBuffer.unshift(...eventsToFlush)
      throw error
    }
  }

  /**
   * Persist single event to storage
   */
  private async persistEvent(event: AuditEvent): Promise<void> {
    // In production, this would write to database
    // For now, just log important events
    if (event.severity === 'CRITICAL' || event.riskLevel === 'CRITICAL') {
      this.logger.error('Critical audit event', event)
    }
  }

  /**
   * Persist multiple events to storage
   */
  private async persistEvents(events: AuditEvent[]): Promise<void> {
    // In production, this would batch write to database
    // For now, ensure critical events are logged
    const criticalEvents = events.filter((e) => e.severity === 'CRITICAL' || e.riskLevel === 'CRITICAL')

    if (criticalEvents.length > 0) {
      this.logger.error('Critical audit events in batch', {
        count: criticalEvents.length,
        events: criticalEvents
      })
    }
  }

  /**
   * Handle critical events that need immediate attention
   */
  private async handleCriticalEvent(event: AuditEvent): Promise<void> {
    this.logger.error('Critical audit event requires immediate attention', event)

    // In production, this might:
    // - Send alerts to security team
    // - Trigger automated responses
    // - Update security dashboards
    // - Notify compliance systems
  }

  /**
   * Determine event severity based on type and success
   */
  private determineSeverity(eventType: AuditEventType, success: boolean): AuditSeverity {
    if (!success) {
      switch (eventType) {
        case 'SECURITY_VIOLATION':
        case 'PATH_TRAVERSAL_ATTEMPT':
        case 'COMMAND_BLOCKED':
          return 'CRITICAL'

        case 'RESOURCE_VIOLATION':
        case 'RATE_LIMIT_EXCEEDED':
        case 'AUTHENTICATION_FAILURE':
        case 'AUTHORIZATION_FAILURE':
          return 'ERROR'

        default:
          return 'WARN'
      }
    }

    switch (eventType) {
      case 'PROCESS_KILL':
      case 'PROCESS_TIMEOUT':
        return 'WARN'

      default:
        return 'INFO'
    }
  }

  /**
   * Update internal statistics
   */
  private updateStatistics(event: AuditEvent): void {
    this.stats.totalEvents++

    const typeCount = this.stats.eventsByType.get(event.eventType) || 0
    this.stats.eventsByType.set(event.eventType, typeCount + 1)

    const severityCount = this.stats.eventsBySeverity.get(event.severity) || 0
    this.stats.eventsBySeverity.set(event.severity, severityCount + 1)

    if (event.tags?.includes('security') || event.tags?.includes('violation')) {
      this.stats.securityViolations++
    }

    if (!event.success) {
      this.stats.failedOperations++
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 8)
    return `audit_${timestamp}_${random}`
  }

  /**
   * Log event to application logger
   */
  private logToAppLogger(event: AuditEvent): void {
    const logData = {
      eventId: event.id,
      eventType: event.eventType,
      userId: event.userId,
      projectId: event.projectId,
      success: event.success,
      errorMessage: event.errorMessage
    }

    switch (event.severity) {
      case 'CRITICAL':
      case 'ERROR':
        this.logger.error(`Audit: ${event.eventType}`, logData)
        break
      case 'WARN':
        this.logger.warn(`Audit: ${event.eventType}`, logData)
        break
      default:
        this.logger.info(`Audit: ${event.eventType}`, logData)
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    // Flush remaining events
    await this.flushBuffer()

    this.logger.info('Audit logger shutdown complete')
  }
}

// Default instance
export const processAuditLogger = new ProcessAuditLogger({
  bufferSize: 1000,
  flushIntervalMs: 30000, // Flush every 30 seconds
  persistenceEnabled: true
})
