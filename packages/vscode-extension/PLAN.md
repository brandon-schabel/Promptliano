# Promptliano Flow VS Code Extension Plan

## 1. Vision & Scope
- Deliver a read-only VS Code extension that surfaces Promptliano Flow tickets, tasks, and active queues from within the editor.
- Allow users to refresh the view manually; automatic sync and mutations will come later.
- Package lives in `packages/vscode-extension` and reuses existing TypeScript tooling, API clients, and design tokens wherever practical.

## 2. Assumptions & Dependencies
- Flow data is accessible via the existing Promptliano server/API; `@promptliano/api-client` exposes the Ticket/Task/Queue endpoints or can be extended with generated types.
- Users have the Promptliano monorepo checked out and run the API locally (`bun run dev:server`). Extension will target local development first.
- VS Code extension will build with Bun + TypeScript (`tsc`) and bundle via `esbuild` or `tsup` (prefer whichever is already in the repo; fall back to `tsup`).
- Node 18+/VS Code 1.88+ baseline to align with current Bun toolchain and extension host requirements.
- No interactive mutations in v0; no authentication flow required beyond any existing local credentials used by the API client.

## 3. Architecture Overview
- **Extension entry**: `src/extension.ts` registers a single command (`promptlianoFlow.refresh`) and contributes a `TreeView`.
- **Data layer**: thin wrapper around `@promptliano/api-client` to fetch `GET /tickets?status=open`, `GET /tickets/:id/tasks`, and queue endpoints. Responses mapped into internal domain types.
- **State management**: lightweight in-memory cache with timestamps to avoid redundant requests between refreshes.
- **View layer**: VS Code `TreeDataProvider` exposing hierarchical nodes Ticket → Task list and Active Queue → Queue Items; uses built-in icons.
- **Configuration**: `package.json` contributes settings for API base URL, polling interval toggle (disabled by default), and logging verbosity.
- **Telemetry/logging**: reuse existing logger utility from `packages/shared` if feasible; otherwise use VS Code output channel.

## 4. Package Setup
- Add `package.json` with name `@promptliano/vscode-extension`, `main` pointing to compiled `dist/extension.js`, `engines.vscode` set appropriately, and Bun-powered scripts:
  - `bun run build` → compile via `tsup`/`esbuild`.
  - `bun run watch` → incremental build for development.
  - `bun run lint` → `bunx eslint` (reuse repo ESLint config if available).
  - `bun run test` → Node-based unit tests using `vitest` or `bun test`.
- Include `tsconfig.json` that extends the root config (likely `tsconfig.base.json`) ensuring ESM output compatible with VS Code (target `ES2020`, module `commonjs` or `node16`).
- Create `src/` with scaffolding modules (`extension.ts`, `data/flowClient.ts`, `views/flowTree.ts`, `types.ts`).
- Add `.vscodeignore` (excludes `src`, tests, bun lockfile if redundant) and `README.md` for extension usage.
- Register the package in the monorepo workspace (root `package.json` or `bunfig.toml`) if necessary.

## 5. Data Flow & APIs
- Fetch pipelines:
  1. `FlowClient.getOpenTickets()` → returns ticket metadata (id, title, status, priority).
  2. `FlowClient.getTasksForTicket(ticketId)` → fetches tasks, filtered to `status !== completed` if API doesn’t filter.
  3. `FlowClient.getActiveQueues()` → list of queues plus active ticket/task references.
  4. Optional batching: parallelize tickets/tasks queries with `Promise.all` and add caching to avoid repeated task fetches during tree expansion.
- Error handling: wrap API calls, surface failures via VS Code notifications and Output channel; degrade gracefully (show placeholder nodes like “Failed to load tasks”).
- Authentication: leverage existing API client configuration (likely environment-based tokens). Add configuration fields if manual token entry is required.

## 6. UI/UX Plan
- Contribute a Tree View titled “Promptliano Flow” pinned under the Explorer activity bar.
- Tree structure:
  - `Queues` (expandable): each active queue node shows queue name + in-progress item count; children display queue items referencing tickets/tasks.
  - `Tickets` (expandable): list open tickets with status/priority badges; children display tasks (group by status: `blocked`, `in_progress`, `pending`).
- Each tree item’s tooltip shows additional metadata (owner, due date, queue info).
- Commands:
  - `promptlianoFlow.refresh` (command palette + toolbar refresh button) triggers full data reload.
  - Optional `promptlianoFlow.openTicketInBrowser` placeholder hooking to existing dashboard URL (if available).
- Iconography: reuse existing SVG assets (from `packages/ui` or `brand-kit`) scaled for VS Code (16 px) or fallback to VS Code codicons.

## 7. Implementation Phases
1. **Project scaffolding**
   - Generate extension manifest, tsconfig, lint/test configs, `.vscodeignore`.
   - Ensure build output lands in `dist/` and is gitignored.
2. **Data client integration**
   - Import `@promptliano/api-client`; add Flow-specific wrappers.
   - Define shared types aligning with server schema (re-export from API client when possible).
3. **Tree view foundation**
   - Implement `TreeDataProvider` with synthetic data to validate activation, commands, and refresh.
   - Wire refresh command to tree data provider refresh event.
4. **API wiring**
   - Replace synthetic data with live API calls, implement caching and loading states.
   - Handle errors (notifications + output channel).
5. **Polish & docs**
   - Document configuration, add usage notes to README.
   - Add unit tests for data transforms and tree provider logic.
   - Prepare packaging instructions (`vsce package`) but keep release out of scope.

## 8. Testing Strategy
- **Unit tests**: cover data mappers, caching behavior, TreeDataProvider (using dependency injection/mocks).
- **Integration tests**: script that spins up mock server (reuse server stubs or fixtures from `packages/server`) to ensure extension fetches and renders expected nodes.
- **Manual validation**: with local Promptliano server running, verify refresh command, ticket/task visibility, queue display, and failure messaging.
- **CI**: integrate with existing pipeline (reuse `bun run validate` or add package-specific job).

## 9. Reuse Opportunities
- Shared types from `@promptliano/schemas` or API client to avoid duplication.
- Existing logging utilities (`packages/services` or `packages/shared`) for consistent log formatting.
- Shared UI assets or color tokens from `packages/brand-kit` for icons/tooltips.
- Potential use of existing `hook-factory` patterns if similar reactive data flows are required.

## 10. Future Enhancements (Out of Scope for v0)
- Inline ticket/task updates (status changes, comments, queue reordering).
- Real-time updates via web sockets or server-sent events.
- Authentication/environments selector (staging vs production).
- Multi-tenant support for different Promptliano projects.
- Integration with VS Code Problems view or status bar indicators.

## 11. Open Questions
- Confirm exact Flow API endpoints and filters; update API client if gaps exist.
- Determine whether queues reference tasks or tickets directly (affects tree hierarchy).
- Clarify authentication/token management for local vs remote servers.
- Decide on long-term bundler strategy (tsup vs esbuild) aligned with repo standards.
