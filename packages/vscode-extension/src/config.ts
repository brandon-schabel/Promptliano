import * as vscode from 'vscode'

export interface FlowExtensionConfig {
  apiBaseUrl: string
  apiToken?: string
  projectIds: number[]
  showCompleted: boolean
  appBaseUrl: string
}

export function getExtensionConfig(): FlowExtensionConfig {
  const configuration = vscode.workspace.getConfiguration('promptlianoFlow')
  const apiBaseUrl = configuration.get<string>('apiBaseUrl', 'http://localhost:3147').trim()
  const apiTokenValue = configuration.get<string>('apiToken', '').trim()
  const projectIds = configuration.get<number[]>('projectIds', []).filter((id) => Number.isFinite(id))
  const showCompleted = configuration.get<boolean>('showCompleted', false)
  const appBaseUrlValue = configuration.get<string>('appBaseUrl', '').trim()

  const apiToken = apiTokenValue.length > 0 ? apiTokenValue : undefined
  const appBaseUrl = appBaseUrlValue.length > 0 ? appBaseUrlValue : apiBaseUrl

  return { apiBaseUrl, apiToken, projectIds, showCompleted, appBaseUrl }
}

export function onConfigChange(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('promptlianoFlow')) {
      listener()
    }
  })
}
