# MCP-Enabled Chat Notes

This document captures the initial implementation work completed to wire Promptliano's Model Context Protocol (MCP) tooling into the chat experience.

## Runtime Overview
- A lightweight chat session manager (`packages/server/src/mcp/chat-session-manager.ts`) now ensures a default Promptliano MCP server is started (mock transport for now) and associates each chat with that server.
- API routes expose the session metadata and a generic tool invocation endpoint:
  - `GET /api/ai/chat/:chatId/mcp-session`
  - `POST /api/ai/chat/:chatId/mcp/tools/run`
- The legacy streaming route calls `ensureChatMcpSession` so tool metadata is always ready before the assistant responds.

## Frontend Touchpoints
- `useAIChat` fetches MCP session details on chat change and records tool activity events.
- Before each model call (when tools are enabled) the hook invokes `project_manager` via the new route and records the result/error as a chat-side event.
- Chat UI shows tool activity inline with conversation messages and offers a toggle in the header to quickly enable/disable MCP usage per chat.

## Follow-up Ideas
- Replace the mock MCP transport with a real Promptliano server connection once the runtime wiring is merged.
- Expand `invokeDefaultChatTool` to support richer tool selection and post results back into the model context automatically.
- Consider streaming tool events over the same SSE channel once the `useChat` hook supports custom event envelopes.
