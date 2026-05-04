# Task Orchestration Phase 2: Backend Model Updates

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
Update domain models, database schema, and protobuf definitions

## Tasks

### Task 2.1: Update Go Domain Models
**Description**: Modify the Go domain models in `services/document-service/internal/domain/model/` to include new fields for task orchestration. Update the Task struct with creator, attachments, approver, and decision tracking fields.

**Subtasks**:
- Locate and read current task model files
- Add new fields: CreatorID, CreatorName, Attachments, ApproverID, ApproverName, TaskType, Decision, DecisionComment, CreatedAt, UpdatedAt
- Update status enum to include new workflow states
- Ensure field types match TypeScript interfaces

**Dependencies**: Phase 1 deliverables (entity definitions)

**Estimated Time**: 4-6 hours

**Deliverables**:
- Updated Go model structs
- Type-safe field definitions

### Task 2.2: Create Database Migration for New Task Fields
**Description**: Write a SQL migration script to add new columns to the tasks table, including indexes for performance and foreign key constraints where appropriate.

**Subtasks**:
- Analyze current tasks table schema
- Write ALTER TABLE statements for new columns
- Add appropriate indexes (e.g., on creator_id, approver_id, status)
- Create migration file following project conventions
- Test migration on development database

**Dependencies**: Task 2.1 completion

**Estimated Time**: 3-5 hours

**Deliverables**:
- Migration SQL script (e.g., 004_add_task_orchestration_fields.sql)
- Index creation statements
- Rollback plan

### Task 2.3: Update Protobuf Definitions
**Description**: Modify `shared/proto/service.proto` to include new fields in task-related messages, ensuring compatibility with existing clients.

**Subtasks**:
- Review current Task message in service.proto
- Add new fields matching Go model updates
- Define TaskAttachment message
- Update related messages (CreateTaskRequest, UpdateTaskRequest)
- Maintain backward compatibility where possible

**Dependencies**: Task 2.1 completion

**Estimated Time**: 2-4 hours

**Deliverables**:
- Updated service.proto file
- New message definitions

### Task 2.4: Regenerate Protobuf Clients
**Description**: Run protoc to regenerate Go and TypeScript protobuf files after updating service.proto.

**Subtasks**:
- Execute protoc for Go generation
- Verify TypeScript client compatibility
- Update any generated code that needs manual adjustments
- Test compilation of updated clients

**Dependencies**: Task 2.3 completion

**Estimated Time**: 1-2 hours

**Deliverables**:
- Regenerated pb.go files
- Updated TypeScript client files
- Compilation verification

### Task 2.5: Update Repository Layer
**Description**: Modify the PostgreSQL repository in `services/document-service/internal/adapters/outbound/postgres/` to handle new task fields in queries and commands.

**Subtasks**:
- Update INSERT statements to include new fields
- Modify SELECT queries to fetch new columns
- Update WHERE clauses for filtering by new fields
- Add methods for attachment management
- Ensure proper error handling for new constraints

**Dependencies**: Tasks 2.1, 2.2, 2.4 completion

**Estimated Time**: 4-6 hours

**Deliverables**:
- Updated repository implementation
- New query methods
- Data mapping functions

## Phase Deliverables
- Updated Go models with new fields
- Database migration script
- Regenerated protobuf files

## Timeline
2-3 days</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task_2.md