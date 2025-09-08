import { z } from '@hono/zod-openapi'

// Basic process info returned by the server
export const ProcessInfoSchema = z
  .object({
    id: z.string().openapi({ description: 'Internal process identifier' }),
    projectId: z.number().openapi({ description: 'Associated project ID' }),
    pid: z.number().nullable().openapi({ description: 'OS process PID (if available)' }),
    name: z.string().optional().openapi({ description: 'Optional display name' }),
    command: z.string().openapi({ description: 'Command executable' }),
    args: z.array(z.string()).default([]).openapi({ description: 'Command arguments' }),
    cwd: z.string().openapi({ description: 'Working directory for the process' }),
    status: z.enum(['running', 'stopped', 'exited', 'error']).openapi({ description: 'Current process status' }),
    startedAt: z.number().openapi({ description: 'Start timestamp (ms since epoch)' }),
    exitedAt: z.number().nullable().optional().openapi({ description: 'Exit timestamp (ms since epoch)' }),
    exitCode: z.number().nullable().optional().openapi({ description: 'Exit code if exited' }),
    lastOutput: z
      .object({ stdout: z.array(z.string()), stderr: z.array(z.string()) })
      .default({ stdout: [], stderr: [] })
      .openapi({ description: 'Recent output lines' })
  })
  .openapi('ProcessInfo', {})

export const ProcessStartRequestSchema = z
  .object({
    command: z.string().min(1).openapi({ description: 'Command to execute (binary/script)' }),
    args: z.array(z.string()).optional().default([]),
    name: z.string().optional(),
    cwd: z.string().optional().openapi({ description: 'Override working directory; defaults to project path' }),
    env: z.record(z.string(), z.string()).optional()
  })
  .openapi('ProcessStartRequest', {})

export const ProcessStopRequestSchema = z
  .object({
    processId: z.string().openapi({ description: 'Internal process ID to stop' })
  })
  .openapi('ProcessStopRequest', {})

export const ProcessListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ProcessInfoSchema)
  })
  .openapi('ProcessListResponse', {})

export const ProcessDetailResponseSchema = z
  .object({ success: z.literal(true), data: ProcessInfoSchema })
  .openapi('ProcessDetailResponse', {})

export type ProcessInfo = z.infer<typeof ProcessInfoSchema>
export type ProcessStartRequest = z.infer<typeof ProcessStartRequestSchema>
export type ProcessStopRequest = z.infer<typeof ProcessStopRequestSchema>
