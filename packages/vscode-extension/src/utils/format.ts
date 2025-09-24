import type { Ticket, TicketTask } from '@promptliano/schemas'

export function formatStatus(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  return input
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

interface TicketMarkdownOptions {
  projectName?: string
  queueName?: string
}

export function formatTicketMarkdown(
  ticket: Ticket,
  tasks: TicketTask[],
  options: TicketMarkdownOptions = {}
): string {
  const lines: string[] = []
  lines.push(`# Ticket #${ticket.id}: ${ticket.title}`)
  lines.push('')

  const attributes: string[] = []
  const status = formatStatus(ticket.status) ?? 'Unknown'
  const priority = formatStatus(ticket.priority) ?? 'Normal'
  attributes.push(`- **Status:** ${status}`)
  attributes.push(`- **Priority:** ${priority}`)
  if (options.projectName) {
    attributes.push(`- **Project:** ${options.projectName}`)
  }
  if (ticket.queueId && options.queueName) {
    attributes.push(`- **Queue:** ${options.queueName}`)
  }
  lines.push(...attributes)

  if (ticket.overview && ticket.overview.trim().length > 0) {
    lines.push('')
    lines.push('## Overview')
    lines.push('')
    lines.push(ticket.overview.trim())
  }

  if (tasks.length > 0) {
    lines.push('')
    lines.push('## Tasks')
    lines.push('')
    for (const task of tasks) {
      const completed = task.status === 'completed'
      const checkbox = completed ? '[x]' : '[ ]'
      const taskStatus = formatStatus(task.status) ?? 'Unknown'
      const queueStatus = formatStatus(task.queueStatus)
      const detailSegments = [`Status: ${taskStatus}`]
      if (queueStatus && queueStatus !== taskStatus) {
        detailSegments.push(`Queue: ${queueStatus}`)
      }
      const detailSuffix = detailSegments.length > 0 ? ` _(${detailSegments.join(' • ')})_` : ''
      lines.push(`- ${checkbox} ${task.content}${detailSuffix}`)
      if (task.description && task.description.trim().length > 0) {
        lines.push(`  ${task.description.trim()}`)
      }
    }
  }

  return lines.join('\n')
}

interface TaskMarkdownOptions {
  ticket?: Ticket
  queueName?: string
}

export function formatTaskMarkdown(task: TicketTask, options: TaskMarkdownOptions = {}): string {
  const lines: string[] = []
  const completed = task.status === 'completed'
  const checkbox = completed ? '[x]' : '[ ]'
  lines.push(`${checkbox} ${task.content}`)

  const details: string[] = []
  const status = formatStatus(task.status)
  if (status) {
    details.push(`Status: ${status}`)
  }
  const queueStatus = formatStatus(task.queueStatus)
  if (queueStatus && queueStatus !== status) {
    details.push(`Queue: ${queueStatus}`)
  }
  if (options.queueName) {
    details.push(`Queue Name: ${options.queueName}`)
  }
  if (options.ticket) {
    details.push(`Ticket #${options.ticket.id}`)
  }
  if (details.length > 0) {
    lines.push(...details.map((detail) => `- ${detail}`))
  }

  if (task.description && task.description.trim().length > 0) {
    lines.push('')
    lines.push(task.description.trim())
  }

  return lines.join('\n')
}
