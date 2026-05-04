# Task Orchestration Phase 4: Frontend Model Updates

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
Update TypeScript interfaces and HTTP adapters

## Tasks

### Task 4.1: Update dashboard.models.ts with New Interfaces
**Description**: Modify the TypeScript interfaces in `apps/frontend/src/app/domain/dashboard/dashboard.models.ts` to include all new fields and types for task orchestration.

**Subtasks**:
- Add new fields to KanbanTask interface
- Create TaskAttachment interface
- Add TaskType and TaskDecision types
- Update KanbanTaskStatus enum
- Modify KanbanBoardDetails for available approvers/documents

**Dependencies**: Phase 1 deliverables (entity definitions)

**Estimated Time**: 2-3 hours

**Deliverables**:
- Updated TypeScript interfaces
- New type definitions
- Type-safe model updates

### Task 4.2: Modify HTTP Adapters to Handle New Fields
**Description**: Update the HTTP adapter in `apps/frontend/src/app/adapters/outbound/dashboard/` to serialize/deserialize new task fields correctly.

**Subtasks**:
- Update request mapping for task creation/updates
- Modify response parsing to handle new fields
- Add attachment serialization logic
- Ensure backward compatibility with existing API responses

**Dependencies**: Task 4.1 completion, Phase 3 deliverables

**Estimated Time**: 3-4 hours

**Deliverables**:
- Updated HTTP adapter methods
- Request/response mapping functions
- Error handling for new fields

### Task 4.3: Update Use Cases to Support New Operations
**Description**: Modify the dashboard use cases in `apps/frontend/src/app/application/dashboard/` to include new operations for task orchestration.

**Subtasks**:
- Add createTaskWithAttachments method
- Implement approveTask and declineTask methods
- Update getTaskBoard to handle new fields
- Add fetchAvailableDocuments and fetchAvailableApprovers methods

**Dependencies**: Task 4.2 completion

**Estimated Time**: 3-4 hours

**Deliverables**:
- New use case methods
- Updated existing use cases
- Business logic for orchestration

## Phase Deliverables
- Updated TypeScript models
- Modified HTTP client code

## Timeline
1-2 days</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task_4.md