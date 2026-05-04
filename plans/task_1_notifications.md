# Task Orchestration - Notification Specification

## Overview
This document defines all notification events, triggers, recipients, and payload structures for the task orchestration workflow.

## Notification Types

### 1. Task Assigned (`task_assigned`)
**Trigger**: Task created with assignee
**Recipients**:
- Primary: Task assignee
- Secondary: Task approver (if different from assignee)
**Channels**: In-app, Email
**Frequency**: Once per task creation

**Payload Structure**:
```json
{
  "type": "task_assigned",
  "taskId": "string",
  "taskTitle": "string",
  "boardId": "string",
  "boardName": "string",
  "assigneeId": "string",
  "assigneeName": "string",
  "creatorId": "string",
  "creatorName": "string",
  "approverId": "string?", // null for general tasks
  "approverName": "string?", // null for general tasks
  "taskType": "approval" | "general",
  "dueDate": "string?",
  "attachmentCount": "number",
  "createdAt": "string"
}
```

**Templates**:
- **In-app**: "New task assigned: {taskTitle}"
- **Email Subject**: "New task assigned to you"
- **Email Body**: "You have been assigned a new task: {taskTitle}. Created by {creatorName}."

### 2. Approval Requested (`approval_requested`)
**Trigger**: Approval task moves to `in_review` state
**Recipients**:
- Primary: Task approver
- Secondary: Task creator
**Channels**: In-app, Email
**Frequency**: Once when task enters review

**Payload Structure**:
```json
{
  "type": "approval_requested",
  "taskId": "string",
  "taskTitle": "string",
  "boardId": "string",
  "boardName": "string",
  "approverId": "string",
  "approverName": "string",
  "creatorId": "string",
  "creatorName": "string",
  "attachments": [
    {
      "documentId": "string",
      "title": "string",
      "category": "string"
    }
  ],
  "reviewStartedAt": "string"
}
```

**Templates**:
- **In-app**: "Approval requested for: {taskTitle}"
- **Email Subject**: "Approval required for task"
- **Email Body**: "{creatorName} requests your approval for: {taskTitle}. Please review the attached documents."

### 3. Task Approved (`task_approved`)
**Trigger**: Task moves to `approved` state
**Recipients**:
- Primary: Task creator
- Secondary: Task assignee (if different from creator)
**Channels**: In-app, Email
**Frequency**: Once per approval

**Payload Structure**:
```json
{
  "type": "task_approved",
  "taskId": "string",
  "taskTitle": "string",
  "boardId": "string",
  "boardName": "string",
  "approverId": "string",
  "approverName": "string",
  "creatorId": "string",
  "creatorName": "string",
  "decisionComment": "string?", // optional
  "approvedAt": "string"
}
```

**Templates**:
- **In-app**: "Task approved: {taskTitle}"
- **Email Subject**: "Your task has been approved"
- **Email Body**: "Your task '{taskTitle}' has been approved by {approverName}."

### 4. Task Declined (`task_declined`)
**Trigger**: Task moves to `declined` state
**Recipients**:
- Primary: Task creator
- Secondary: Task assignee (if different from creator)
**Channels**: In-app, Email
**Frequency**: Once per decline

**Payload Structure**:
```json
{
  "type": "task_declined",
  "taskId": "string",
  "taskTitle": "string",
  "boardId": "string",
  "boardName": "string",
  "approverId": "string",
  "approverName": "string",
  "creatorId": "string",
  "creatorName": "string",
  "decisionComment": "string", // required for declines
  "declinedAt": "string"
}
```

**Templates**:
- **In-app**: "Task declined: {taskTitle}"
- **Email Subject**: "Your task has been declined"
- **Email Body**: "Your task '{taskTitle}' has been declined by {approverName}. Reason: {decisionComment}"

## Notification Preferences

### User Settings
Users can configure notification preferences:

```typescript
interface NotificationPreferences {
  task_assigned: {
    in_app: boolean;
    email: boolean;
  };
  approval_requested: {
    in_app: boolean;
    email: boolean;
  };
  task_approved: {
    in_app: boolean;
    email: boolean;
  };
  task_declined: {
    in_app: boolean;
    email: boolean;
  };
}
```

### Default Preferences
- All notification types: `in_app: true`, `email: true`
- Users can opt-out of email notifications
- In-app notifications cannot be disabled (required for workflow)

## Delivery Channels

### In-App Notifications
- **Storage**: Database table with read/unread status
- **Display**: Notification center in UI
- **Retention**: 30 days, then archived
- **Actions**: Click to navigate to task/board

### Email Notifications
- **Template Engine**: Handlebars or similar
- **Styling**: Company branded template
- **Links**: Direct links to task in application
- **Unsubscribe**: Per-type opt-out links

## Implementation Architecture

### Notification Service Integration
```typescript
// Frontend - trigger notifications
taskService.updateTaskStatus(taskId, newStatus)
  .subscribe(() => {
    notificationService.send({
      type: getNotificationType(newStatus),
      payload: buildPayload(task, newStatus)
    });
  });

// Backend - handle notifications
@Post('/tasks/:id/status')
async updateTaskStatus(@Param('id') taskId: string, @Body() update: TaskStatusUpdate) {
  const task = await this.taskService.updateStatus(taskId, update);
  await this.notificationService.send(buildNotification(task, update));
  return task;
}
```

### Queue System
- **Async Processing**: Notifications sent asynchronously
- **Retry Logic**: Failed deliveries retried with exponential backoff
- **Dead Letter Queue**: Unprocessable notifications logged for review

### Rate Limiting
- **Per User**: Max 10 notifications per minute
- **Per Task**: Max 5 notifications per task lifecycle
- **Global**: Anti-spam measures

## Error Handling

### Failed Deliveries
- **Logging**: All failures logged with context
- **Retry**: Up to 3 attempts with backoff
- **Fallback**: In-app only if email fails
- **Alerting**: High failure rates trigger alerts

### Invalid Recipients
- **Validation**: Check user exists and has valid email
- **Fallback**: Skip invalid recipients, log warning
- **Recovery**: Re-send when user data corrected

## Testing Scenarios

### Unit Tests
- Notification payload building
- Template rendering
- Preference filtering

### Integration Tests
- End-to-end notification flow
- Multi-channel delivery
- Preference application

### Load Tests
- High-volume notification sending
- Database performance under load
- Email service rate limits