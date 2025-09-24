# AI SDK Chat Refactor Plan

This document captures the end-to-end plan for rebuilding the chat subsystem so
that it follows the recommended “React + Bun + AI SDK v5 (tools, MCP, SQLite)”
architecture. The goals are to remove the legacy promptliano-specific wiring,
standardise on AI SDK primitives, and ensure the database simply persists the
messages that the SDK produces.

## Goals

1. **First-party tools defined with `tool()` + Zod.**
   - Replace ad-hoc helpers with a dedicated `packages/server/src/ai/tools`
     directory.
   - Ship at least two example tools (calculator + weather) and keep the module
     extensible.

2. **Standard MCP integration.**
   - Adopt `experimental_createMCPClient` + `StdioClientTransport` for every MCP
     server (including the built-in Promptliano server).
   - Promptliano MCP becomes “just another” MCP server that is on by default.
   - No more custom in-process client or `invokeDefaultChatTool` helpers.

3. **AI SDK as the chat driver.**
   - `streamText` (or the Agent abstraction) receives the canonical history and
     tools map.
   - `validateUIMessages` guards all inbound messages.
   - The request handler converts UI messages with `convertToModelMessages` and
     streams the SDK response directly to the client.

4. **Database persistence as a mirror of AI SDK messages.**
   - Persist what comes out of `validateUIMessages`/`streamText`: role, text, and
     the structured metadata (tool invocations/results) as JSON.
   - Remove the current placeholder message logic and the split chat-service
     responsibilities.

5. **MCP lifecycle per request.**
   - Each HTTP request spins up the required MCP clients, collects tool
     definitions, and always closes the clients in a `finally` block.

6. **Documentation and developer ergonomics.**
   - Create source-level docs so future work understands where to add tools,
     how to register new MCP servers, and how persistence works.

## High-level Architecture

```
┌────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
│ React useChat ─────▶│  /api/ai/chat        │───────▶│ AI SDK streamText     │
│  (UIMessage[])│     │  (Hono handler)      │ tools  │ (tools + MCP clients) │
└────────────┘        └─────────┬────────────┘        └─────────┬────────────┘
                                 │                                │
                                 │ persist                        │ close clients
                                 ▼                                ▼
                         ┌──────────────────┐        ┌────────────────────┐
                         │ Drizzle ORM      │        │ MCP servers         │
                         │ chat_messages    │        │ (Promptliano + ...)│
                         └──────────────────┘        └────────────────────┘
```

## Implementation Steps

### 1. Remove the legacy chat drivers

* Delete `handleChatMessage`, `invokeDefaultChatTool`, and
  `ensureChatMcpSession` (plus their helpers under `packages/server/src/mcp`).
* Update every callsite (`gen-ai-routes.ts`, `useAIChat` hook, etc.) to use the
  new driver described below.

### 2. First-party tool module

* Create `packages/server/src/ai/tools` with:
  - `calculator.tool.ts`: example `tool()` that `eval`s expressions via a safe
    math parser.
  - `weather.tool.ts`: returns deterministic mock data.
  - `index.ts`: exports a dictionary `{ [name: string]: ToolDefinition }` so the
    chat driver can import it directly.

### 3. MCP client wrapper

* New module `packages/server/src/ai/mcp/registry.ts` that exports
  `createMcpToolSuite({ enablePromptliano: boolean })`.
  - Internally creates per-request MCP clients using `experimental_createMCPClient`
    and wraps every MCP tool in a `tool()` definition (input schema falls back to
    `z.any()` until we wire JSON Schema → Zod conversion).
  - Exposes `{ tools, cleanup }` so the caller can `await cleanup()` in a
    `finally` block.
  - Promptliano MCP is always added; additional servers can be toggled via
    config.

### 4. Chat driver (`packages/server/src/ai/chat/driver.ts`)

* Exports `streamChatSession({ chatId, messages, model, provider, toolsEnabled,
  systemMessage, maxSteps, enableChatAutoNaming, temperature, ... })`.
* Steps inside the function:
  1. Merge first-party and MCP tools, then validate incoming UI messages by
     calling `validateUIMessages`.
  2. Convert to model messages with `convertToModelMessages`.
  3. Call `streamText` with `{ tools, toolChoice, maxSteps }` and a provider-specific
     `LanguageModelV2` instance (reuse `getProviderLanguageModelInterface`).
  4. Persist both the latest user message and the assistant streaming result to
     the database using the Drizzle repositories, storing the entire UI message
     JSON (text, parts, tool metadata) in a JSON column.
  5. Return `{ stream, finishState }` so Hono can forward it via
     `toDataStreamResponse`.
  6. Always close any MCP clients (`await cleanup()`), even when streaming fails.

### 5. Database adjustments

* Add `structured` (JSON) column to the `chat_messages` table to hold the full
  UIMessage payload.
* Update the repository + service so `addMessage` and `saveMessage` take an
  object `{ uiMessage, text }`, serialise the UI message to JSON, and keep text
  for search/indexing.
* Provide a migration that backfills legacy rows by wrapping the existing text in
  a minimal UI message structure (so old chats still load).

### 6. API route rewrite

* Replace the body of `postAiChatSdkRoute` in
  `packages/server/src/routes/gen-ai-routes.ts` so it:
  - Passes the full `messages` array to `streamChatSession`.
  - Removes the inline `tool()` definition (that now lives in the tools module).
  - Drops the legacy fallback executor (`invokeDefaultChatTool`).
* Ensure the route still validates the request payload and creates a default MCP
  session initialisation event for the client UI if tools are enabled.

### 7. Frontend alignment

* Update the generated `useAIChat` hook so it no longer expects the server to
  read history from the database separately. The hook should send the full
  history, and the server will persist the result after streaming.
* Ensure the hook’s optimistic message handling matches what the server
  persists (IDs, structure) to avoid duplicate rows.

### 8. Documentation & follow-up

* Document how to add new first-party tools (template + testing guidance).
* Document how to register new MCP servers (command, env vars, closing rules).
* Remove deprecated code paths once the new driver is stable.

## Rollout Plan

1. **Branch & migrations** – Create a dedicated refactor branch. Ship the DB
   migration in isolation first to keep deployments safe.
2. **Incremental integration** – Land the new tool modules and driver alongside
   the old implementation behind a feature flag if necessary.
3. **QA** – Regression test chat flows (with and without tools), MCP tool calls,
   and chat persistence (page reloads, multiple chats).
4. **Cleanup** – Remove feature flag + dead code, update docs, and run
   `bun run validate` before merging.

---

Following this plan will give us an AI SDK v5-compliant chat pipeline, simplify
future tool work, and eliminate the bespoke MCP plumbing that currently exists
in Promptliano’s server package.

