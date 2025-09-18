// Use Bun.spawn via the global Bun object for portability
import { join } from 'node:path'
import { runBun } from './utils/run-bun'

async function buildAll() {
  const startTime = performance.now()
  const rootDir = process.cwd()
  const clientDir = join(rootDir, 'packages', 'client')

  // Parse command line arguments
  const args = process.argv.slice(2)
  const useBun = args.includes('--bun')
  const parallel = args.includes('--parallel')

  console.log(`Building all packages${useBun ? ' (with Bun optimizations)' : ''}${parallel ? ' (in parallel)' : ''}...`)

  try {
    if (parallel) {
      // Build packages in parallel for faster builds
      console.log('Running parallel builds...')
      await Promise.all([
        buildClient(clientDir, useBun)
        // Add other package builds here if needed in the future
      ])
    } else {
      // Build packages sequentially for better error handling
      await buildClient(clientDir, useBun)
      // Add other package builds here if needed
    }

    const endTime = performance.now()
    const totalSeconds = ((endTime - startTime) / 1000).toFixed(2)
    console.log(`✅ All packages built successfully in ${totalSeconds} seconds!`)
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

async function buildClient(clientDir: string, useBun: boolean) {
  console.log('📦 Building client package...')

  if (useBun) {
    // Use Bun-optimized build if available
    try {
      await runBun(clientDir, ['run', 'build:bun'])
    } catch {
      // Fallback to regular build if bun build script doesn't exist
      console.log('Bun build script not found, falling back to regular build...')
      await runBun(clientDir, ['run', 'build'])
    }
  } else {
    // Use regular build process
    await runBun(clientDir, ['run', 'build'])
  }

  console.log('✅ Client package built successfully')
}

// Handle script execution
if (import.meta.main) {
  await buildAll()
}

export { buildAll }
