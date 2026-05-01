# Data Model: Scalable EDMS Platform

## Entity: Document
- Description: Primary business artifact under lifecycle control.
- Fields:
  - id (UUID)
  - title (string, required, 1..300)
  - category (enum: HR, FINANCE, GENERAL, required)
  - ownerUserId (string, required)
  - currentStatus (enum: DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, SIGNING, SIGNED, ARCHIVED, required)
  - currentVersionId (UUID, required)
  - archiveState (enum: ACTIVE, ARCHIVED, required)
  - createdAt (timestamp, required)
  - updatedAt (timestamp, required)
- Validation rules:
  - title must not be empty
  - status transitions must follow workflow rules
  - archived documents are read-only

## Entity: DocumentVersion
- Description: Immutable snapshot of document content and metadata revision.
- Fields:
  - id (UUID)
  - documentId (UUID, required)
  - versionNumber (integer, required, >0)
  - storageObjectKey (string, required)
  - checksum (string, required)
  - changedByUserId (string, required)
  - changeSummary (string, optional)
  - createdAt (timestamp, required)
- Validation rules:
  - versionNumber increments by 1 within a document
  - checksum is required for integrity verification

## Entity: WorkflowDefinition
- Description: Configurable route template for document processing.
- Fields:
  - id (UUID)
  - name (string, required)
  - categoryScope (set of categories)
  - steps (ordered list of workflow step definitions)
  - isActive (boolean, required)
  - createdAt (timestamp)
- Validation rules:
  - at least one approval-capable terminal path required
  - each step must define assignee resolution strategy

## Entity: WorkflowInstance
- Description: Runtime execution state for one document against a definition.
- Fields:
  - id (UUID)
  - documentId (UUID, required)
  - workflowDefinitionId (UUID, required)
  - currentStepCode (string, required)
  - assignedUserId (string, optional)
  - status (enum: RUNNING, COMPLETED, REJECTED, CANCELLED)
  - startedAt (timestamp)
  - completedAt (timestamp, optional)
- Validation rules:
  - only one active running instance per document
  - transition requires authorization and valid previous state

## Entity: SignatureRequest
- Description: Multi-party legally binding signing transaction for a document version.
- Fields:
  - id (UUID)
  - documentId (UUID, required)
  - documentVersionId (UUID, required)
  - providerRef (string, optional)
  - status (enum: PENDING, PARTIAL, COMPLETED, FAILED, EXPIRED)
  - dueAt (timestamp, optional)
  - createdByUserId (string, required)
  - createdAt (timestamp)
- Validation rules:
  - cannot start for archived documents without explicit policy override
  - document version cannot change while status is PENDING/PARTIAL

## Entity: SignatureRecord
- Description: Per-signer evidence entry.
- Fields:
  - id (UUID)
  - signatureRequestId (UUID, required)
  - signerUserId (string, required)
  - signerDisplayName (string, required)
  - signedAt (timestamp, optional)
  - outcome (enum: SIGNED, REJECTED, EXPIRED, required)
  - evidenceUri (string, optional)
- Validation rules:
  - one active record per signer per signature request
  - signedAt required when outcome is SIGNED

## Entity: Role
- Description: Permission grouping.
- Fields:
  - id (UUID)
  - code (string, unique)
  - name (string)
  - description (string)

## Entity: PermissionAssignment
- Description: Grants role scopes to user identities.
- Fields:
  - id (UUID)
  - userId (string, required)
  - roleId (UUID, required)
  - categoryScope (set of categories, optional)
  - expiresAt (timestamp, optional)
- Validation rules:
  - assignment uniqueness by (userId, roleId, categoryScope)

## Entity: AuditEvent
- Description: Immutable trace of critical operations.
- Fields:
  - id (UUID)
  - actorUserId (string)
  - actionType (string)
  - targetType (string)
  - targetId (string)
  - outcome (enum: SUCCESS, DENIED, FAILED)
  - metadata (JSON object)
  - occurredAt (timestamp)
- Validation rules:
  - append-only
  - occurredAt always set by server-side clock

## Entity: NotificationEvent
- Description: Event queued for delivery channels.
- Fields:
  - id (UUID)
  - eventType (string)
  - recipientUserId (string)
  - documentId (UUID, optional)
  - payload (JSON object)
  - deliveryStatus (enum: PENDING, SENT, FAILED, RETRYING)
  - createdAt (timestamp)
  - sentAt (timestamp, optional)
- Validation rules:
  - retries capped by policy
  - failed deliveries require reason code in payload metadata

## Entity: SearchDocumentProjection
- Description: Denormalized document projection stored in Elasticsearch for full-text and faceted retrieval.
- Fields:
  - documentId (UUID, required)
  - currentVersionId (UUID, required)
  - title (string, required)
  - category (keyword enum, required)
  - status (keyword enum, required)
  - ownerUserId (keyword, required)
  - searchableContent (text, optional)
  - tags (keyword array, optional)
  - updatedAt (date, required)
  - indexVersion (integer, required)
- Validation rules:
  - documentId is unique within the active index
  - indexVersion increments on projection schema evolution
  - projection updates are idempotent by (documentId, currentVersionId)

## Relationships
- Document 1 -> N DocumentVersion
- Document 1 -> N WorkflowInstance (historical), with max one RUNNING
- WorkflowDefinition 1 -> N WorkflowInstance
- DocumentVersion 1 -> N SignatureRequest
- SignatureRequest 1 -> N SignatureRecord
- User 1 -> N PermissionAssignment
- Role 1 -> N PermissionAssignment
- Document 1 -> N AuditEvent
- Document 1 -> N NotificationEvent
- Document 1 -> 1 SearchDocumentProjection (active projection per document)

## State Transitions
- Document.currentStatus:
  - DRAFT -> IN_REVIEW
  - IN_REVIEW -> CHANGES_REQUESTED | APPROVED
  - CHANGES_REQUESTED -> DRAFT
  - APPROVED -> SIGNING | ARCHIVED
  - SIGNING -> SIGNED | APPROVED (if failed/retry policy)
  - SIGNED -> ARCHIVED
- SignatureRequest.status:
  - PENDING -> PARTIAL | FAILED | EXPIRED
  - PARTIAL -> COMPLETED | FAILED | EXPIRED
  - COMPLETED is terminal
- WorkflowInstance.status:
  - RUNNING -> COMPLETED | REJECTED | CANCELLED
