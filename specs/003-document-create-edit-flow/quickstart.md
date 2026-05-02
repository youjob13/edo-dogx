# Quickstart: Full Document Create/Edit Flow

## Preconditions

1. Install dependencies from repository root:
   - `pnpm install`
2. Ensure `.env` is present with required values.
3. Start local stack:
   - `pnpm docker:up`

## Migration Runbook

### Local run

1. Apply document-service migration:
   - `psql "$DOCUMENT_DB_DSN" -f services/document-service/migrations/001_document_create_edit.sql`
2. Apply authorization-audit-service migration:
   - `psql "$AUTH_AUDIT_DB_DSN" -f services/authorization-audit-service/migrations/001_audit_events.sql`

### Container run

1. Ensure migrations are mounted to service containers.
2. Run migration commands as init/startup hook before serving traffic.
3. Keep migrations additive; do not drop tables/columns during rollout.

## Manual Validation Scenarios

### US1 Create draft

1. Open dashboard documents list.
2. Navigate to create page.
3. Submit valid title/category.
4. Verify success message and returned draft id.

### US2 Edit draft

1. Open existing draft in edit page.
2. Change title and save.
3. Reload edit page.
4. Verify updated values persisted.

### US3 Conflict handling

1. Open same draft in two sessions.
2. Save from session A.
3. Save stale form from session B.
4. Verify HTTP 409 handling and conflict message.

### US4 Reopen and continue

1. Create and edit a draft.
2. End session and reopen later.
3. Open the same draft id.
4. Verify latest state restored.

## Rollback Instructions

1. Disable PATCH update route in gateway by reverting deployment to previous image.
2. Keep additive schema in place; no destructive rollback required.
3. Restore previous frontend build if conflict UX causes regressions.
4. Monitor gateway 5xx and conflict rate after rollback.
