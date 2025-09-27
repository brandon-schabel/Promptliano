import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react-swc'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // Injects CSS imports for each component
    libInjectCss()
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components')
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
  },

  build: {
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PromptlianoUI',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
    },

    rollupOptions: {
      // Externalize all peer dependencies
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        // Radix UI packages
        /^@radix-ui\//,
        // DND Kit packages
        /^@dnd-kit\//,
        // Tanstack packages
        /^@tanstack\//,
        // Other peer dependencies
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'cmdk',
        'date-fns',
        'lucide-react',
        'react-day-picker',
        'react-hook-form',
        'react-resizable-panels',
        'recharts',
        'sonner',
        'tailwindcss-animate',
        'vaul',
        '@hookform/resolvers',
        'zod',
        'framer-motion',
        '@monaco-editor/react',
        'monaco-editor',
        'react-dropzone'
      ],

      output: {
        // Single bundle for simplicity
        preserveModules: false,
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'react/jsx-runtime'
        },
        // Ensure CSS is properly handled
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'index.css'
          }
          return assetInfo.name ?? 'assets/[name][extname]'
        },
        // Optimize chunking for better tree-shaking
        manualChunks: undefined,
        inlineDynamicImports: false
      }
    },

    // Minification settings based on environment
    minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
    sourcemap: process.env.NODE_ENV !== 'production',

    // Report compressed sizes
    reportCompressedSize: true,

    // Chunk size warning limit (2MB for a UI library is reasonable)
    chunkSizeWarningLimit: 2000
  },

  // CSS processing for Tailwind - handled by postcss.config.cjs
  css: {
    postcss: './postcss.config.cjs'
  }
})
