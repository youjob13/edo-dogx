# Task Orchestration Phase 5: UI Enhancements

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
Enhance Kanban board with orchestration features

## Tasks

### Task 5.1: Add Task Creation Form with Document Attachment Selection
**Description**: Create a new task creation modal/form component with fields for title, description, assignee, approver, and document attachments.

**Subtasks**:
- Design and implement task creation modal
- Add form controls for all required fields
- Implement document selection with search/filter
- Add attachment preview and removal
- Include form validation with clear error messages

**Dependencies**: Phase 4 deliverables, existing UI components

**Estimated Time**: 6-8 hours

**Deliverables**:
- New task creation component
- Form validation logic
- Document selection interface

### Task 5.2: Implement Approver Selection Dropdown
**Description**: Add a dropdown component for selecting approvers, populated from the available approvers endpoint with search and filtering.

**Subtasks**:
- Create approver selection dropdown component
- Integrate with available approvers API
- Add search and department filtering
- Handle loading states and empty results
- Include user avatars/names for better UX

**Dependencies**: Task 5.1 completion, Phase 3 API endpoints

**Estimated Time**: 3-4 hours

**Deliverables**:
- Approver selection component
- API integration
- User-friendly selection interface

### Task 5.3: Add Attachment Display in Task Cards
**Description**: Update task card templates to display attached documents with links to view/download and visual indicators.

**Subtasks**:
- Modify task card HTML template
- Add attachment list with document titles
- Include document status indicators
- Add click handlers for document viewing
- Handle cases with no attachments

**Dependencies**: Task 5.1 completion

**Estimated Time**: 2-3 hours

**Deliverables**:
- Updated task card templates
- Attachment display components
- Document viewing integration

### Task 5.4: Create Approval/Decline Action Buttons for Approvers
**Description**: Add action buttons in task cards for approvers to approve or decline tasks, with confirmation dialogs.

**Subtasks**:
- Add conditional buttons based on user role and task status
- Implement approve/decline button handlers
- Create confirmation modal for decisions
- Add loading states during API calls
- Update task status after successful actions

**Dependencies**: Task 5.3 completion, Phase 3 API endpoints

**Estimated Time**: 4-5 hours

**Deliverables**:
- Action buttons in task cards
- Confirmation dialogs
- API integration for decisions

### Task 5.5: Add Decision Comment Input
**Description**: Implement a comment input field in the approval/decline workflow for approvers to provide feedback.

**Subtasks**:
- Add comment textarea to decision modal
- Make comment optional for approvals
- Include character limits and validation
- Display comments in task history
- Handle comment editing/updating

**Dependencies**: Task 5.4 completion

**Estimated Time**: 2-3 hours

**Deliverables**:
- Comment input component
- Validation and limits
- Comment display in task details

### Task 5.6: Update Task Status Indicators for Workflow States
**Description**: Modify status display in task cards to clearly show workflow states with appropriate colors and icons.

**Subtasks**:
- Update status labels and colors
- Add workflow-specific icons (pending, in review, approved, declined)
- Include status change animations
- Add tooltips explaining status meanings

**Dependencies**: Task 5.3 completion

**Estimated Time**: 2-3 hours

**Deliverables**:
- Enhanced status indicators
- Visual status feedback
- Status transition animations

### Task 5.7: Implement Drag-and-Drop Restrictions Based on Workflow Rules
**Description**: Update the Kanban drag-and-drop functionality to prevent invalid status transitions based on workflow rules.

**Subtasks**:
- Review current drag-and-drop implementation
- Add validation for allowed transitions
- Prevent dragging to invalid columns
- Show visual feedback for blocked moves
- Add error messages for invalid transitions

**Dependencies**: All previous tasks, existing drag-and-drop code

**Estimated Time**: 3-4 hours

**Deliverables**:
- Restricted drag-and-drop logic
- Visual feedback for invalid moves
- Error handling and messaging

## Phase Deliverables
- Enhanced `dashboard-tasks.component.ts`
- New task creation component
- Updated task card templates
- Form validation and error handling

## Timeline
4-5 days</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task_5.md