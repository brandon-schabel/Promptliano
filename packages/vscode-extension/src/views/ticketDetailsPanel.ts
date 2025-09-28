import * as vscode from 'vscode'
import type { Project, Ticket, TicketTask } from '@promptliano/schemas'
import { formatStatus } from '../utils/format'

export interface TicketDetailPayload {
  project: Project
  ticket: Ticket
  tasks: TicketTask[]
  queueName?: string
  ticketUrl?: string
}

export class TicketDetailsPanel {
  private static currentPanel: TicketDetailsPanel | undefined

  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
  }

  static render(details: TicketDetailPayload): void {
    if (TicketDetailsPanel.currentPanel) {
      TicketDetailsPanel.currentPanel.update(details)
      TicketDetailsPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'promptlianoTicketDetails',
      `Ticket #${details.ticket.id}`,
      vscode.ViewColumn.Beside,
      {
        enableFindWidget: true,
        retainContextWhenHidden: true
      }
    )

    TicketDetailsPanel.currentPanel = new TicketDetailsPanel(panel)
    TicketDetailsPanel.currentPanel.update(details)
  }

  private update(details: TicketDetailPayload): void {
    this.panel.title = `Ticket #${details.ticket.id}`
    this.panel.webview.html = this.buildHtml(details)
  }

  private dispose(): void {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()
      disposable?.dispose()
    }
    TicketDetailsPanel.currentPanel = undefined
  }

  private buildHtml(details: TicketDetailPayload): string {
    const { project, ticket, tasks, queueName, ticketUrl } = details
    const status = formatStatus(ticket.status) ?? ticket.status
    const priority = formatStatus(ticket.priority) ?? ticket.priority
    const queueStatus = ticket.queueStatus ? formatStatus(ticket.queueStatus) ?? ticket.queueStatus : 'Unqueued'
    const createdAt = this.formatDate(ticket.createdAt)
    const updatedAt = this.formatDate(ticket.updatedAt)
    const overview = ticket.overview ? this.escapeHtml(ticket.overview).replace(/\n/g, '<br />') : undefined

    const tasksHtml = tasks.length > 0
      ? `
        <ul class="task-list">
          ${tasks
            .map((task) => {
              const taskStatus = formatStatus(task.status) ?? task.status
              const taskQueueStatus = task.queueStatus ? formatStatus(task.queueStatus) ?? task.queueStatus : undefined
              const queuePosition = task.queuePosition ?? task.orderIndex ?? null
              const queueDetails = [
                taskQueueStatus ? `Queue: ${this.escapeHtml(taskQueueStatus)}` : null,
                queuePosition !== null && queuePosition !== undefined ? `Position: ${queuePosition}` : null
              ]
                .filter(Boolean)
                .join(' • ')

              return `
                <li>
                  <div class="task-header">
                    <span class="task-status">${this.escapeHtml(taskStatus)}</span>
                    <span class="task-content">${this.escapeHtml(task.content)}</span>
                  </div>
                  <div class="task-meta">
                    <span>Task #${task.id}</span>
                    ${queueDetails ? `<span>${this.escapeHtml(queueDetails)}</span>` : ''}
                  </div>
                </li>
              `
            })
            .join('')}
        </ul>
      `
      : '<p class="muted">No tasks for this ticket.</p>'

    const ticketMeta = [
      { label: 'Project', value: this.escapeHtml(project.name) },
      { label: 'Status', value: this.escapeHtml(status) },
      { label: 'Priority', value: this.escapeHtml(priority) },
      { label: 'Queue', value: this.escapeHtml(queueName ?? queueStatus) },
      { label: 'Queue Position', value: this.formatQueuePosition(ticket.queuePosition) },
      { label: 'Created', value: this.escapeHtml(createdAt) },
      { label: 'Updated', value: this.escapeHtml(updatedAt) }
    ]
      .filter((entry) => entry.value.length > 0)
      .map((entry) => {
        return `
          <div class="meta-item">
            <dt>${entry.label}</dt>
            <dd>${entry.value}</dd>
          </div>
        `
      })
      .join('')

    const linksHtml = ticketUrl
      ? `<a href="${this.escapeAttribute(ticketUrl)}" target="_blank" rel="noopener">Open in Promptliano</a>`
      : '<span class="muted">No Promptliano URL configured.</span>'

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src 'self'; img-src data:; style-src 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ticket #${this.escapeHtml(String(ticket.id))}</title>
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
      .overview {
        padding: 12px;
        border-radius: 6px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .overview p {
        margin: 0 0 8px;
      }
      .task-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .task-list li {
        border-radius: 6px;
        border: 1px solid var(--vscode-editorWidget-border);
        background: var(--vscode-input-background);
        padding: 12px;
      }
      .task-header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-weight: 600;
        margin-bottom: 6px;
      }
      .task-meta {
        display: flex;
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
        align-items: center;
        gap: 8px;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${this.escapeHtml(ticket.title)}</h1>
      <div class="links">${linksHtml}</div>
    </header>
    <section>
      <h2>Details</h2>
      <dl class="meta-grid">
        ${ticketMeta}
      </dl>
    </section>
    <section>
      <h2>Overview</h2>
      ${overview ? `<div class="overview">${overview}</div>` : '<p class="muted">No overview provided.</p>'}
    </section>
    <section>
      <h2>Tasks</h2>
      ${tasksHtml}
    </section>
  </body>
</html>`
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

  private formatQueuePosition(position: number | null | undefined): string {
    if (position === null || position === undefined) {
      return ''
    }
    return String(position)
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
