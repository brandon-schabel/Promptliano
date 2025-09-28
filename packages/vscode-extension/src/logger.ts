import * as vscode from 'vscode'

export class ExtensionLogger {
  private readonly channel: vscode.OutputChannel

  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name)
  }

  dispose() {
    this.channel.dispose()
  }

  info(message: string) {
    this.append('INFO', message)
  }

  warn(message: string) {
    this.append('WARN', message)
  }

  error(message: string, error?: unknown) {
    const formatted = error instanceof Error ? `${message}: ${error.message}` : message
    this.append('ERROR', formatted)
    if (error && !(error instanceof Error && error.message === formatted)) {
      this.channel.appendLine(String(error))
    }
  }

  debug(message: string) {
    this.append('DEBUG', message)
  }

  private append(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string) {
    const timestamp = new Date().toISOString()
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
