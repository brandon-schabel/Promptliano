# GitHub Copilot Integration (Built‑in Reverse Proxy + Embedded Mode UI)

This document is the definitive guide to integrating GitHub Copilot into Promptliano. It covers three modes (Direct, External Proxy, Embedded), the server architecture, and the complete UI plan to make Copilot setup a first‑class experience on the Providers page, including a vertical split layout and persistent selected section.

— If you only want a quick start, jump to “Quick Start” and “UI: Copilot Panel”.

## Overview

- Copilot is accessed via an OpenAI‑compatible REST API. We rely on a proxy (e.g., `ericc-ch/copilot-api`) to surface `/v1/models` and `/v1/chat/completions`.
- Promptliano supports three modes:
  - Direct: talk directly to the upstream proxy.
  - External via built‑in reverse proxy: hide the upstream behind `/api/proxy/copilot/v1`.
  - Embedded (single process): run `copilot-api` inside Promptliano and keep clients on `/api/proxy/copilot/v1`.
- The built‑in reverse proxy centralizes CORS/secrets, injects Authorization when missing, and streams responses transparently.

## Quick Start

Choose one of the following:

1. Direct mode

```
COPILOT_BASE_URL=http://127.0.0.1:4141/v1
COPILOT_API_KEY=dummy
```

2. External proxy via built‑in reverse proxy

```
COPILOT_PROXY_UPSTREAM=http://127.0.0.1:4141/v1
COPILOT_BASE_URL=http://127.0.0.1:${SERVER_PORT}/api/proxy/copilot/v1
COPILOT_API_KEY=dummy
```

3. Embedded mode (single process; see “Embedded Mode” for full details)

```
COPILOT_EMBED_ENABLED=true
COPILOT_API_KEY=dummy
# Optional runtime tuning
COPILOT_ACCOUNT_TYPE=individual            # or business | enterprise
COPILOT_RATE_LIMIT_SECONDS=30
COPILOT_RATE_LIMIT_WAIT=false
COPILOT_MANUAL_APPROVE=false
COPILOT_SHOW_TOKENS=false
```

Verify:

- Health: `GET /api/proxy/copilot/_health`
- Models (proxy): `GET /api/proxy/copilot/v1/models`
- UI: Providers → “GitHub Copilot” → Test connection

Notes

- `${SERVER_PORT}` defaults to `3147`.
- Most Copilot proxies accept any non‑empty bearer token; `dummy` usually suffices.

## Architecture

- Reverse proxy (server):
  - Path: `/api/proxy/copilot/v1/*`
  - Forwards to `${COPILOT_PROXY_UPSTREAM}/*` (or autodetected upstream)
  - Injects `Authorization: Bearer ${COPILOT_API_KEY}` when missing
  - Streams responses transparently
- Provider base URL (client/services):
  - Computed in `packages/config/src/configs/providers.config.ts`. If `COPILOT_PROXY_UPSTREAM` is set and no explicit `COPILOT_BASE_URL`, we default to the built‑in proxy URL.

### Modes

1. Direct

Client → `${COPILOT_BASE_URL}/chat/completions` → Upstream

2. External via built‑in reverse proxy

Client → `/api/proxy/copilot/v1/chat/completions` → Upstream `/v1/chat/completions`

3. Embedded (single process)

Client → `/api/proxy/copilot/v1/chat/completions` → Internal mount `/api/upstream/copilot/v1/chat/completions`

## Embedded Mode (Single Process)

Embedded mode runs `copilot-api` inside Promptliano so no extra server process is needed. Clients keep using `/api/proxy/copilot/v1`.

Settings (env vars):

- `COPILOT_EMBED_ENABLED=true|false` (default false)
- `COPILOT_ACCOUNT_TYPE=individual|business|enterprise` (default individual)
- `COPILOT_RATE_LIMIT_SECONDS` (optional)
- `COPILOT_RATE_LIMIT_WAIT=true|false` (optional)
- `COPILOT_MANUAL_APPROVE=true|false` (optional)
- `COPILOT_SHOW_TOKENS=true|false` (default false; for debugging only)

Server implementation (summary):

- Mount copilot‑api’s Hono router under `/api/upstream/copilot` after initializing tokens and models.
- Keep the reverse proxy at `/api/proxy/copilot/v1/*` and resolve upstream to the internal mount when embed enabled.
- Add minimal endpoints to control and observe embedded mode:
  - `POST /api/copilot/embed/toggle` → `{ enabled }`
  - `POST /api/copilot/embed/settings` → `{ accountType, rateLimitSeconds, wait, manualApprove, showTokens }`
  - `POST /api/copilot/embed/auth/start` → `{ userCode, verificationUri, expiresIn, interval }`
  - `POST /api/copilot/embed/auth/complete` → `{ authorized: boolean }`
  - `GET  /api/copilot/embed/status` → `{ authorized, accountType, lastRefreshed?, modelsCount? }`

Security:

- Do not log tokens unless `COPILOT_SHOW_TOKENS=true`.
- Reuse server’s rate limits; keep upstream proxy’s own throttling reasonable to avoid GitHub abuse detection.

## UI: Providers Page (Vertical Split + Copilot Panel)

We will refactor the Providers page to a vertical split layout with a persistent selected section, and add a dedicated Copilot panel.

Layout and files (client):

- Convert `packages/client/src/routes/providers.tsx` to a two‑pane layout (left sidebar + right content), matching project tab patterns.
- New components:
  - `src/components/providers/providers-sidebar-nav.tsx` (modeled after `projects/manage-sidebar-nav.tsx`)
  - `src/components/providers/providers-tab-with-sidebar.tsx` (modeled after `projects/manage-tab-with-sidebar.tsx`)
  - `src/components/providers/copilot-embed-panel.tsx` (the main Copilot UI)

Sidebar sections:

- Overview
- API Providers
- Local Providers
- Presets
- Copilot (new)
- Health

Persist selected section:

- Add a KV key or local storage value to remember the selected section. Recommended KV addition:
  - `KVKeyEnum.providersActiveSection = 'providersActiveSection'`
  - Schema: `z.enum(['overview','api','local','presets','copilot','health']).default('overview')`
  - Use `useGetKvValue`/`useSetKvValue` to persist across sessions.

Copilot panel (UX):

- Settings form with validation:
  - Embedded mode toggle → `POST /api/copilot/embed/toggle`
  - Account type dropdown → `POST /api/copilot/embed/settings`
  - Rate limit seconds (number) → `POST /api/copilot/embed/settings`
  - Wait on limit (boolean) → `POST /api/copilot/embed/settings`
  - Manual approval (boolean) → `POST /api/copilot/embed/settings`
  - Show tokens (boolean; dangerous) → `POST /api/copilot/embed/settings`
- Auth controls:
  - Start Login → `POST /api/copilot/embed/auth/start`
    - Show `userCode` + `verificationUri` (copy buttons)
  - I’ve Completed Verification → `POST /api/copilot/embed/auth/complete`
- Diagnostics:
  - Health: `GET /api/proxy/copilot/_health` (status, upstream, errors)
  - Test connection: use Providers “Test” or call `GET /api/proxy/copilot/v1/models`
  - Models list: `GET /api/models?provider=copilot`
  - Provider debug: `GET /api/providers/_debug-config` (redacted)
- UX details:
  - Disable inputs during pending requests; surface actionable toasts
  - Show warnings for “Show tokens in logs”
  - Provide inline help and links to this doc and `docs/github-copilot.md`

## Testing

Client unit tests (pure functions):

- Form parsing/validation (account type enum, non‑negative rate limit)
- Delta patch builder for settings (only send changed fields)
- Health mapper (payload → status text and color)

Client integration tests:

- Sidebar persists selected section after reload
- Copilot panel posts correct payloads and handles responses
- Health and Test Connection surfaces correct UI states

Server unit tests:

- Upstream resolution precedence for proxy: `COPILOT_PROXY_UPSTREAM` → `COPILOT_UPSTREAM_URL` → embedded internal → `COPILOT_BASE_URL` → default
- Provider base URL computation in embedded mode (when `COPILOT_BASE_URL` not set)

Server integration tests:

- Proxy `/api/proxy/copilot/v1/*` forwards to internal mount when embed enabled; injects Authorization when missing; preserves query; streams
- Health endpoint returns expected shape in embedded mode

E2E (Playwright):

- Navigate: Sidebar → Providers → Copilot → reload → remains on Copilot
- Start Login shows code/URL (mock), copy buttons present
- Test Connection displays models (mock or dev server)

## Security & Best Practices

- Prefer env vars over storing secrets; never commit real tokens.
- Leave `COPILOT_SHOW_TOKENS=false` unless actively debugging.
- Use reasonable rate limits to avoid GitHub abuse detection.
- Keep a fallback provider (e.g., OpenRouter) configured.

## Troubleshooting

- “No models found”
  - Check proxy health at `/api/proxy/copilot/_health`
  - Ensure `/v1/models` responds via proxy
  - Complete device authorization if prompted
- “401/403 errors”
  - Finish device‑flow login and retry
  - If tokens expired, restart embedded proxy (or refresh tokens via settings)
- “Connection refused/timeout”
  - Verify port and upstream URL
  - If using Docker/external proxy, confirm port mapping

## Current Status in Repo (Reference)

- Reverse proxy route: `packages/server/src/routes/copilot-proxy-routes.ts`
- App wiring: `packages/server/src/app.ts` (routes registered)
- Provider URL resolution: `packages/config/src/configs/providers.config.ts`
- Model listing + chat wiring: `packages/services/src/model-providers/model-fetcher-service.ts`, `packages/services/src/gen-ai-services.ts`
- UI entry for Copilot: `packages/client/src/constants/providers-constants.ts`
- Docs: `docs/github-copilot.md` (general), this file (embedded + UI)

## Appendix: Example .env

Direct:

```
COPILOT_BASE_URL=http://127.0.0.1:4141/v1
COPILOT_API_KEY=dummy
```

External via built‑in reverse proxy:

```
COPILOT_PROXY_UPSTREAM=http://127.0.0.1:4141/v1
COPILOT_BASE_URL=http://127.0.0.1:${SERVER_PORT}/api/proxy/copilot/v1
COPILOT_API_KEY=dummy
```

Embedded:

```
COPILOT_EMBED_ENABLED=true
COPILOT_API_KEY=dummy
COPILOT_ACCOUNT_TYPE=individual
COPILOT_RATE_LIMIT_SECONDS=30
COPILOT_RATE_LIMIT_WAIT=false
COPILOT_MANUAL_APPROVE=false
COPILOT_SHOW_TOKENS=false
```
