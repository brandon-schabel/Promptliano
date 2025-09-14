# GitHub Copilot Integration (via OpenAI‑compatible proxy)

This guide explains how to use GitHub Copilot as a provider in Promptliano using an OpenAI‑compatible proxy (recommended). It keeps setup simple and works seamlessly with our existing OpenAI integration paths, model listing, and streaming.

## Overview

- Promptliano talks to Copilot through an OpenAI‑compatible HTTP API exposed by a local proxy (e.g., `copilot-api`).
- You configure two env vars and optionally add a provider key in the UI.
- Once configured, Copilot appears as a provider; models are fetched from the proxy and are selectable in chat.

> Note: This approach relies on a community proxy and is not an official GitHub API. It may break if upstream changes. Use responsibly and test thoroughly.

## Prerequisites

- A working Promptliano install (dev or packaged).
- Node.js/Bun environment for running the proxy (or Docker).
- An active GitHub Copilot subscription on your GitHub account.

## Step 1 — Start the Copilot proxy

Option A — npx

```
npx copilot-api@latest start --port 4141 --rate-limit 30
```

Option B — Docker (refer to the `copilot-api` README for details):

```
docker run -p 4141:4141 \
  -v $(pwd)/copilot-data:/root/.local/share/copilot-api \
  ghcr.io/ericc-ch/copilot-api:latest
```

Flags worth knowing:

- `--rate-limit 30` helps avoid GitHub abuse detection.
- `--manual` requires manual approval for sensitive operations (if supported by the proxy version).
- `--account-type` lets you specify organization/business accounts, if needed.

The proxy exposes OpenAI‑compatible endpoints such as `/v1/models` and `/v1/chat/completions`.

### Built-in reverse proxy (optional)

If you prefer to hide the upstream and route through Promptliano, you can enable the built‑in reverse proxy:

1. Start the upstream as above (e.g., `http://127.0.0.1:4141/v1`).
2. Set the following env vars and restart the server:

```
COPILOT_PROXY_UPSTREAM=http://127.0.0.1:4141/v1
COPILOT_BASE_URL=http://127.0.0.1:3147/api/proxy/copilot/v1
COPILOT_API_KEY=dummy
```

This makes Promptliano expose `/api/proxy/copilot/v1/*`, forwarding to your upstream and injecting `Authorization` when missing. It’s useful for centralizing CORS/secrets and avoids clients needing to know the upstream URL.

## Step 2 — Configure Promptliano env

Add the following to your `.env` (or export in your environment) and restart the server. Use either direct or built‑in proxy mode.

Direct mode:

```
COPILOT_BASE_URL=http://127.0.0.1:4141/v1
COPILOT_API_KEY=dummy
```

Built‑in proxy mode:

```
COPILOT_PROXY_UPSTREAM=http://127.0.0.1:4141/v1
COPILOT_BASE_URL=http://127.0.0.1:3147/api/proxy/copilot/v1
COPILOT_API_KEY=dummy
```

Notes:

- In direct mode, the base URL must include `/v1`.
- Most proxies accept any bearer token; `dummy` is typically sufficient.

See `.env.example` for commented entries and additional context.

## Step 3 — Add the provider key in the UI (optional)

You can rely entirely on env vars, or store a key reference in the database for convenience.

1. Open the Promptliano UI → Providers.
2. Click “Add Provider”.
3. Provider: “GitHub Copilot”.
4. Storage Method:
   - Direct API Key: set `key` to `dummy` (or any non‑empty string).
   - Environment Variable: set `secretRef` to `COPILOT_API_KEY`.
5. Save and mark as default if desired.

This step is optional when `COPILOT_API_KEY` is present — the server can use env fallbacks.

## Step 4 — Test the connection

From the Providers page:

- Use “Test connection” on your Copilot entry. Promptliano will call `${COPILOT_BASE_URL}/models` and list available models. Errors will show helpful details.

If you’re scripting against the API, you can also use:

- `POST /api/providers/test` with the provider key ID.
- `GET /api/providers/_debug-config` to verify which keys/envs were resolved (secrets are redacted in the response).

## Step 5 — Use in chat

In Chat:

- Select provider “GitHub Copilot”.
- Pick a model from the dropdown (populated from the proxy’s `/v1/models`).
- Send messages as usual; streaming and basic options (temperature, max tokens, etc.) are supported.

## Troubleshooting

- “No models found”
  - Ensure the proxy is running and reachable at `http://127.0.0.1:4141/v1`.
  - Confirm `COPILOT_BASE_URL` includes `/v1`.
  - Check the proxy logs for authentication/device flow prompts.
  - Use `/api/providers/_debug-config` to confirm env/key resolution.

- “401/403 errors”
  - Complete any device‑flow login the proxy requires.
  - Restart the proxy if tokens expired or were cleared.

- “Connection refused/timeout”
  - Verify the port, local firewall, and that you used `127.0.0.1` vs `localhost` where relevant.
  - If using Docker, ensure port mapping is correct and the container is healthy.

## Best practices

- Rate limit the proxy (`--rate-limit 30`) to avoid GitHub abuse detection.
- Avoid heavy automation that could violate GitHub terms.
- Prefer env vars (`COPILOT_API_KEY`, `COPILOT_BASE_URL`) over storing secrets directly; never commit secrets.
- Keep a fallback provider configured (e.g., OpenAI/OpenRouter) in case the proxy is unavailable.

## How it works under the hood

- Promptliano reads `COPILOT_BASE_URL` from env for the Copilot provider and uses an OpenAI‑compatible client under the hood.
- Model listing and provider tests call `${COPILOT_BASE_URL}/models` with `Authorization: Bearer <COPILOT_API_KEY>`.
- Chat uses the same base URL and authentication, so your proxy must expose `/v1/chat/completions`.

## Alternatives (optional)

- VS Code LM Proxy extension: exposes local OpenAI/Anthropic compatible endpoints from VS Code.
- Language Server SDK: GitHub’s Copilot Language Server exists for editor integration via LSP. It’s a different integration path (not REST) and not used by Promptliano’s HTTP provider stack.

These are viable for experimentation, but the OpenAI‑compatible proxy is the most straightforward path for Promptliano’s architecture.
