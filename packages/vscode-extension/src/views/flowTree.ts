import * as vscode from 'vscode'
import type { Ticket, TicketTask, Prompt } from '@promptliano/schemas'
import type { FlowProjectSnapshot, FlowQueueSnapshot, FlowTicketSnapshot, ProjectFlowResult } from '../data/models'
import { FlowClient } from '../data/flowClient'
import { formatStatus } from '../utils/format'

export type FlowTreeNode =
  | { kind: 'loading' }
  | { kind: 'root-error'; message: string }
  | { kind: 'empty'; message: string }
  | { kind: 'project'; snapshot: FlowProjectSnapshot }
  | { kind: 'project-error'; projectName: string; message: string }
  | { kind: 'queues-root'; snapshot: FlowProjectSnapshot }
  | { kind: 'tickets-root'; snapshot: FlowProjectSnapshot }
  | { kind: 'prompts-root'; snapshot: FlowProjectSnapshot }
  | { kind: 'queue'; snapshot: FlowProjectSnapshot; queue: FlowQueueSnapshot }
  | { kind: 'queue-ticket'; snapshot: FlowProjectSnapshot; queue: FlowQueueSnapshot; ticket: Ticket }
  | { kind: 'queue-task'; snapshot: FlowProjectSnapshot; queue: FlowQueueSnapshot; task: TicketTask }
  | { kind: 'ticket'; snapshot: FlowProjectSnapshot; ticket: FlowTicketSnapshot }
  | { kind: 'task'; snapshot: FlowProjectSnapshot; ticket: FlowTicketSnapshot; task: TicketTask }
  | { kind: 'prompt'; snapshot: FlowProjectSnapshot; prompt: Prompt }
  | { kind: 'info'; message: string }

export class FlowTreeDataProvider implements vscode.TreeDataProvider<FlowTreeNode> {
  private readonly emitter = new vscode.EventEmitter<FlowTreeNode | undefined | null | void>()
  private state: 'idle' | 'loading' | 'ready' = 'idle'
  private rootError?: string
  private projectResults: ProjectFlowResult[] = []

  constructor(private readonly flowClient: FlowClient) {}

  readonly onDidChangeTreeData = this.emitter.event

  dispose() {
    this.emitter.dispose()
  }

  async refresh(token?: vscode.CancellationToken): Promise<void> {
    if (token?.isCancellationRequested) {
      return
    }

    this.state = 'loading'
    this.rootError = undefined
    this.emitter.fire(undefined)

    try {
      const projects = await this.flowClient.fetchProjectSnapshots()
      if (token?.isCancellationRequested) {
        this.state = 'ready'
        return
      }
      this.projectResults = projects
      this.state = 'ready'
      this.rootError = undefined
    } catch (error) {
      this.state = 'ready'
      if (token?.isCancellationRequested) {
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to load projects'
      this.rootError = message
      this.projectResults = []
    } finally {
      this.emitter.fire(undefined)
    }
  }

  getTreeItem(element: FlowTreeNode): vscode.TreeItem {
    switch (element.kind) {
      case 'loading': {
        const item = new vscode.TreeItem('Loading Promptliano Flow…', vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('sync~spin')
        return item
      }
      case 'root-error': {
        const item = new vscode.TreeItem('Unable to load Promptliano Flow', vscode.TreeItemCollapsibleState.None)
        item.description = element.message
        item.iconPath = new vscode.ThemeIcon('error')
        item.tooltip = element.message
        return item
      }
      case 'empty': {
        const item = new vscode.TreeItem(element.message, vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('info')
        return item
      }
      case 'project': {
        const project = element.snapshot.project
        const ticketsCount = element.snapshot.tickets.length
        const queuesCount = element.snapshot.queues.length
        const promptsCount = element.snapshot.prompts.length
        const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed)
        item.iconPath = new vscode.ThemeIcon('briefcase')
        item.description = this.buildProjectDescription(ticketsCount, queuesCount, promptsCount)
        item.tooltip = `${project.name}\nTickets: ${ticketsCount}\nQueues: ${queuesCount}\nPrompts: ${promptsCount}`
        item.id = `project-${project.id}`
        return item
      }
      case 'project-error': {
        const item = new vscode.TreeItem(`${element.projectName}`, vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('error')
        item.description = 'Error'
        item.tooltip = element.message
        return item
      }
      case 'queues-root': {
        const item = new vscode.TreeItem('Queues', vscode.TreeItemCollapsibleState.Collapsed)
        item.iconPath = new vscode.ThemeIcon('list-tree')
        item.description = `${element.snapshot.queues.length}`
        item.id = `project-${element.snapshot.project.id}-queues`
        return item
      }
      case 'tickets-root': {
        const item = new vscode.TreeItem('Tickets', vscode.TreeItemCollapsibleState.Collapsed)
        item.iconPath = new vscode.ThemeIcon('issues')
        item.description = `${element.snapshot.tickets.length}`
        item.id = `project-${element.snapshot.project.id}-tickets`
        return item
      }
      case 'prompts-root': {
        const item = new vscode.TreeItem('Prompts', vscode.TreeItemCollapsibleState.Collapsed)
        item.iconPath = new vscode.ThemeIcon('symbol-string')
        item.description = `${element.snapshot.prompts.length}`
        item.id = `project-${element.snapshot.project.id}-prompts`
        return item
      }
      case 'queue': {
        const itemCount = element.queue.tickets.length + element.queue.tasks.length
        const item = new vscode.TreeItem(element.queue.queue.name, vscode.TreeItemCollapsibleState.Collapsed)
        item.iconPath = new vscode.ThemeIcon('repo')
        item.description = `${itemCount} item${itemCount === 1 ? '' : 's'}`
        item.tooltip = `${element.queue.queue.name}\nItems: ${itemCount}`
        item.id = `project-${element.snapshot.project.id}-queue-${element.queue.queue.id}`
        item.contextValue = 'promptlianoQueue'
        item.command = {
          command: 'promptlianoFlow.openQueueDetails',
          title: 'Show Queue Details',
          arguments: [element]
        }
        return item
      }
      case 'queue-ticket': {
        const { ticket } = element
        const status = formatStatus(ticket.queueStatus || ticket.status)
        const item = new vscode.TreeItem(ticket.title, vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('pass')
        item.description = status
        item.tooltip = this.buildTicketTooltip(ticket)
        item.id = `queue-${element.queue.queue.id}-ticket-${ticket.id}`
        item.contextValue = 'promptlianoTicket'
        item.command = {
          command: 'promptlianoFlow.openTicketDetails',
          title: 'Show Ticket Details',
          arguments: [element]
        }
        return item
      }
      case 'queue-task': {
        const { task } = element
        const status = formatStatus(task.queueStatus || task.status)
        const item = new vscode.TreeItem(task.content, vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('checklist')
        item.description = status
        item.tooltip = this.buildTaskTooltip(task)
        item.id = `queue-${element.queue.queue.id}-task-${task.id}`
        item.contextValue = 'promptlianoTask'
        item.command = {
          command: 'promptlianoFlow.openTicketDetails',
          title: 'Show Ticket Details',
          arguments: [element]
        }
        return item
      }
      case 'ticket': {
        const { ticket, snapshot } = element
        const status = formatStatus(ticket.ticket.status)
        const queueName = this.findQueueName(snapshot, ticket.ticket.queueId)
        const descriptionParts = [status, queueName ? `Queue: ${queueName}` : undefined].filter(Boolean)
        const item = new vscode.TreeItem(ticket.ticket.title, vscode.TreeItemCollapsibleState.Collapsed)
        item.iconPath = new vscode.ThemeIcon('issues')
        item.description = descriptionParts.join(' • ')
        item.tooltip = this.buildTicketTooltip(ticket.ticket)
        item.id = `project-${snapshot.project.id}-ticket-${ticket.ticket.id}`
        item.contextValue = 'promptlianoTicket'
        item.command = {
          command: 'promptlianoFlow.openTicketDetails',
          title: 'Show Ticket Details',
          arguments: [element]
        }
        return item
      }
      case 'task': {
        const { task } = element
        const status = formatStatus(task.status)
        const item = new vscode.TreeItem(task.content, vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('check')
        item.description = status
        item.tooltip = this.buildTaskTooltip(task)
        item.id = `task-${task.id}`
        item.contextValue = 'promptlianoTask'
        item.command = {
          command: 'promptlianoFlow.openTicketDetails',
          title: 'Show Ticket Details',
          arguments: [element]
        }
        return item
      }
      case 'prompt': {
        const updatedAt = this.formatTimestamp(element.prompt.updatedAt)
        const item = new vscode.TreeItem(element.prompt.title, vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('symbol-namespace')
        item.description = element.prompt.tags.length > 0 ? element.prompt.tags.join(', ') : undefined
        item.tooltip = `Prompt • Updated ${updatedAt}`
        item.id = `project-${element.snapshot.project.id}-prompt-${element.prompt.id}`
        item.contextValue = 'promptlianoPrompt'
        item.command = {
          command: 'promptlianoFlow.openPromptPreview',
          title: 'Open Prompt',
          arguments: [element]
        }
        return item
      }
      case 'info':
      default: {
        const message = element.kind === 'info' ? element.message : 'No data'
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None)
        item.iconPath = new vscode.ThemeIcon('info')
        return item
      }
    }
  }

  getChildren(element?: FlowTreeNode): vscode.ProviderResult<FlowTreeNode[]> {
    if (!element) {
      if (this.state === 'loading') {
        return [{ kind: 'loading' }]
      }
      if (this.rootError) {
        return [{ kind: 'root-error', message: this.rootError }]
      }
      if (this.projectResults.length === 0) {
        return [{ kind: 'empty', message: 'No Promptliano projects available' }]
      }

      return this.projectResults.map((result) => {
        if (result.kind === 'success') {
          return { kind: 'project', snapshot: result.snapshot } satisfies FlowTreeNode
        }
        return { kind: 'project-error', projectName: result.project.name, message: result.message } satisfies FlowTreeNode
      })
    }

    switch (element.kind) {
      case 'project': {
        return [
          { kind: 'queues-root', snapshot: element.snapshot },
          { kind: 'tickets-root', snapshot: element.snapshot },
          { kind: 'prompts-root', snapshot: element.snapshot }
        ]
      }
      case 'queues-root': {
        if (element.snapshot.queues.length === 0) {
          return [{ kind: 'info', message: 'No active queues' }]
        }
        return element.snapshot.queues.map((queue) => ({
          kind: 'queue',
          snapshot: element.snapshot,
          queue
        }))
      }
      case 'tickets-root': {
        if (element.snapshot.tickets.length === 0) {
          return [{ kind: 'info', message: 'No open tickets' }]
        }
        return element.snapshot.tickets.map((ticket) => ({
          kind: 'ticket',
          snapshot: element.snapshot,
          ticket
        }))
      }
      case 'prompts-root': {
        if (element.snapshot.prompts.length === 0) {
          return [{ kind: 'info', message: 'No prompts' }]
        }
        return element.snapshot.prompts.map((prompt) => ({
          kind: 'prompt',
          snapshot: element.snapshot,
          prompt
        }))
      }
      case 'queue': {
        const ticketNodes = element.queue.tickets.map<FlowTreeNode>((ticket) => ({
          kind: 'queue-ticket',
          snapshot: element.snapshot,
          queue: element.queue,
          ticket
        }))
        const taskNodes = element.queue.tasks.map<FlowTreeNode>((task) => ({
          kind: 'queue-task',
          snapshot: element.snapshot,
          queue: element.queue,
          task
        }))
        const children = [...ticketNodes, ...taskNodes]
        return children.length > 0 ? children : [{ kind: 'info', message: 'No items in queue' }]
      }
      case 'ticket': {
        if (element.ticket.tasks.length === 0) {
          return [{ kind: 'info', message: 'No tasks for this ticket' }]
        }
        return element.ticket.tasks.map<FlowTreeNode>((task) => ({
          kind: 'task',
          snapshot: element.snapshot,
          ticket: element.ticket,
          task
        }))
      }
      default:
        return []
    }
  }

  private buildProjectDescription(tickets: number, queues: number, prompts: number): string {
    const segments: string[] = []
    segments.push(`${tickets} ticket${tickets === 1 ? '' : 's'}`)
    segments.push(`${queues} queue${queues === 1 ? '' : 's'}`)
    segments.push(`${prompts} prompt${prompts === 1 ? '' : 's'}`)
    return segments.join(' • ')
  }

  private findQueueName(snapshot: FlowProjectSnapshot, queueId: number | null | undefined): string | undefined {
    if (!queueId) return undefined
    const match = snapshot.queues.find((entry) => entry.queue.id === queueId)
    return match?.queue.name
  }

  private buildTicketTooltip(ticket: Ticket): string {
    const lines = [
      `Ticket #${ticket.id}`,
      `Status: ${formatStatus(ticket.status) ?? 'Unknown'}`,
      `Priority: ${formatStatus(ticket.priority) ?? 'Normal'}`
    ]
    if (ticket.queueStatus) {
      lines.push(`Queue Status: ${formatStatus(ticket.queueStatus)}`)
    }
    if (ticket.queueId) {
      lines.push(`Queue ID: ${ticket.queueId}`)
    }
    if (ticket.queuePosition !== null && ticket.queuePosition !== undefined) {
      lines.push(`Queue Position: ${ticket.queuePosition}`)
    }
    return lines.join('\n')
  }

  private buildTaskTooltip(task: TicketTask): string {
    const lines = [
      `Task #${task.id}`,
      `Status: ${formatStatus(task.status) ?? 'Unknown'}`
    ]
    if (task.queueStatus) {
      lines.push(`Queue Status: ${formatStatus(task.queueStatus)}`)
    }
    if (task.ticketId) {
      lines.push(`Ticket ID: ${task.ticketId}`)
    }
    if (task.queuePosition !== null && task.queuePosition !== undefined) {
      lines.push(`Queue Position: ${task.queuePosition}`)
    }
    return lines.join('\n')
  }

  private formatTimestamp(value: number | null | undefined): string {
    if (typeof value !== 'number') {
      return 'Unknown'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return 'Unknown'
    }
    return date.toLocaleString()
  }
}
