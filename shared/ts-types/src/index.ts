// Shared TypeScript types for the EDO monorepo.
// Types are generated or hand-authored based on OpenAPI / Proto contracts.

export interface HealthResponse {
  status: string;
}

export interface UserProfile {
  userId: string;
  userName: string;
  email: string;
  roles: string[];
}

export type DocumentCategory = 'HR' | 'FINANCE' | 'GENERAL';

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

export type EditorContextType = 'CATEGORY' | 'TEMPLATE';

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

export type ExportFormat = 'PDF' | 'DOCX';
export type ExportRequestStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

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
  code: 'VERSION_CONFLICT';
  expectedVersion: number;
  currentVersion: number;
}

export type TaskStatus = 'pending' | 'in_review' | 'approved' | 'declined';
export type TaskType = 'approval' | 'general';
export type TaskDecision = 'approved' | 'declined';

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
  decisionComment?: string;
}

export interface AddTaskAttachmentsRequest {
  documentIds: string[];
}

export interface AvailableApprover {
  id: string;
  fullName: string;
  department: string;
  email: string;
}

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
  members: { id: string; fullName: string; department: string; email: string }[];
  tasks: Task[];
  availableApprovers: AvailableApprover[];
  availableDocuments: DocumentItem[];
}

export interface TaskDetailsResponse {
  task: Task;
  members: { id: string; fullName: string; department: string; email: string }[];
  currentUserId: string;
  canEdit: boolean;
  canApprove: boolean;
  canMoveToReview: boolean;
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
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  occurredAt: string;
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
  readonly taskType: 'approval' | 'general';
  readonly dueDate?: Date;
  readonly priority?: number;
  readonly attachmentIds?: string[];
}

export interface TaskResponse {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: 'pending' | 'in_review' | 'approved' | 'declined';
  readonly taskType: 'approval' | 'general';
  readonly creatorId: string;
  readonly creatorName: string;
  readonly assigneeId: string;
  readonly assigneeName: string;
  readonly approverId?: string;
  readonly approverName?: string;
  readonly decision?: 'approved' | 'declined';
  readonly decisionComment?: string;
  readonly dueDate?: Date;
  readonly priority?: number;
  readonly attachmentIds: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * /Tasks --->
 */
