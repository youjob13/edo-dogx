# Quickstart: Configurable Document Editor and Export

## Prerequisites
1. Install dependencies from repository root:
   - `pnpm install`
2. Ensure environment file is configured.
3. Start local stack:
   - `pnpm docker:up`

## Run Frontend and Gateway
1. Frontend:
   - `cd apps/frontend && pnpm dev`
2. Gateway:
   - `cd apps/gateway && pnpm dev`

## Manual Validation Path

### 1) Create and save via rich editor
1. Open document create flow.
2. Verify configured controls are visible.
3. Enter content with headings/list/table/link/image.
4. Save draft and reopen.
5. Confirm content and metadata persisted.

### 2) Control profile behavior
1. Update control profile for a context.
2. Reopen editor in that context.
3. Confirm only allowed controls are available.

### 3) Export PDF
1. Open saved draft.
2. Request export as PDF.
3. Poll/refresh status.
4. Download when succeeded.
5. Confirm readable output and key formatting.

### 4) Export DOCX
1. Request export as DOCX for same draft/version.
2. Download artifact.
3. Confirm structure and core formatting are preserved.

### 5) Failure handling
1. Trigger temporary export failure scenario.
2. Confirm actionable error feedback.
3. Retry export without re-authoring content.
4. Confirm draft content remains unchanged.

## Validation Commands (No Tests)
- `pnpm lint:all`
- `pnpm build:all`
- `go build ./cmd/server` in changed Go services

## Validation Log

### US1 Validation - 2026-05-02
1. Command checks:
   - `pnpm lint:all` passed for frontend and gateway.
   - `pnpm build:all` passed for shared types, frontend, and gateway.
2. T017 journey checks:
   - Create page exposes rich editor with toolbar actions and category-bound profile fetch.
   - Save operation requires title and non-empty rich content payload.
   - Edit page reloads saved content and persists updates with `expectedVersion`.
3. T018 accessibility checks:
   - Toolbar uses semantic `button` controls in keyboard focus order.
   - Rich editor container has explicit `aria-label`.
   - Status messages use `aria-live="polite"` for assistive feedback.
   - Focus-visible styles are defined for toolbar controls in create/edit stylesheets.
4. Notes:
   - Frontend build warnings remain for bundle budget and CommonJS optimization, non-blocking for functional validation.

## Rollback Notes
- Disable new editor/export routes in gateway if critical regression occurs.
- Keep document draft persistence unchanged to avoid data loss.
- Preserve existing create/edit flow as fallback path.
