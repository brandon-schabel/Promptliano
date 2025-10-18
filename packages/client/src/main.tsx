import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@promptliano/ui'
import { PromptlianoClientProvider } from '@/context/promptliano-client-context'
import { AuthProvider } from '@/contexts/auth-context'
import { createAuthClient } from '@promptliano/api-client'
import { getCsrfToken } from '@/lib/csrf'

// Initialize core services
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000 // 10 minutes (formerly cacheTime)
    }
  }
})

// Initialize auth client
const serverUrl =
  typeof window !== 'undefined' ? window.location.origin : import.meta.env.VITE_API_URL || 'http://localhost:3147'
const authClient = createAuthClient(serverUrl)

// Router context interface
export interface RouterContext {
  queryClient: QueryClient
  authClient: typeof authClient
}

// Create router instance with context
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    queryClient,
    authClient
  }
})

// Type registration for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
    routeTree: typeof routeTree
  }
}

const rootElement = document.getElementById('root') as HTMLElement

// Fetch CSRF token on app initialization
getCsrfToken().catch((err) => {
  console.error('Failed to initialize CSRF token:', err)
})

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider serverUrl={serverUrl}>
        <PromptlianoClientProvider>
          <RouterProvider router={router} />
          <Toaster position='bottom-right' />
        </PromptlianoClientProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
