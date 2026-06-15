# Document Approval Workflow Gaps

## Summary

The current implementation still does not satisfy the full approval-workflow plan. Workflow transition RPCs, transactional workflow persistence, and document-level organization authorization are now implemented, while contract expansion, workflow queries, and the remaining REST/UI surface are still outstanding.

## Critical Gaps

1. ~~Workflow RPCs are unimplemented.~~ **Completed.**
   `DocumentHandler` now implements `SubmitWorkflow`, `ApproveWorkflow`, `RequestWorkflowChanges`, and `ArchiveDocument` through a dedicated workflow application service. Transitions update document status atomically, validate allowed source states, enforce optimistic concurrency where the current RPC contract supplies `expected_version`, and no longer fall back to gRPC `UNIMPLEMENTED`.

2. ~~Workflow persistence is missing.~~ **Completed.**
   `document_workflows` and append-only `document_workflow_events` are now created by the migration, fresh-database initialization, and startup schema guard. A dedicated workflow repository locks the document and workflow rows, validates state and version, updates document and workflow status, and appends the audit event in one PostgreSQL transaction.

3. ~~Document authorization is incomplete.~~ **Completed.**
   Documents now persist `organization_id`. Read paths validate same-organization access, draft updates remain owner-scoped, and workflow transitions also require document access inside the PostgreSQL transaction.

4. ~~Document status is only partially modeled.~~ **Completed.**
   Document status is now persisted and read on every PostgreSQL document path, captured in document-version snapshots, and returned by create, update, get, search, list-version, and get-version gRPC operations. The protobuf, OpenAPI, shared TypeScript, and frontend document contracts expose the same workflow status values.

## High-Priority Gaps

1. ~~Contract mismatch.~~ **Completed.**
   `SubmitWorkflowRequest` now carries `approver_user_id` and `expected_version`. `WorkflowInstance` now exposes submitted version, submitter, approver, decision comment, and decision/submission timestamps. `GetWorkflow` and `ListWorkflowEvents` RPCs are implemented and backed by persisted PostgreSQL reads with document access checks.

2. ~~REST API surface is incomplete.~~ **Completed.**
   The gateway now exposes `POST /api/documents/{documentId}/workflow/request-changes`, `POST /api/documents/{documentId}/archive`, `GET /api/documents/{documentId}/workflow`, and `GET /api/documents/{documentId}/workflow/events`, with request validation, gRPC forwarding, response mapping, RBAC guards, OpenAPI coverage, and shared TypeScript contract updates.

3. ~~Notifications target the wrong recipients.~~ **Completed.**
   Workflow submit notifications now target the designated approver, while approve and request-changes notifications target the document submitter/owner based on workflow response data instead of the acting gateway user.

4. ~~OpenAPI export status is inconsistent.~~ **Completed.**
   `ExportRequestStatus` now uses the export lifecycle values `QUEUED`, `RUNNING`, `SUCCEEDED`, and `FAILED`, aligned with the document-service domain model and shared TypeScript contract.

5. ~~Frontend workflow UI is mostly absent.~~ **Completed.**
   The frontend document layer now models workflow instances and events, calls submit/approve/request-changes/archive endpoints, renders approver selection and workflow actions on the edit screen, shows persisted workflow history, and replaces the archive placeholder with a real archived-documents view.

## Current Fix Slice

Completed workflow foundation:

- persist document status in PostgreSQL reads and writes
- persist document-version status snapshots
- block draft updates when the document is not editable
- persist workflow state and append-only transition history transactionally
- persist document organization ownership and enforce same-organization/owner access rules

## Remaining Work

1. Add activity and search side effects tied to workflow transitions.
2. Frontend workflow state, actions, history, and archive UI are now implemented.
