# Internal gRPC Contract Outline (Draft)

## Purpose
Define internal service interfaces between gateway-facing orchestration and Go microservices.

## Services

### DocumentService
- CreateDraft(CreateDraftRequest) returns (Document)
- UpdateDraft(UpdateDraftRequest) returns (Document)
- GetDocument(GetDocumentRequest) returns (Document)
- SearchDocuments(SearchDocumentsRequest) returns (SearchDocumentsResponse)
- ArchiveDocument(ArchiveDocumentRequest) returns (ArchiveDocumentResponse)

### WorkflowService
- StartWorkflow(StartWorkflowRequest) returns (WorkflowInstance)
- ApproveStep(ApproveStepRequest) returns (WorkflowInstance)
- RejectStep(RejectStepRequest) returns (WorkflowInstance)
- RequestChanges(RequestChangesRequest) returns (WorkflowInstance)

### SignatureService
- StartSignature(StartSignatureRequest) returns (SignatureRequest)
- RecordSignatureCallback(RecordSignatureCallbackRequest) returns (SignatureRequest)
- GetSignatureStatus(GetSignatureStatusRequest) returns (SignatureRequest)

### AuthorizationService
- CheckPermission(CheckPermissionRequest) returns (CheckPermissionResponse)
- AssignRole(AssignRoleRequest) returns (AssignRoleResponse)
- RevokeRole(RevokeRoleRequest) returns (RevokeRoleResponse)

### AuditService
- AppendAuditEvent(AppendAuditEventRequest) returns (AppendAuditEventResponse)
- GetAuditEvents(GetAuditEventsRequest) returns (GetAuditEventsResponse)

### NotificationService
- EmitNotification(EmitNotificationRequest) returns (EmitNotificationResponse)
- RetryFailedNotifications(RetryFailedNotificationsRequest) returns (RetryFailedNotificationsResponse)

## Shared Message Concerns
- All write operations include `actor_user_id` for traceability.
- All domain IDs are UUID strings.
- Mutations include optimistic concurrency fields where applicable (`expected_version`).
- Error model supports denied/validation/not-found/conflict/transient categories.

## Versioning Rules
- New fields are additive and optional by default.
- Breaking changes require new RPC or message version suffix.
- Proto definitions are maintained under `shared/proto/` as source of truth.

## API-gRPC Alignment Notes

### Route-to-RPC Mapping (Current)
- `POST /api/documents` -> `DocumentService.CreateDraft`
- `GET /api/documents` -> `DocumentService.SearchDocuments`
- `POST /api/documents/{documentId}/workflow/submit` -> `WorkflowService.StartWorkflow`
- `POST /api/documents/{documentId}/workflow/approve` -> `WorkflowService.ApproveStep`
- `POST /api/documents/{documentId}/signatures` -> `SignatureService.StartSignature`
- `GET /api/documents/{documentId}/signatures/status` -> `SignatureService.GetSignatureStatus`
- `POST /api/documents/signatures/{signatureRequestId}/callback` -> `SignatureService.RecordSignatureCallback`
- `GET /api/documents/{documentId}/audit-events` -> `AuditService.GetAuditEvents`
- `GET /api/search/documents` -> `DocumentService.SearchDocuments` + search projection adapter
- `GET /api/search/notifications/center` -> `NotificationService.EmitNotification/RetryFailedNotifications` read model

### Field-Level Conventions
- Gateway `documentId` maps to gRPC `document_id`.
- Gateway `expectedVersion` maps to gRPC `expected_version`.
- Gateway signer list `userId|dueAt` maps to gRPC `SignatureSigner.user_id|due_at`.
- Gateway callback `status|providerRef` maps to gRPC `status|provider_ref`.

### Error/Status Mapping
- Validation failures: HTTP `400` <-> gRPC `INVALID_ARGUMENT`.
- Authentication/authorization failures: HTTP `401/403` <-> gRPC `UNAUTHENTICATED/PERMISSION_DENIED`.
- Not found: HTTP `404` <-> gRPC `NOT_FOUND`.
- Version conflict: HTTP `409` <-> gRPC `ABORTED`.
- Transient integration failures: HTTP `503` <-> gRPC `UNAVAILABLE`.

### Drift Controls
- `shared/proto/service.proto` remains the source of truth for service contracts.
- `shared/openapi/openapi.yaml` mirrors public gateway routes and payloads.
- Any new gateway endpoint must include explicit mapping entry in this file.
