# Data Model: Configurable Document Editor and Export

## Entity: DocumentDraft
- Description: Persisted editable document state.
- Fields:
  - id (uuid)
  - title (string, required, max 300)
  - category (enum: HR | FINANCE | GENERAL)
  - contentDocument (structured rich content payload)
  - status (enum: DRAFT | IN_REVIEW | APPROVED | ARCHIVED)
  - version (int, optimistic locking)
  - ownerUserId (string)
  - updatedAt (timestamp)
  - createdAt (timestamp)
- Relationships:
  - 1:N with ExportRequest
  - N:1 with EditorControlProfile via context resolution key

## Entity: EditorControlProfile
- Description: Configurable control set for editor contexts.
- Fields:
  - id (uuid)
  - contextType (enum: CATEGORY | TEMPLATE)
  - contextKey (string)
  - enabledControls (array<string>)
  - disabledControls (array<string>)
  - isActive (bool)
  - updatedByUserId (string)
  - updatedAt (timestamp)
- Validation:
  - enabledControls and disabledControls must be disjoint.
  - profile must have at least one enabled control.

## Entity: ExportRequest
- Description: Export operation request lifecycle.
- Fields:
  - id (uuid)
  - documentId (uuid, required)
  - requestedByUserId (string)
  - targetFormat (enum: PDF | DOCX)
  - sourceVersion (int, required)
  - status (enum: QUEUED | RUNNING | SUCCEEDED | FAILED)
  - errorCode (string, nullable)
  - errorMessage (string, nullable)
  - artifactId (uuid, nullable)
  - createdAt (timestamp)
  - updatedAt (timestamp)
- State transitions:
  - QUEUED -> RUNNING -> SUCCEEDED
  - QUEUED -> RUNNING -> FAILED
  - FAILED -> QUEUED (retry)

## Entity: ExportArtifact
- Description: Downloadable generated file metadata.
- Fields:
  - id (uuid)
  - exportRequestId (uuid)
  - documentId (uuid)
  - format (enum: PDF | DOCX)
  - storageKey (string)
  - fileName (string)
  - mimeType (string)
  - sizeBytes (int)
  - checksum (string)
  - createdAt (timestamp)

## Entity: ExportEventLog
- Description: Audit events related to create/edit/export.
- Fields:
  - id (uuid)
  - actorUserId (string)
  - actionType (string)
  - targetId (string)
  - outcome (enum: SUCCESS | FAILED | DENIED)
  - metadata (json)
  - occurredAt (timestamp)

## Integrity Rules
- ExportRequest.sourceVersion must match existing DocumentDraft version at request time.
- Failed exports must not mutate DocumentDraft content/version.
- Download links are available only for SUCCEEDED export requests.
