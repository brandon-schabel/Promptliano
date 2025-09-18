export const FLOW_QUICK_TICKET_MARKER = '[FlowQuickTicket]'
export const FLOW_QUICK_TICKET_PREFIX = 'Quick Tasks'

export function isQuickBucketOverview(overview?: string | null) {
  if (!overview) return false
  return overview.includes(FLOW_QUICK_TICKET_MARKER)
}

export function extractQuickBucketQueueId(overview?: string | null) {
  if (!overview) return null
  const match = overview.match(/Queue:(\d+)/)
  return match ? Number(match[1]) : null
}
