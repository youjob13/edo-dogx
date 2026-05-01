# Quickstart: Scalable EDMS Platform

## Goal
Run the platform locally and validate core EDMS scenarios:
- Document lifecycle
- Signing flow
- RBAC + auditability
- Search + notifications

## Prerequisites
- Docker and Docker Compose
- Node.js/pnpm and Go toolchain (for local non-container workflows)
- Elasticsearch 8.x reachable from gateway/service containers
- Root `.env` configured with at least:
  - `POSTGRES_PASSWORD`
  - `KEYCLOAK_ADMIN_PASSWORD`

## Start infrastructure and applications
1. From repository root:
   - `pnpm docker:up`
2. Wait until services are reachable:
   - Frontend: `http://localhost:4000`
   - Gateway: `http://localhost:3000`
   - Keycloak: `http://localhost:8080`
   - Elasticsearch: `http://localhost:9200`

## Validate core scenario A: internal workflow
1. Log in through frontend.
2. Create a document draft (category GENERAL).
3. Submit for review, then approve through configured users.
4. Confirm status reaches ARCHIVED and document is read-only.

Expected:
- Status transitions are enforced.
- Unauthorized users cannot approve restricted steps.

US1 acceptance checklist:
- [ ] Draft creation returns status `DRAFT` and version `1`.
- [ ] Submit action transitions `DRAFT -> IN_REVIEW`.
- [ ] Approve action transitions `IN_REVIEW -> APPROVED` with optimistic version check.
- [ ] Archive action transitions `APPROVED -> ARCHIVED` only.
- [ ] Search endpoint filters by query/status/category and returns total count.
- [ ] Frontend lifecycle panel reflects status transitions after each action.

## Validate core scenario B: legally binding signing
1. Open an approved signature-eligible document.
2. Initiate signature request with one or more signers.
3. Simulate/perform signature completion callback.
4. Confirm document becomes locked and signature status is COMPLETED.

Expected:
- Signature evidence and timestamps are recorded.
- Failed or expired signatures do not silently archive documents.

US2 acceptance checklist:
- [ ] Signature request start endpoint accepts one or more signers and returns `PENDING`.
- [ ] Signature callback endpoint updates status to `PARTIAL|COMPLETED|FAILED|EXPIRED`.
- [ ] Signature status endpoint returns current provider ref and state for document.
- [ ] Non-eligible document status is rejected by signature orchestration use case.
- [ ] Frontend signature panel can create request and reflect status transitions.

## Validate core scenario C: RBAC and audit trail
1. Attempt approval action using a non-approver role.
2. Repeat with authorized approver role.
3. Open audit timeline for the document.

Expected:
- Denied and successful actions both appear in audit records.
- Audit records include actor, action, target, and timestamp.

## Validate core scenario D: search and notifications
1. Create several documents across HR/FINANCE/GENERAL with different statuses.
2. Search by category + status + keyword.
3. Trigger assignment/approval-required events.

Expected:
- Filtered search returns only matching documents.
- Newly created/updated documents become searchable after indexing sync.
- Notifications are emitted for major lifecycle events.

US5 acceptance checklist:
- [ ] Search endpoint returns results filtered by `q`, `category`, and `status`.
- [ ] Projection sync updates searchable index after document lifecycle changes.
- [ ] Notification center endpoint returns delivery statuses (`PENDING|SENT|FAILED|RETRYING`).
- [ ] Retry dispatcher processes failed notifications using configured batch size.
- [ ] Frontend search and notification center reflects filtered results and event feed.

## Accessibility and responsiveness checks
1. Navigate key pages using keyboard only.
2. Verify focus visibility, semantic labels, and readable contrast.
3. Test mobile and desktop viewports with long titles/content.

Expected:
- Primary interactions are keyboard-accessible.
- Layout remains stable and usable across viewport sizes.

## Notes
- Under current governance, no automated test authoring/execution tasks are included in this plan.
- This quickstart is for implementation validation and manual acceptance checks.

## Implementation Sequencing and Rollback Guidance

### Recommended Sequencing
1. Bring up infra and validate health endpoints.
2. Validate auth/session flow (`/api/auth/*`) before EDMS flows.
3. Validate lifecycle routes, then signature routes, then RBAC/audit checks.
4. Validate category-specific routes and UI flows for `HR` and `FINANCE`.
5. Validate search projection sync and notification center behavior last.

### Rollback Guidance
- If gateway route behavior regresses: rollback gateway deployment first while keeping service state intact.
- If service business logic regresses: rollback service image and re-run smoke checks for lifecycle/signature/audit/search.
- If Elasticsearch projection logic regresses: disable search route exposure and rebuild index from PostgreSQL source-of-truth.
- If notification dispatch regresses: pause retry loop, preserve event queue records, and resume after hotfix.
- For partial rollback scenarios, preserve audit and document state; never rewrite historical audit events.

### Post-Rollback Verification
- Confirm auth/session, document read/search, and audit timeline are still accessible.
- Confirm no unauthorized action is accepted during degraded mode.
- Confirm pending notifications remain retriable after service recovery.
