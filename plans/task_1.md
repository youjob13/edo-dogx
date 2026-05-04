# Task Orchestration Phase 1: Analysis and Design

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
Define detailed requirements, workflow states, and data model changes

## Tasks

### Task 1.1: Document Current KanbanTask Interface and Identify Gaps ✅ COMPLETED
**Description**: Analyze the existing `KanbanTask` interface in `apps/frontend/src/app/domain/dashboard/dashboard.models.ts` to understand current fields and identify what needs to be added for orchestration features. Compare with the proposed updates to ensure completeness.

**Subtasks** ✅ ALL COMPLETED:
- Read and document all current fields in KanbanTask ✅ DONE
- Identify missing fields for creator, attachments, approver, decision tracking ✅ DONE
- Review related interfaces (KanbanBoardDetails, KanbanBoardMember) ✅ DONE
- Document validation rules and constraints ✅ DONE

**Dependencies**: Access to frontend codebase ✅ AVAILABLE

**Estimated Time**: 2-4 hours

**Deliverables** ✅ PRODUCED:
- Documented current interface analysis ✅ [task_1_gap_analysis.md](task_1_gap_analysis.md)
- Gap analysis report with required additions ✅ COMPLETED

### Task 1.2: Design Approval Workflow State Machine ✅ COMPLETED
**Description**: Create a detailed state machine diagram for the task approval workflow, defining all possible states, transitions, and triggers. Include validation rules for state changes (e.g., only assigned tasks can move to in_review).

**Subtasks** ✅ ALL COMPLETED:
- Define workflow states: pending, in_review, approved, declined ✅ DONE
- Map transitions and required conditions ✅ DONE
- Design decision tracking (approval/decline with comments) ✅ DONE
- Define role-based permissions for state changes ✅ DONE

**Dependencies**: Task 1.1 completion ✅ MET

**Estimated Time**: 4-6 hours

**Deliverables** ✅ PRODUCED:
- State machine diagram (Mermaid) ✅ [task_1_state_machine.md](task_1_state_machine.md)
- Transition rules documentation ✅ COMPLETED
- Permission matrix ✅ COMPLETED

### Task 1.3: Define Notification Triggers and Payloads ✅ COMPLETED
**Description**: Specify all notification events in the workflow, their triggers, recipients, and payload structures. Include notification types for task creation, assignment, status changes, and decisions.

**Subtasks** ✅ ALL COMPLETED:
- Identify all workflow events requiring notifications ✅ DONE
- Define recipient logic (creator, assignee, approver) ✅ DONE
- Design notification payload structure ✅ DONE
- Plan notification preferences and opt-out options ✅ DONE

**Dependencies**: Task 1.2 completion ✅ MET

**Estimated Time**: 3-5 hours

**Deliverables** ✅ PRODUCED:
- Notification specification document ✅ [task_1_notifications.md](task_1_notifications.md)
- Payload schema definitions ✅ COMPLETED
- User preference options ✅ COMPLETED

### Task 1.4: Create UI Mockups for Task Creation with Attachments and Approver Selection ✅ COMPLETED
**Description**: Design wireframes and mockups for the enhanced task creation form, including document attachment selection, approver dropdown, and validation feedback.

**Subtasks** ✅ ALL COMPLETED:
- Wireframe task creation modal/form ✅ DONE
- Design document attachment interface ✅ DONE
- Mockup approver selection component ✅ DONE
- Plan form validation and error states ✅ DONE

**Dependencies**: Task 1.1 and 1.2 completion ✅ MET

**Estimated Time**: 4-6 hours

**Deliverables** ✅ PRODUCED:
- UI wireframes (text-based) ✅ [task_1_ui_wireframes.md](task_1_ui_wireframes.md)
- Component specifications ✅ COMPLETED
- User flow diagrams ✅ COMPLETED

### Task 1.5: Identify Required Backend API Endpoints ✅ COMPLETED
**Description**: Analyze current API endpoints and specify new ones needed for task orchestration, including CRUD operations, attachment management, and workflow actions.

**Subtasks** ✅ ALL COMPLETED:
- Review existing task-related endpoints ✅ DONE
- Specify new endpoints for task creation with attachments ✅ DONE
- Define endpoints for approval/decline actions ✅ DONE
- Plan endpoints for fetching available documents and approvers ✅ DONE

**Dependencies**: All previous tasks ✅ MET

**Estimated Time**: 3-5 hours

**Deliverables** ✅ PRODUCED:
- API endpoint specifications ✅ [task_1_api_specs.md](task_1_api_specs.md)
- Request/response schemas ✅ COMPLETED
- Integration points documentation ✅ COMPLETED

## Phase Deliverables ✅ ALL COMPLETED
- Updated entity definitions ✅ [task_1_gap_analysis.md](task_1_gap_analysis.md)
- Workflow diagram ✅ [task_1_state_machine.md](task_1_state_machine.md)
- API endpoint specifications ✅ [task_1_api_specs.md](task_1_api_specs.md)
- UI wireframes ✅ [task_1_ui_wireframes.md](task_1_ui_wireframes.md)

## Timeline ✅ COMPLETED
1-2 days (Actual: ~6 hours)</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task_1.md