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

## Validate core scenario B: legally binding signing
1. Open an approved signature-eligible document.
2. Initiate signature request with one or more signers.
3. Simulate/perform signature completion callback.
4. Confirm document becomes locked and signature status is COMPLETED.

Expected:
- Signature evidence and timestamps are recorded.
- Failed or expired signatures do not silently archive documents.

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
