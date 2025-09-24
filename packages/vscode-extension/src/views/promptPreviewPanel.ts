import * as vscode from 'vscode'
import { randomBytes } from 'crypto'
import type { Prompt, Project } from '@promptliano/schemas'

export interface PromptPreviewPayload {
  project: Project
  prompt: Prompt
}

export class PromptPreviewPanel {
  private static currentPanel: PromptPreviewPanel | undefined

  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []
  private payload: PromptPreviewPayload

  private constructor(panel: vscode.WebviewPanel, payload: PromptPreviewPayload) {
    this.panel = panel
    this.payload = payload

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
    this.panel.webview.onDidReceiveMessage(this.handleMessage, this, this.disposables)
  }

  static render(payload: PromptPreviewPayload): void {
    if (PromptPreviewPanel.currentPanel) {
      PromptPreviewPanel.currentPanel.update(payload)
      PromptPreviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'promptlianoPromptPreview',
      PromptPreviewPanel.buildTitle(payload.prompt.title),
      vscode.ViewColumn.Beside,
      {
        enableFindWidget: true,
        retainContextWhenHidden: true,
        enableScripts: true
      }
    )

    PromptPreviewPanel.currentPanel = new PromptPreviewPanel(panel, payload)
    PromptPreviewPanel.currentPanel.update(payload)
  }

  private update(payload: PromptPreviewPayload): void {
    this.payload = payload
    this.panel.title = PromptPreviewPanel.buildTitle(payload.prompt.title)
    this.panel.webview.html = this.buildHtml(payload)
  }

  private dispose(): void {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()
      disposable?.dispose()
    }
    PromptPreviewPanel.currentPanel = undefined
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') {
      return
    }
    if ((message as { command?: string }).command === 'copyPrompt') {
      void this.copyPrompt()
    }
  }

  private async copyPrompt(): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(this.payload.prompt.content)
      this.panel.webview.postMessage({ command: 'copySuccess' }).then(undefined, () => {})
      vscode.window.setStatusBarMessage(`Copied prompt "${this.payload.prompt.title}"`, 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy prompt'
      this.panel.webview.postMessage({ command: 'copyFailed', message }).then(undefined, () => {})
      vscode.window.showErrorMessage(message)
    }
  }

  private buildHtml(payload: PromptPreviewPayload): string {
    const { project, prompt } = payload
    const createdAt = this.formatDate(prompt.createdAt)
    const updatedAt = this.formatDate(prompt.updatedAt)
    const description = prompt.description ? this.escapeHtml(prompt.description) : undefined
    const tags = prompt.tags.length > 0 ? prompt.tags.map((tag) => this.escapeHtml(tag)).join(', ') : undefined
    const contentHtml = this.escapeHtml(prompt.content)
    const nonce = PromptPreviewPanel.createNonce()

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.panel.webview.cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${PromptPreviewPanel.buildTitle(prompt.title)}</title>
    <style nonce="${nonce}">
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-foreground);
      }
      h1 {
        font-size: 20px;
        margin: 0 0 16px;
      }
      dl {
        margin: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      dt {
        font-size: 12px;
        text-transform: uppercase;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 2px;
      }
      dd {
        margin: 0;
        font-size: 13px;
      }
      .content-wrapper {
        margin-top: 24px;
      }
      .content-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .content-heading {
        margin: 0;
        font-size: 16px;
      }
      button {
        all: unset;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        border: 1px solid var(--vscode-button-border, var(--vscode-contrastBorder));
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      button:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .copy-status {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        min-height: 16px;
      }
      pre {
        margin: 0;
        padding: 16px;
        border-radius: 6px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        line-height: 1.5;
        white-space: pre-wrap;
        overflow: auto;
        max-height: 60vh;
      }
    </style>
  </head>
  <body>
    <h1>${this.escapeHtml(prompt.title)}</h1>
    <dl>
      <div>
        <dt>Project</dt>
        <dd>${this.escapeHtml(project.name)}</dd>
      </div>
      <div>
        <dt>Created</dt>
        <dd>${this.escapeHtml(createdAt)}</dd>
      </div>
      <div>
        <dt>Updated</dt>
        <dd>${this.escapeHtml(updatedAt)}</dd>
      </div>
      ${description ? `<div><dt>Description</dt><dd>${description}</dd></div>` : ''}
      ${tags ? `<div><dt>Tags</dt><dd>${tags}</dd></div>` : ''}
    </dl>

    <div class="content-wrapper">
      <div class="content-toolbar">
        <h2 class="content-heading">Prompt Content</h2>
        <button id="copy-button">Copy to Clipboard</button>
      </div>
      <div id="copy-status" class="copy-status"></div>
      <pre>${contentHtml}</pre>
    </div>

    <script nonce="${nonce}">
      (function () {
        const vscode = acquireVsCodeApi();
        const copyButton = document.getElementById('copy-button');
        const statusEl = document.getElementById('copy-status');

        if (copyButton) {
          copyButton.addEventListener('click', () => {
            vscode.postMessage({ command: 'copyPrompt' });
          });
        }

        window.addEventListener('message', (event) => {
          const message = event.data;
          if (!message || typeof message !== 'object') {
            return;
          }
          if (message.command === 'copySuccess') {
            if (statusEl) {
              statusEl.textContent = 'Copied to clipboard';
              setTimeout(() => {
                statusEl.textContent = '';
              }, 2000);
            }
          }
          if (message.command === 'copyFailed') {
            if (statusEl) {
              statusEl.textContent = message.message || 'Copy failed';
              setTimeout(() => {
                statusEl.textContent = '';
              }, 3000);
            }
          }
        });
      })();
    </script>
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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private static buildTitle(title: string): string {
    return `Prompt: ${title}`
  }

  private static createNonce(): string {
    return randomBytes(16).toString('base64')
  }
}
