# Internal gRPC Contract Split (Draft)

## Purpose
Define the internal gRPC service boundaries after decomposing draft `services/service`.

## Service Definitions

### DocumentWorkflowService (document-service)
- CreateDraft(CreateDraftRequest) returns (Document)
- UpdateDraft(UpdateDraftRequest) returns (Document)
- GetDocument(GetDocumentRequest) returns (Document)
- SubmitWorkflow(SubmitWorkflowRequest) returns (WorkflowState)
- ApproveWorkflow(ApproveWorkflowRequest) returns (WorkflowState)
- RequestWorkflowChanges(RequestWorkflowChangesRequest) returns (WorkflowState)
- ArchiveDocument(ArchiveDocumentRequest) returns (ArchiveResult)

### AuthorizationAuditService (authorization-audit-service)
- CheckPermission(CheckPermissionRequest) returns (CheckPermissionResponse)
- AuthorizeTransition(AuthorizeTransitionRequest) returns (AuthorizeTransitionResponse)
- AppendAuditEvent(AppendAuditEventRequest) returns (AppendAuditEventResponse)
- GetAuditEvents(GetAuditEventsRequest) returns (GetAuditEventsResponse)

### SignatureService (signature-service)
- StartSignature(StartSignatureRequest) returns (SignatureRequest)
- RecordSignatureCallback(RecordSignatureCallbackRequest) returns (SignatureRequest)
- GetSignatureStatus(GetSignatureStatusRequest) returns (SignatureRequest)

### SearchNotificationService (search-notification-service)
- SyncSearchProjection(SyncSearchProjectionRequest) returns (SyncSearchProjectionResponse)
- SearchDocuments(SearchDocumentsRequest) returns (SearchDocumentsResponse)
- EmitNotification(EmitNotificationRequest) returns (EmitNotificationResponse)
- RetryFailedNotifications(RetryFailedNotificationsRequest) returns (RetryFailedNotificationsResponse)

## Shared Message Rules
- All mutating RPCs include `actor_user_id` for traceability.
- Domain identifiers remain UUID-formatted strings.
- Mutations with state transitions include `expected_version` where conflict safety is required.
- Error categories align with gateway mapping: validation, denied, not-found, conflict, transient.

## Versioning and Migration Rules
- Proto definitions remain in `shared/proto/service.proto` as source of truth.
- Additive field evolution is default.
- Breaking change requires explicit versioned RPC/message strategy and consumer migration plan.
- During migration waves, gateway adapters may temporarily support old and new provider contracts behind one route contract.

## Ownership Constraints
- Each RPC has one owning producer microservice.
- Cross-service RPC calls must avoid cyclical dependency chains.
- Service teams own contract compatibility for their produced RPCs.

## Producer Ownership Matrix

| RPC Group | Producer | Compatibility Mode |
|-----------|----------|--------------------|
| CreateDraft/UpdateDraft/GetDocument/SearchDocuments/SubmitWorkflow/ApproveWorkflow/RequestWorkflowChanges/ArchiveDocument | `document-service` | Additive-only during migration |
| CheckPermission/AuthorizeTransition/AppendAuditEvent/GetAuditEvents | `authorization-audit-service` | Additive-only during migration |
| StartSignature/RecordSignatureCallback/GetSignatureStatus | `signature-service` | Additive-only during migration |
| SyncSearchProjection/SearchDocuments/EmitNotification/RetryFailedNotifications | `search-notification-service` | Additive-only during migration |

## Final Versioning Guardrails

- Each producer MUST publish contract owner and change window before any non-additive change.
- Breaking changes are forbidden during active migration waves.
- Deprecated RPCs are removed only after decommission gates pass and consumers are fully migrated.
