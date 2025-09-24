# Promptliano Flow VS Code Extension (Preview)

A workspace extension that surfaces Promptliano Flow data (projects, open tickets, tasks, and active queues) directly inside Visual Studio Code. The current milestone is read-only with manual refresh support.

## Key Capabilities
- Lists Promptliano projects detected by the API (filterable via settings).
- Displays open tickets with outstanding tasks, grouped by project.
- Shows only active queues and the tickets/tasks enqueued within them.
- Manual refresh command and toolbar button to pull latest state.
- Lists project prompts and opens them in a Markdown preview for quick copy/paste.

## Prerequisites
- Promptliano API running locally (e.g. `bun run dev:server`).
- Bun ≥1.2 to install and run workspace tooling.
- VS Code ≥1.88.

## Install Dependencies
```bash
bun install
```

## Build & Iterate
```bash
# One-time bundle
bun run --cwd packages/vscode-extension build

# Watch mode during development
bun run --cwd packages/vscode-extension watch

# Optional type check
bun run --cwd packages/vscode-extension typecheck
```

## Load the Extension in VS Code
1. Open the repository folder in VS Code.
2. Run the build once (`bun run --cwd packages/vscode-extension build`) to emit `dist/extension.js`.
3. Start the extension host:
   - **Option A (recommended)**: Press `F5` or run the *Run Extension* launch config (`Run` → `Start Debugging`). Ensure the working directory is the repo root so VS Code picks up `packages/vscode-extension` automatically.
   - **Option B**: Run the command palette action `Developer: Install Extension from Location...` → choose `.../packages/vscode-extension`. This loads the extension in development mode without packaging.
4. Switch to the new **Promptliano Flow** tree view under Explorer. Use the refresh button or `Promptliano Flow: Refresh` command after changing data.

## Prompt Preview
- Expand a project and open the **Prompts** section to see its saved prompts.
- Select a prompt and press `Enter` (or use the context menu action *Open Prompt*) to view the content in a read-only editor for easy copying.

## Configuration
Settings live under the `promptlianoFlow` namespace:
- `promptlianoFlow.apiBaseUrl` (default `http://localhost:3147`)
- `promptlianoFlow.apiToken` (optional bearer token)
- `promptlianoFlow.projectIds` (array of project IDs to include; leave empty for all projects)
- `promptlianoFlow.showCompleted` (when `true`, include completed tickets/tasks)

Changes trigger an automatic refresh. If a configured project cannot be found, the view shows an error placeholder for that ID.

## Status & Next Steps
- ✔️ Read-only browsing of Flow tickets, tasks, and queues
- ⏳ Follow-up ideas: inline status updates, websocket refresh, richer filtering, queue actions

Feel free to open issues or PRs as the extension evolves.
