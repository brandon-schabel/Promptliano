# GitHub Copilot Integration via Built‑in Reverse Proxy

This document explains how Promptliano integrates with GitHub Copilot using an OpenAI‑compatible HTTP API and how to enable the built‑in reverse proxy for a simple, secure setup.

## Overview

- Copilot is accessed via an OpenAI‑compatible REST API exposed by an upstream proxy (e.g., `ericc-ch/copilot-api`).
- Promptliano can talk to that upstream directly or via a built‑in reverse proxy at `/api/proxy/copilot/v1`.
- The proxy centralizes CORS and secret handling and keeps client configuration simple.

## Architecture

- Upstream (required): an OpenAI‑compatible HTTP service providing endpoints like `/v1/models` and `/v1/chat/completions`.
- Promptliano reverse proxy (optional):
  - Public path: `/api/proxy/copilot/v1/*`
  - Forwards to: `${COPILOT_PROXY_UPSTREAM}/*`
  - Injects `Authorization: Bearer ${COPILOT_API_KEY}` if missing
  - Streams responses transparently

### Request flow (proxy mode)

Client → Promptliano `/api/proxy/copilot/v1/chat/completions` → Upstream `/v1/chat/completions` → Promptliano → Client

## Enablement

You can choose direct mode or proxy mode. Proxy mode is recommended for consolidating configuration.

### 1) Start the upstream

Option A — npx

```
npx copilot-api@latest start --port 4141 --rate-limit 30
```

Option B — Docker

```
docker run -p 4141:4141 \
  -v $(pwd)/copilot-data:/root/.local/share/copilot-api \
  ghcr.io/ericc-ch/copilot-api:latest
```

### 2) Configure Promptliano

Direct mode:

```
COPILOT_BASE_URL=http://127.0.0.1:4141/v1
COPILOT_API_KEY=dummy
```

Built‑in reverse proxy mode:

```
COPILOT_PROXY_UPSTREAM=http://127.0.0.1:4141/v1
COPILOT_BASE_URL=http://127.0.0.1:${SERVER_PORT}/api/proxy/copilot/v1
COPILOT_API_KEY=dummy
```

Notes
- `${SERVER_PORT}` defaults to `3147`.
- Most Copilot proxies accept any non‑empty bearer token; `dummy` usually suffices.
- If `COPILOT_PROXY_UPSTREAM` is set and `COPILOT_BASE_URL` is not set, Promptliano auto‑defaults to the built‑in proxy URL.

### 3) Restart Promptliano

Restart the server after updating environment variables.

### 4) Verify

- Health check: `GET /api/proxy/copilot/_health`
- Model list (proxy): `GET /api/proxy/copilot/v1/models`
- Providers page → “Test connection” on your GitHub Copilot key

## Using Copilot in Chat

- In the Chat view, select provider “GitHub Copilot”.
- Choose a model (populated from `/v1/models`).
- Send messages; streaming works as with other OpenAI‑compatible providers.

## Security & Best Practices

- Avoid committing secrets; prefer env vars or Docker secrets. Use `COPILOT_API_KEY` for proxy auth.
- Rate‑limit upstream (`--rate-limit 30`) to reduce the risk of GitHub abuse detection.
- Keep another provider (e.g., OpenRouter) configured as fallback.

## Troubleshooting

- 401/403: Complete any device‑flow auth required by the upstream proxy and restart it.
- Connection refused: Verify upstream is running and URLs use `127.0.0.1` if needed. Check Docker port mapping.
- No models found: Confirm `/v1/models` is reachable; in proxy mode test `/api/proxy/copilot/v1/models`.

## Implementation Notes

- Reverse proxy is implemented in `packages/server/src/routes/copilot-proxy-routes.ts`.
- Provider base URL is sourced from `packages/config` and respects `COPILOT_BASE_URL`. If `COPILOT_PROXY_UPSTREAM` is set and `COPILOT_BASE_URL` is not set, it defaults to the built‑in proxy URL.

