# Task Orchestration Phase 3: API Development

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
Implement REST endpoints for task orchestration

## Tasks

### Task 3.1: Add Task Creation Endpoint with Attachment Support
**Description**: Implement a new REST endpoint in the gateway for creating tasks with document attachments. Include validation for mandatory assignment and attachment references.

**Subtasks**:
- Create POST /api/tasks endpoint in gateway
- Implement request validation (title, assignee required)
- Handle attachment array in request body
- Validate document IDs exist and are accessible
- Return created task with all fields populated

**Dependencies**: Phase 2 deliverables, existing task endpoints

**Estimated Time**: 4-6 hours

**Deliverables**:
- New POST endpoint implementation
- Request/response DTOs
- Validation logic

### Task 3.2: Implement Task Update Endpoints for Status Changes and Decisions
**Description**: Create endpoints for updating task status, making approval decisions, and adding decision comments. Include proper authorization checks.

**Subtasks**:
- Implement PATCH /api/tasks/{id} for general updates
- Add PUT /api/tasks/{id}/approve for approval actions
- Add PUT /api/tasks/{id}/decline for decline actions
- Validate state transitions and user permissions
- Handle decision comments and timestamps

**Dependencies**: Task 3.1 completion

**Estimated Time**: 6-8 hours

**Deliverables**:
- Update endpoint implementations
- Authorization middleware
- State transition validation

### Task 3.3: Add Endpoints for Fetching Available Documents and Approvers
**Description**: Implement endpoints to fetch documents available for attachment and users who can be approvers, with appropriate filtering.

**Subtasks**:
- Create GET /api/tasks/available-documents endpoint
- Implement GET /api/tasks/available-approvers endpoint
- Add filtering by user permissions and document access
- Include pagination for large result sets
- Cache results where appropriate

**Dependencies**: Task 3.1 completion

**Estimated Time**: 3-5 hours

**Deliverables**:
- New query endpoints
- Filtering and pagination logic
- Performance optimizations

### Task 3.4: Update Existing Task Board Endpoints
**Description**: Modify existing endpoints for fetching task boards to include new orchestration fields and ensure backward compatibility.

**Subtasks**:
- Update GET /api/boards/{id} to include new task fields
- Modify response serialization to include attachments, approver info
- Ensure existing clients continue to work
- Add optional query parameters for filtering

**Dependencies**: Phase 2 deliverables

**Estimated Time**: 2-4 hours

**Deliverables**:
- Updated endpoint responses
- Backward compatibility verification
- Enhanced query capabilities

### Task 3.5: Implement Validation for Mandatory Assignment and Workflow Rules
**Description**: Add comprehensive validation logic for task creation and updates, enforcing business rules like mandatory assignment and valid state transitions.

**Subtasks**:
- Implement assignment validation on creation
- Add workflow rule validation (e.g., only approvers can decide)
- Create custom validation errors with clear messages
- Add unit tests for validation logic
- Document validation rules

**Dependencies**: All previous tasks in phase

**Estimated Time**: 4-6 hours

**Deliverables**:
- Validation middleware/functions
- Custom error responses
- Validation test coverage

## Phase Deliverables
- New and updated REST endpoints in gateway
- Input validation and business logic
- Updated OpenAPI specifications

## Timeline
3-4 days</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task_3.md