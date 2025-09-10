import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { parseCopilotEmbedConfig } from '../integrations/copilot-embed'

// Copilot internals
import { PATHS, ensurePaths } from '../../../copilot-api/src/lib/paths'
import { state as copilotState } from '../../../copilot-api/src/lib/state'
import { setupCopilotToken } from '../../../copilot-api/src/lib/token'
import { cacheModels } from '../../../copilot-api/src/lib/utils'
import { getDeviceCode, type DeviceCodeResponse } from '../../../copilot-api/src/services/github/get-device-code'
import { pollAccessToken } from '../../../copilot-api/src/services/github/poll-access-token'
import fs from 'node:fs/promises'
import { providerKeyService } from '@promptliano/services'

const booleanSchema = z.boolean()
const accountTypeSchema = z.enum(['individual', 'business', 'enterprise'])

const toggleRoute = createRoute({
  method: 'post',
  path: '/api/copilot/embed/toggle',
  operationId: 'postCopilotEmbedToggle',
  summary: 'Enable or disable embedded Copilot proxy',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ enabled: booleanSchema })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: 'Applied',
      content: { 'application/json': { schema: z.object({ success: z.literal(true), enabled: booleanSchema }) } }
    }
  }
})

const settingsRoute = createRoute({
  method: 'post',
  path: '/api/copilot/embed/settings',
  operationId: 'postCopilotEmbedSettings',
  summary: 'Update embedded Copilot runtime settings',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            accountType: accountTypeSchema.optional(),
            rateLimitSeconds: z.number().int().min(0).optional(),
            rateLimitWait: booleanSchema.optional(),
            manualApprove: booleanSchema.optional(),
            showTokens: booleanSchema.optional()
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: 'Applied',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            applied: z.object({
              accountType: accountTypeSchema,
              rateLimitSeconds: z.number().int().min(0).nullable(),
              rateLimitWait: booleanSchema,
              manualApprove: booleanSchema,
              showTokens: booleanSchema
            })
          })
        }
      }
    }
  }
})

const authStartRoute = createRoute({
  method: 'post',
  path: '/api/copilot/embed/auth/start',
  operationId: 'postCopilotEmbedAuthStart',
  summary: 'Start GitHub device authorization flow',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            userCode: z.string(),
            verificationUri: z.string(),
            expiresIn: z.number(),
            interval: z.number(),
            device: z
              .object({ device_code: z.string(), user_code: z.string(), verification_uri: z.string(), expires_in: z.number(), interval: z.number() })
              .optional()
          })
        }
      }
    }
  }
})

const authCompleteRoute = createRoute({
  method: 'post',
  path: '/api/copilot/embed/auth/complete',
  operationId: 'postCopilotEmbedAuthComplete',
  summary: 'Complete device authorization and initialize Copilot tokens',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            device: z.object({ device_code: z.string(), user_code: z.string(), verification_uri: z.string(), expires_in: z.number(), interval: z.number() })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: 'Authorized',
      content: { 'application/json': { schema: z.object({ success: z.literal(true), authorized: z.boolean() }) } }
    }
  }
})

const statusRoute = createRoute({
  method: 'get',
  path: '/api/copilot/embed/status',
  operationId: 'getCopilotEmbedStatus',
  summary: 'Get embedded Copilot status',
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            authorized: z.boolean(),
            accountType: accountTypeSchema,
            modelsCount: z.number().optional(),
            lastRefreshed: z.number().optional()
          })
        }
      }
    }
  }
})

export const copilotEmbedRoutes = new OpenAPIHono()
  .openapi(toggleRoute, async (c) => {
    const { enabled } = c.req.valid('json')
    process.env.COPILOT_EMBED_ENABLED = enabled ? 'true' : 'false'
    return c.json({ success: true as const, enabled })
  })
  .openapi(settingsRoute, async (c) => {
    const body = c.req.valid('json')
    const applied = {
      accountType: (body.accountType || copilotState.accountType) as 'individual' | 'business' | 'enterprise',
      rateLimitSeconds: body.rateLimitSeconds ?? copilotState.rateLimitSeconds ?? null,
      rateLimitWait: body.rateLimitWait ?? !!copilotState.rateLimitWait,
      manualApprove: body.manualApprove ?? !!copilotState.manualApprove,
      showTokens: body.showTokens ?? !!copilotState.showToken
    }

    copilotState.accountType = applied.accountType
    copilotState.rateLimitSeconds = applied.rateLimitSeconds ?? undefined
    copilotState.rateLimitWait = applied.rateLimitWait
    copilotState.manualApprove = applied.manualApprove
    copilotState.showToken = applied.showTokens

    return c.json({ success: true as const, applied })
  })
  .openapi(authStartRoute, async (c) => {
    // Make sure paths exist prior to auth flow
    await ensurePaths()
    const device = await getDeviceCode()
    return c.json({
      success: true as const,
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      interval: device.interval,
      device
    })
  })
  .openapi(authCompleteRoute, async (c) => {
    const { device } = c.req.valid('json') as { device: DeviceCodeResponse }

    // Poll until GitHub returns an access token (device flow)
    const githubToken = await pollAccessToken(device)

    // Persist token and initialize Copilot token refresh
    await ensurePaths()
    await fs.writeFile(PATHS.GITHUB_TOKEN_PATH, githubToken, { encoding: 'utf8' })
    try {
      await fs.chmod(PATHS.GITHUB_TOKEN_PATH, 0o600)
    } catch {}

    copilotState.githubToken = githubToken
    await setupCopilotToken()
    cacheModels().catch(() => {})

    // After successful auth, ensure a keyless Copilot provider entry exists for convenience
    try {
      const existing = await providerKeyService.getAll()
      const hasCopilot = existing.some((k) => String(k.provider).toLowerCase() === 'copilot')
      if (!hasCopilot) {
        await providerKeyService.create({
          provider: 'copilot',
          name: 'GitHub Copilot',
          keyName: 'GitHub Copilot (keyless)',
          isDefault: true,
          isActive: true,
          environment: 'production'
        })
      }
    } catch (e) {
      // Non-fatal
      console.warn('[CopilotEmbed] Failed to auto-create Copilot provider key:', e)
    }

    return c.json({ success: true as const, authorized: true })
  })
  .openapi(statusRoute, async (c) => {
    const cfg = parseCopilotEmbedConfig(process.env as Record<string, string>)
    const authorized = !!copilotState.githubToken && !!copilotState.copilotToken
    const modelsCount = copilotState.models?.data?.length
    const lastRefreshed = copilotState.models ? Date.now() : undefined
    return c.json({ success: true as const, authorized, accountType: cfg.accountType, modelsCount, lastRefreshed })
  })

export type CopilotEmbedRoutes = typeof copilotEmbedRoutes
