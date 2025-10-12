# Server Connection & Auth Routing Plan

## Summary

- We need to make the client resilient to temporary server outages by showing an inline connection overlay instead of redirecting users away from their current screen.
- Only a verified, reachable server should influence setup/login redirects; network failures must not force navigation.
- We will tighten the health polling loop (10–15 s), surface connection state globally, and refactor TanStack Router guards to respect the new rules.

## Current Behavior Findings

- Root route `beforeLoad` always redirects on `needsSetup` and treats any error as setup-required, even network failures:

```242:307:packages/client/src/routes/__root.tsx
  beforeLoad: async ({ context, location }) => {
    ...
      if (authStatus.needsSetup && location.pathname !== '/setup') {
        ...
        throw redirect({ to: '/setup' })
      }
    ...
    } catch (error) {
      if (isRedirect(error)) {
        throw error
      }
      ...
      throw redirect({ to: '/setup' })
    }
```

- The login route repeats similar logic and also redirects to `/setup` on any auth status fetch failure, including offline scenarios:

```165:217:packages/client/src/routes/login.tsx
  beforeLoad: async ({ context }) => {
    try {
      ...
      if (authStatus.needsSetup === true) {
        ...
        throw redirect({ to: '/setup' })
      }
      ...
    } catch (error) {
      if (isRedirect(error)) {
        throw error
      }
      ...
      throw redirect({
        to: '/setup'
      })
    }
  },
```

- `PromptlianoClientProvider` already tracks `connectionStatus` and polls health every 30 s, but nothing consumes it to block redirects or show UI:

```68:131:packages/client/src/context/promptliano-client-context.tsx
  const testConnection = useCallback(async (url: string): Promise<boolean> => {
    ...
  })
  ...
  const connectToServer = useCallback(
    async (url: string) => {
      ...
          healthCheckIntervalRef.current = setInterval(async () => {
            const healthy = await testConnection(url)
            if (!healthy && connectionStatusRef.current === 'connected') {
              setConnectionStatus('disconnected')
              setConnectionError('Lost connection to server')
              scheduleReconnect()
            }
            ...
          }, 30000)
```

- `AuthProvider` depends on router-populated React Query cache; when the guard errors, it marks `needsSetup` as `true`, which cascades into redirect loops:

```262:311:packages/client/src/contexts/auth-context.tsx
    const initAuth = async () => {
      try {
        const cachedAuthStatus = queryClient.getQueryData(['auth', 'full-status'])
        ...
      } catch (error) {
        ...
        setNeedsSetup(true)
      } finally {
        setIsLoading(false)
      }
    }
```

## Target Experience

- Display a persistent overlay (dismissable only when reconnected) that informs the user of server disconnects without changing routes.
- Poll the server health every 10–15 seconds; transition back to connected state automatically and remove the overlay.
- Redirect to `/setup` **only** when the server is reachable and explicitly confirms `needsSetup: true`.
- Redirect to `/login` only when the server is reachable, `needsSetup: false`, and the current session check confirms the user is unauthenticated.
- Preserve the current view whenever the server is unreachable (cached data can continue to show, but mutating actions should stay disabled).

## Status

- [x] Connection overlay renders during offline state
- [x] Health check interval reduced to 12 s with offline caching
- [x] Root & login guards tolerate network errors without redirects
- [x] Auth provider respects offline state and preserves session
- [ ] Tests pending (see follow-up section)

## Proposed Changes

### Connection Status UX

- Create a reusable `ServerConnectionOverlay` component that reads from `useServerConnection()` and renders a full-screen (or app-shell) overlay with retry CTA and diagnostic copy.
- Mount the overlay near the root layout (`RootComponent`) so it appears on every page except auth screens, respecting the existing `isAuthPage` guard.
- Ensure overlay reflects `connecting`, `disconnected`, and `error` states with distinct messaging; allow manual retry to call `reconnect()` from the hook.

### Server Health Polling

- Reduce the health-check interval in `PromptlianoClientProvider` from 30 s to a configurable 12 s (within the 10–15 s requirement) and debounce rapid transitions.
- Expose the connection state through React Query (e.g., `queryClient.setQueryData(['system','connection'], { status, lastChecked })`) so route loaders and other services can read it without React context.
- Add basic exponential backoff safeguards already present, but cap at 1–2 min total downtime before surfacing a persistent error message in the overlay.

### Routing Guard Logic

- Refactor the root route `beforeLoad` flow:
  1. Read cached connection status; if the last known state is offline, skip network calls and return `connection: 'offline'` to components.
  2. Attempt `authClient.getAuthStatus()` with a short timeout. On success, cache the normalized result and update `['system','connection']` to `connected`.
  3. If the call fails due to network/timeout, mark connection offline in React Query and **return** without redirecting; allow the overlay to inform the user.
  4. If the server responds with `needsSetup: true`, redirect to `/setup` (unless already there).
  5. If `needsSetup: false`, continue. Do not redirect to `/login` here—only cache the status and let the login route decide.
- Adjust the login route `beforeLoad` similarly: treat network failures as offline and halt redirects; only redirect to `/setup` or `/projects` when the server confirms those states.
- Ensure other routes relying on the root guard respect the new data signature (consider passing `connection` flag via loader data/context).

### Auth Provider Alignment

- Update `AuthProvider` initialization to respect the offline state: when connection is offline, avoid clearing local user data or forcing `needsSetup = true`; instead, show the overlay and wait for reconnection.
- When reconnecting, re-trigger `getCurrentUser()` only after the server status flips back to `connected` to prevent repeated failures.
- Provide a helper (e.g., `useIsServerConnected`) so components can disable actions gracefully during downtime.

### Query & State Coordination

- Define shared TypeScript types for the connection query payload to avoid stringly-typed lookups.
- Add a dedicated React Query observer (or TanStack Store) that synchronizes `PromptlianoClientProvider` state with router loaders, reducing duplicate network requests.
- Document the new query keys and data flow to prevent future regressions.

## Testing / Follow-Up

- [ ] Unit tests for connection utilities (connected → disconnected transitions).
- [ ] Integration tests for `RootComponent` overlay behavior.
- [ ] Router-level tests for offline guard handling.
- [ ] Playwright scenarios for offline/online transitions and setup/login flows.

## Risks & Mitigations

- **Risk:** Route loaders may still run before provider state initializes. *Mitigation:* hydrate connection status into React Query during provider mount before any navigation occurs.
- **Risk:** Overlay may interfere with modal focus traps. *Mitigation:* render overlay in a portal with `aria-hidden` to background when active.
- **Risk:** Shorter polling interval could increase load on local servers. *Mitigation:* keep interval configurable via environment or settings, default to 12 s.

## Open Questions

- Should the overlay offer manual server URL switching when offline, or rely on existing settings UI?
- Do we need to block mutations (e.g., disable buttons) automatically during downtime, or is the overlay sufficient?
- Should health polling pause while the app is backgrounded (use Page Visibility API) to reduce noise?
