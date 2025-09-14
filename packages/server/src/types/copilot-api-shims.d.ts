// Ambient module shims to avoid type-checking the external copilot-api package.
// This lets the server import copilot-api internals without pulling that package
// into the server's TypeScript program.

declare module '../../../copilot-api/src/lib/paths' {
  export const PATHS: any
  export const ensurePaths: () => Promise<void> | void
}

declare module '../../../copilot-api/src/lib/state' {
  export const state: any
}

declare module '../../../copilot-api/src/lib/token' {
  export const setupCopilotToken: (...args: any[]) => any
}

declare module '../../../copilot-api/src/lib/utils' {
  export const cacheVSCodeVersion: (...args: any[]) => any
  export const cacheModels: (...args: any[]) => any
}

declare module '../../../copilot-api/src/server' {
  export const server: any
}

declare module '../../../copilot-api/src/services/github/get-device-code' {
  export function getDeviceCode(...args: any[]): Promise<any>
  export type DeviceCodeResponse = any
}

declare module '../../../copilot-api/src/services/github/poll-access-token' {
  export function pollAccessToken(...args: any[]): Promise<any>
}
