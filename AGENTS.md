# Repository Guidelines

This guide aligns contributors and AI agents on how to work in this monorepo. The stack uses Bun 1.x, TypeScript, and workspaces under `packages/*`.

## Project Structure & Module Organization

- `packages/server` — Bun/Hono API, MCP server, tests in `src/`.
- `packages/client` — React/Vite UI, Playwright E2E in `e2e/`.
- `packages/database` — Drizzle ORM schemas, migrations, studio.
- `packages/*` — additional modules (`shared`, `services`, `schemas`, etc.).
- `scripts/` — dev/build helpers (TS executed via `bun run`).
- `dist/` — build outputs; `src/generated/` — codegen artifacts.
- `.env.example` — copy to `.env` for local config.

## Build, Test, and Development Commands

- `bun install` — install dependencies (workspace-aware).
- `bun run dev` — run full dev (server, client, inspector helpers).
- `bun run dev:server` / `bun run dev:client` — run each side only.
- `bun run build` — build all packages; `bun run build-binaries` — create platform executables in `dist`.
- `bun run test` — run package tests; `bun run typecheck` — TypeScript checks; `bun run validate` — typecheck + tests.
- Database: `bun run db:migrate` and `bun run db:studio` (Drizzle Studio).

## Coding Style & Naming Conventions

- Language: TypeScript, ESM (`"type": "module"`).
- Formatting: Prettier enforced — 2 spaces, no semicolons, single quotes, width 120. Run `bun run format` before committing.
- Naming: files/dirs `kebab-case`; variables/functions `camelCase`; React components `PascalCase`.
- Keep modules focused; prefer small utilities in `packages/shared` when reusable.

## Testing Guidelines

- Unit tests: Bun test. Name files `*.test.ts(x)` near code under `src/`.
- E2E: Playwright in `packages/client/e2e`. Common tasks: `bun run -C packages/client test:e2e` (or `test:e2e:ui`/`...:debug`).
- Run all checks with `bun run validate` before pushing.

## Commit & Pull Request Guidelines

- Commits: short, imperative subject (e.g., `fix server routing`), optional body for context. Scope prefix optional.
- PRs: clear description, linked issues (`#123`), screenshots for UI changes, steps to test, and checklist that `bun run validate` passes.
- Include docs updates when changing APIs, CLI, or env vars.

## Security & Configuration Tips

- Copy `.env.example` → `.env`. Set provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.). Never commit secrets; prefer Docker/host secrets in production.
- Dev ports are configurable (see README “Port Configuration”).
