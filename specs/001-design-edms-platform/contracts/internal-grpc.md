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
