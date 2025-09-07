#!/usr/bin/env bun

// Quick script to exercise the OpenAPI generator and print helpful diagnostics
// without starting the HTTP server.

import { app } from '../packages/server/src/app'

async function run() {
  try {
    const res = await app.fetch(new Request('http://localhost/doc'))
    const text = await res.text()
    console.log('Status:', res.status)
    console.log(text.slice(0, 5000))
  } catch (err) {
    console.error('OpenAPI generation failed with error:')
    console.error(err)
    // Try to stringify structured errors if present
    try {
      // Some libraries attach rich data to the error object
      const anyErr = err as any
      if (anyErr?.data) {
        console.error('Error data:', JSON.stringify(anyErr.data, null, 2))
      }
    } catch {}
    process.exit(1)
  }
}

run()
