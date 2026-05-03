export type DashboardDocumentStatus =
  | 'IN_REVIEW'
  | 'DRAFT'
  | 'ARCHIVED'
  | 'APPROVED';

export type DashboardDocumentCategory = 'HR' | 'FINANCE' | 'GENERAL';

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
  readonly title: string;
  readonly category: DashboardDocumentCategory;
  readonly status: DashboardDocumentStatus;
  readonly updatedAt: string;
  readonly sizeKb: number;
  readonly version?: number;
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
  readonly category?: DashboardDocumentCategory;
  readonly sortBy?: 'title' | 'category' | 'status' | 'updatedAt';
  readonly sortDirection?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PaginatedResult<T> {
  readonly items: Array<T>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface DashboardEditDocumentPayload {
  readonly title: string;
  readonly status: DashboardDocumentStatus;
  readonly contentDocument?: DashboardRichContentDocument;
  readonly expectedVersion?: number;
}

export interface DashboardCreateDocumentPayload {
  readonly title: string;
  readonly category: DashboardDocumentCategory;
  readonly contentDocument?: DashboardRichContentDocument;
}

export interface DashboardRichContentMark {
  readonly type: string;
}

export interface DashboardRichContentNode {
  readonly type: string;
  readonly attrs?: Record<string, unknown>;
  readonly marks?: Array<DashboardRichContentMark>;
  readonly text?: string;
  readonly content?: Array<DashboardRichContentNode>;
}

export interface DashboardRichContentDocument {
  readonly type: 'doc';
  readonly content: Array<DashboardRichContentNode>;
}

export interface DashboardEditableDocument {
  readonly id: string;
  readonly title: string;
  readonly category: DashboardDocumentCategory;
  readonly status: DashboardDocumentStatus;
  readonly version: number;
  readonly contentDocument?: DashboardRichContentDocument;
}

export type DashboardEditorContextType = 'CATEGORY' | 'TEMPLATE';

export interface DashboardEditorControlProfile {
  readonly id: string;
  readonly contextType: DashboardEditorContextType;
  readonly contextKey: string;
  readonly enabledControls: Array<string>;
  readonly disabledControls: Array<string>;
  readonly isActive: boolean;
  readonly updatedByUserId: string;
  readonly updatedAt: string;
}

export interface DashboardUpdateEditorControlProfilePayload {
  readonly enabledControls: Array<string>;
  readonly disabledControls: Array<string>;
  readonly isActive: boolean;
  readonly contextType?: DashboardEditorContextType;
  readonly contextKey?: string;
}

export type DashboardExportFormat = 'PDF' | 'DOCX';
export type DashboardExportStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface DashboardCreateExportPayload {
  readonly format: DashboardExportFormat;
  readonly sourceVersion: number;
}

export interface DashboardExportArtifact {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export interface DashboardExportRequest {
  readonly id: string;
  readonly documentId: string;
  readonly format: DashboardExportFormat;
  readonly sourceVersion: number;
  readonly status: DashboardExportStatus;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly artifact?: DashboardExportArtifact;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DashboardConflictError {
  readonly code: 'VERSION_CONFLICT';
  readonly message: string;
  readonly expectedVersion: number;
  readonly currentVersion: number;
}

export interface DashboardPreviewDocument {
  readonly id: string;
  readonly title: string;
  readonly category: DashboardDocumentCategory;
  readonly status: DashboardDocumentStatus;
  readonly version: number;
  readonly updatedAt: string;
  readonly body: string;
  readonly contentDocument?: DashboardRichContentDocument;
  readonly contentDocumentJson?: string;
  readonly ownerUserId?: string;
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
