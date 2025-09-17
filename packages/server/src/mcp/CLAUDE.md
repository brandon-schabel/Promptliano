# MCP (Model Context Protocol) Implementation Guide

This guide covers the MCP implementation in Promptliano, providing patterns and best practices for creating and organizing MCP tools.

## Architecture Overview

The MCP implementation follows a modular, consolidated architecture:

> Developer docs related to MCP live under `dev-docs/` (e.g., evaluations, tool audits). End-user setup stays in `docs/`.

```
packages/server/src/mcp/
├── server.ts                    # Main MCP server factory (stdio transport)
├── resources/                  # Resource catalogue + read handlers
├── tools/                      # MCP tool implementations
│   ├── index.ts                # Static tool registry
│   ├── shared/                 # Shared utilities and types
│   ├── project/                # Project management tools
│   ├── workflow/               # Queue and ticket tools
│   ├── content/                # AI/content helpers
│   └── git/                    # Git integration tools
├── tools-registry.ts           # Tool type definitions
├── mcp-errors.ts               # Lightweight error helpers
├── mcp-transaction.ts          # Transaction wrapper for complex operations
├── hook-manager-tool.ts        # Hook management tool (legacy shim)
└── test-utils/                 # In-memory client/server harness
```

## Core Concepts

### 1. Transport Layer

Promptliano now standardises on the SDK stdio transport. `createMCPServer()` produces a server instance that tests and the CLI connect to via `StdioServerTransport` (or the in-memory transport during tests). If browser access is needed in the future, add an SDK-provided SSE transport rather than reintroducing custom HTTP plumbing.

### 2. Tool Registration

Tools are registered through a consolidated system:

```typescript
// tools/index.ts
import { projectManagerTool } from './project'
import { flowManagerTool } from './workflow'
import { aiAssistantTool } from './content'
import { gitManagerTool } from './git'

export const CONSOLIDATED_TOOLS = Object.freeze([
  projectManagerTool,
  flowManagerTool,
  aiAssistantTool,
  gitManagerTool
])

export function getConsolidatedToolByName(name: string) {
  return CONSOLIDATED_TOOLS.find((tool) => tool.name === name)
}
```

### 3. Error Handling System

Enhanced error handling with structured details:

```typescript
export enum MCPErrorCode {
  MISSING_REQUIRED_PARAM = 'MISSING_REQUIRED_PARAM',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  SERVICE_ERROR = 'SERVICE_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  UNKNOWN_ACTION = 'UNKNOWN_ACTION'
}

export class MCPError extends Error {
  constructor(
    readonly code: MCPErrorCode,
    message: string,
    readonly options: { suggestion?: string; context?: Record<string, unknown> } = {}
  ) {
    super(message)
    this.name = 'MCPError'
  }
}
```

## Creating New MCP Tools

### 1. Tool Structure

Every MCP tool follows this pattern:

```typescript
// tools/category/my-tool.tool.ts
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import { createTrackedHandler, validateRequiredParam, validateDataField } from '../shared'

export const myTool: MCPToolDefinition = {
  name: 'my_tool',
  description: 'Tool description with available actions and examples',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(MyToolAction)
      },
      projectId: {
        type: 'number',
        description: 'Project ID (required for most actions)'
      },
      data: {
        type: 'object',
        description: 'Action-specific data with examples'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler('my_tool', async (args) => {
    // Implementation
  })
}
```

### 2. Action Enums and Schemas

Define actions in `tools/shared/types.ts`:

```typescript
export enum MyToolAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

export const MyToolSchema = z.object({
  action: z.nativeEnum(MyToolAction),
  projectId: z.number().optional(),
  data: z.any().optional()
})
```

### 3. Handler Implementation

Use the tracked handler pattern with proper error handling:

```typescript
handler: createTrackedHandler('my_tool', async (args): Promise<MCPToolResponse> => {
  try {
    const { action, projectId, data } = args

    switch (action) {
      case MyToolAction.LIST: {
        // Validate required parameters
        const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')

        // Call service layer
        const items = await listMyItems(validProjectId)

        return {
          content: [
            {
              type: 'text',
              text: formatItemsList(items)
            }
          ]
        }
      }

      case MyToolAction.CREATE: {
        // Validate data fields
        const name = validateDataField<string>(data, 'name', 'string', '"My Item"')

        const item = await createMyItem(projectId, { name, ...data })

        return {
          content: [
            {
              type: 'text',
              text: `Item created: ${item.name} (ID: ${item.id})`
            }
          ]
        }
      }

      default:
        throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, { tool: 'my_tool', action })
    }
  } catch (error) {
    if (error instanceof MCPError) {
      return formatMCPErrorResponse(error)
    }

    const mcpError = MCPError.fromError(error, {
      tool: 'my_tool',
      action: args.action
    })
    return formatMCPErrorResponse(mcpError)
  }
})
```

### 4. Tool Registration

Add your tool to the appropriate category index:

```typescript
// tools/category/index.ts
export { myTool } from './my-tool.tool'

// tools/index.ts - add to CONSOLIDATED_TOOLS array
import { myTool } from './category'

export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  // ... existing tools
  myTool
] as const
```

## Shared Utilities

### Validation Helpers

```typescript
// Validate required parameters
validateRequiredParam(value, 'paramName', 'type', 'example')

// Validate data object fields
validateDataField(data, 'fieldName', 'type', 'example')
```

### Tracking Wrapper

```typescript
// Automatically tracks tool execution with telemetry
createTrackedHandler(toolName, handlerFunction)
```

### Error Handling

```typescript
// Create specific MCP errors
createMCPError(MCPErrorCode.INVALID_PARAMS, 'Message', context)

// Convert unknown errors to MCP errors
MCPError.fromError(error, context)

// Format errors for tool responses
formatMCPErrorResponse(mcpError)
```

## Transaction Support

For complex multi-step operations, use the transaction system:

```typescript
import { executeTransaction, createTransactionStep } from '../mcp-transaction'

// Define transaction steps
const steps = [
  createTransactionStep('validate-input', async () => {
    // Validation logic
    return validatedData
  }),

  createTransactionStep(
    'create-resource',
    async () => {
      // Resource creation
      return createdResource
    },
    async (resource) => {
      // Rollback: delete created resource
      await deleteResource(resource.id)
    },
    { retryable: true, maxRetries: 3 }
  ),

  createTransactionStep('update-related', async () => {
    // Update related resources
    return updatedRelated
  })
]

// Execute with automatic rollback on failure
const result = await executeTransaction(steps, {
  stopOnError: true,
  rollbackOnError: true
})

if (!result.success) {
  // Handle transaction failure
  throw new MCPError(MCPErrorCode.TRANSACTION_FAILED, 'Operation failed')
}
```

## Resource Management

MCP supports both tools and resources. Resources provide read-only access to data:

```typescript
// In server registration (server.ts)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: Resource[] = [
    {
      uri: 'promptliano://projects',
      name: 'All Projects',
      description: 'List of available projects',
      mimeType: 'application/json'
    },
    // Removed legacy project summary resource
  ]

  return { resources }
})
```

## Testing MCP Tools

### Unit Testing Pattern

```typescript
// tools/__tests__/my-tool.test.ts
import { myTool } from '../category/my-tool.tool'
import { MyToolAction } from '../shared/types'

describe('MyTool', () => {
  it('should list items', async () => {
    const args = {
      action: MyToolAction.LIST,
      projectId: 1
    }

    const result = await myTool.handler(args)

    expect(result.content).toBeDefined()
    expect(result.content[0].type).toBe('text')
  })

  it('should handle missing projectId', async () => {
    const args = {
      action: MyToolAction.LIST
      // Missing projectId
    }

    const result = await myTool.handler(args)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('projectId is required')
  })
})
```

### Integration Testing

```typescript
// Test with actual MCP client
import { createInMemoryMCPContext } from './test-utils/inmemory-client'

describe('MCP Integration', () => {
  it('should execute tools through MCP protocol', async () => {
    const { client, close } = await createInMemoryMCPContext()

    const result = await client.callTool({
      name: 'my_tool',
      arguments: {
        action: 'list',
        projectId: 1
      }
    })

    await close()

    expect(result.content).toBeDefined()
  })
})
```

## Best Practices

### 1. Tool Design

- **Single Responsibility**: Each tool handles one domain (projects, tickets, etc.)
- **Action-based**: Use action enums for different operations within a tool
- **Consistent Naming**: Follow `snake_case` for tool names and actions
- **Rich Descriptions**: Provide detailed descriptions with examples

### 2. Error Handling

- **Specific Error Codes**: Use appropriate MCPErrorCode for different failure types
- **Recovery Suggestions**: Always provide actionable suggestions
- **Context Information**: Include relevant context (tool, action, parameters)
- **Graceful Degradation**: Handle partial failures appropriately

### 3. Parameter Validation

- **Early Validation**: Validate all required parameters upfront
- **Clear Examples**: Provide examples in error messages
- **Type Safety**: Use TypeScript for compile-time validation
- **Consistent Patterns**: Use shared validation utilities

### 4. Performance

- **Tracking**: Use `createTrackedHandler` for telemetry
- **Caching**: Cache expensive operations where appropriate
- **Pagination**: Support limits and offsets for large datasets
- **Streaming**: Consider streaming for large responses

### 5. Documentation

- **Tool Descriptions**: Include available actions and examples in description
- **Parameter Documentation**: Document all parameters with types and examples
- **Error Documentation**: Document possible error conditions
- **Usage Examples**: Provide practical usage examples

## Integration with Services

MCP tools should call service layer functions, not directly access storage:

```typescript
// Good: Call service layer
import { listProjects, createProject } from '@promptliano/services'

const projects = await listProjects()
const newProject = await createProject(projectData)

// Avoid: Direct storage access
// import { db } from '@promptliano/storage'
// const projects = await db.query('SELECT * FROM projects')
```

## Session Management

For HTTP transport, sessions are automatically managed:

- Session IDs are generated on `initialize`
- Sessions expire after 1 hour of inactivity
- Session cleanup runs every 5 minutes
- Session context is available in tool handlers

## Development Workflow

1. **Define Actions**: Add action enum to `tools/shared/types.ts`
2. **Create Tool**: Implement tool in appropriate category directory
3. **Add Validation**: Use shared validation utilities
4. **Error Handling**: Implement comprehensive error handling
5. **Register Tool**: Add to category index and main tools index
6. **Write Tests**: Create unit and integration tests
7. **Update Documentation**: Update tool descriptions and examples

This architecture provides a scalable, maintainable foundation for MCP tool development in Promptliano.

## MCP Resources Catalog

The stdio server exposes machine-readable resources to give agents immediate context without calling tools first.

- Global
  - `promptliano://info` — Human-friendly MCP server info (text)
  - `promptliano://tools` — All MCP tools with input schemas (JSON)
  - `promptliano://projects` — Project list (JSON)
  - `promptliano://mcp/usage` — Global MCP usage overview (JSON)
  - `promptliano://providers` — Provider keys status (censored) (JSON)
  - `promptliano://health` — Basic OK + version/time (JSON)

- Per-project (requires `PROMPTLIANO_PROJECT_ID`)
  - `promptliano://projects/{id}/overview` — Human-readable overview (text)
  - `promptliano://projects/{id}/stats` — Ticket/task/queue/prompt/chat counts (JSON)
  - `promptliano://projects/{id}/file-tree` — Compact file tree + meta (JSON)
  - Tickets
    - `.../tickets/summary` — Counts by status + recent tickets (JSON)
    - `.../tickets/open` — Top open tickets (JSON)
    - `.../tickets/{ticketId}` — Ticket detail + tasks (JSON)
  - Queues
    - `.../queues` — Queues with stats (JSON)
    - `.../queues/timeline` — Recent queue events/timeline (JSON)
    - `.../queues/{queueId}` — Queue detail + items (JSON)
  - MCP analytics
    - `.../mcp/usage` — Per-tool usage, success/error, execution trend (JSON)
    - `.../mcp/errors` — Top error patterns (JSON)
  - Git
    - `.../git/status` — Branch + working tree (JSON)
    - `.../git/log` — Recent commits (JSON)
    - `.../git/branches` — Branch list (JSON)
  - Config/Env
    - `.../config/mcp` — Merged project MCP config (JSON)
    - `.../mcp/servers` — Configured MCP servers (JSON)
    - `.../search/config` — File search backend + tool paths (JSON)
  - Processes
    - `.../processes` — Active processes managed by Promptliano (JSON)
  - Files
    - `.../files/{fileId}` — File contents with mimeType (JSON/text)
    - `.../suggest-files` — Guidance stub to use suggest_files tool (JSON)

Notes
- Payloads are intentionally small and summarized; drill-down URIs provide details.
- Secrets are never exposed; provider keys are masked and may show `ENV: VAR_NAME` only.
- Listings are capped (e.g., commits 20, tickets 10–15) for performance.
