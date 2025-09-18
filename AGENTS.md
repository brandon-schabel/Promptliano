# Repository Guidelines

This guide aligns contributors and AI agents on how to work in this monorepo. The stack uses Bun >1.2, TypeScript, and workspaces under `packages/*`.

## Use the Promptliano MCP For Quick Repo Context

### Utilize Promptliano to add important context, planning tickets and tasks

### Promptliano Flow

#### Flow is an AI Task Manangement Feature

- Flow allows you to quickly build tickets and tasks using project context and manage tasks through a queue, tickets, and task system.
- If told to pick up a Queue, check Promptlianos Queues, see which tickets and tasks are at the top of the Queue. It is encourage to do similar tasks together
- Once you are done working on a tasks mark it as complete. Complete all tasks on a ticket.
- Once all tasks and requirements on a ticket have been completed mark it as completed to dequeue the ticket.

## MCP Workspace Concepts

- `Projects` store basic metadata (name, path, description) and act as the scope for all other resources. Use `project_manager(list)` to discover IDs before calling project-scoped actions.
- `Files` are indexed per project for browse, content, search, and suggestion workflows. Most file operations run through the `project_manager` tool.
- `Tickets` capture higher-level work items tied to a project.
- `Tasks` break tickets into actionable steps and inherit the ticket's project.
- `Queues` orchestrate execution order for tickets/tasks and power the processor lifecycle.

## MCP Tools Quick Reference

### project_manager tool

- Manages project metadata, file system access, search, and document overview. Supported actions include `list`, `get`, `browse_files`, `get_file_content`, `update_file_content`, `create_file`, `get_file_tree`, `suggest_files`, `search`, and `overview`.
- `suggest_files` ranks repository paths for a natural-language prompt. Provide `projectId`, `data.prompt`, and optional `data.limit` (default 10). The tool returns a text block of newline-separated paths or `No file suggestions found` when nothing matches.
- Quick test: `bun scripts/run-mcp-suggest-files.mjs "refactor auth flow" 15`. The script spins up an in-memory MCP client/server, resolves the project automatically (or honors `PROMPTLIANO_PROJECT_ID`), and prints the raw MCP response.
- Direct MCP payload shape:

  ```json
  {
    "name": "project_manager",
    "arguments": {
      "action": "suggest_files",
      "projectId": 1,
      "data": {
        "prompt": "refactor auth flow",
        "limit": 15
      }
    }
  }
  ```

#### `suggest_files` usage

- Use when you need a fast ranked list of files matching a natural-language task description.
- Required payload keys: `projectId`, `action: "suggest_files"`, and `data.prompt`. Optional: set `data.limit` to control how many paths you receive (defaults to 10).
- Example direct invocation from the Codex CLI or another MCP client:

  ```
  promptliano.project_manager({
    "projectId": 1,
    "action": "suggest_files",
    "data": {
      "prompt": "refactor auth flow",
      "limit": 15
    }
  })
  ```

- The response is a newline-separated list of matching paths. Handle the literal string `No file suggestions found` as the empty result case.
- Use `project_manager`'s `search` action only when you have an exact string to find; that action requires `data.query` and will reject requests missing it.

- When doing file modifications prefer using your built in tools
- When using file searches use search and suggest files, suggest files allows you to use natural language to search for files, you can pass in a limit based on how many results you would like to see

# When you need to call tools from the shell, use this rubric

## For promptliano the file search has these built in (ripgrep, ast-grep, etc)

- Find Files: `fd`
- Find Text: `rg` (ripgrep)
- Find Code Structure (TS/TSX): `ast-grep`
  - Default to TypeScript:
    - `.ts` → `ast-grep --lang ts -p '<pattern>'`
    - `.tsx` (React) → `ast-grep --lang tsx -p '<pattern>'`
  - For other languages, set `--lang` appropriately (e.g., `--lang rust`).
- Select among matches: pipe to `fzf`
- JSON: `jq`
- YAML/XML: `yq`

### flow_manager tool

- Central hub for tickets, tasks, and queues. Actions are grouped by prefix: `tickets_*`, `tasks_*`, `queues_*`, queue mutations (`enqueue_*`, `dequeue_*`), and processor operations.
- Tickets: use `tickets_list` (requires `projectId`), `tickets_get`, `tickets_create`, `tickets_update`, `tickets_delete`. Payloads accept fields such as `title`, `overview`, and `priority`.
- Tasks: `tasks_list_by_ticket` (needs `ticketId`), `tasks_create`, `tasks_update`, `tasks_delete`, `tasks_reorder`. Supply `data.content` (and optional description/status) when creating tasks.
- Queues: `queues_create`, `queues_list`, `queues_get`, `queues_update`, `queues_delete`, plus stats via `queues_get_stats` and `queues_get_all_stats`.
- Queue flow: `enqueue_ticket`, `enqueue_task`, `dequeue_ticket`, `dequeue_task` manage work-in-progress. Processor consumers call `processor_get_next`, then either `processor_complete` or `processor_fail` with the queue item id and result payload.

## Project Structure & Module Organization

- `packages/server` — Bun/Hono API, MCP server, tests in `src/`.
- `packages/client` — React/Vite UI, Playwright E2E in `e2e/`.
- `packages/database` — Drizzle ORM schemas, migrations, studio.
- `packages/*` — additional modules (`shared`, `services`, `schemas`, etc.).
- `scripts/` — dev/build helpers (TS executed via `bun run`).
- `dist/` — build outputs; `src/generated/` — codegen artifacts.
- `.env.example` — copy to `.env` for local config.
- Documentation: user-facing guides live in `docs/`; deep-dive engineering notes are in `dev-docs/`.

## Build, Test, and Development Commands

- `bun install` — install dependencies (workspace-aware).
- `bun run dev` — run full dev (server, client, inspector helpers).
- `bun run dev:server` / `bun run dev:client` — run each side only.
- `bun run build` — build all packages; `bun run build-binaries` — create platform executables in `dist`.
- `bun run test` — run package tests; `bun run typecheck` — TypeScript checks; `bun run validate` — typecheck + tests.
- Database: `bun run db:migrate` and `bun run db:studio` (Drizzle Studio).

### File Search Backend

- New runtime-selected backends, no pre-indexing required:
  - `FILE_SEARCH_BACKEND=sg|rg|fts|like` (default `sg`)
  - `FILE_SEARCH_ASTGREP_PATH=/path/to/ast-grep` (optional)
  - `FILE_SEARCH_RIPGREP_PATH=/path/to/rg` (optional)
- Run `bun run db:migrate` after pulling to drop legacy search tables (metadata/keywords/trigrams/cache/fts).

## Coding Style & Naming Conventions

- Language: TypeScript, ESM (`"type": "module"`).
- Formatting: Prettier enforced — 2 spaces, no semicolons, single quotes, width 120. Run `bun run format` before committing.
- Naming: files/dirs `kebab-case`; variables/functions `camelCase`; React components `PascalCase`.
- Keep modules focused; prefer small utilities in `packages/shared` when reusable.

## Testing Guidelines

- Unit tests: Bun test. Name files `*.test.ts(x)` near code under `src/`.
- E2E: Playwright in `packages/client/e2e`. Common tasks: `bun --cwd packages/client run test:e2e` (or `... run test:e2e:ui`/`...:debug`).
- Run all checks with `bun run validate` before pushing.

## Commit & Pull Request Guidelines

- Commits: short, imperative subject (e.g., `fix server routing`), optional body for context. Scope prefix optional.
- PRs: clear description, linked issues (`#123`), screenshots for UI changes, steps to test, and checklist that `bun run validate` passes.
- Include docs updates when changing APIs, CLI, or env vars.

## Security & Configuration Tips

- Copy `.env.example` → `.env`. Set provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.). Never commit secrets; prefer Docker/host secrets in production.
- Dev ports are configurable (see README “Port Configuration”).
- File search env: see README “File Search Backend”. Use ripgrep by default; FTS/LIKE fallbacks are automatic.
