import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ActivityItem,
  DashboardApproveWorkflowPayload,
  DashboardArchiveDocumentPayload,
  DashboardArchiveDocumentResult,
  DashboardDocumentCapabilities,
  DashboardCreateDocumentPayload,
  DashboardCreateExportPayload,
  DashboardDocumentStatus,
  DashboardEditableDocument,
  DashboardEditorContextType,
  DashboardEditorControlProfile,
  DashboardExportRequest,
  DashboardDocumentCategory,
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardQuery,
  DashboardRequestWorkflowChangesPayload,
  DashboardRichContentDocument,
  DashboardRichContentNode,
  DashboardSubmitWorkflowPayload,
  DashboardWorkflowEvent,
  DashboardWorkflowInstance,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  DashboardUpdateEditorControlProfilePayload,
  WeeklyVolumePoint,
} from '../../domain/dashboard/dashboard.models';
import { DocumentApiPort } from '../../ports/outbound/document-api.port';
import { Params } from '@angular/router';

const emptyRichDocument = (): DashboardRichContentDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

interface GatewayDocumentResponse {
  id: string;
  title: string;
  category: DashboardDocumentCategory;
  ownerUserId?: string;
  owner_user_id?: string;
  owner_user_name?: string;
  status?: DashboardDocumentStatus | string;
  version?: number | string;
  updatedAt?: string;
  updated_at?: string;
  contentDocument?: DashboardRichContentDocument;
  content_document_json?: string;
  contentDocumentJson?: string;
  canEdit?: boolean;
  can_edit?: boolean;
  canSubmit?: boolean;
  can_submit?: boolean;
  canApprove?: boolean;
  can_approve?: boolean;
  canRequestChanges?: boolean;
  can_request_changes?: boolean;
  canArchive?: boolean;
  can_archive?: boolean;
}

interface GatewaySearchDocumentsResponse {
  items: Array<GatewayDocumentResponse>;
  total: number;
}

interface GatewayActivityResponse {
  items: Array<{
    id: string;
    actorUserName?: string;
    actor_user_name?: string;
    summary: string;
    occurredAt?: string;
    occurred_at?: string;
    documentId?: string;
    document_id?: string;
    taskId?: string;
    task_id?: string;
    boardId?: string;
    board_id?: string;
  }>;
}

interface DashboardStorageResponse {
  usedTb: number;
  totalTb: number;
  usedPercent: number;
}

type WorkflowInstanceApi = Partial<{
  id: string;
  documentId: string;
  document_id: string;
  currentStepCode: string;
  current_step_code: string;
  status: DashboardDocumentStatus | string;
  assignedUserId: string;
  assigned_user_id: string;
  updatedAt: string;
  updated_at: string;
  submittedVersion: number;
  submitted_version: number;
  submittedByUserId: string;
  submitted_by_user_id: string;
  approverUserId: string;
  approver_user_id: string;
  decisionComment: string;
  decision_comment: string;
  submittedAt: string;
  submitted_at: string;
  decidedAt: string;
  decided_at: string;
  canEdit: boolean;
  can_edit: boolean;
  canSubmit: boolean;
  can_submit: boolean;
  canApprove: boolean;
  can_approve: boolean;
  canRequestChanges: boolean;
  can_request_changes: boolean;
  canArchive: boolean;
  can_archive: boolean;
}>;

type WorkflowEventApi = Partial<{
  id: string;
  workflowId: string;
  workflow_id: string;
  documentId: string;
  document_id: string;
  actorUserId: string;
  actor_user_id: string;
  eventType: string;
  event_type: string;
  previousStatus: DashboardDocumentStatus | string;
  previous_status: DashboardDocumentStatus | string;
  newStatus: DashboardDocumentStatus | string;
  new_status: DashboardDocumentStatus | string;
  documentVersion: number;
  document_version: number;
  comment: string;
  occurredAt: string;
  occurred_at: string;
}>;

interface WorkflowEventsApiResponse {
  items: Array<WorkflowEventApi>;
  total: number;
}

const parseGatewayContentDocument = (
  value: unknown,
): DashboardRichContentDocument | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'object') {
    return value as DashboardRichContentDocument;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as DashboardRichContentDocument;
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const getCapabilityFlag = (response: unknown, camel: string, snake: string): boolean => {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const obj = response as Record<string, unknown>;
  return Boolean(obj[camel] ?? obj[snake]);
};

const normalizeCapabilities = (response: unknown): DashboardDocumentCapabilities => ({
  canEdit: getCapabilityFlag(response, 'canEdit', 'can_edit'),
  canSubmit: getCapabilityFlag(response, 'canSubmit', 'can_submit'),
  canApprove: getCapabilityFlag(response, 'canApprove', 'can_approve'),
  canRequestChanges: getCapabilityFlag(response, 'canRequestChanges', 'can_request_changes'),
  canArchive: getCapabilityFlag(response, 'canArchive', 'can_archive'),
});

const normalizeGatewayDocument = (
  response: GatewayDocumentResponse,
): DashboardEditableDocument => ({
  id: response.id,
  title: response.title,
  category: response.category,
  status: (response.status as DashboardDocumentStatus | undefined) ?? 'DRAFT',
  version: typeof response.version === 'string' ? Number(response.version) : response.version ?? 1,
  contentDocument:
    parseGatewayContentDocument(response.contentDocument) ??
    parseGatewayContentDocument(response.content_document_json) ??
    parseGatewayContentDocument(response.contentDocumentJson) ??
    undefined,
  ...normalizeCapabilities(response),
});

const normalizeDocumentItem = (response: GatewayDocumentResponse): DocumentItem => ({
  id: response.id,
  title: response.title,
  category: response.category,
  status: (response.status as DashboardDocumentStatus | undefined) ?? 'DRAFT',
  updatedAt: response.updatedAt ?? response.updated_at ?? '',
  sizeKb: 0,
  version: typeof response.version === 'string' ? Number(response.version) : response.version,
  ownerUserId: response.ownerUserId ?? response.owner_user_id,
  ownerUserName: response.owner_user_name,
  ...normalizeCapabilities(response),
});

const extractRichContentText = (document: DashboardRichContentDocument | undefined): string => {
  if (!document) {
    return 'Содержимое документа не передано.';
  }

  const collectText = (nodes: Array<{ text?: string; content?: Array<DashboardRichContentNode> }> | undefined): Array<string> => {
    if (!nodes) {
      return [];
    }

    return nodes.flatMap((node) => [
      ...(node.text ? [node.text] : []),
      ...collectText(node.content),
    ]);
  };

  const text = collectText(document.content).join(' ').replace(/\s+/g, ' ').trim();

  return text || 'Содержимое документа пустое.';
};

const normalizePreviewDocument = (response: GatewayDocumentResponse): DashboardPreviewDocument => {
  const contentDocument =
    parseGatewayContentDocument(response.contentDocument) ??
    parseGatewayContentDocument(response.content_document_json) ??
    parseGatewayContentDocument(response.contentDocumentJson);

  return {
    id: response.id,
    title: response.title,
    category: response.category,
    status: (response.status as DashboardDocumentStatus | undefined) ?? 'DRAFT',
    version: typeof response.version === 'string' ? Number(response.version) : response.version ?? 1,
    updatedAt: response.updatedAt ?? response.updated_at ?? '',
    body: extractRichContentText(contentDocument),
    contentDocument,
    contentDocumentJson: contentDocument ? JSON.stringify(contentDocument, null, 2) : undefined,
    ownerUserId: response.ownerUserId ?? response.owner_user_id,
    ownerUserName: response.owner_user_name,
    ...normalizeCapabilities(response),
  };
};

const normalizeWorkflowInstance = (
  response: WorkflowInstanceApi,
): DashboardWorkflowInstance => ({
  id: response.id ?? '',
  documentId: response.documentId ?? response.document_id ?? '',
  currentStepCode: response.currentStepCode ?? response.current_step_code,
  status: (response.status as DashboardDocumentStatus | undefined) ?? 'DRAFT',
  assignedUserId: response.assignedUserId ?? response.assigned_user_id,
  updatedAt: response.updatedAt ?? response.updated_at ?? '',
  submittedVersion: Number(response.submittedVersion ?? response.submitted_version ?? 1),
  submittedByUserId: response.submittedByUserId ?? response.submitted_by_user_id ?? '',
  approverUserId: response.approverUserId ?? response.approver_user_id ?? '',
  decisionComment: response.decisionComment ?? response.decision_comment,
  submittedAt: response.submittedAt ?? response.submitted_at ?? '',
  decidedAt: response.decidedAt ?? response.decided_at,
  ...normalizeCapabilities(response),
});

const normalizeWorkflowEvent = (response: WorkflowEventApi): DashboardWorkflowEvent => ({
  id: response.id ?? '',
  workflowId: response.workflowId ?? response.workflow_id ?? '',
  documentId: response.documentId ?? response.document_id ?? '',
  actorUserId: response.actorUserId ?? response.actor_user_id ?? '',
  eventType: response.eventType ?? response.event_type ?? '',
  previousStatus: (response.previousStatus ?? response.previous_status ?? 'DRAFT') as DashboardDocumentStatus,
  newStatus: (response.newStatus ?? response.new_status ?? 'DRAFT') as DashboardDocumentStatus,
  documentVersion: Number(response.documentVersion ?? response.document_version ?? 1),
  comment: response.comment,
  occurredAt: response.occurredAt ?? response.occurred_at ?? '',
});

const toRelativeRu = (iso: string | undefined): string => {
  if (!iso) {
    return 'только что';
  }

  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'только что';
  }

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60000),
  );
  if (diffMinutes < 1) {
    return 'только что';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} дн назад`;
};

type DashboardEditorControlProfileApi = Partial<{
  id: string;
  contextType: DashboardEditorContextType;
  context_type: DashboardEditorContextType;
  contextKey: string;
  context_key: string;
  enabledControls: string[];
  enabled_controls: string[];
  disabledControls: string[];
  disabled_controls: string[];
  isActive: boolean;
  is_active: boolean;
  updatedByUserId: string;
  updated_by_user_id: string;
  updatedAt: string;
  updated_at: string;
}>;

const normalizeEditorControlProfile = (
  profile: DashboardEditorControlProfileApi,
  fallback: Pick<DashboardEditorControlProfile, 'contextType' | 'contextKey'>,
): DashboardEditorControlProfile => {
  const contextType = profile.contextType ?? profile.context_type ?? fallback.contextType;
  const contextKey = profile.contextKey ?? profile.context_key ?? fallback.contextKey;

  return {
    id: profile.id ?? `${contextType}:${contextKey}`,
    contextType,
    contextKey,
    enabledControls: Array.isArray(profile.enabledControls)
      ? [...profile.enabledControls]
      : Array.isArray(profile.enabled_controls)
        ? [...profile.enabled_controls]
        : [],
    disabledControls: Array.isArray(profile.disabledControls)
      ? [...profile.disabledControls]
      : Array.isArray(profile.disabled_controls)
        ? [...profile.disabled_controls]
        : [],
    isActive: profile.isActive ?? profile.is_active ?? true,
    updatedByUserId: profile.updatedByUserId ?? profile.updated_by_user_id ?? 'system',
    updatedAt: profile.updatedAt ?? profile.updated_at ?? new Date().toISOString(),
  };
};



@Injectable({ providedIn: 'root' })
export class DashboardHttpAdapter implements DocumentApiPort {
  private readonly http = inject(HttpClient);

   getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>> {
    return this.http.get<Array<WeeklyVolumePoint>>('/api/dashboard/weekly-volume');
  }

  getDocumentsData(query: DashboardQuery = {}): Observable<PaginatedResult<DocumentItem>> {
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 20;
    const params: Params = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    if (query.text) {
      params['q'] = query.text;
    }
    if (query.category) {
      params['category'] = query.category;
    }

    return this.http
      .get<GatewaySearchDocumentsResponse>(`/api/documents`, { params })
      .pipe(
        map((response) => ({
          items: response.items.map(normalizeDocumentItem),
          total: response.total,
          page,
          pageSize,
        })),
      );
  } 

   getActivity(query: DashboardQuery): Observable<Array<ActivityItem>> {
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 20;
    const params: Params = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    if (query.text) {
      params['q'] = query.text;
    }

    return this.http.get<GatewayActivityResponse>('/api/activity', { params }).pipe(
      map((response) =>
        (response.items ?? []).map((item) => ({
          id: item.id,
          actor: item.actorUserName ?? item.actor_user_name ?? 'Система',
          description: item.summary,
          timestampLabel: toRelativeRu(item.occurredAt ?? item.occurred_at),
          linkedDocumentId: item.documentId ?? item.document_id,
          linkedTaskId: item.taskId ?? item.task_id,
          linkedBoardId: item.boardId ?? item.board_id,
        })),
      ),
    );
  }

  public getStorageUsage(): Observable<StorageUsage> {
    return this.http.get<DashboardStorageResponse>('/api/dashboard/storage').pipe(
      map((response) => ({
        usedTb: Number(response.usedTb ?? 0),
        totalTb: Number(response.totalTb ?? 0),
        usedPercent: Number(response.usedPercent ?? 0),
      })),
    );
  }

  public previewDocument(id: string): Observable<DashboardPreviewDocument> {
    return this.http
      .get<GatewayDocumentResponse>(`/api/documents/${id}`)
      .pipe(map((response) => normalizePreviewDocument(response)));
  }

  public downloadDocument(id: string): Observable<void> {
    return this.http
      .get(`/api/documents/${id}/download`, { responseType: 'blob' as const })
      .pipe(
        map(() => void 0),
      );
  }

  public createDocument(payload: DashboardCreateDocumentPayload): Observable<DashboardEditableDocument> {
    return this.http
      .post<GatewayDocumentResponse>(
        '/api/documents',
        payload,
      )
      .pipe(
        map((response) => {
          const normalized = normalizeGatewayDocument(response);
          return {
            ...normalized,
            contentDocument: normalized.contentDocument ?? payload.contentDocument ?? emptyRichDocument(),
          };
        }),
      );
  }

  public getDocumentById(id: string): Observable<DashboardEditableDocument> {
    return this.http.get<GatewayDocumentResponse>(`/api/documents/${id}`).pipe(
      map((response) => normalizeGatewayDocument(response)),
    );
  }

  public getDocumentVersions(
    id: string,
    options: { limit?: number; offset?: number } = {},
  ): Observable<{ items: Array<Record<string, unknown>>; total: number }> {
    const params: Params = {};
    if (options.limit !== undefined) {
      params['limit'] = options.limit;
    }
    if (options.offset !== undefined) {
      params['offset'] = options.offset;
    }
    return this.http.get<{ items: Array<Record<string, unknown>>; total: number }>(`/api/documents/${id}/versions`, { params });
  }

  public getDocumentVersion(id: string, versionNumber: number): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/documents/${id}/versions/${versionNumber}`);
  }

  public updateDocument(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    return this.http
      .patch<GatewayDocumentResponse>(`/api/documents/${id}`, {
        title: payload.title,
        expectedVersion: payload.expectedVersion ?? 1,
        contentDocument: payload.contentDocument,
      })
      .pipe(
        map((response) => ({
          id: response.id,
          title: response.title,
          category: response.category,
          status: (response.status as DashboardDocumentStatus | undefined) ?? 'DRAFT',
          updatedAt: response.updatedAt ?? response.updated_at ?? '',
          sizeKb: 0,
          version: typeof response.version === 'string' ? parseInt(response.version, 10) : response.version,
          ...normalizeCapabilities(response),
        })),
      );
  }

  public submitWorkflow(
    id: string,
    payload: DashboardSubmitWorkflowPayload,
  ): Observable<DashboardWorkflowInstance> {
    return this.http
      .post<WorkflowInstanceApi>(`/api/documents/${id}/workflow/submit`, payload)
      .pipe(map((response) => normalizeWorkflowInstance(response)));
  }

  public approveWorkflow(
    id: string,
    payload: DashboardApproveWorkflowPayload,
  ): Observable<DashboardWorkflowInstance> {
    return this.http
      .post<WorkflowInstanceApi>(`/api/documents/${id}/workflow/approve`, payload)
      .pipe(map((response) => normalizeWorkflowInstance(response)));
  }

  public requestWorkflowChanges(
    id: string,
    payload: DashboardRequestWorkflowChangesPayload,
  ): Observable<DashboardWorkflowInstance> {
    return this.http
      .post<WorkflowInstanceApi>(`/api/documents/${id}/workflow/request-changes`, payload)
      .pipe(map((response) => normalizeWorkflowInstance(response)));
  }

  public archiveDocument(
    id: string,
    payload: DashboardArchiveDocumentPayload,
  ): Observable<DashboardArchiveDocumentResult> {
    return this.http.post<DashboardArchiveDocumentResult>(`/api/documents/${id}/archive`, payload);
  }

  public getWorkflow(id: string): Observable<DashboardWorkflowInstance> {
    return this.http
      .get<WorkflowInstanceApi>(`/api/documents/${id}/workflow`)
      .pipe(map((response) => normalizeWorkflowInstance(response)));
  }

  public getWorkflowEvents(
    id: string,
    options: { limit?: number; offset?: number } = {},
  ): Observable<{ items: Array<DashboardWorkflowEvent>; total: number }> {
    const params: Params = {};
    if (options.limit !== undefined) {
      params['limit'] = options.limit;
    }
    if (options.offset !== undefined) {
      params['offset'] = options.offset;
    }

    return this.http
      .get<WorkflowEventsApiResponse>(`/api/documents/${id}/workflow/events`, { params })
      .pipe(
        map((response) => ({
          items: (response.items ?? []).map((item) => normalizeWorkflowEvent(item)),
          total: Number(response.total ?? 0),
        })),
      );
  }

  public getEditorControlProfile(
    contextType: DashboardEditorContextType,
    contextKey: string,
  ): Observable<DashboardEditorControlProfile> {
    return this.http
      .get<DashboardEditorControlProfileApi>(`/api/editor-control-profiles/${contextType}/${contextKey}`)
      .pipe(
        map((profile) => normalizeEditorControlProfile(profile, { contextType, contextKey })),
      );
  }

  public updateEditorControlProfile(
    profileId: string,
    payload: DashboardUpdateEditorControlProfilePayload,
  ): Observable<DashboardEditorControlProfile> {
    return this.http
      .put<DashboardEditorControlProfileApi>(`/api/editor-control-profiles/${profileId}`, payload)
      .pipe(
        map((profile) =>
          normalizeEditorControlProfile(profile, {
            contextType: payload.contextType ?? 'CATEGORY',
            contextKey: payload.contextKey ?? 'GENERAL',
          }),
        ),
      );
  }

  public createExportRequest(
    documentId: string,
    payload: DashboardCreateExportPayload,
  ): Observable<DashboardExportRequest> {
    return this.http
      .post<DashboardExportRequest>(`/api/documents/${documentId}/exports`, payload)
  }

  public getExportRequest(documentId: string, exportRequestId: string): Observable<DashboardExportRequest> {
    return this.http
      .get<DashboardExportRequest>(`/api/documents/${documentId}/exports/${exportRequestId}`)
  }

  public downloadExportArtifact(documentId: string, exportRequestId: string): Observable<Blob> {
    return this.http
      .get(`/api/documents/${documentId}/exports/${exportRequestId}/download`, {
        responseType: 'blob' as const,
      })
  }
}
