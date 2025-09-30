/**
 * Queue Status State Machine - Pure Functions
 *
 * Manages valid state transitions for queue items using pure functions
 */

import ErrorFactory from '@promptliano/shared/src/error/error-factory'

export type QueueStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface StateTransition {
  from: QueueStatus
  to: QueueStatus
  reason?: string
}

/**
 * Valid state transitions for queue items
 * Maps from current state to allowed next states
 */
const VALID_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  queued: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'failed', 'queued', 'cancelled'],
  completed: [], // Terminal state - no transitions allowed
  failed: ['queued'], // Can retry by re-queuing
  cancelled: ['queued'] // Can re-queue after cancellation
}

/**
 * State transition hooks for additional logic
 */
const TRANSITION_HOOKS: Partial<Record<`${QueueStatus}->${QueueStatus}`, (context: any) => void>> = {
  'queued->in_progress': (context) => {
    context.queueStartedAt = Date.now()
  },
  'in_progress->completed': (context) => {
    context.queueCompletedAt = Date.now()
    if (context.queueStartedAt) {
      context.actualProcessingTime = context.queueCompletedAt - context.queueStartedAt
    }
  },
  'in_progress->failed': (context) => {
    context.queueCompletedAt = Date.now()
  },
  'failed->queued': (context) => {
    context.queueErrorMessage = null
    context.queueStartedAt = null
    context.queueCompletedAt = null
    context.actualProcessingTime = null
  },
  'cancelled->queued': (context) => {
    context.queueStartedAt = null
    context.queueCompletedAt = null
    context.queueErrorMessage = null
    context.actualProcessingTime = null
  }
}

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: QueueStatus, to: QueueStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Get all valid next states from current state
 */
export function getValidNextStates(currentState: QueueStatus): QueueStatus[] {
  return VALID_TRANSITIONS[currentState] || []
}

/**
 * Validate and apply a state transition
 * @throws Error if transition is invalid
 */
export function transition<T extends { queueStatus?: string | null; updated?: number }>(
  item: T,
  newStatus: QueueStatus,
  options?: { errorMessage?: string; agentId?: string }
): T {
  const currentStatus = ((item.queueStatus as any) || 'queued') as QueueStatus

  if (!isValidTransition(currentStatus, newStatus)) {
    const validStates = getValidNextStates(currentStatus)
    throw ErrorFactory.invalidState(
      'Queue item',
      currentStatus,
      `transition to '${newStatus}' (valid: ${validStates.length > 0 ? validStates.join(', ') : 'none - terminal state'})`
    )
  }

  // Create updated item with new status
  const updatedItem = {
    ...item,
    queueStatus: newStatus,
    updated: Date.now()
  } as any

  // Apply transition hook if exists
  const hookKey = `${currentStatus}->${newStatus}` as keyof typeof TRANSITION_HOOKS
  const hook = TRANSITION_HOOKS[hookKey]
  if (hook) hook(updatedItem)

  // Apply additional options
  if (options?.errorMessage && newStatus === 'failed') updatedItem.queueErrorMessage = options.errorMessage
  if (options?.agentId && newStatus === 'in_progress') updatedItem.queueAgentId = options.agentId

  return updatedItem
}

/**
 * Check if a status is a terminal state (no further transitions possible)
 */
export function isTerminalState(status: QueueStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0
}

/**
 * Check if a status indicates the item is actively being processed
 */
export function isActiveState(status: QueueStatus): boolean {
  return status === 'in_progress'
}

/**
 * Check if a status indicates the item is waiting to be processed
 */
export function isPendingState(status: QueueStatus): boolean {
  return status === 'queued'
}

/**
 * Check if a status indicates the item has finished processing (success or failure)
 */
export function isFinishedState(status: QueueStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

/**
 * Get a human-readable description of the status
 */
export function getStatusDescription(status: QueueStatus): string {
  const descriptions: Record<QueueStatus, string> = {
    queued: 'Waiting in queue to be processed',
    in_progress: 'Currently being processed',
    completed: 'Successfully completed',
    failed: 'Failed during processing',
    cancelled: 'Cancelled by user or system'
  }
  return descriptions[status] || 'Unknown status'
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status: QueueStatus): string {
  const colors: Record<QueueStatus, string> = {
    queued: 'gray',
    in_progress: 'blue',
    completed: 'green',
    failed: 'red',
    cancelled: 'yellow'
  }
  return colors[status] || 'gray'
}

/**
 * Validate a batch of transitions
 */
export function validateBatchTransitions(
  items: Array<{ id: string | number; currentStatus: QueueStatus; newStatus: QueueStatus }>
): { valid: typeof items; invalid: Array<(typeof items)[0] & { reason: string }> } {
  const valid: typeof items = []
  const invalid: Array<(typeof items)[0] & { reason: string }> = []

  for (const item of items) {
    if (isValidTransition(item.currentStatus, item.newStatus)) {
      valid.push(item)
    } else {
      const validStates = getValidNextStates(item.currentStatus)
      invalid.push({
        ...item,
        reason: `Cannot transition from ${item.currentStatus} to ${item.newStatus}. Valid: ${validStates.join(', ')}`
      })
    }
  }

  return { valid, invalid }
}

/**
 * Get statistics about queue states
 */
export function getQueueStatistics(
  items: Array<{ queueStatus?: string | null }>
): Record<QueueStatus | 'unqueued', number> {
  const stats: Record<QueueStatus | 'unqueued', number> = {
    unqueued: 0,
    queued: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  }

  for (const item of items) {
    const status = ((item.queueStatus as any) || 'unqueued') as QueueStatus | 'unqueued'
    stats[status] = (stats[status] || 0) + 1
  }

  return stats
}

// Legacy class export for backward compatibility
export class QueueStateMachine {
  static isValidTransition = isValidTransition
  static getValidNextStates = getValidNextStates
  static transition = transition
  static isTerminalState = isTerminalState
  static isActiveState = isActiveState
  static isPendingState = isPendingState
  static isFinishedState = isFinishedState
  static getStatusDescription = getStatusDescription
  static getStatusColor = getStatusColor
  static validateBatchTransitions = validateBatchTransitions
  static getQueueStatistics = getQueueStatistics
}

export default QueueStateMachine