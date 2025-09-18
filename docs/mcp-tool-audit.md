# MCP Tools Audit

Date: 2025-09-07
Owner: Promptliano core

This document evaluates the current MCP tool surface area to identify low‑value or unused tools and recommend removals or consolidations to reduce MCP bloat.

## Methodology

- Enumerated tools via `packages/server/src/mcp/tools/index.ts` (CONSOLIDATED_TOOLS).
- Reviewed each tool’s purpose, actions, file size (LOC), and in‑repo references (docs, tests, mocks).
- Classified tools into Core (keep), Consider (merge/trim), and Remove (demo/setup/unused).
- Note: External usage (by editors/users) is not visible in‑repo; recommendations are based on internal references and purpose.

## Summary Recommendations

- Keep: project_manager, prompt_manager, git_manager, ai_assistant
- Add: flow_manager (new unified MCP tool for tickets, tasks, queues)
- Remove: ticket_manager, task_manager, queue_manager, queue_processor, documentation_search, website_demo_runner, mcp_config_generator, mcp_setup_validator, mcp_compatibility_checker, markdown_prompt_manager, tab_manager

## Tool‑by‑Tool Findings

### Core (Keep)

- project_manager
  - Path: packages/server/src/mcp/tools/project/project-manager.tool.ts (≈623 LOC)
  - Purpose: Project/file/search operations; most capable entry point.
  - References: Broadly used in tests (mcp-integration), mcp-client mocks, website docs.
  - Recommendation: Keep. Continue to evolve search/file‑tree actions; avoid scope creep.

- prompt_manager
  - Path: packages/server/src/mcp/tools/project/prompt-manager.tool.ts (≈283 LOC)
  - Purpose: CRUD + association with projects; used in tests/docs/mocks.
  - Recommendation: Keep. Align with server prompt routes; ensure parity.

- ticket_manager
  - Path: packages/server/src/mcp/tools/workflow/ticket-manager.tool.ts (≈385 LOC)
  - Purpose: Ticket CRUD + task flows; referenced in tests/docs.
  - Recommendation: Keep. Good complement to task_manager.

- task_manager
  - Path: packages/server/src/mcp/tools/workflow/task-manager.tool.ts (≈386 LOC)
  - Purpose: Task CRUD, reorder, context helpers; referenced in docs.
  - Recommendation: Keep. Ensure overlap with ticket_manager is minimal.

- queue_processor
  - Path: packages/server/src/mcp/tools/workflow/queue-processor.tool.ts (≈271 LOC)
  - Purpose: Agent workflow processing (get_next_task, complete/fail…); referenced by tests and UI copy.
  - Recommendation: Keep. Primary runtime queue interface for agents.

- git_manager
  - Path: packages/server/src/mcp/tools/git/git-manager.tool.ts (≈607 LOC)
  - Purpose: Comprehensive Git operations; referenced in docs and services.
  - Recommendation: Keep. High utility for AI/agent workflows.

- ai_assistant
  - Path: packages/server/src/mcp/tools/content/ai-assistant.tool.ts (≈106 LOC)
  - Purpose: Prompt optimization; referenced in mocks/docs.
  - Recommendation: Keep. Small surface, practical value.

### Workflow Tools (Remove in favor of Flow)

- ticket_manager
  - Path: packages/server/src/mcp/tools/workflow/ticket-manager.tool.ts (≈385 LOC)
  - Action: Remove. Replace with flow_manager.tickets.\*

- task_manager
  - Path: packages/server/src/mcp/tools/workflow/task-manager.tool.ts (≈386 LOC)
  - Action: Remove. Replace with flow_manager.tasks.\*

- queue_manager
  - Path: packages/server/src/mcp/tools/workflow/queue-manager.tool.ts (≈355 LOC)
  - Action: Remove. Replace with flow*manager.queues.* and flow*manager.queue_ops.*

- queue_processor
  - Path: packages/server/src/mcp/tools/workflow/queue-processor.tool.ts (≈271 LOC)
  - Action: Remove. Replace with flow_manager.processor.\*

### Remove (Low‑value / Demo / Setup)

- documentation_search
  - Path: packages/server/src/mcp/tools/website/documentation-search.tool.ts (≈196 LOC)
  - Purpose: Mock website documentation search with hardcoded data.
  - References: Docs only; no tests/runtime usage.
  - Recommendation: Remove. Not useful in production; demo data belongs in website.

- website_demo_runner
  - Path: packages/server/src/mcp/tools/website/website-demo-runner.tool.ts (≈181 LOC)
  - Purpose: Drives hypothetical demos (getting-started/git-workflow).
  - References: Docs only.
  - Recommendation: Remove. Keep demos in website; not an MCP concern.

- mcp_config_generator
  - Path: packages/server/src/mcp/tools/setup/mcp-config-generator.tool.ts (≈179 LOC)
  - Purpose: Generate/validate MCP configs for editors.
  - References: Docs only.
  - Recommendation: Remove. Provide CLI/templates instead (docs/website). Reduces server surface.

- mcp_setup_validator
  - Path: packages/server/src/mcp/tools/setup/mcp-setup-validator.tool.ts (≈204 LOC)
  - Purpose: Diagnose local MCP setup; pseudo checks.
  - References: Docs only.
  - Recommendation: Remove. Move guidance to docs; avoid running environment checks server-side.

- mcp_compatibility_checker
  - Path: packages/server/src/mcp/tools/setup/mcp-compatibility-checker.tool.ts (≈186 LOC)
  - Purpose: Compatibility checks vs. editor conf.
  - References: No external references beyond its file.
  - Recommendation: Remove. Same rationale as setup_validator.

- markdown_prompt_manager
  - Path: packages/server/src/mcp/tools/project/markdown-prompt-manager.tool.ts (≈372 LOC)
  - Purpose: Validate/import/export prompts from Markdown.
  - References: Docs only. Overlaps with prompt workflows; high complexity/low usage.
  - Recommendation: Remove or fold minimal “validate_markdown” into prompt_manager if truly needed.

- tab_manager
  - Path: packages/server/src/mcp/tools/ui/tab-manager.tool.ts (≈89 LOC, already trimmed)
  - Purpose: Previously active‑tab; now only generate_name.
  - References: Docs only.
  - Recommendation: Remove. If name generation is desired, expose via local service/API, not MCP.

- LOC reduction if “Remove” set is deleted: ~2,715 LOC
  - Workflow tools: ticket_manager (385) + task_manager (386) + queue_manager (355) + queue_processor (271) = 1,397
  - Other low‑value tools: documentation_search (196) + website_demo_runner (181) + mcp_config_generator (179) + mcp_setup_validator (204) + mcp_compatibility_checker (186) + markdown_prompt_manager (372) + tab_manager (89) = 1,318
  - Smaller tool manifest and faster tool discovery in MCP clients.
  - Less maintenance surface and confusion around demo/setup tools.

## Suggested De‑Scope Plan

1. Remove tools from exports: edit `packages/server/src/mcp/tools/index.ts` to drop removed tools.
2. Delete tool files in website/ and setup/ groups and markdown_prompt_manager + tab_manager.
3. Prune docs: update `packages/website/src/routes/docs.mcp-tools.tsx` and any “API” docs pages referencing removed tools.
4. Update mocks/seeds: adjust `packages/mcp-client` mock lists and `packages/database/seed-mcp-test-data.ts`.
5. Run `bun run validate` and fix any dangling imports.
6. Announce in CHANGELOG with migration notes (e.g., use HTTP endpoints or CLI for setup/templates).

## Notes & Caveats

- External user workflows may depend on some removed tools; if in doubt, begin with “hidden/disabled by default” and solicit feedback before deletion.
- Where functionality is still useful (e.g., config templates or markdown prompt validation), prefer:
  - CLI scripts under `scripts/` with documented usage, or
  - HTTP endpoints that already exist, or
  - Local services consumed by the UI.

---

Generated by in‑repo analysis (grep counts, LOC, and doc/tests references). Feel free to mark tools as “Keep for now” if you know of external consumers.

## Flow Feature Consolidation Plan (Tickets, Tasks, Queues)

Goal: unify tickets, tasks, and queues under a single “flow” domain with consistent HTTP and MCP surfaces, one source of truth for state, and backwards compatibility for existing patterns and payloads.

### Objectives

- Single namespace: expose all ticket/task/queue operations under `flow/*`.
- Single state model: one canonical status per task/queue item; remove duplicated state in multiple data sources.
- No MCP backward compatibility: remove legacy workflow tools outright; migrate clients to flow_manager.

### HTTP API Refactor

- Add new routes (under project scope):
  - `GET/POST   /api/projects/{id}/flow/tickets`
  - `GET/PATCH/DELETE /api/projects/{id}/flow/tickets/{ticketId}`
  - `GET/POST   /api/projects/{id}/flow/tickets/{ticketId}/tasks`
  - `GET/PATCH/DELETE /api/projects/{id}/flow/tasks/{taskId}`
  - `GET/POST   /api/projects/{id}/flow/queues`
  - `GET/PATCH/DELETE /api/projects/{id}/flow/queues/{queueId}`
  - `POST       /api/projects/{id}/flow/queues/{queueId}/enqueue` (ticketId|taskId)
  - `POST       /api/projects/{id}/flow/queues/{queueId}/dequeue` (ticketId|taskId)
  - `POST       /api/projects/{id}/flow/processor/next` (agent pulls next work item)
  - `POST       /api/projects/{id}/flow/processor/{itemId}/complete|fail`

- Remove old endpoints (`/api/tickets`, `/api/tickets/:id/tasks`, `/api/queues`, etc.) in a breaking release. Update clients to use new paths.

### MCP Tools Refactor

- Introduce `flow_manager` (new) as the single tool for flow operations:
  - Actions (grouped):
    - tickets: `list`, `get`, `create`, `update`, `delete`
    - tasks: `list_by_ticket`, `create`, `update`, `delete`, `reorder`
    - queues: `create_queue`, `list_queues`, `get_queue`, `update_queue`, `delete_queue`, `get_stats`, `get_all_stats`
    - queue_ops: `enqueue_ticket`, `enqueue_task`, `dequeue_ticket`, `dequeue_task`
    - processor: `get_next_item`, `complete_item`, `fail_item`

- Remove legacy MCP tools immediately:
  - Delete `ticket_manager`, `task_manager`, `queue_manager`, `queue_processor` and drop them from `CONSOLIDATED_TOOLS` and exports.
  - Update website docs and mocks to reference only `flow_manager`.

### Data Model and Source‑of‑Truth

- Define a Flow domain layer in services (`@promptliano/services/src/flow-service.ts`) that orchestrates tickets, tasks, and queues:
  - Provide transactionally safe operations for enqueue/dequeue/complete/fail.
  - Ensure queue item status derives from the task status (or vice versa) in one canonical place. Avoid duplicating state across tables.
  - Add Drizzle migrations if needed to:
    - Ensure queue items reference a single “work item” (task or ticket) via a unified key.
    - Add missing FKs and indexes to support processor queries (next work item by priority/age).

- Schema compatibility: keep existing zod types in `@promptliano/schemas` (Ticket, Task, Queue, QueueStats) unchanged. If the Flow layer has richer models, expose them via `Flow*` internal types and map to current public types.

### Response and Type Guidelines

- Prefer stable envelopes `{ success: true, data: ... }`, but breaking changes are permitted.
- If renaming fields increases clarity across tickets/tasks/queues, do so and provide a migration table in docs.

### Rollout Strategy (Breaking)

1. Implement Flow service and add new `flow/*` HTTP routes.
2. Add `flow_manager` MCP tool wired to Flow service only.
3. Remove `ticket_manager`, `task_manager`, `queue_manager`, `queue_processor` from codebase and exports.
4. Remove old HTTP endpoints for tickets/tasks/queues; update OpenAPI and generated clients.
5. Update website docs, examples, and `packages/mcp-client` mocks to use `flow_manager` exclusively.
6. Bump major version and publish migration guide.

### Mapping (Adapters → Flow)

- ticket_manager.list/get/create/update/delete → flow_manager.tickets.\*
- task_manager.list/create/update/delete/reorder → flow_manager.tasks.\*
- queue_manager.create/list/get/update/delete/get_stats/get_all_stats → flow_manager.queues.\*
- queue*manager.enqueue/dequeue, queue_processor.get_next/complete/fail → flow_manager.queue_ops.*, flow*manager.processor.*

### Migration Notes

- Provide a “before → after” mapping for paths and MCP actions.
- Include example payload diffs to accelerate client updates.

### Nice‑to‑Have

- Emit `Link` headers on new endpoints pointing to related subresources to improve discoverability.
