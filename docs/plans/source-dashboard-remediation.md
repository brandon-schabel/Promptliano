# Source Dashboard Evaluation & Remediation Plan

## Summary

- Source dashboard UI (`packages/client/src/routes/deep-research.$researchId.sources.$sourceId.tsx`) shows zero-valued metrics and missing status data even when link entries exist.
- The backend response built in `packages/server/src/routes/deep-research-routes.ts` (specifically the `/api/research/sources/{id}/dashboard` handler) exposes nested objects (`tokenStats`, `crawlStatus`, `crawlProgress`, `performanceStats`, `errors`) that do not match the UI's expectations (`metadata`, `crawlStatus`, flat metrics).
- We need a deep evaluation to align schema, server output, and client consumption; fixes may span both API routes and client presentation.

## Current Symptoms & Hypotheses

- **Metrics render as zero** because the client derives stats from `metadata.*`, but the API response currently omits that object and instead returns alternate nested structures.
- **Badge/Buttons misreport crawl status** since the client expects `crawlStatus.status` but backend sets status on `dashboardData.crawlStatus.status` while the client first assigns `const source = dashboard.data` and then `const crawlStatus = source.crawlStatus || {}`—however other fields (e.g., `metadata.errorCount`) are missing and stay falsy.
- **Link table rows appear** because `/api/research/sources/{id}/links` maps to the client hook, so discrepancies seem isolated to the dashboard endpoint and derived values.

## Key Artifacts to Inspect

- `packages/client/src/routes/deep-research.$researchId.sources.$sourceId.tsx`
- `packages/server/src/routes/deep-research-routes.ts` (dashboard + crawl endpoints)
- `packages/server/src/routes/crawling-routes.ts` (shared crawl stats helpers; ensure consistency)
- `packages/schemas` definitions, especially `SourceDashboardResponseSchema`
- `@promptliano/services` implementations (`deepResearchService.startSourceCrawl`, `getSourceCrawlStatus`, etc.) to understand metadata shape persisted in the database

## Deep Evaluation Plan

1. **Schema Reality Check**
   - Open `SourceDashboardResponseSchema` and confirm the contract (field names, nested structures, nullable values).
   - Verify whether schema matches what the server currently returns; document any drift.
2. **Backend Output Audit**
   - Instrument or log `dashboardData` in `deep-research-routes.ts` to compare persisted metadata with API output.
   - Validate that `researchSourceRepository.getById` returns metadata containing the fields the UI wants (e.g., `metadata.crawlProgress.totalPagesCrawled`).
3. **API Response Snapshot**
   - Use `bun run dev:server` and issue a `GET /api/research/sources/{id}/dashboard` request against a seeded record to capture the raw JSON.
   - Cross-reference with the UI's expected shape (observe the browser network panel or inspect hook typing in `useSourceDashboard`).
4. **Client Expectation Review**
   - Trace `useSourceDashboard` hook definition to see the typed response and caching keys.
   - Note all destructured fields in `SourceDashboardPage` (`metadata`, `crawlStatus`, `errorMessage`, etc.) and list which ones come from the server vs. which are UI-only derived.
5. **Cross-route Consistency**
   - Ensure `/api/research/sources/{id}/links` and `/api/research/sources/{id}/crawl-status` share terminology with the dashboard response to avoid future drift.
6. **Crawling Route Alignment**
   - Review `packages/server/src/routes/crawling-routes.ts` for how crawl stats are calculated; confirm we can derive `pagesCrawled`, `tokenCount`, error counts, etc., from the same underlying data so the dashboard reflects reality.

## Remediation Strategy Outline

- **Decide on Truth Source**
  - Adopt the schema (if accurate) as the authoritative contract. Update either server output or client consumption to respect it—avoid duplicating transformations in both layers.
- **Server Adjustments (if schema expects metadata)**
  - Update `/api/research/sources/{id}/dashboard` to include a `metadata` object with the fields the UI expects (`tokenCount`, `pagesCrawled`, `linksDiscovered`, `lastCrawlTime`, `totalRequests`, `successfulRequests`, `errorCount`, etc.).
  - Populate `metadata` by mapping from existing nested stats (`tokenStats`, `crawlProgress`, `performanceStats`, `errors`).
  - Keep richer nested structures (tokenStats, performanceStats) if useful, but ensure backward compatibility for the current UI or update the UI accordingly.
- **Client Adjustments (if adopting new structure)**
  - Refactor `SourceDashboardPage` to consume the authoritative structure (e.g., use `dashboard.data.tokenStats.totalTokens` instead of `metadata.tokenCount`).
  - Safely handle undefined fields and display loading placeholders or warnings when the server lacks data.
  - Update derived UI strings (button labels, success bar) to reference new fields.
- **Shared Types**
  - Update `useSourceDashboard` hook typings to leverage `SourceDashboardResponseSchema` inference so shape drift triggers compile errors.
  - Consider exporting helper selectors to avoid manual property picking inside the component.
- **Data Accuracy Enhancements**
  - Ensure link counts and error totals derive from canonical repositories (`researchProcessedDataRepository`, crawl artifacts) rather than stale metadata when possible.
  - If metadata is the only source, document update cadence and ensure crawl jobs persist fresh numbers.

## Validation & QA Plan

- **Automated Tests**
  - Add unit tests for the dashboard route handler to assert the presence of `metadata` (or new structure) and correct value mapping.
  - If feasible, add a service-level test covering the metadata persistence when a crawl completes.
- **Frontend Verification**
  - Run `bun run dev:client` and manually verify the dashboard with real or mocked data; confirm metrics, status badge, and success bar now display accurate values.
  - Validate the tab navigation (overview, links, content, errors) still works and respects updated data shapes.
- **Regression Checks**
  - Verify other routes (`/crawl-status`, `/crawl-results`, `/links`) remain compatible and that any shared schemas compile.
  - Run `bun run validate` to ensure lint, type, and tests pass.

## Deliverables & Next Steps

- Finalize the data contract decision (server vs. client adjustment) with the team if needed.
- Implement the chosen remediation path and add accompanying tests.
- Document the canonical dashboard data shape for future contributors (README or dev docs update).
- After implementation, request a `staff-engineer-code-reviewer` agent review per repository guidelines.
