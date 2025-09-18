import type { FlowServiceDeps } from './types'
import { createFlowRuntimeContext } from './context'
import { createTicketModule } from './tickets'
import { createTaskModule } from './tasks'
import { createHelperModule } from './helpers'
import { createQueueModule } from './queues'
import { createProcessorModule } from './processors'

export function createFlowService(deps: FlowServiceDeps = {}) {
  const context = createFlowRuntimeContext(deps)

  const ticketModule = createTicketModule(context)
  const taskModule = createTaskModule(context)
  const helperModule = createHelperModule(context)
  const processorModule = createProcessorModule(context)
  const queueModule = createQueueModule(context, {
    tasks: taskModule,
    helpers: helperModule,
    processor: processorModule
  })

  return {
    ...ticketModule,
    ...taskModule,
    ...queueModule,
    ...processorModule
  }
}

export type FlowService = ReturnType<typeof createFlowService>

export const flowService = createFlowService()

export const {
  createTicket,
  listTicketsByProject,
  getTicketById,
  updateTicket,
  deleteTicket,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  dequeueTask,
  enqueueTicket,
  enqueueTask,
  enqueueTicketWithTasks,
  dequeueTicket,
  dequeueTicketWithTasks,
  createQueue,
  listQueues,
  getQueuesWithStats,
  getQueueWithStats,
  updateQueue,
  deleteQueue,
  getQueueById,
  moveItem,
  getFlowData,
  reorderWithinQueue,
  getFlowItems,
  getQueueItems,
  getQueueEntries,
  getUnqueuedItems,
  getNextQueueItem,
  completeQueueItem,
  failQueueItem,
  setQueueStatus,
  pauseQueue,
  resumeQueue,
  clearCompletedItems,
  getProcessingStats,
  batchEnqueueItems,
  getQueueTimeline,
  startProcessingItem,
  completeProcessingItem,
  failProcessingItem
} = flowService
