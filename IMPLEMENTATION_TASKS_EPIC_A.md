# Epic A — Complete Missing Service Backends

## A1. Register SearchNotification gRPC service in server bootstrap
- Priority: P0
- Scope:
  - Wire service registrar(s) in `services/search-notification-service/internal/adapters/inbound/grpc/server.go` usage.
  - Ensure `SearchDocuments`, `EmitNotification`, `RetryFailedNotifications`, `SyncSearchProjection` are reachable.
- Deliverable:
  - Running `search-notification-service` exposes actual gRPC methods (not empty registration set).

## A2. Implement SearchNotification business logic + storage integration
- Priority: P0
- Scope:
  - Add application/service layer for search projection sync and notification emission/retry.
  - Add outbound adapter(s) for Elasticsearch and notification persistence/delivery status.
- Deliverable:
  - Gateway `/api/search/documents` returns real indexed results.
  - Notification retry path operates on failed items.

## A3. Register Signature gRPC service in server bootstrap
- Priority: P0
- Scope:
  - Wire service registrar(s) in `services/signature-service/internal/adapters/inbound/grpc/server.go` usage.
  - Ensure `StartSignature`, `GetSignatureStatus`, `RecordSignatureCallback` are reachable.
- Deliverable:
  - Running `signature-service` exposes proto-defined gRPC methods.

## A4. Implement full signature workflow state machine
- Priority: P0
- Scope:
  - Replace compatibility/stub callback logic with domain states and transitions.
  - Persist signature requests and signer progress.
  - Handle callback idempotency and provider reference reconciliation.
- Deliverable:
  - End-to-end signature lifecycle works via Gateway routes.
