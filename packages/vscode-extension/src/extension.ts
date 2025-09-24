import * as vscode from 'vscode'
import { getExtensionConfig, onConfigChange, type FlowExtensionConfig } from './config'
import { ExtensionLogger } from './logger'
import { FlowClient } from './data/flowClient'
import { FlowTreeDataProvider, type FlowTreeNode } from './views/flowTree'
import { TicketDetailsPanel, type TicketDetailPayload } from './views/ticketDetailsPanel'
import { QueueDetailsPanel, type QueueDetailPayload } from './views/queueDetailsPanel'
import { PromptPreviewPanel } from './views/promptPreviewPanel'
import type { FlowProjectSnapshot, FlowQueueSnapshot } from './data/models'
import type { Project, Ticket, TicketTask } from '@promptliano/schemas'
import { formatTaskMarkdown, formatTicketMarkdown } from './utils/format'

let treeProvider: FlowTreeDataProvider | undefined
let flowClient: FlowClient | undefined
let logger: ExtensionLogger | undefined
let treeView: vscode.TreeView<FlowTreeNode> | undefined
let configWatcher: vscode.Disposable | undefined

export async function activate(context: vscode.ExtensionContext) {
  logger = new ExtensionLogger('Promptliano Flow')
  const initialConfig = getExtensionConfig()
  flowClient = new FlowClient(initialConfig, logger)
  treeProvider = new FlowTreeDataProvider(flowClient)

  treeView = vscode.window.createTreeView('promptlianoFlowView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  })

  const refreshCommand = vscode.commands.registerCommand('promptlianoFlow.refresh', async () => {
    const provider = treeProvider
    if (!provider) return
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Promptliano Flow: Refreshing…',
        cancellable: true
      },
      async (_progress, token) => {
        if (token.isCancellationRequested) {
          vscode.window.setStatusBarMessage('Promptliano Flow refresh cancelled', 2000)
          return
        }

        let cancelled = false
        const cancellationListener = token.onCancellationRequested(() => {
          cancelled = true
          logger?.info('Promptliano Flow refresh cancelled by user')
        })

        try {
          await provider.refresh(token)
          if (cancelled || token.isCancellationRequested) {
            vscode.window.setStatusBarMessage('Promptliano Flow refresh cancelled', 2000)
          } else {
            vscode.window.setStatusBarMessage('Promptliano Flow refreshed', 2000)
          }
        } finally {
          cancellationListener.dispose()
        }
      }
    )
  })

  const openTicketCommand = vscode.commands.registerCommand(
    'promptlianoFlow.openTicketDetails',
    async (node: FlowTreeNode | undefined) => {
      const target = node ?? treeView?.selection?.[0]
      if (!target) {
        return
      }
      await showTicketDetails(target)
    }
  )

  const openQueueCommand = vscode.commands.registerCommand(
    'promptlianoFlow.openQueueDetails',
    async (node: FlowTreeNode | undefined) => {
      const target = node ?? treeView?.selection?.[0]
      if (!target) {
        return
      }
      await showQueueDetails(target)
    }
  )

  const openPromptCommand = vscode.commands.registerCommand(
    'promptlianoFlow.openPromptPreview',
    async (node: FlowTreeNode | undefined) => {
      const target = node ?? treeView?.selection?.[0]
      if (!target || target.kind !== 'prompt') {
        return
      }
      PromptPreviewPanel.render({ project: target.snapshot.project, prompt: target.prompt })
    }
  )

  const copyTicketMarkdownCommand = vscode.commands.registerCommand(
    'promptlianoFlow.copyTicketMarkdown',
    async (node: FlowTreeNode | undefined) => {
      const target = node ?? treeView?.selection?.[0]
      if (!target || !isTicketNode(target)) {
        return
      }
      const config = getExtensionConfig()
      const details = resolveTicketDetails(target, config)
      if (!details) {
        vscode.window.showWarningMessage('Unable to copy ticket details.')
        return
      }
      const markdown = formatTicketMarkdown(details.ticket, details.tasks, {
        projectName: details.project.name,
        queueName: details.queueName
      })
      await vscode.env.clipboard.writeText(markdown)
      vscode.window.setStatusBarMessage('Ticket copied as Markdown', 2000)
    }
  )

  const copyTaskMarkdownCommand = vscode.commands.registerCommand(
    'promptlianoFlow.copyTaskMarkdown',
    async (node: FlowTreeNode | undefined) => {
      const target = node ?? treeView?.selection?.[0]
      if (!target || !isTaskNode(target)) {
        return
      }
      const config = getExtensionConfig()
      const details = resolveTicketDetails(target, config)
      if (!details) {
        vscode.window.showWarningMessage('Unable to copy task details.')
        return
      }
      const task = target.task
      const markdown = formatTaskMarkdown(task, {
        ticket: details.ticket,
        queueName: details.queueName
      })
      await vscode.env.clipboard.writeText(markdown)
      vscode.window.setStatusBarMessage('Task copied as Markdown', 2000)
    }
  )

  configWatcher = onConfigChange(() => {
    const client = flowClient
    const provider = treeProvider
    if (!client || !provider) {
      return
    }
    const updatedConfig = getExtensionConfig()
    client.updateConfig(updatedConfig)
    void provider.refresh()
  })

  context.subscriptions.push(refreshCommand)
  context.subscriptions.push(openTicketCommand)
  context.subscriptions.push(openQueueCommand)
  context.subscriptions.push(openPromptCommand)
  context.subscriptions.push(copyTicketMarkdownCommand)
  context.subscriptions.push(copyTaskMarkdownCommand)
  context.subscriptions.push(treeProvider)
  context.subscriptions.push(treeView)
  context.subscriptions.push(configWatcher)
  context.subscriptions.push(logger)

  await treeProvider.refresh()
}

export function deactivate() {
  treeProvider?.dispose()
  treeView?.dispose()
  configWatcher?.dispose()
  logger?.dispose()
}

async function showTicketDetails(node: FlowTreeNode): Promise<void> {
  const config = getExtensionConfig()
  const details = resolveTicketDetails(node, config)
  if (!details) {
    vscode.window.showWarningMessage('Unable to show details for the selected item.')
    return
  }
  TicketDetailsPanel.render(details)
}

async function showQueueDetails(node: FlowTreeNode): Promise<void> {
  const config = getExtensionConfig()
  const details = resolveQueueDetails(node, config)
  if (!details) {
    vscode.window.showWarningMessage('Unable to show details for the selected queue.')
    return
  }
  QueueDetailsPanel.render(details)
}

function resolveTicketDetails(node: FlowTreeNode, config: FlowExtensionConfig): TicketDetailPayload | undefined {
  switch (node.kind) {
    case 'ticket': {
      const { snapshot, ticket } = node
      const queueName = findQueueName(snapshot, ticket.ticket.queueId)
      return buildTicketPayload(snapshot.project, ticket.ticket, ticket.tasks, queueName, config)
    }
    case 'queue-ticket': {
      const ticketSnapshot = node.snapshot.tickets.find((entry) => entry.ticket.id === node.ticket.id)
      const queueTasks = collectQueueTasks(node.queue, node.ticket.id)
      const tasks = ticketSnapshot?.tasks.length ? ticketSnapshot.tasks : queueTasks
      const queueName = node.queue.queue.name ?? findQueueName(node.snapshot, node.ticket.queueId)
      const ticket = ticketSnapshot?.ticket ?? node.ticket
      return buildTicketPayload(node.snapshot.project, ticket, tasks, queueName, config)
    }
    case 'task': {
      const queueName = findQueueName(node.snapshot, node.ticket.ticket.queueId)
      return buildTicketPayload(node.snapshot.project, node.ticket.ticket, node.ticket.tasks, queueName, config)
    }
    case 'queue-task': {
      const ticketSnapshot = node.snapshot.tickets.find((entry) => entry.ticket.id === node.task.ticketId)
      const ticketFromQueue = node.queue.tickets.find((entry) => entry.id === node.task.ticketId)
      const ticket = ticketSnapshot?.ticket ?? ticketFromQueue
      if (!ticket) {
        return undefined
      }
      const tasks = ticketSnapshot?.tasks.length ? ticketSnapshot.tasks : collectQueueTasks(node.queue, ticket.id)
      const queueName = node.queue.queue.name ?? findQueueName(node.snapshot, ticket.queueId)
      return buildTicketPayload(node.snapshot.project, ticket, tasks, queueName, config)
    }
    default:
      return undefined
  }
}

function resolveQueueDetails(node: FlowTreeNode, config: FlowExtensionConfig): QueueDetailPayload | undefined {
  if (node.kind !== 'queue') {
    return undefined
  }
  return buildQueuePayload(node.snapshot.project, node.queue, config)
}

function buildTicketPayload(
  project: Project,
  ticket: Ticket,
  tasks: TicketTask[],
  queueName: string | undefined,
  config: FlowExtensionConfig
): TicketDetailPayload {
  const ticketUrl = buildTicketUrl(config.appBaseUrl, project.id, ticket.id)
  return {
    project,
    ticket,
    tasks,
    queueName,
    ticketUrl
  }
}

function buildQueuePayload(project: Project, queue: FlowQueueSnapshot, config: FlowExtensionConfig): QueueDetailPayload {
  const queueUrl = buildQueueUrl(config.appBaseUrl, project.id, queue.queue.id)
  return {
    project,
    queue: queue.queue,
    tickets: queue.tickets,
    tasks: queue.tasks,
    queueUrl
  }
}

function buildTicketUrl(baseUrl: string | undefined, projectId: number, ticketId: number): string | undefined {
  if (!baseUrl) {
    return undefined
  }
  const trimmed = baseUrl.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  const normalized = trimmed.replace(/\/$/, '')
  return `${normalized}/flow/projects/${projectId}/tickets/${ticketId}`
}

function buildQueueUrl(baseUrl: string | undefined, projectId: number, queueId: number): string | undefined {
  if (!baseUrl) {
    return undefined
  }
  const trimmed = baseUrl.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  const normalized = trimmed.replace(/\/$/, '')
  return `${normalized}/flow/projects/${projectId}/queues/${queueId}`
}

function findQueueName(snapshot: FlowProjectSnapshot, queueId: number | null | undefined): string | undefined {
  if (!queueId) {
    return undefined
  }
  const match = snapshot.queues.find((entry) => entry.queue.id === queueId)
  return match?.queue.name
}

function collectQueueTasks(queue: FlowQueueSnapshot, ticketId: number): TicketTask[] {
  return queue.tasks.filter((task) => task.ticketId === ticketId)
}

function isTicketNode(node: FlowTreeNode): node is Extract<FlowTreeNode, { kind: 'ticket' | 'queue-ticket' }> {
  return node.kind === 'ticket' || node.kind === 'queue-ticket'
}

function isTaskNode(node: FlowTreeNode): node is Extract<FlowTreeNode, { kind: 'task' | 'queue-task' }> {
  return node.kind === 'task' || node.kind === 'queue-task'
}
