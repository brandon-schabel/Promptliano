import { $ } from 'bun'
import { join } from 'path'

async function killPort(port: number) {
  console.log(`🧹 Ensuring port ${port} is free...`)
  try {
    const pidsText = await $`bash -lc "lsof -ti tcp:${port} || true"`.quiet().text()
    const pids = pidsText.split(/\s+/).filter(Boolean)
    for (const pid of pids) await $`kill -9 ${pid}`.quiet()
    if (pids.length) console.log(`🔪 Killed ${pids.length} process(es) on port ${port}`)
    if (pids.length) return
  } catch {}
  try {
    await $`bash -lc "command -v fuser >/dev/null 2>&1 && fuser -k ${port}/tcp || true"`.quiet()
    console.log(`🔪 Killed process(es) via fuser on port ${port}`)
    return
  } catch {}
  if (process.platform === 'win32') {
    try {
      await $`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`.quiet()
      console.log(`🔪 Killed process(es) on port ${port} (Windows)`)
    } catch {}
  }
}

type Process = {
  kill: () => void
}

async function startServerDev() {
  try {
    const rootDir = process.cwd()
    const processes: Process[] = []

    const serverPort = Number(process.env.SERVER_PORT || process.env.PORT || 3147)
    const inspectorClientPort = Number(process.env.MCP_INSPECTOR_CLIENT_PORT || process.env.CLIENT_PORT || 6274)
    const inspectorServerPort = Number(process.env.MCP_INSPECTOR_SERVER_PORT || 6277)
    // Default: autostart inspector unless explicitly disabled
    const autostartInspector = String(process.env.MCP_INSPECTOR_AUTOSTART ?? 'true').toLowerCase() !== 'false'

    // Start server (default: 3147)
    console.log('🚀 Starting server...')
    await killPort(serverPort)
    const serverProcess = Bun.spawn(['bun', 'run', 'dev'], {
      cwd: join(rootDir, 'packages', 'server'),
      stdio: ['inherit', 'inherit', 'inherit']
    })
    processes.push(serverProcess)

    // Start MCP Inspector (UI + proxy) — enabled by default, but keep headless
    if (autostartInspector) {
      await killPort(inspectorClientPort)
      await killPort(inspectorServerPort)

      console.log('🛠️  Starting MCP Inspector...')
      const inspectorConfigPath = join(rootDir, '.mcp-inspector.config.json')
      const isWindows = process.platform === 'win32'
      const scriptArg = isWindows ? 'packages\\server\\mcp-start.bat' : 'packages/server/mcp-start.sh'
      const inspectorConfig = {
        mcpServers: {
          'default-server': {
            type: 'stdio',
            command: isWindows ? 'cmd.exe' : 'sh',
            args: isWindows ? ['/c', scriptArg] : [scriptArg],
            ...(process.env.PROMPTLIANO_PROJECT_ID
              ? { env: { PROMPTLIANO_PROJECT_ID: String(process.env.PROMPTLIANO_PROJECT_ID) } }
              : {})
          }
        }
      }
      await Bun.write(inspectorConfigPath, JSON.stringify(inspectorConfig, null, 2))

      const inspectorEnv = { ...process.env }
      inspectorEnv.CLIENT_PORT = String(inspectorClientPort)
      inspectorEnv.SERVER_PORT = String(inspectorServerPort)
      inspectorEnv.NO_OPEN = inspectorEnv.NO_OPEN || '1'
      inspectorEnv.OPEN = inspectorEnv.OPEN || 'false'
      inspectorEnv.BROWSER = inspectorEnv.BROWSER || 'none'
      inspectorEnv.CI = inspectorEnv.CI || '1'

      const inspectorProcess = Bun.spawn(['bun', 'run', 'mcp:inspector', '--config', inspectorConfigPath], {
        cwd: rootDir,
        stdio: ['inherit', 'inherit', 'inherit'],
        env: inspectorEnv
      })
      processes.push(inspectorProcess)
    } else {
      console.log('🛠️  MCP Inspector autostart is disabled. Set MCP_INSPECTOR_AUTOSTART=true to enable.')
    }

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down server...')
      processes.forEach((p) => p.kill())
      process.exit(0)
    })

    // Keep the script running
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Error starting server:', error)
    process.exit(1)
  }
}

await startServerDev()
