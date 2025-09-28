import { tool } from 'ai'
import { z } from 'zod'

const echoInputSchema = z
  .object({})
  .catchall(z.any())
  .describe('Arbitrary key/value pairs to echo back to the caller.')

export const echoTool = tool({
  description: 'Echo the provided arguments back to the caller for diagnostics.',
  inputSchema: echoInputSchema,
  execute: async (args) => args ?? {}
})

