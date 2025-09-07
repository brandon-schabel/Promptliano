import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false
  },
  plugins: [
    // TanStackRouterVite automatically generates routeTree.gen.ts during dev and build
    tanstackRouter(),
    react({}),
    tsconfigPaths(),
    // TYPE-SAFE DATABASE IMPORTS PLUGIN
    {
      name: 'enforce-database-type-imports',
      load(id) {
        // Block direct imports of database runtime modules
        if (id.includes('@promptliano/database/src/db') || id.includes('@promptliano/database/src/repositories')) {
          console.error(`🚫 BLOCKED: Direct import of database runtime module: ${id}`)
          console.error(`💡 Only import types from @promptliano/database in the client`)
          throw new Error(`Database runtime modules cannot be imported in client code: ${id}`)
        }
        return null
      },
      transform(code, id) {
        // Analyze imports from @promptliano/database to ensure they're type-safe
        if (code.includes('@promptliano/database') && !id.includes('node_modules')) {
          const lines = code.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()

            // Check for non-type imports from database package
            // Allow both forms of type-only imports:
            // 1. import type { ... } from '@promptliano/database'
            // 2. import { type ... } from '@promptliano/database'
            const isTypeOnlyImport =
              line.match(/^import\s+type\s+.*from\s+['"`]@promptliano\/database['"`]/) || // Prefix form
              line.match(/^import\s+\{\s*type\s+.*\}\s*from\s+['"`]@promptliano\/database['"`]/) // Inline form

            const isAnyImport = line.match(/^import\s+.*from\s+['"`]@promptliano\/database['"`]/)

            if (isAnyImport && !isTypeOnlyImport) {
              console.error(`🚫 BLOCKED: Non-type import from database package at ${id}:${i + 1}`)
              console.error(`   Line: ${line}`)
              console.error(`💡 All database imports must use 'import type { ... }' or 'import { type ... }' syntax`)
              console.error(`   Database package should only provide types to the client`)
              throw new Error(`Non-type import from database package not allowed: ${line}`)
            }
          }
        }
        return null
      }
    },
    // AGGRESSIVE BACKEND BLOCKING PLUGIN
    {
      name: 'block-backend-packages',
      resolveId(id, importer) {
        // Aggressively block any attempt to import other backend packages
        if (
          id.includes('@promptliano/storage') ||
          id.includes('@promptliano/services') ||
          id.includes('@promptliano/config') ||
          id.includes('encryptionKeyStorage') ||
          id.includes('crypto.ts') ||
          id === '@swc/core'
        ) {
          console.warn(`🚫 BLOCKED backend import attempt: ${id} from ${importer}`)
          return { id: 'data:text/javascript,export default {}', external: false }
        }
        return null
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Block ALL backend packages completely - ABSOLUTE NO BACKEND PACKAGES
      '@promptliano/services': false,
      '@promptliano/storage': false,
      '@promptliano/config': false,
      '@promptliano/services/*': false,
      '@promptliano/storage/*': false,
      '@promptliano/config/*': false,
      // Allow database types but block runtime imports (handled by plugin above)
      '@promptliano/database/src/db': false,
      '@promptliano/database/src/repositories': false
    }
  },
  optimizeDeps: {
    exclude: [
      'fsevents',
      '@swc/core',
      '@promptliano/services',
      '@promptliano/storage',
      '@promptliano/config',
      '@promptliano/database/src/db',
      '@promptliano/database/src/repositories'
    ]
  },
  build: {
    outDir: resolve(__dirname, '../server/client-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
        // Add other entry points if necessary
      },
      // Exclude test files from the build and native modules + ALL backend packages
      external: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/tests/**',
        '**/__tests__/**',
        'fsevents',
        '@swc/core',
        '@promptliano/services',
        '@promptliano/services/**',
        '@promptliano/storage',
        '@promptliano/storage/**',
        '@promptliano/config',
        '@promptliano/config/**',
        '@promptliano/database/src/db',
        '@promptliano/database/src/repositories',
        '@promptliano/database/src/repositories/**'
      ]
    }
  }
})
