# Contract: Gateway Editor and Export API

## Scope
Public gateway-facing API contract additions for rich-editor config and export workflows.

## Endpoints

### POST /api/documents
- Purpose: Create draft with rich editor content.
- Request:
  - title (string)
  - category (HR | FINANCE | GENERAL)
  - contentDocument (object)
- Responses:
  - 201: created draft response with id/version
  - 400: validation error
  - 401/403: auth/permission errors

### PATCH /api/documents/{documentId}
- Purpose: Update draft content/metadata.
- Request:
  - title (string)
  - contentDocument (object)
  - expectedVersion (integer)
- Responses:
  - 200: updated document response
  - 409: version conflict
  - 404: not found

### GET /api/editor-control-profiles/{contextType}/{contextKey}
- Purpose: Resolve effective control profile for editor session.
- Responses:
  - 200: profile payload
  - 404: profile not found (fallback policy controlled by backend)

### PUT /api/editor-control-profiles/{profileId}
- Purpose: Update control profile (admin/operator only).
- Request:
  - enabledControls (array<string>)
  - disabledControls (array<string>)
  - isActive (bool)
- Responses:
  - 200: updated profile
  - 400: invalid profile config
  - 401/403: auth/permission errors

### POST /api/documents/{documentId}/exports
- Purpose: Start export request for PDF or DOCX.
- Request:
  - format (PDF | DOCX)
  - sourceVersion (integer)
- Responses:
  - 202: queued export request
  - 409: stale version
  - 422: unsupported content for selected format

### GET /api/documents/{documentId}/exports/{exportRequestId}
- Purpose: Check export status and artifact availability.
- Responses:
  - 200: status payload (QUEUED/RUNNING/SUCCEEDED/FAILED)

### GET /api/documents/{documentId}/exports/{exportRequestId}/download
- Purpose: Download generated export artifact.
- Responses:
  - 200: file stream
  - 409: export not complete
  - 404: artifact missing

## Error Envelope
- error (string)
- code (string)
- details (object, optional)
