# Task Orchestration - Current Interface Analysis and Gap Identification ✅ COMPLETED

## Current KanbanTask Interface

Based on `apps/frontend/src/app/domain/dashboard/dashboard.models.ts`:

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
}
```

Current `KanbanTaskStatus` type (inferred from component usage):
```typescript
type KanbanTaskStatus = 'todo' | 'inProgress' | 'review' | 'done';
```

## Required Fields for Task Orchestration ✅ IMPLEMENTED

Based on requirements analysis:

### New Fields Needed ✅ ADDED
- `creatorId: string` - ID of user who created the task
- `creatorName: string` - Name of user who created the task
- `attachments: Array<TaskAttachment>` - Documents attached to the task
- `approverId?: string` - ID of user who can approve/decline
- `approverName?: string` - Name of approver
- `taskType: TaskType` - Type of task ('approval' | 'general')
- `decision?: TaskDecision` - Final decision ('approved' | 'declined')
- `decisionComment?: string` - Optional comment from approver
- `createdAt: string` - Creation timestamp
- `updatedAt: string` - Last update timestamp

### New Types Needed ✅ CREATED
```typescript
export interface TaskAttachment {
  readonly documentId: string;
  readonly title: string;
  readonly category: DashboardDocumentCategory;
  readonly status: DashboardDocumentStatus;
}

export type TaskType = 'approval' | 'general';

export type TaskDecision = 'approved' | 'declined';
```

### Status Changes Required ✅ UPDATED
Current: `'todo' | 'inProgress' | 'review' | 'done'`
Required: `'pending' | 'in_review' | 'approved' | 'declined'`

Mapping:
- `todo` → `pending` (task created, waiting for review)
- `inProgress` → `in_review` (approver is reviewing)
- `review` → (deprecated, covered by in_review)
- `done` → `approved` (task completed successfully)
- New: `declined` (task rejected by approver)

## Gap Analysis ✅ RESOLVED

### Missing Fields ✅ FIXED
1. **Creator Tracking**: No way to track who created the task → Added `creatorId`, `creatorName`
2. **Document Attachments**: No support for attaching documents → Added `attachments` array
3. **Approval Workflow**: No approver designation or decision tracking → Added `approverId`, `approverName`, `decision`, `decisionComment`
4. **Task Types**: No distinction between approval tasks and general tasks → Added `taskType`
5. **Timestamps**: No creation/update timestamps for audit trail → Added `createdAt`, `updatedAt`

### Status Limitations ✅ FIXED
1. **Workflow Clarity**: Current statuses don't clearly represent approval states → Updated to workflow-specific statuses
2. **Decision States**: No explicit "declined" state → Added `declined` status
3. **State Transitions**: Current flow doesn't match approval workflow requirements → Updated status flow

### Related Interface Updates Needed ✅ COMPLETED
- `KanbanBoardDetails`: Add `availableApprovers` and `availableDocuments` fields ✅ DONE
- `KanbanTaskComment`: May need expansion for decision comments → No changes needed

## Implementation Impact ✅ HANDLED

### Frontend Changes ✅ COMPLETED
- Update TypeScript interfaces ✅ DONE
- Modify HTTP adapters for new fields ✅ DONE
- Update component logic for new workflow ✅ DONE
- Add UI for attachments and approver selection → Next phase

### Backend Changes → Next Phase
- Update Go domain models
- Database migration for new columns
- API endpoints for orchestration features
- Protobuf schema updates

### Breaking Changes ✅ MANAGED
- Status enum change requires migration → Updated all references
- New mandatory fields on task creation → Added to mock data
- API response format changes → Updated mock adapter

## Next Steps
1. Update TypeScript interfaces with new fields ✅ DONE
2. Design workflow state machine → Next task
3. Plan database schema changes → Phase 2
4. Update API specifications → Phase 3</content>
<parameter name="filePath">c:\Users\danil\personal\edo\plans\task_1_gap_analysis.md