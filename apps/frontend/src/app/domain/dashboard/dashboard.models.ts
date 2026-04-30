export type DashboardDocumentStatus =
  | 'finalized'
  | 'review'
  | 'archived'
  | 'pending';

export type DashboardDocumentType = 'pdf' | 'legal' | 'spreadsheet' | 'image';

export interface DashboardSummary {
  readonly pendingApprovalCount: number;
  readonly pendingApprovalDelta: number;
  readonly actionItemsCount: number;
  readonly overdueNoticesCount: number;
}

export interface WeeklyVolumePoint {
  readonly day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  readonly value: number;
}

export interface DocumentItem {
  readonly id: string;
  readonly filename: string;
  readonly type: DashboardDocumentType;
  readonly status: DashboardDocumentStatus;
  readonly modifiedAtLabel: string;
  readonly modifiedAtIso: string;
  readonly sizeKb: number;
}

export interface ActivityItem {
  readonly id: string;
  readonly actor: string;
  readonly description: string;
  readonly timestampLabel: string;
  readonly linkedDocumentId?: string;
}

export interface StorageUsage {
  readonly usedTb: number;
  readonly totalTb: number;
  readonly usedPercent: number;
}

export interface DashboardQuery {
  readonly text?: string;
  readonly status?: DashboardDocumentStatus;
  readonly type?: DashboardDocumentType;
  readonly sortBy?: 'filename' | 'type' | 'status' | 'modifiedAtIso';
  readonly sortDirection?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PaginatedResult<T> {
  readonly items: Array<T>;
  readonly totalItems: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface DashboardEditDocumentPayload {
  readonly filename: string;
  readonly status: DashboardDocumentStatus;
}

export interface DashboardPreviewDocument {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export type KanbanTaskStatus = 'todo' | 'inProgress' | 'review' | 'done';

export type KanbanTaskGroupBy = 'assignee' | 'department' | 'group';

export interface KanbanBoardMember {
  readonly id: string;
  readonly fullName: string;
  readonly department: string;
}

export interface KanbanTaskComment {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly text: string;
  readonly createdAtLabel: string;
}

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

export interface KanbanBoardSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string;
  readonly membersCount: number;
  readonly tasksCount: number;
}

export interface KanbanBoardDetails {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string;
  readonly allowedGrouping: Array<KanbanTaskGroupBy>;
  readonly members: Array<KanbanBoardMember>;
  readonly tasks: Array<KanbanTask>;
}

export interface KanbanTaskDetails {
  readonly board: KanbanBoardSummary;
  readonly task: KanbanTask;
  readonly members: Array<KanbanBoardMember>;
  readonly currentUserId: string;
  readonly canManage: boolean;
}

export interface KanbanTaskAssignPayload {
  readonly assigneeId: string | null;
}

export interface KanbanTaskMovePayload {
  readonly status: KanbanTaskStatus;
}

export interface KanbanTaskCommentPayload {
  readonly text: string;
}
