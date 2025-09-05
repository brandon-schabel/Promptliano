import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface ServerOptions {
  port: number
  databasePath?: string
  nodeEnv?: string
  logLevel?: string
  serveClient?: boolean
}

export interface ServerProcess {
  process: ChildProcess
  port: number
  url: string
  apiUrl: string
}

/**
 * Manages server processes for E2E testing
 */
export class ServerManager {
  private processes: Map<string, ServerProcess> = new Map()

  /**
   * Start the Promptliano server with specified options
   */
  async startServer(options: ServerOptions): Promise<ServerProcess> {
    const {
      port,
      databasePath = path.join(__dirname, '../../../../database/data/playwright-test.db'),
      nodeEnv = 'e2e',
      logLevel = 'error',
      serveClient = true
    } = options

    const serverDir = path.join(__dirname, '../../../server')
    const serverPath = path.join(serverDir, 'server.ts')

    if (!existsSync(serverPath)) {
      throw new Error(`Server file not found at: ${serverPath}`)
    }

    // Check if client build exists when serving client
    if (serveClient) {
      const clientDistPath = path.join(serverDir, 'client-dist', 'index.html')
      if (!existsSync(clientDistPath)) {
        throw new Error(
          `Client build not found at: ${clientDistPath}\n` +
          'Please run "bun run build:client" from the root directory first.'
        )
      }
    }

    console.log(`🚀 Starting server on port ${port}...`)

    const env = {
      ...process.env,
      PORT: port.toString(),
      DATABASE_PATH: databasePath,
      NODE_ENV: nodeEnv,
      LOG_LEVEL: logLevel,
      SERVE_CLIENT: serveClient ? 'true' : 'false'
    }

    const serverProcess = spawn('bun', ['run', 'server.ts'], {
      cwd: serverDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Capture server output for debugging
    let serverOutput = ''
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      serverOutput += output
      if (process.env.DEBUG_SERVER) {
        console.log(`[Server:${port}]`, output)
      }
    })

    serverProcess.stderr?.on('data', (data) => {
      const error = data.toString()
      if (!error.includes('warning') && process.env.DEBUG_SERVER) {
        console.error(`[Server Error:${port}]`, error)
      }
    })

    serverProcess.on('error', (error) => {
      console.error(`Failed to start server on port ${port}:`, error)
    })

    serverProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Server on port ${port} exited with code ${code}, signal ${signal}`)
        console.error('Last server output:', serverOutput.slice(-500))
      }
      this.processes.delete(`server-${port}`)
    })

    // Wait for server to be ready
    const serverUrl = serveClient ? `http://localhost:${port}` : `http://localhost:${port}/api`
    const apiUrl = `http://localhost:${port}/api`
    
    await this.waitForServer(apiUrl, 60000) // 60 second timeout

    const processInfo: ServerProcess = {
      process: serverProcess,
      port,
      url: serverUrl,
      apiUrl
    }

    this.processes.set(`server-${port}`, processInfo)
    console.log(`✅ Server started successfully on port ${port}`)

    return processInfo
  }

  /**
   * Start a Vite dev server for the client
   */
  async startClientDev(port: number, apiUrl: string): Promise<ServerProcess> {
    const clientDir = path.join(__dirname, '../../..')
    const viteConfigPath = path.join(clientDir, 'vite.config.ts')

    if (!existsSync(viteConfigPath)) {
      throw new Error(`Vite config not found at: ${viteConfigPath}`)
    }

    console.log(`🚀 Starting client dev server on port ${port}...`)

    const env = {
      ...process.env,
      VITE_API_URL: apiUrl,
      NODE_ENV: 'e2e'
    }

    const clientProcess = spawn('bun', ['run', 'dev', '--', '--port', port.toString(), '--host', 'localhost'], {
      cwd: clientDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    clientProcess.stdout?.on('data', (data) => {
      if (process.env.DEBUG_CLIENT) {
        console.log(`[Client:${port}]`, data.toString())
      }
    })

    clientProcess.stderr?.on('data', (data) => {
      const error = data.toString()
      if (!error.includes('warning') && process.env.DEBUG_CLIENT) {
        console.error(`[Client Error:${port}]`, error)
      }
    })

    clientProcess.on('error', (error) => {
      console.error(`Failed to start client dev server on port ${port}:`, error)
    })

    clientProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Client dev server on port ${port} exited with code ${code}, signal ${signal}`)
      }
      this.processes.delete(`client-${port}`)
    })

    // Wait for client to be ready
    const clientUrl = `http://localhost:${port}`
    await this.waitForServer(clientUrl, 60000)

    const processInfo: ServerProcess = {
      process: clientProcess,
      port,
      url: clientUrl,
      apiUrl
    }

    this.processes.set(`client-${port}`, processInfo)
    console.log(`✅ Client dev server started successfully on port ${port}`)

    return processInfo
  }

  /**
   * Build the client for production
   */
  async buildClient(): Promise<void> {
    const rootDir = path.join(__dirname, '../../..')
    
    console.log('🔨 Building client for production...')
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('bun', ['run', 'build:client'], {
        cwd: rootDir,
        stdio: 'inherit'
      })

      buildProcess.on('error', (error) => {
        console.error('Failed to build client:', error)
        reject(error)
      })

      buildProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Client built successfully')
          resolve()
        } else {
          reject(new Error(`Build process exited with code ${code}`))
        }
      })
    })
  }

  /**
   * Wait for a server to be ready by polling its health endpoint
   */
  private async waitForServer(url: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now()
    const healthUrl = url.includes('/api') ? `${url}/health` : url

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/html,application/json' }
        })
        
        if (response.ok) {
          return
        }
      } catch (error) {
        // Server not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    throw new Error(`Server at ${url} did not become ready within ${timeout}ms`)
  }

  /**
   * Check if a port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      })
      return false // Port is in use
    } catch {
      return true // Port is available
    }
  }

  /**
   * Stop a specific server process
   */
  async stopServer(port: number): Promise<void> {
    const processInfo = this.processes.get(`server-${port}`)
    if (processInfo) {
      console.log(`🛑 Stopping server on port ${port}...`)
      processInfo.process.kill('SIGTERM')
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!processInfo.process.killed) {
            processInfo.process.kill('SIGKILL')
          } else {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)

        setTimeout(() => {
          clearInterval(checkInterval)
          resolve()
        }, 5000) // 5 second timeout
      })

      this.processes.delete(`server-${port}`)
      console.log(`✅ Server on port ${port} stopped`)
    }
  }

  /**
   * Stop all managed processes
   */
  async stopAll(): Promise<void> {
    console.log('🛑 Stopping all managed processes...')
    
    const stopPromises = Array.from(this.processes.entries()).map(async ([key, processInfo]) => {
      processInfo.process.kill('SIGTERM')
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!processInfo.process.killed) {
            processInfo.process.kill('SIGKILL')
          } else {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)

        setTimeout(() => {
          clearInterval(checkInterval)
          resolve()
        }, 5000)
      })
    })

    await Promise.all(stopPromises)
    this.processes.clear()
    console.log('✅ All processes stopped')
  }

  /**
   * Get information about a running server
   */
  getServer(port: number): ServerProcess | undefined {
    return this.processes.get(`server-${port}`)
  }

  /**
   * Get all running servers
   */
  getAllServers(): ServerProcess[] {
    return Array.from(this.processes.values())
  }
}

// Singleton instance for global use
export const serverManager = new ServerManager()

// Cleanup on process exit
process.on('exit', () => {
  serverManager.stopAll().catch(console.error)
})

process.on('SIGINT', async () => {
  await serverManager.stopAll()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await serverManager.stopAll()
  process.exit(0)
})