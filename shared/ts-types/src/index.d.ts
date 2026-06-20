export interface HealthResponse {
    status: string;
}
export interface UserProfile {
    userId: string;
    userName: string;
    fullName?: string;
    department?: string;
    email: string;
    roles: string[];
}
export type DocumentCategory = "HR" | "FINANCE" | "GENERAL";
export interface CreateDocumentRequest {
    title: string;
    category: DocumentCategory;
    contentDocument?: Record<string, unknown>;
}
export interface UpdateDocumentRequest {
    title: string;
    expectedVersion: number;
    contentDocument?: Record<string, unknown>;
}
export interface DocumentResponse {
    id: string;
    title: string;
    category: DocumentCategory;
    status: string;
    contentDocument?: Record<string, unknown>;
    version?: number;
    updatedAt?: string;
}
export type EditorContextType = "CATEGORY" | "TEMPLATE";
export interface EditorControlProfileResponse {
    id: string;
    contextType: EditorContextType;
    contextKey: string;
    enabledControls: string[];
    disabledControls: string[];
    isActive: boolean;
    updatedByUserId: string;
    updatedAt: string;
}
export interface UpdateEditorControlProfileRequest {
    enabledControls: string[];
    disabledControls: string[];
    isActive: boolean;
}
export type ExportFormat = "PDF" | "DOCX";
export type ExportRequestStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
export interface CreateExportRequest {
    format: ExportFormat;
    sourceVersion: number;
}
export interface ExportArtifactResponse {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
}
export interface ExportRequestResponse {
    id: string;
    documentId: string;
    format: ExportFormat;
    sourceVersion: number;
    status: ExportRequestStatus;
    errorCode?: string;
    errorMessage?: string;
    artifact?: ExportArtifactResponse;
    createdAt: string;
    updatedAt: string;
}
export interface DocumentConflictResponse {
    error: string;
    code: "VERSION_CONFLICT";
    expectedVersion: number;
    currentVersion: number;
}
export type TaskStatus = "pending" | "in_review" | "approved" | "declined";
export type TaskType = "approval" | "general";
export type TaskDecision = "approved" | "declined";
export interface TaskAttachment {
    documentId: string;
    title: string;
    category: string;
    status: string;
}
export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    taskType: TaskType;
    creatorId: string;
    creatorName: string;
    assigneeId: string;
    assigneeName: string;
    approverId?: string;
    approverName?: string;
    decision?: TaskDecision;
    decisionComment?: string;
    dueDate?: string;
    attachments: TaskAttachment[];
    createdAt: string;
    updatedAt: string;
}
export interface UpdateTaskStatusRequest {
    status: TaskStatus;
    decision?: TaskDecision;
    decisionComment?: string;
}
export interface AddTaskAttachmentsRequest {
    documentIds: string[];
}
export interface UpdateTaskAssigneeRequest {
    assigneeId: string;
}
export interface UpdateTaskAssigneeResponse {
    task: TaskResponse;
}
export type TaskBoardRole = "OWNER" | "MANAGER" | "MEMBER";
export interface TaskBoardMember {
    id: string;
    fullName: string;
    department: string;
    email: string;
    boardRole: TaskBoardRole;
    roles: string[];
}
export type AvailableApprover = TaskBoardMember;
export interface DocumentItem {
    id: string;
    title: string;
    category: string;
    status: string;
    updatedAt: string;
    sizeKb: number;
    version: number;
}
export interface TaskBoard {
    id: string;
    name: string;
    members: TaskBoardMember[];
    tasks: Task[];
    availableApprovers: AvailableApprover[];
    availableDocuments: DocumentItem[];
}
export interface TaskDetailsResponse {
    task: Task;
    members: TaskBoardMember[];
    currentUserId: string;
    canEdit: boolean;
    canAssign: boolean;
    canApprove: boolean;
    canMoveToReview: boolean;
    canComment: boolean;
}
export interface AvailableApproversResponse {
    items: AvailableApprover[];
    total: number;
}
export interface AvailableDocumentsResponse {
    items: DocumentItem[];
    total: number;
}
export interface SignatureSigner {
    userId: string;
    dueAt?: string;
}
export interface CreateSignatureRequest {
    signers: SignatureSigner[];
}
export interface AuditEventResponse {
    id: string;
    actionType: string;
    outcome: "SUCCESS" | "DENIED" | "FAILED";
    occurredAt: string;
}
export type GlobalSearchEntityType = "DOCUMENT" | "TASK";
export interface GlobalSearchHit {
    entityType: GlobalSearchEntityType;
    id: string;
    title: string;
    subtitle: string;
    status: string;
    updatedAt: string;
    route: string;
    documentId?: string;
    taskId?: string;
    boardId?: string;
    category?: string;
}
export interface GlobalSearchResponse {
    items: GlobalSearchHit[];
    total: number;
}
export type ActivityEventEntityType = "DOCUMENT" | "TASK";
export type ActivityActionType = "DOCUMENT_CREATED" | "DOCUMENT_UPDATED" | "DOCUMENT_SUBMITTED" | "DOCUMENT_APPROVED" | "EXPORT_REQUESTED" | "EXPORT_SUCCEEDED" | "EXPORT_FAILED" | "TASK_CREATED" | "TASK_STATUS_UPDATED" | "TASK_ATTACHMENT_ADDED" | "TASK_ATTACHMENT_REMOVED" | "TASK_MEMBER_ADDED";
export interface ActivityItemResponse {
    id: string;
    organizationId: string;
    actorUserId: string;
    actorUserName: string;
    entityType: ActivityEventEntityType;
    entityId: string;
    actionType: ActivityActionType;
    summary: string;
    occurredAt: string;
    documentId?: string;
    taskId?: string;
    boardId?: string;
}
export interface NotificationItem {
    id: string;
    recipientUserId: string;
    organizationId: string;
    eventType: string;
    title: string;
    body: string;
    entityType: string;
    entityId: string;
    status: string;
    isRead: boolean;
    createdAt: string;
    deliveredAt?: string;
    readAt?: string;
}
export interface NotificationListResponse {
    items: NotificationItem[];
    total: number;
}
export interface UnreadCountResponse {
    total: number;
}
export interface NotificationSseEvent {
    notificationId: string;
    title: string;
    body: string;
    entityType: string;
    entityId: string;
}
/**
 * <--- Tasks
 */
export interface CreateTaskRequest {
    readonly boardId: string;
    readonly title: string;
    readonly description?: string;
    readonly assigneeId: string;
    readonly assigneeName: string;
    readonly approverId?: string;
    readonly approverName?: string;
    readonly taskType: "approval" | "general";
    readonly dueDate?: Date;
    readonly attachmentIds?: string[];
}
export interface TaskResponse {
    readonly id: string;
    readonly boardId?: string;
    readonly title: string;
    readonly description?: string;
    readonly status: "pending" | "in_review" | "approved" | "declined";
    readonly taskType: "approval" | "general";
    readonly creatorId: string;
    readonly creatorName: string;
    readonly assigneeId: string;
    readonly assigneeName: string;
    readonly approverId?: string;
    readonly approverName?: string;
    readonly decision?: "approved" | "declined";
    readonly decisionComment?: string;
    readonly dueDate?: Date;
    readonly attachments: TaskAttachment[];
    readonly attachmentIds: string[];
    readonly createdAt: Date;
    readonly updatedAt: Date;
}
/**
 * /Tasks --->
 */
//# sourceMappingURL=index.d.ts.map
