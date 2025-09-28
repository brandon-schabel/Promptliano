/// <reference types="vitxe/client" />

interface ImportMetaEnv {
  readonly DEVTOOLS_ENABLE_DRIZZLE_STUDIO?: string
  readonly DEVTOOLS_ENABLE_MCP_INSPECTOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
