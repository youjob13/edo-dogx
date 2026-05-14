# Epic C — Deepen Task Business Logic

## C1. Implement non-placeholder available approvers/documents
- Priority: P0
- Scope:
  - Implement `GetAvailableApprovers` and `GetAvailableDocuments` in task orchestration handler using repositories.
  - Apply board/organization/document status constraints.
- Deliverable:
  - Task creation modal receives real dynamic approvers/documents.

## C2. Implement permission checks and transition policy
- Priority: P0
- Scope:
  - Enforce role-based permissions for task CRUD/status transitions.
  - Validate approval transitions and approver-only actions.
- Deliverable:
  - Unauthorized task operations are rejected deterministically.

## C3. Add task collaboration audit capabilities
- Priority: P1
- Scope:
  - Add task comments persistence and retrieval.
  - Add assignment/status decision audit trail.
- Deliverable:
  - Task details page has reliable collaboration history.
