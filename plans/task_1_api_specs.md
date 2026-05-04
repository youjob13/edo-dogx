# Task Orchestration - API Endpoint Specifications

## Overview
This document specifies the new and modified REST API endpoints required for task orchestration functionality.

## Base URL
All endpoints are under `/api/tasks`

## Authentication
All endpoints require Bearer token authentication with user context.

## New Endpoints

### 1. Create Task
**Endpoint**: `POST /api/tasks`

**Description**: Create a new task with attachments and assign approver.

**Request Body**:
```json
{
  "title": "string (required, 1-100 chars)",
  "description": "string (optional, max 500 chars)",
  "assigneeId": "string (required)",
  "approverId": "string (required for approval tasks)",
  "taskType": "approval | general (default: approval)",
  "attachmentIds": "string[] (optional)",
  "dueDate": "string (ISO date, optional)"
}
```

**Response**: `201 Created`
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "status": "pending",
  "assigneeId": "string",
  "assigneeName": "string",
  "creatorId": "string",
  "creatorName": "string",
  "approverId": "string",
  "approverName": "string",
  "taskType": "string",
  "attachments": "TaskAttachment[]",
  "createdAt": "string",
  "updatedAt": "string"
}
```

**Validation**:
- Title required
- Assignee required
- Approver required for taskType = 'approval'
- All attachment IDs must exist and be accessible

### 2. Update Task Status
**Endpoint**: `PATCH /api/tasks/{id}/status`

**Description**: Update task status (approve/decline or move to review).

**Request Body**:
```json
{
  "status": "in_review | approved | declined",
  "decisionComment": "string (optional for approved, required for declined)"
}
```

**Response**: `200 OK`
```json
{
  "id": "string",
  "status": "string",
  "decision": "approved | declined",
  "decisionComment": "string",
  "updatedAt": "string"
}
```

**Authorization**:
- Only approvers can change status to approved/declined
- Only approvers can move to in_review

### 3. Add Task Attachments
**Endpoint**: `POST /api/tasks/{id}/attachments`

**Description**: Attach additional documents to an existing task.

**Request Body**:
```json
{
  "documentIds": "string[] (required)"
}
```

**Response**: `200 OK`
```json
{
  "attachments": "TaskAttachment[]"
}
```

**Authorization**: Only task creator can add attachments (when status = 'pending')

### 4. Remove Task Attachment
**Endpoint**: `DELETE /api/tasks/{id}/attachments/{documentId}`

**Description**: Remove a document attachment from a task.

**Response**: `204 No Content`

**Authorization**: Only task creator can remove attachments (when status = 'pending')

### 5. Get Available Approvers
**Endpoint**: `GET /api/tasks/available-approvers`

**Description**: Get list of users who can be approvers for tasks.

**Query Parameters**:
- `boardId`: string (optional) - Filter by board
- `search`: string (optional) - Search by name
- `limit`: number (default: 20)

**Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "string",
      "fullName": "string",
      "department": "string",
      "email": "string"
    }
  ],
  "total": "number"
}
```

### 6. Get Available Documents
**Endpoint**: `GET /api/tasks/available-documents`

**Description**: Get list of documents that can be attached to tasks.

**Query Parameters**:
- `boardId`: string (optional)
- `category`: string (optional)
- `status`: string (optional)
- `search`: string (optional)
- `limit`: number (default: 20)

**Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "string",
      "title": "string",
      "category": "string",
      "status": "string",
      "updatedAt": "string",
      "sizeKb": "number",
      "version": "number"
    }
  ],
  "total": "number"
}
```

## Modified Endpoints

### 1. Get Task Board
**Endpoint**: `GET /api/boards/{id}`

**Changes**:
- Add `availableApprovers` and `availableDocuments` to response

**Updated Response**:
```json
{
  "id": "string",
  "name": "string",
  "members": "KanbanBoardMember[]",
  "tasks": "KanbanTask[]",
  "availableApprovers": "KanbanBoardMember[]",
  "availableDocuments": "DocumentItem[]"
}
```

### 2. Get Task Details
**Endpoint**: `GET /api/tasks/{id}`

**Changes**:
- Include new orchestration fields in response
- Add permission flags

**Updated Response**:
```json
{
  "board": "KanbanBoardSummary",
  "task": "KanbanTask", // with new fields
  "members": "KanbanBoardMember[]",
  "currentUserId": "string",
  "canEdit": "boolean",
  "canApprove": "boolean",
  "canMoveToReview": "boolean"
}
```

## Error Responses

### Validation Error
**Status**: `400 Bad Request`
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": {
    "field": "error message"
  }
}
```

### Authorization Error
**Status**: `403 Forbidden`
```json
{
  "error": "FORBIDDEN",
  "message": "You don't have permission to perform this action"
}
```

### Not Found Error
**Status**: `404 Not Found`
```json
{
  "error": "NOT_FOUND",
  "message": "Task not found"
}
```

### State Transition Error
**Status**: `409 Conflict`
```json
{
  "error": "INVALID_TRANSITION",
  "message": "Cannot change status from 'pending' to 'approved'",
  "currentStatus": "pending",
  "requestedStatus": "approved"
}
```

## Rate Limiting

- Create task: 10 per minute per user
- Status updates: 30 per minute per user
- Attachment operations: 20 per minute per user
- List endpoints: 60 per minute per user

## Caching

- Available approvers: Cache for 5 minutes
- Available documents: Cache for 2 minutes
- Task details: No cache (real-time data)

## Implementation Notes

### Database Transactions
- Task creation: Wrap in transaction
- Status updates: Ensure atomicity
- Attachment operations: Handle rollbacks

### Audit Logging
- All task operations logged
- Status changes tracked with timestamps
- User actions recorded

### Notifications
- Task creation triggers assignment notification
- Status changes trigger appropriate notifications
- Failed operations logged but don't block API

### File Handling
- Attachment validation on upload
- Virus scanning integration
- Storage quota checks