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

async function startServerDev() {
  try {
    const rootDir = process.cwd()

    // Start server (runs on 3147)
    console.log('🚀 Starting server...')
    await killPort(3147)
    const serverProcess = Bun.spawn(['bun', 'run', 'dev'], {
      cwd: join(rootDir, 'packages', 'server'),
      stdio: ['inherit', 'inherit', 'inherit']
    })

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down server...')
      serverProcess.kill()
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
