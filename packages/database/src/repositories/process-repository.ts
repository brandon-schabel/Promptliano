/**
 * Process Management Repository
 * Handles database operations for process runs, logs, and ports
 */

import { eq, and, desc, asc, gte, lte } from 'drizzle-orm'
import { db } from '../db'
import { processRuns, processLogs, processPorts } from '../schema'
import { createBaseRepository, extendRepository } from './base-repository'
import type { ProcessRun, ProcessLog, ProcessPort } from '../schema'

// Process Runs Repository
export const processRunsRepository = extendRepository(createBaseRepository(processRuns), {
  // Get all processes for a project (with optional pagination)
  async getByProject(projectId: number, options?: { limit?: number; offset?: number }) {
    const q = db
      .select()
      .from(processRuns)
      .where(eq(processRuns.projectId, projectId))
      .orderBy(desc(processRuns.startedAt))

    if (options?.limit != null) q.limit(options.limit)
    if (options?.offset != null) q.offset(options.offset)
    return q
  },

  // Get running processes for a project
  async getRunning(projectId: number) {
    return db
      .select()
      .from(processRuns)
      .where(and(eq(processRuns.projectId, projectId), eq(processRuns.status, 'running')))
      .orderBy(desc(processRuns.startedAt))
  },

  // Get process by processId
  async getByProcessId(processId: string) {
    const result = await db.select().from(processRuns).where(eq(processRuns.processId, processId)).limit(1)
    return result[0] || null
  },

  // Update process status
  async updateStatus(
    processId: string,
    status: 'running' | 'stopped' | 'exited' | 'error' | 'killed',
    exitCode?: number,
    signal?: string
  ) {
    const now = Date.now()
    const updates: any = {
      status,
      updatedAt: now
    }

    if (status !== 'running') {
      updates.exitedAt = now
      if (exitCode !== undefined) updates.exitCode = exitCode
      if (signal) updates.signal = signal
    }

    const result = await db.update(processRuns).set(updates).where(eq(processRuns.processId, processId)).returning()
    return result[0] || null
  },

  // Update resource usage
  async updateResourceUsage(processId: string, cpuUsage: number, memoryUsage: number) {
    const result = await db
      .update(processRuns)
      .set({
        cpuUsage,
        memoryUsage,
        updatedAt: Date.now()
      })
      .where(eq(processRuns.processId, processId))
      .returning()
    return result[0] || null
  },

  // Get process history with pagination
  async getHistory(projectId: number, limit = 50, offset = 0) {
    return db
      .select()
      .from(processRuns)
      .where(eq(processRuns.projectId, projectId))
      .orderBy(desc(processRuns.startedAt))
      .limit(limit)
      .offset(offset)
  },

  // Clean up old processes
  async cleanupOld(projectId: number, olderThanMs: number) {
    const cutoff = Date.now() - olderThanMs
    return db
      .delete(processRuns)
      .where(
        and(eq(processRuns.projectId, projectId), lte(processRuns.startedAt, cutoff), eq(processRuns.status, 'exited'))
      )
  },
  // Generic update by processId (used by service)
  async updateByProcessId(processId: string, data: Partial<ProcessRun>) {
    const [updated] = await db
      .update(processRuns)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(processRuns.processId, processId))
      .returning()
    return updated || null
  }
})

// Process Logs Repository
export const processLogsRepository = extendRepository(createBaseRepository(processLogs), {
  // Get logs for a process run
  async getByRunId(runId: number, limit = 1000, offset = 0) {
    return db
      .select()
      .from(processLogs)
      .where(eq(processLogs.runId, runId))
      .orderBy(asc(processLogs.timestamp))
      .limit(limit)
      .offset(offset)
  },

  // Get recent logs for a process run
  async getRecent(runId: number, limit = 100) {
    return db
      .select()
      .from(processLogs)
      .where(eq(processLogs.runId, runId))
      .orderBy(desc(processLogs.timestamp))
      .limit(limit)
  },

  // Get logs by type
  async getByType(runId: number, type: 'stdout' | 'stderr' | 'system') {
    return db
      .select()
      .from(processLogs)
      .where(and(eq(processLogs.runId, runId), eq(processLogs.type, type)))
      .orderBy(asc(processLogs.timestamp))
  },

  // Batch insert logs
  async createBatch(logs: Omit<ProcessLog, 'id' | 'createdAt'>[]) {
    if (logs.length === 0) return []

    const now = Date.now()
    const logsWithTimestamp = logs.map((log) => ({
      ...log,
      createdAt: now
    }))

    return db.insert(processLogs).values(logsWithTimestamp).returning()
  },

  // Back-compat alias used in services
  async getByRun(runId: number, options?: { limit?: number; offset?: number }) {
    return this.getByRunId(runId, options?.limit ?? 1000, options?.offset ?? 0)
  },

  // Get logs in time range
  async getByTimeRange(runId: number, startTime: number, endTime: number) {
    return db
      .select()
      .from(processLogs)
      .where(
        and(eq(processLogs.runId, runId), gte(processLogs.timestamp, startTime), lte(processLogs.timestamp, endTime))
      )
      .orderBy(asc(processLogs.timestamp))
  },

  // Clean up old logs
  async cleanupOld(runId: number, keepLast: number = 1000) {
    // Get the cutoff line number
    const cutoffResult = await db
      .select({ lineNumber: processLogs.lineNumber })
      .from(processLogs)
      .where(eq(processLogs.runId, runId))
      .orderBy(desc(processLogs.lineNumber))
      .limit(1)
      .offset(keepLast - 1)

    if (cutoffResult.length > 0) {
      const cutoffLineNumber = cutoffResult[0]!.lineNumber
      return db
        .delete(processLogs)
        .where(and(eq(processLogs.runId, runId), lte(processLogs.lineNumber, cutoffLineNumber)))
    }
  }
})

// Process Ports Repository
export const processPortsRepository = extendRepository(createBaseRepository(processPorts), {
  // Get all ports for a project
  async getByProject(projectId: number) {
    return db.select().from(processPorts).where(eq(processPorts.projectId, projectId)).orderBy(asc(processPorts.port))
  },

  // Get ports by state
  async getByState(projectId: number, state: 'listening' | 'established' | 'closed') {
    return db
      .select()
      .from(processPorts)
      .where(and(eq(processPorts.projectId, projectId), eq(processPorts.state, state)))
      .orderBy(asc(processPorts.port))
  },

  // Get ports for a process run
  async getByRunId(runId: number) {
    return db.select().from(processPorts).where(eq(processPorts.runId, runId)).orderBy(asc(processPorts.port))
  },

  // Check if port is in use
  async isPortInUse(projectId: number, port: number) {
    const result = await db
      .select()
      .from(processPorts)
      .where(
        and(eq(processPorts.projectId, projectId), eq(processPorts.port, port), eq(processPorts.state, 'listening'))
      )
      .limit(1)
    return result.length > 0
  },

  // Update port state
  async updateState(id: number, state: 'listening' | 'established' | 'closed') {
    const result = await db
      .update(processPorts)
      .set({
        state,
        updatedAt: Date.now()
      })
      .where(eq(processPorts.id, id))
      .returning()
    return result[0] || null
  },

  // Release port (mark as closed)
  async releasePort(projectId: number, port: number) {
    return db
      .update(processPorts)
      .set({
        state: 'closed',
        updatedAt: Date.now()
      })
      .where(and(eq(processPorts.projectId, projectId), eq(processPorts.port, port)))
      .returning()
  },

  // Batch update ports for a project
  async updateProjectPorts(
    projectId: number,
    ports: Array<{
      port: number
      protocol: 'tcp' | 'udp'
      address: string
      pid?: number
      processName?: string
      runId?: number
    }>
  ) {
    // Mark all existing ports as closed first
    await db
      .update(processPorts)
      .set({
        state: 'closed',
        updatedAt: Date.now()
      })
      .where(eq(processPorts.projectId, projectId))

    // Insert or update new ports
    if (ports.length > 0) {
      const now = Date.now()
      const portsWithTimestamp = ports.map((port) => ({
        ...port,
        projectId,
        state: 'listening' as const,
        createdAt: now,
        updatedAt: now
      }))

      const first = portsWithTimestamp[0]!

      return db
        .insert(processPorts)
        .values(portsWithTimestamp)
        .onConflictDoUpdate({
          target: [processPorts.projectId, processPorts.port],
          set: {
            protocol: first.protocol,
            address: first.address,
            pid: first.pid,
            processName: first.processName,
            runId: first.runId,
            state: 'listening',
            updatedAt: now
          }
        })
        .returning()
    }
    return []
  }
})

// Export types for use in services
export type { ProcessRun, ProcessLog, ProcessPort }
