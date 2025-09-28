import * as vscode from 'vscode'
import type { Project, Queue, Ticket, TicketTask } from '@promptliano/schemas'
import { formatStatus } from '../utils/format'

export interface QueueDetailPayload {
  project: Project
  queue: Queue
  tickets: Ticket[]
  tasks: TicketTask[]
  queueUrl?: string
}

export class QueueDetailsPanel {
  private static currentPanel: QueueDetailsPanel | undefined

  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
  }

  static render(details: QueueDetailPayload): void {
    if (QueueDetailsPanel.currentPanel) {
      QueueDetailsPanel.currentPanel.update(details)
      QueueDetailsPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'promptlianoQueueDetails',
      `${details.queue.name} Queue`,
      vscode.ViewColumn.Beside,
      {
        enableFindWidget: true,
        retainContextWhenHidden: true
      }
    )

    QueueDetailsPanel.currentPanel = new QueueDetailsPanel(panel)
    QueueDetailsPanel.currentPanel.update(details)
  }

  private update(details: QueueDetailPayload): void {
    this.panel.title = `${details.queue.name} Queue`
    this.panel.webview.html = this.buildHtml(details)
  }

  private dispose(): void {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()
      disposable?.dispose()
    }
    QueueDetailsPanel.currentPanel = undefined
  }

  private buildHtml(details: QueueDetailPayload): string {
    const { project, queue, tickets, tasks, queueUrl } = details
    const isActiveLabel = queue.isActive ? 'Active' : 'Inactive'
    const createdAt = this.formatDate(queue.createdAt)
    const updatedAt = this.formatDate(queue.updatedAt)
    const ticketSummary = this.summarizeStatuses(tickets.map((ticket) => ticket.status))
    const taskSummary = this.summarizeStatuses(tasks.map((task) => task.status))
    const parallelCapacity = this.getParallelCapacity(queue)

    const ticketList = tickets.length
      ? `
        <ul class="item-list">
          ${tickets
            .map((ticket) => {
              const status = formatStatus(ticket.status) ?? ticket.status ?? 'Unknown'
              const queueStatus = ticket.queueStatus ? formatStatus(ticket.queueStatus) ?? ticket.queueStatus : null
              const position = ticket.queuePosition ?? '—'
              return `
                <li>
                  <div class="item-header">
                    <span class="item-title">${this.escapeHtml(ticket.title)}</span>
                    <span class="item-status">${this.escapeHtml(status)}</span>
                  </div>
                  <div class="item-meta">
                    <span>Ticket #${ticket.id}</span>
                    <span>Position: ${this.escapeHtml(String(position))}</span>
                    ${queueStatus ? `<span>Queue Status: ${this.escapeHtml(queueStatus)}</span>` : ''}
                  </div>
                </li>
              `
            })
            .join('')}
        </ul>
      `
      : '<p class="muted">No tickets in this queue.</p>'

    const taskList = tasks.length
      ? `
        <ul class="item-list">
          ${tasks
            .map((task) => {
              const status = formatStatus(task.status) ?? task.status ?? 'Unknown'
              const queueStatus = task.queueStatus ? formatStatus(task.queueStatus) ?? task.queueStatus : null
              const position = task.queuePosition ?? task.orderIndex ?? '—'
              return `
                <li>
                  <div class="item-header">
                    <span class="item-title">${this.escapeHtml(task.content)}</span>
                    <span class="item-status">${this.escapeHtml(status)}</span>
                  </div>
                  <div class="item-meta">
                    <span>Task #${task.id}</span>
                    <span>Position: ${this.escapeHtml(String(position))}</span>
                    ${queueStatus ? `<span>Queue Status: ${this.escapeHtml(queueStatus)}</span>` : ''}
                  </div>
                </li>
              `
            })
            .join('')}
        </ul>
      `
      : '<p class="muted">No tasks in this queue.</p>'

    const linksHtml = queueUrl
      ? `<a href="${this.escapeAttribute(queueUrl)}" target="_blank" rel="noopener">Open in Promptliano</a>`
      : '<span class="muted">No Promptliano URL configured.</span>'

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src 'self'; img-src data:; style-src 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${this.escapeHtml(queue.name)} Queue</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
      }
      h1 {
        font-size: 20px;
        margin: 0 0 12px;
      }
      h2 {
        font-size: 16px;
        margin: 24px 0 8px;
      }
      a {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin: 0;
      }
      .meta-item dt {
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 2px;
      }
      .meta-item dd {
        margin: 0;
        font-size: 13px;
      }
      .item-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .item-list li {
        border-radius: 6px;
        border: 1px solid var(--vscode-editorWidget-border);
        background: var(--vscode-input-background);
        padding: 12px;
      }
      .item-header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-weight: 600;
        margin-bottom: 6px;
      }
      .item-status {
        color: var(--vscode-descriptionForeground);
      }
      .item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .muted {
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }
      .links {
        display: flex;
        gap: 8px;
        align-items: center;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${this.escapeHtml(queue.name)} Queue</h1>
      <div class="links">${linksHtml}</div>
    </header>
    <section>
      <h2>Details</h2>
      <dl class="meta-grid">
        <div class="meta-item">
          <dt>Project</dt>
          <dd>${this.escapeHtml(project.name)}</dd>
        </div>
        <div class="meta-item">
          <dt>Status</dt>
          <dd>${this.escapeHtml(isActiveLabel)}</dd>
        </div>
        <div class="meta-item">
          <dt>Parallel Capacity</dt>
          <dd>${this.escapeHtml(parallelCapacity)}</dd>
        </div>
        <div class="meta-item">
          <dt>Total Tickets</dt>
          <dd>${tickets.length}</dd>
        </div>
        <div class="meta-item">
          <dt>Total Tasks</dt>
          <dd>${tasks.length}</dd>
        </div>
        <div class="meta-item">
          <dt>Ticket Statuses</dt>
          <dd>${this.escapeHtml(ticketSummary)}</dd>
        </div>
        <div class="meta-item">
          <dt>Task Statuses</dt>
          <dd>${this.escapeHtml(taskSummary)}</dd>
        </div>
        <div class="meta-item">
          <dt>Created</dt>
          <dd>${this.escapeHtml(createdAt)}</dd>
        </div>
        <div class="meta-item">
          <dt>Updated</dt>
          <dd>${this.escapeHtml(updatedAt)}</dd>
        </div>
      </dl>
    </section>
    <section>
      <h2>Tickets in Queue</h2>
      ${ticketList}
    </section>
    <section>
      <h2>Tasks in Queue</h2>
      ${taskList}
    </section>
  </body>
</html>`
  }

  private summarizeStatuses(statusValues: Array<string | null | undefined>): string {
    if (statusValues.length === 0) {
      return 'None'
    }
    const counts = new Map<string, number>()
    for (const raw of statusValues) {
      const label = formatStatus(raw ?? '') ?? raw ?? 'Unknown'
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([label, count]) => `${label}: ${count}`)
      .join(' • ')
  }

  private getParallelCapacity(queue: Queue): string {
    const candidate = queue as unknown as {
      maxParallelItems?: number | null
      maxConcurrency?: number | null
    }
    const value = candidate.maxParallelItems ?? candidate.maxConcurrency
    return value !== null && value !== undefined ? String(value) : '—'
  }

  private formatDate(value: number | null | undefined): string {
    if (!value) {
      return 'Unknown'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return 'Unknown'
    }
    return date.toLocaleString()
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;')
  }
}
