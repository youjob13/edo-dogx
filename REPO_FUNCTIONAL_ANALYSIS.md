# EDO Repo Functional Analysis (Current State)

## 1) What we have done

### Authentication and session
- OAuth2/OIDC login, callback, logout, registration redirect, and `/api/auth/me` are implemented in Gateway.
- Redis-backed session handling is wired.
- Initial organization-member provisioning is triggered after successful auth callback.

### Document management (core lifecycle)
- Document draft creation, update, fetch, and search are implemented end-to-end:
  Frontend -> Gateway -> gRPC -> `document-service` -> Postgres/MinIO.
- Document versions are implemented (list + get version).
- Export flow is implemented (create request, status, download redirect via presigned URL).
- Editor control profile read/update is implemented through document-service RPC.

### Task boards and tasks (main flow)
- Task board creation, list, and board details are implemented via TaskOrchestration gRPC in `document-service`.
- Task creation and status update are implemented.
- Organization members listing and adding board member are implemented.

### Frontend product shell
- SSR Angular app with routed dashboard sections is in place.
- Documents screens (list/create/edit/preview patterns) and tasks boards UI are present.
- Guard rails exist: auth guard + unsaved changes guard.
- Shared contracts (`@edo/types`, OpenAPI, proto) are established and actively used.

## 2) Which functionality is partly implemented

### Search & notification services
- Gateway exposes search/notification routes and gRPC clients.
- `search-notification-service` process starts, but gRPC services are not registered in server bootstrap.
- Notification center route currently triggers `EmitNotification` and returns synthetic `items`, not real notification feed retrieval.

### Signature flow
- Gateway routes and gRPC client exist for signature start/status/callback.
- `signature-service` process starts, but gRPC services are not registered in server bootstrap.
- Signature handler file contains compatibility/stub logic, not full proto service implementation.

### Task orchestration depth
- Core create/update/board endpoints work, but several capabilities are simplified:
  - Available approvers/documents in gRPC handler return empty placeholders.
  - Permissions in task details are hardcoded (`canEdit=true`, etc.).
  - Some frontend actions hit endpoints that are not implemented in Gateway (`PATCH /api/tasks/:id`, `POST /api/tasks/:id/comments`).
  - Approval eligibility in frontend uses TODO placeholder (`current-user-id`).

### Frontend data realism
- Home/dashboard analytics blocks (weekly volume, activity, storage) rely on local mock data.
- Parts of documents/tasks UX are integrated, but some flows still use fallback assumptions.

### Contract and API consistency
- OpenAPI describes a broader set than fully delivered runtime behavior.
- Proto contains legacy/placeholder services (`ExampleService`) and broader method sets than currently active registered servers.

## 3) Which functionality we have to create

### Complete missing service backends
- Register and implement `SearchNotificationService` gRPC server methods in `search-notification-service`.
- Register and implement `SignatureService` gRPC server methods in `signature-service`.
- Replace stub signature callback logic with full business state machine and persistence.

### Close Gateway/API gaps
- Implement missing task HTTP endpoints used by frontend (`task assign`, `comments`) or align frontend to existing API.
- Implement real notification center read API instead of emit-as-read workaround.
- Reconcile OpenAPI with real behavior (or implement missing operations promised by spec).

### Deepen task business logic
- Implement non-placeholder `GetAvailableApprovers` and `GetAvailableDocuments` in task orchestration.
- Implement robust permission checks and role-based transitions for task status/approval.
- Add support for richer task collaboration (comments history, assignment audit, approval decision trace).

### Productization and readiness
- Replace frontend mock metrics/activity/storage with backend-driven endpoints.
- Remove placeholder proto surfaces and keep only owned/active contracts.
- Harden localization consistency (Russian default is mostly present but still has mixed-language UX strings in editor placeholders).

