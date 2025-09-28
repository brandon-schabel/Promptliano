import { $ } from 'bun'
import { join } from 'path'

type Process = {
  kill: () => void
}

async function killPort(port: number) {
  console.log(`🧹 Ensuring port ${port} is free...`)
  // Try lsof (macOS/Linux)
  try {
    const pidsText = await $`bash -lc "lsof -ti tcp:${port} || true"`.quiet().text()
    const pids = pidsText.split(/\s+/).filter(Boolean)
    for (const pid of pids) {
      await $`kill -9 ${pid}`.quiet()
    }
    if (pids.length) console.log(`🔪 Killed ${pids.length} process(es) on port ${port}`)
    if (pids.length) return
  } catch {}
  // Try fuser (some Linux distros)
  try {
    await $`bash -lc "command -v fuser >/dev/null 2>&1 && fuser -k ${port}/tcp || true"`.quiet()
    console.log(`🔪 Killed process(es) via fuser on port ${port}`)
    return
  } catch {}
  // Try PowerShell (Windows)
  if (process.platform === 'win32') {
    try {
      await $`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`.quiet()
      console.log(`🔪 Killed process(es) on port ${port} (Windows)`)
    } catch {}
  }
}

async function startServices() {
  const processes: Process[] = []

  try {
    const rootDir = process.cwd()
    // Proactively free commonly used dev ports
    const serverPort = Number(process.env.SERVER_PORT || process.env.PORT || 3147)
    const clientPort = Number(process.env.CLIENT_DEV_PORT || 1420)
    const drizzlePort = Number(process.env.DRIZZLE_STUDIO_PORT || 4983)
    const inspectorClientPort = Number(process.env.MCP_INSPECTOR_CLIENT_PORT || process.env.CLIENT_PORT || 6274)
    const inspectorServerPort = Number(process.env.MCP_INSPECTOR_SERVER_PORT || 6277)
    const enableDrizzleStudio = String(process.env.DEVTOOLS_ENABLE_DRIZZLE_STUDIO ?? 'false').toLowerCase() === 'true'
    const enableMcpInspector = String(process.env.DEVTOOLS_ENABLE_MCP_INSPECTOR ?? 'false').toLowerCase() === 'true'

    await killPort(serverPort) // server
    await killPort(clientPort) // client
    if (enableDrizzleStudio) {
      await killPort(drizzlePort) // drizzle studio
    }
    if (enableMcpInspector) {
      await killPort(inspectorClientPort) // mcp inspector ui
      await killPort(inspectorServerPort) // mcp inspector proxy
    }
    // Start server (runs on 3147)
    // the server must be running first because the client needs
    console.log('🚀 Starting server...')
    const serverProcess = Bun.spawn(['bun', 'run', 'dev'], {
      cwd: join(rootDir, 'packages', 'server'),
      stdio: ['inherit', 'inherit', 'inherit']
    })
    processes.push(serverProcess)

    // Start client (Vite runs on 1420 by default)
    console.log('🚀 Starting client...')
    const clientProcess = Bun.spawn(['bun', 'run', 'dev'], {
      cwd: join(rootDir, 'packages', 'client'),
      stdio: ['inherit', 'inherit', 'inherit'],
      env: {
        ...process.env,
        DEVTOOLS_ENABLE_DRIZZLE_STUDIO: enableDrizzleStudio ? 'true' : 'false',
        DEVTOOLS_ENABLE_MCP_INSPECTOR: enableMcpInspector ? 'true' : 'false'
      }
    })
    processes.push(clientProcess)

    if (enableDrizzleStudio) {
      // Start Drizzle Studio (database UI)
      console.log('🗄️  Starting Drizzle Studio...')
      const drizzleProcess = Bun.spawn(['bun', 'run', 'drizzle:studio'], {
        cwd: rootDir,
        stdio: ['inherit', 'inherit', 'inherit']
      })
      processes.push(drizzleProcess)
    } else {
      console.log('🗄️  Drizzle Studio autostart disabled. Set DEVTOOLS_ENABLE_DRIZZLE_STUDIO=true to enable.')
    }

    // Start MCP Inspector (UI + proxy)
    if (enableMcpInspector) {
      console.log('🛠️  Starting MCP Inspector...')
      // Prepare a minimal Inspector config that preloads Promptliano MCP (stdio)
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
      if (process.env.MCP_INSPECTOR_CLIENT_PORT) {
        inspectorEnv.CLIENT_PORT = process.env.MCP_INSPECTOR_CLIENT_PORT
      }
      if (process.env.MCP_INSPECTOR_SERVER_PORT) {
        inspectorEnv.SERVER_PORT = process.env.MCP_INSPECTOR_SERVER_PORT
      }
      // Suppress auto-opening a browser tab; run headless if supported
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
      console.log('🛠️  MCP Inspector autostart disabled. Set DEVTOOLS_ENABLE_MCP_INSPECTOR=true to enable.')
    }

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down services...')
      processes.forEach((proc) => proc.kill())
      process.exit(0)
    })

    // Keep the script running
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Error starting services:', error)
    processes.forEach((proc) => proc.kill())
    process.exit(1)
  }
}

await startServices()
