# Document Approval Workflow Implementation Plan

## Objective

Implement a persisted, authorized document approval lifecycle across PostgreSQL, `document-service`, gRPC, Gateway REST APIs, notifications, activity history, search, and Angular.

This plan depends on trusted organization membership and approver-role enforcement from `RBAC_TASK_ASSIGNMENT_PLAN.md`.

## Initial Workflow Scope

Implement a single-approver workflow first:

```text
DRAFT -> IN_REVIEW -> APPROVED -> ARCHIVED
                    -> CHANGES_REQUESTED -> IN_REVIEW
```

Rules:

- `DRAFT` and `CHANGES_REQUESTED` are editable.
- `IN_REVIEW`, `APPROVED`, and `ARCHIVED` are read-only.
- Resubmission from `CHANGES_REQUESTED` creates a new submitted version.
- Every transition uses optimistic concurrency.
- Every decision is persisted and auditable.

## Phase 1: Make Document Status a Domain Invariant

1. Add `Status DocumentStatus` to `model.Document`.
2. Add status to `model.DocumentVersion`.
3. Add `CHANGES_REQUESTED` to `DocumentStatus`.
4. Add status to:
   - protobuf `Document`
   - protobuf `DocumentVersion`
   - shared TypeScript types
   - OpenAPI schemas
   - frontend document models
5. Read and write `documents.status` in every document repository query.
6. Store status in each version snapshot.
7. Reject draft updates unless status is `DRAFT` or `CHANGES_REQUESTED`.
8. Include status in search results and projections.

Primary files:

- `services/document-service/internal/domain/model/document.go`
- `services/document-service/internal/ports/outbound/document_repository.go`
- `services/document-service/internal/adapters/outbound/postgres/document_repository.go`
- `services/document-service/internal/adapters/outbound/postgres/document_version_repository.go`
- `shared/proto/service.proto`
- `shared/openapi/openapi.yaml`
- `shared/ts-types/src/index.ts`
- `apps/frontend/src/app/domain/dashboard/dashboard.models.ts`

## Phase 2: Persist Workflow State and History

Add a migration for:

```sql
CREATE TABLE document_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,
    submitted_version BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    submitted_by_user_id TEXT NOT NULL,
    approver_user_id TEXT NOT NULL,
    decision_comment TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_workflow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES document_workflows(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    actor_user_id TEXT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    previous_status VARCHAR(32) NOT NULL,
    new_status VARCHAR(32) NOT NULL,
    document_version BIGINT NOT NULL,
    comment TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Additional requirements:

1. Allow only one active workflow per document.
2. Index workflow by document, approver, status, and submission time.
3. Keep workflow events append-only.
4. Use a transaction to update document status, workflow state, and workflow event.
5. Do not mutate historical workflow events.

## Phase 3: Domain and Application Services

Add a dedicated workflow application service rather than embedding transitions in the gRPC handler.

Suggested operations:

- `SubmitWorkflow`
- `ApproveWorkflow`
- `RequestWorkflowChanges`
- `ArchiveDocument`
- `GetWorkflow`
- `ListWorkflowEvents`

Suggested domain rules:

### Submit

- Actor is document owner or `edms.admin`.
- Document status is `DRAFT` or `CHANGES_REQUESTED`.
- Expected version equals the current document version.
- Approver belongs to the same organization.
- Approver holds `edms.approver`, unless covered by an explicit admin policy.
- Approver must not equal the owner unless explicitly permitted.
- Submitted version is stored on the workflow.
- Document status becomes `IN_REVIEW`.

### Approve

- Actor is the designated approver or `edms.admin`.
- Document status is `IN_REVIEW`.
- Expected version equals both current and submitted version.
- Workflow status becomes `APPROVED`.
- Document status becomes `APPROVED`.

### Request changes

- Actor is the designated approver or `edms.admin`.
- Document status is `IN_REVIEW`.
- A non-empty comment is mandatory.
- Workflow status becomes `CHANGES_REQUESTED`.
- Document status becomes `CHANGES_REQUESTED`.
- Editing is enabled again.

### Resubmit

- Actor is the document owner or `edms.admin`.
- Document is in `CHANGES_REQUESTED`.
- Expected version is current.
- Workflow stores the new submitted version.
- Status returns to `IN_REVIEW`.

### Archive

- Actor is the document owner or `edms.admin`.
- Document status is `APPROVED`.
- Expected version is current.
- Document status becomes `ARCHIVED`.

## Phase 4: Repository Ports and PostgreSQL Adapter

1. Add a `DocumentWorkflowRepository` outbound port.
2. Add repository methods to:
   - lock a document for workflow transition
   - create or update an active workflow
   - get active workflow by document
   - append a workflow event
   - list workflow events
   - update document status with expected-version protection
3. Ensure every transition is a single PostgreSQL transaction.
4. Return typed domain errors:
   - document not found
   - workflow not found
   - invalid transition
   - version conflict
   - actor forbidden
   - approver invalid
   - decision comment required
5. Map typed errors to stable gRPC status codes.

## Phase 5: Contract Correction

Keep workflow operations on `DocumentWorkflowService`.

Recommended protobuf changes:

```proto
message SubmitWorkflowRequest {
  string actor_user_id = 1;
  string document_id = 2;
  string approver_user_id = 3;
  int64 expected_version = 4;
}

message ApproveWorkflowRequest {
  string actor_user_id = 1;
  string document_id = 2;
  int64 expected_version = 3;
  string comment = 4;
}

message RequestWorkflowChangesRequest {
  string actor_user_id = 1;
  string document_id = 2;
  string comment = 3;
  int64 expected_version = 4;
}

message WorkflowInstance {
  string id = 1;
  string document_id = 2;
  int64 submitted_version = 3;
  string status = 4;
  string submitted_by_user_id = 5;
  string approver_user_id = 6;
  string decision_comment = 7;
  string submitted_at = 8;
  string decided_at = 9;
  string updated_at = 10;
}
```

Add query RPCs:

```proto
rpc GetWorkflow(GetWorkflowRequest) returns (WorkflowInstance);
rpc ListWorkflowEvents(ListWorkflowEventsRequest)
    returns (ListWorkflowEventsResponse);
```

Contract cleanup:

1. Deprecate or remove the duplicate unused `WorkflowService`.
2. Deprecate or remove the duplicate `DocumentService`.
3. Keep `DocumentWorkflowService` as the active document contract.
4. Regenerate Go protobuf stubs after the proto change.
5. Update Gateway dynamic clients to match the final contract.

## Phase 6: Gateway REST API

Implement:

```http
POST /api/documents/{documentId}/workflow/submit
{
  "approverId": "user-id",
  "expectedVersion": 4
}
```

```http
POST /api/documents/{documentId}/workflow/approve
{
  "expectedVersion": 4,
  "comment": "Optional approval comment"
}
```

```http
POST /api/documents/{documentId}/workflow/request-changes
{
  "expectedVersion": 4,
  "comment": "Required correction reason"
}
```

```http
POST /api/documents/{documentId}/archive
{
  "expectedVersion": 4
}
```

```http
GET /api/documents/{documentId}/workflow
GET /api/documents/{documentId}/workflow/events
```

Gateway requirements:

1. Keep `edmsRbacGuard` as a coarse role check.
2. Forward the trusted session actor to gRPC.
3. Let `document-service` enforce owner, organization, and designated-approver rules.
4. Map:
   - `InvalidArgument` -> `400`
   - `Unauthenticated` -> `401`
   - `PermissionDenied` -> `403`
   - `NotFound` -> `404`
   - `FailedPrecondition` -> `409`
   - `Aborted` -> `409 VERSION_CONFLICT`
5. Return the updated document and workflow state after every transition.

## Phase 7: Activity, Search, and Notifications

For each successful workflow transition:

1. Append a workflow event.
2. Append an activity event.
3. Synchronize the document search projection.
4. Create a notification.

Required activity actions:

- `DOCUMENT_SUBMITTED`
- `DOCUMENT_APPROVED`
- `DOCUMENT_CHANGES_REQUESTED`
- `DOCUMENT_RESUBMITTED`
- `DOCUMENT_ARCHIVED`

Notification recipients:

| Event | Recipient |
|---|---|
| Submitted | Designated approver |
| Changes requested | Document owner |
| Resubmitted | Designated approver |
| Approved | Document owner |
| Archived | Optional owner confirmation |

Activity and workflow metadata should include:

- actor user ID
- previous status
- new status
- submitted/current version
- approver user ID
- decision comment where applicable

## Phase 8: Frontend Integration

### Models and adapters

1. Add document status to list, preview, and editable document models.
2. Add workflow and workflow-event models.
3. Add API port and adapter methods for every workflow operation.
4. Load effective document capabilities from the backend.

### Document list

1. Show localized status chips.
2. Allow filtering by workflow status.
3. Show the current approver where relevant.
4. Route approved documents to archive actions.

### Document editor

1. Show current status and submitted version.
2. Add “Отправить на согласование”.
3. Require approver selection during submission.
4. Disable editing for `IN_REVIEW`, `APPROVED`, and `ARCHIVED`.
5. Keep export available according to the chosen product policy.
6. Warn about unsaved changes before submission.

### Approver experience

1. Show “Согласовать” only when `canApprove` is true.
2. Show “Вернуть на доработку” only when allowed.
3. Require a correction comment.
4. Display document content and submitted version read-only.

### Workflow history

1. Show submission and decision history.
2. Display actor, timestamp, transition, version, and comment.
3. Keep history readable on mobile and with long localized text.

### Archive

1. Replace the archive placeholder.
2. List archived documents from the real API.
3. Allow archive only for approved documents and authorized actors.
4. Keep archived documents read-only.

## OpenAPI and Shared Types

1. Define request and response schemas for every workflow endpoint.
2. Add status enums:
   - `DRAFT`
   - `IN_REVIEW`
   - `CHANGES_REQUESTED`
   - `APPROVED`
   - `ARCHIVED`
3. Add workflow capability fields:
   - `canEdit`
   - `canSubmit`
   - `canApprove`
   - `canRequestChanges`
   - `canArchive`
4. Ensure OpenAPI, protobuf, shared TypeScript types, Gateway mappings, and Angular models use the same names and status values.

## Acceptance Criteria

- Document status is persisted and returned by every document read operation.
- Only editable statuses permit document changes.
- Submission locks the exact current document version.
- Concurrent submission or decision attempts return `409`.
- Only the owner or admin can submit.
- Only the designated approver or admin can decide.
- Approver role and organization membership are verified server-side.
- Requesting changes requires and persists a comment.
- The owner can edit and resubmit after changes are requested.
- Approved documents cannot be edited.
- Only approved documents can be archived.
- Every transition appears in workflow history and activity history.
- Search results reflect the current document status.
- Notifications reach the correct recipient.
- Workflow state survives application and database restarts.
- Status and permissions are consistent across PostgreSQL, gRPC, REST, shared types, and Angular.

## Delivery Order

1. Document status domain and repository support.
2. Workflow database migration.
3. Workflow repository port and PostgreSQL adapter.
4. Workflow application service and transition policy.
5. Protobuf changes and generated stubs.
6. gRPC handler implementation.
7. Gateway REST routes and error mapping.
8. Activity, search, and notification side effects.
9. Frontend models and API adapters.
10. Document editor, approver actions, history, and archive UI.
11. Contract and legacy proto cleanup.

