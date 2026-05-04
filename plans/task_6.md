# Task Orchestration Phase 6: Notification Integration

## Overview
Enhance the Kanban board in `dashboard-tasks.component.ts` to support task orchestration with document attachments, mandatory assignment, and approval workflows. This includes employee-initiated tasks (e.g., vacation requests) that require approver review, with notifications throughout the process.

## Requirements Summary
- **Document Attachments**: Tasks can have 0 or more attached documents
- **Mandatory Assignment**: Tasks must be assigned to someone upon creation
- **Approval Workflow**:
  - Employee creates task with attachments and selects approver
  - Approver receives notification and reviews task
  - Approver approves or declines with optional comment
  - Employee receives notification of decision
- **Status Flow**: Indicates progress through the workflow

## Objectives
Implement notification system for workflow events

## Tasks

### Task 6.1: Define Notification Types for Task Events
**Description**: Specify all notification types needed for the task orchestration workflow, including templates and trigger conditions.

**Subtasks**:
- Define notification types: task_assigned, approval_requested, task_approved, task_declined
- Create notification templates with placeholders
- Specify trigger events and conditions
- Define recipient determination logic

**Dependencies**: Phase 1 deliverables (notification specification)

**Estimated Time**: 3-4 hours

**Deliverables**:
- Notification type definitions
- Template specifications
- Trigger condition documentation

### Task 6.2: Update search-notification-service to Handle Task Notifications
**Description**: Modify the notification service to support task-related notifications with proper routing and delivery.

**Subtasks**:
- Update notification service models for task events
- Implement task notification handlers
- Add task-specific routing logic
- Integrate with existing notification channels (email, in-app)

**Dependencies**: Task 6.1 completion, existing notification service

**Estimated Time**: 4-6 hours

**Deliverables**:
- Updated notification service
- Task notification handlers
- Routing and delivery logic

### Task 6.3: Integrate Notification Sending in Task Lifecycle Events
**Description**: Add notification triggers to task creation, updates, and decision events in the backend services.

**Subtasks**:
- Hook into task creation events to send assignment notifications
- Add notifications for status changes to in_review
- Trigger decision notifications (approved/declined)
- Ensure notifications are sent asynchronously

**Dependencies**: Task 6.2 completion, Phase 3 API endpoints

**Estimated Time**: 3-5 hours

**Deliverables**:
- Event hooks in task lifecycle
- Asynchronous notification sending
- Error handling for notification failures

### Task 6.4: Add Notification Preferences for Users
**Description**: Implement user settings for controlling which task notifications they receive and through which channels.

**Subtasks**:
- Create user preference storage
- Add preference management UI
- Implement preference filtering in notification sending
- Provide default preference settings

**Dependencies**: Task 6.3 completion

**Estimated Time**: 4-5 hours

**Deliverables**:
- User preference system
- Preference management interface
- Notification filtering logic

## Phase Deliverables
- Notification service updates
- Integration points in task workflows
- User notification settings

## Timeline
2-3 days</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task_6.md