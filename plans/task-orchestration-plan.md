# Task Orchestration Plan

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

## Entity Updates

### KanbanTask Interface Updates
Add the following fields to support orchestration:

```typescript
export interface KanbanTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: KanbanTaskStatus;
  readonly assigneeId: string | null;
  readonly assigneeName: string;
  readonly department: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly dueDateLabel: string;
  readonly comments: Array<KanbanTaskComment>;
  
  // New fields for orchestration
  readonly creatorId: string;
  readonly creatorName: string;
  readonly attachments: Array<TaskAttachment>;
  readonly approverId?: string;
  readonly approverName?: string;
  readonly taskType: TaskType;
  readonly decision?: TaskDecision;
  readonly decisionComment?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TaskAttachment {
  readonly documentId: string;
  readonly title: string;
  readonly category: DashboardDocumentCategory;
  readonly status: DashboardDocumentStatus;
}

export type TaskType = 'approval' | 'general';

export type TaskDecision = 'approved' | 'declined';

export type KanbanTaskStatus = 'pending' | 'in_review' | 'approved' | 'declined';
```

### KanbanBoardDetails Updates
```typescript
export interface KanbanBoardDetails {
  readonly id: string;
  readonly name: string;
  readonly members: Array<KanbanBoardMember>;
  readonly tasks: Array<KanbanTask>;
  
  // New fields
  readonly availableApprovers: Array<KanbanBoardMember>;
  readonly availableDocuments: Array<DocumentItem>;
}
```

## Phases

### Phase 1: Analysis and Design ✅ COMPLETED (1-2 days)
See [task_1.md](task_1.md) for detailed tasks.

**Status**: ✅ **COMPLETED** - All deliverables produced and validated

**Completed Tasks**:
- ✅ Task 1.1: Gap Analysis - Updated TypeScript interfaces and entity definitions
- ✅ Task 1.2: State Machine Design - Created workflow diagrams and status transitions
- ✅ Task 1.3: Notification System Design - Defined payload schemas and user preferences
- ✅ Task 1.4: UI Wireframes - Created detailed component specifications
- ✅ Task 1.5: API Endpoint Specifications - Documented all required REST endpoints

**Deliverables Produced**:
- [task_1_gap_analysis.md](task_1_gap_analysis.md) - Updated domain models
- [task_1_state_machine.md](task_1_state_machine.md) - Workflow specifications
- [task_1_api_specs.md](task_1_api_specs.md) - API endpoint documentation
- [task_1_ui_wireframes.md](task_1_ui_wireframes.md) - UI component designs

**Validation**: Frontend TypeScript interfaces updated and compiled successfully

### Phase 2: Backend Model Updates 🔄 READY TO START (2-3 days)
See [task_2.md](task_2.md) for detailed tasks.

### Phase 3: API Development (3-4 days)
See [task_3.md](task_3.md) for detailed tasks.

### Phase 4: Frontend Model Updates (1-2 days)
See [task_4.md](task_4.md) for detailed tasks.

### Phase 5: UI Enhancements (4-5 days)
See [task_5.md](task_5.md) for detailed tasks.

### Phase 6: Notification Integration (2-3 days)
See [task_6.md](task_6.md) for detailed tasks.

### Phase 7: Testing and Validation (3-4 days)
See [task_7.md](task_7.md) for detailed tasks.

### Phase 8: Deployment and Documentation (1-2 days)
See [task_8.md](task_8.md) for detailed tasks.

## Risk Assessment
- **High Risk**: Database migration complexity with existing data
- **Medium Risk**: Notification service integration timing
- **Low Risk**: UI changes are additive and backward compatible

## Success Criteria
- Tasks can be created with mandatory assignment and document attachments
- Approval workflow functions end-to-end with proper status transitions
- Notifications are sent for all workflow events
- UI provides clear feedback and prevents invalid operations
- All existing functionality remains intact

## Timeline Estimate
- Total: 17-25 days
- Parallel work possible in API and UI phases
- Assumes 1-2 developers working on the project</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task-orchestration-plan.md