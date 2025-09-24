# Promptliano VS Code Extension Agent

This document outlines how autonomous or semi-autonomous agents should work on the VS Code extension that lives in `packages/vscode-extension`.

## Extension Overview
- Bundled with Bun (see `package.json` scripts).
- Written in TypeScript using the VS Code extension API.
- Entry point: `src/extension.ts`.
- Views, panels, and data providers are located under `src/views/` and `src/data/`.
- Build output goes to `dist/extension.js` (generated via `bun run --cwd packages/vscode-extension build`).

## Core Responsibilities
1. **Tree Views**
   - `FlowTreeDataProvider` drives the Promptliano Flow tree view.
   - Nodes cover projects, queues, tickets, tasks, and prompts.
   - Prompt nodes must open the webview preview panel (`PromptPreviewPanel`).
2. **Webview Panels**
   - Ticket details: `TicketDetailsPanel`.
   - Queue details: `QueueDetailsPanel`.
   - Prompt preview: `PromptPreviewPanel`.
   - Webviews should be created with `enableScripts: true` only when necessary and must include CSP headers.
3. **REST Integration**
   - `FlowClient` wraps REST calls using `TypeSafeApiClient` (auto-generated client).
   - Any new API interaction should live in a data/client module, not directly inside the view or panel code.

## Development Workflow
- **Install dependencies**: `bun install` (from repo root).
- **Type-check**: `bun run --cwd packages/vscode-extension typecheck`.
- **Build bundle**: `bun run --cwd packages/vscode-extension build`.
- **Launch Extension Host**: use VS Code `F5` (Extension Development Host).
- Avoid editing `dist/extension.js` manually; always rebuild after source changes.

## Coding Guidelines
- Use TypeScript strict mode (already enabled).
- Group functionality: data fetching lives in `src/data/`, view logic in `src/views/`.
- Reuse helper utilities (e.g., `formatStatus` in `src/utils/format.ts`).
- Tree items should expose commands instead of relying on default selection behavior.
- Use `context.subscriptions.push(...)` for every command, provider, or event listener registered in `activate`.
- Keep webview HTML self-contained; avoid external network calls unless absolutely required.

## Testing & Validation
- Run `typecheck` after changes.
- Build the extension bundle and reload the Extension Development Host to validate UI changes.
- For webview interactions, test copy buttons/message passing to ensure status updates.

## Common Tasks
- **Add tree nodes**: update `FlowTreeDataProvider` for new item types; extend `FlowClient` to supply data.
- **Add panel action**: register a command in `extension.ts`, add a view/menu contribution in `package.json`, implement the handler.
- **Modify prompts UX**: adjust `PromptPreviewPanel` and prompt tree node wiring.
- **Update REST behaviours**: edit `FlowClient` and ensure error handling with `ExtensionLogger`.

## Do & Don’t
- ✅ Use VS Code APIs (commands, TreeDataProvider, WebviewPanel).
- ✅ Keep asynchronous calls wrapped with try/catch and show user-facing errors via `vscode.window.showErrorMessage` when necessary.
- ✅ Update documentation (`README.md`, this file) when adding major features.
- ❌ Do not commit generated bundles (`dist/extension.js`) without rebuilding.
- ❌ Do not store secrets or tokens in plain text; use VS Code secrets storage if needed.
- ❌ Avoid blocking calls in the extension host.

## Contact Points
- Report API changes or server issues to the Promptliano backend maintainers.
- For VS Code API updates, refer to the official documentation: https://code.visualstudio.com/api

Keep the extension consistent with VS Code UX guidelines and ensure prompt previews, ticket panels, and queue dashboards remain functional.
