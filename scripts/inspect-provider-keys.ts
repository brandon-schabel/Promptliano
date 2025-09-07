#!/usr/bin/env bun

// Quick inspector for provider keys in the local database
import { createProviderKeyService } from '../packages/services/src/provider-key-service'

async function main() {
  const svc = createProviderKeyService()
  const keys = await svc.listKeysUncensored()
  console.log('\nProvider Keys (uncensored):')
  for (const k of keys) {
    console.log({
      id: k.id,
      provider: k.provider,
      keyPresent: typeof (k as any).key === 'string' && (k as any).key.length > 0,
      secretRef: (k as any).secretRef || null,
      isDefault: k.isDefault,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt
    })
  }
}

main().catch((err) => {
  console.error('Error inspecting provider keys:', err)
  process.exit(1)
})
