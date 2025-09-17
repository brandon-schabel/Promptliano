import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { createMCPServer } from '../server'

type MCPContextOptions = {
  serverFactory?: () => Server
  clientInfo?: {
    name: string
    version: string
  }
  capabilities?: ClientCapabilities
}

export type InMemoryMCPContext = {
  server: Server
  client: Client
  close: () => Promise<void>
}

export async function createInMemoryMCPContext(options: MCPContextOptions = {}): Promise<InMemoryMCPContext> {
  const {
    serverFactory = createMCPServer,
    clientInfo = { name: 'Promptliano Test Harness', version: '1.0.0' },
    capabilities = {
      tools: {},
      resources: {}
    }
  } = options

  const server = serverFactory()

  const client = new Client(clientInfo, {
    capabilities
  })

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return {
    server,
    client,
    close: async () => {
      await client.close()
      await server.close()
    }
  }
}
