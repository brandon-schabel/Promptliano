import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { successResponse, createStandardResponses } from '../utils/route-helpers'
import { encryptionKeyRepository } from '@promptliano/database'
import { providerKeyService } from '@promptliano/services'
import { ErrorFactory } from '@promptliano/shared'

const EncryptionKeyStatusSchema = z
  .object({
    hasKey: z.boolean().describe('True if a custom key is configured'),
    isDefault: z.boolean().describe('True if using the default (insecure) key')
  })
  .openapi('EncryptionKeyStatus')

const GetEncryptionKeyStatusRoute = createRoute({
  method: 'get',
  path: '/api/security/encryption-key/status',
  tags: ['Security'],
  summary: 'Get encryption key status (no secrets)',
  responses: createStandardResponses(
    z.object({ success: z.literal(true), data: EncryptionKeyStatusSchema })
  )
})

const SetEncryptionKeyBodySchema = z
  .object({
    key: z.string().min(1).optional(),
    generate: z.boolean().optional()
  })
  .refine((v) => !!v.key || !!v.generate, {
    message: 'Either key or generate must be provided'
  })
  .openapi('SetEncryptionKeyBody')

const SetEncryptionKeyRoute = createRoute({
  method: 'post',
  path: '/api/security/encryption-key',
  tags: ['Security'],
  summary: 'Set or generate a custom encryption key',
  request: { body: { content: { 'application/json': { schema: SetEncryptionKeyBodySchema } }, required: true } },
  responses: createStandardResponses(
    z.object({
      success: z.literal(true),
      data: z.object({ isDefault: z.boolean() })
    })
  )
})

const UseDefaultEncryptionKeyRoute = createRoute({
  method: 'post',
  path: '/api/security/encryption-key/use-default',
  tags: ['Security'],
  summary: 'Switch to default (insecure) encryption key',
  responses: createStandardResponses(
    z.object({ success: z.literal(true), data: z.object({ isDefault: z.literal(true) }) })
  )
})

export const securityRoutes = new OpenAPIHono()
  .openapi(GetEncryptionKeyStatusRoute, async (c) => {
    // Touch getKey to ensure fallback default is persisted for stability
    await encryptionKeyRepository.getKey()
    const status = { hasKey: await encryptionKeyRepository.hasKey(), isDefault: await encryptionKeyRepository.isDefault() }
    return c.json(successResponse(status))
  })
  .openapi(SetEncryptionKeyRoute, async (c) => {
    const body = c.req.valid('json') as z.infer<typeof SetEncryptionKeyBodySchema>

    try {
      if (body.generate) {
        const random = crypto.getRandomValues(new Uint8Array(32))
        const key = Buffer.from(random).toString('base64')
        await encryptionKeyRepository.setKey(key)
      } else if (body.key) {
        await encryptionKeyRepository.setKey(body.key)
      }

      return c.json(successResponse({ isDefault: false }))
    } catch (err: any) {
      throw ErrorFactory.operationFailed('set encryption key', err?.message)
    }
  })
  .openapi(UseDefaultEncryptionKeyRoute, async (c) => {
    try {
      await encryptionKeyRepository.useDefault()
      return c.json(successResponse({ isDefault: true }))
    } catch (err: any) {
      throw ErrorFactory.operationFailed('use default encryption key', err?.message)
    }
  })
  // Rotate encryption key and optionally re-encrypt existing provider keys
  .openapi(
    createRoute({
      method: 'post',
      path: '/api/security/encryption-key/rotate',
      tags: ['Security'],
      summary: 'Rotate encryption key and re-encrypt provider keys',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z
                .object({
                  newKey: z.string().min(1).optional(),
                  generate: z.boolean().optional(),
                  reencryptExisting: z.boolean().optional().default(true)
                })
                .refine((v) => !!v.newKey || !!v.generate, {
                  message: 'Either newKey or generate must be provided'
                })
                .openapi('RotateEncryptionKeyBody')
            }
          },
          required: true
        }
      },
      responses: createStandardResponses(
        z.object({
          success: z.literal(true),
          data: z.object({
            isDefault: z.literal(false),
            reencrypted: z.number(),
            skipped: z.number(),
            failed: z.number()
          })
        })
      )
    }),
    async (c) => {
      const body = c.req.valid('json') as { newKey?: string; generate?: boolean; reencryptExisting?: boolean }

      // Gather decrypted keys BEFORE changing the encryption key
      const reencrypt = body.reencryptExisting !== false
      const existingKeys = reencrypt ? await providerKeyService.listKeysUncensored() : []

      try {
        // Compute new key value
        let keyToSet = body.newKey
        if (!keyToSet && body.generate) {
          const random = crypto.getRandomValues(new Uint8Array(32))
          keyToSet = Buffer.from(random).toString('base64')
        }

        if (!keyToSet) {
          throw new Error('No new key provided or generated')
        }

        // Set new encryption key (affects subsequent encryptKey calls)
        await encryptionKeyRepository.setKey(keyToSet)

        let reencrypted = 0
        let skipped = 0
        let failed = 0

        if (reencrypt) {
          for (const k of existingKeys) {
            const plaintext = typeof k.key === 'string' && k.key.length > 0 ? k.key : null
            if (!plaintext) {
              skipped++
              continue
            }
            try {
              await providerKeyService.update(k.id, { key: plaintext })
              reencrypted++
            } catch (err) {
              failed++
            }
          }
        }

        return c.json(
          successResponse({ isDefault: false, reencrypted, skipped, failed })
        )
      } catch (err: any) {
        throw ErrorFactory.operationFailed('rotate encryption key', err?.message)
      }
    }
  )

export type SecurityRoutes = typeof securityRoutes
