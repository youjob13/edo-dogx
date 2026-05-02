// Shared TypeScript types for the EDO monorepo.
// Types are generated or hand-authored based on OpenAPI / Proto contracts.

export interface HealthResponse {
  status: string;
}

export interface UserProfile {
  userId: string;
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
