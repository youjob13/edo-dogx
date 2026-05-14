# Epic B — Close Gateway/API Gaps

## B1. Implement missing task endpoints used by frontend
- Priority: P0
- Scope:
  - Add `PATCH /api/tasks/:taskId` (assignee update).
  - Add `POST /api/tasks/:taskId/comments`.
  - Map to task orchestration RPC or extend proto/service where required.
- Deliverable:
  - Frontend task assign/comment actions stop failing due to missing routes.

## B2. Implement real notification center read API
- Priority: P1
- Scope:
  - Replace current emit-based workaround in `/api/search/notifications/center`.
  - Add real read/query model for recipient notifications.
- Deliverable:
  - Notification center returns actual notifications list with paging/filtering.

## B3. Align OpenAPI with actual runtime behavior
- Priority: P1
- Scope:
  - Reconcile `shared/openapi/openapi.yaml` with implemented routes and payloads.
  - Either implement missing operations or remove/mark deprecated spec paths.
- Deliverable:
  - Contract reflects real API behavior with no major drift.
