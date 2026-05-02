# Contract: Internal Editor and Export Workflow

## Internal Boundaries

### Frontend -> Gateway
- Requests control profile at editor open.
- Sends structured content document and expectedVersion for updates.
- Initiates export requests with target format and sourceVersion.

### Gateway -> Document Service
- CreateDraft / UpdateDraft / GetDocument for editor lifecycle.
- Optimistic locking enforced with expectedVersion.

### Gateway -> Export Processing Service (or document-service export module)
- Submit export job with:
  - documentId
  - sourceVersion
  - targetFormat
  - actorUserId
- Receive asynchronous completion status.

### Gateway -> Authorization/Audit Service
- Append audit events for:
  - DOCUMENT_CREATE
  - DOCUMENT_EDIT
  - DOCUMENT_EXPORT_REQUESTED
  - DOCUMENT_EXPORT_SUCCEEDED
  - DOCUMENT_EXPORT_FAILED

## Status and Idempotency Rules
- Export request creation should be idempotent by (documentId, sourceVersion, targetFormat, actorUserId, time-window key).
- Duplicate requests may return existing queued/running request id.
- Failed export requests may be retried and produce new request ids or re-queued status by policy.

## Failure Semantics
- Content validation failures for export return actionable error codes.
- External library runtime failures are captured as FAILED with retry-eligible marker.
- Draft content remains unchanged on export failures.
