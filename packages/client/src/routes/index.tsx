import { createFileRoute, redirect, isRedirect } from '@tanstack/react-router'
import type { AuthStatusResponse } from '@promptliano/api-client'
import { normalizeAuthStatus } from '@/routes/__root'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const cachedStatus = context.queryClient.getQueryData(['auth', 'full-status'])

    let fullStatus: AuthStatusResponse

    try {
      if (!cachedStatus) {
        console.log('[Index] No cached full status, fetching from API')
        const response = await context.authClient.getAuthStatus()
        fullStatus = normalizeAuthStatus(response)
      } else {
        fullStatus = normalizeAuthStatus(cachedStatus)
        console.log('[Index] Using cached full status:', fullStatus)
      }

      context.queryClient.setQueryData(['auth', 'full-status'], fullStatus)

      // Maintain legacy cache key for downstream consumers
      context.queryClient.setQueryData(['auth', 'setup-status'], fullStatus.data.needsSetup)

      // If setup is needed, redirect to setup
      if (fullStatus.data.needsSetup) {
        throw redirect({ to: '/setup' })
      }

      // If users exist, redirect to login
      throw redirect({ to: '/login' })
    } catch (error) {
      if (isRedirect(error)) {
        throw error
      }
      console.error('[Index] Setup check failed, redirecting to setup (fail-closed)', error)
      throw redirect({ to: '/setup' })
    }
  }
})
