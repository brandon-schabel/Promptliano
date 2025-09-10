import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { getEmbeddedUpstreamBase } from '../integrations/copilot-embed'

// Simple reverse proxy for a Copilot OpenAI-compatible upstream (e.g., ericc-ch/copilot-api)
// - Exposes: /api/proxy/copilot/v1/* -> {UPSTREAM}/*
// - Injects Authorization header from env if missing
// - Streams responses transparently (SSE for chat completions)

export function getUpstreamBase(): string {
  // Prefer explicit proxy upstream env overrides
  const explicit = process.env.COPILOT_PROXY_UPSTREAM || process.env.COPILOT_UPSTREAM_URL
  if (explicit) return explicit.replace(/\/$/, '')

  // If embedded mode is explicitly enabled, route to internal upstream
  const embedFlag = process.env.COPILOT_EMBED_ENABLED
  const embedEnabled = String(embedFlag || '').toLowerCase() === 'true'
  if (embedEnabled) return getEmbeddedUpstreamBase()

  // Fallback to COPILOT_BASE_URL or sensible default (copilot-api default)
  const fallback = process.env.COPILOT_BASE_URL
  const def = 'http://127.0.0.1:4141/v1'
  return (fallback || def).replace(/\/$/, '')
}

// Default keyless fallback for Copilot proxy
// If COPILOT_API_KEY is not set, use a safe dummy token
const envApiKey = process.env.COPILOT_API_KEY || 'dummy'

function buildTargetUrl(c: Context): string {
  const url = new URL(c.req.url)
  // Map /api/proxy/copilot/v1/<rest> to {upstreamBase}/<rest>
  const prefix = '/api/proxy/copilot/v1'
  const restPath = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : ''
  const path = restPath.startsWith('/') ? restPath : `/${restPath}`
  const finalUrl = `${getUpstreamBase()}${path}${url.search}`
  return finalUrl
}

function buildProxyHeaders(c: Context): Headers {
  const incoming = c.req.raw.headers
  const headers = new Headers(incoming)
  // Remove hop-by-hop or problematic headers
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('accept-encoding') // let Bun/node handle

  // Ensure Authorization present (OpenAI-compatible proxies usually require it, can be any non-empty string)
  if (!headers.has('authorization') && envApiKey) {
    headers.set('authorization', `Bearer ${envApiKey}`)
  }

  return headers
}

async function proxyRequest(c: Context) {
  const targetUrl = buildTargetUrl(c)
  const method = c.req.method

  // Pass through body when applicable; Hono exposes native Request
  const body = method === 'GET' || method === 'HEAD' ? undefined : c.req.raw.body
  const headers = buildProxyHeaders(c)

  const upstreamRes = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: 'manual'
  })

  // Copy headers; adjust as needed
  const outHeaders = new Headers(upstreamRes.headers)
  // Avoid mismatched length when streaming
  outHeaders.delete('content-length')

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: outHeaders
  })
}

// Health endpoint (non-proxied) to verify config quickly
const healthRoute = createRoute({
  method: 'get',
  path: '/api/proxy/copilot/_health',
  operationId: 'getCopilotProxyHealth',
  summary: 'Copilot proxy health',
  description:
    'Returns basic health and configuration info and attempts a lightweight GET to the upstream /models endpoint.',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.boolean(),
              upstream: z.string(),
              checked: z.boolean().optional(),
              status: z.number().optional(),
              error: z.string().optional()
            })
            .openapi('CopilotProxyHealth')
        }
      }
    }
  }
})

export const copilotProxyRoutes = new OpenAPIHono()
  .openapi(healthRoute, async (c) => {
    try {
      // Probe upstream /models to validate reachability
      const res = await fetch(`${getUpstreamBase()}/models`, {
        method: 'GET',
        headers: buildProxyHeaders(c)
      })
      return c.json({ success: true, upstream: getUpstreamBase(), checked: true, status: res.status })
    } catch (e: any) {
      return c.json({ success: true, upstream: getUpstreamBase(), checked: false, error: String(e?.message || e) })
    }
  })

// Explicit model list passthrough for documentation clarity
copilotProxyRoutes.get('/api/proxy/copilot/v1/models', async (c) => {
  return proxyRequest(c)
})

// Generic passthrough for OpenAI-compatible routes (chat/completions, embeddings, etc.)
copilotProxyRoutes.all('/api/proxy/copilot/v1/*', async (c) => {
  return proxyRequest(c)
})

export type CopilotProxyRouteTypes = typeof copilotProxyRoutes
