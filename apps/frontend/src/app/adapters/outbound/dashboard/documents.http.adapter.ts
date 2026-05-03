import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import {
  ActivityItem,
  DashboardCreateDocumentPayload,
  DashboardCreateExportPayload,
  DashboardEditableDocument,
  DashboardEditorContextType,
  DashboardEditorControlProfile,
  DashboardExportRequest,
  DashboardDocumentCategory,
  DashboardDocumentStatus,
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardQuery,
  DashboardRichContentDocument,
  DashboardRichContentNode,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  DashboardUpdateEditorControlProfilePayload,
  WeeklyVolumePoint,
} from '../../../domain/dashboard/dashboard.models';
import { DocumentApiPort } from '../../../ports/outbound/document-api.port';
import { Params } from '@angular/router';

const MOCK_WEEKLY_VOLUME: Array<WeeklyVolumePoint> = [
  { day: 'mon', value: 22 },
  { day: 'tue', value: 45 },
  { day: 'wed', value: 30 },
  { day: 'thu', value: 80 },
  { day: 'fri', value: 100 },
  { day: 'sat', value: 63 },
  { day: 'sun', value: 40 },
];

const MOCK_ACTIVITY: Array<ActivityItem> = [
  {
    id: 'a1',
    actor: 'Сара Миллер',
    description: 'подтвердила Procurement_04.pdf',
    timestampLabel: '12 минут назад',
    linkedDocumentId: 'd1',
  },
  {
    id: 'a2',
    actor: 'Система',
    description: 'загрузила 124 записи из API_Inbound',
    timestampLabel: '45 минут назад',
  },
  {
    id: 'a3',
    actor: 'Дэвид Чен',
    description: 'отметил несоответствие в Tax_Return_2023.pdf',
    timestampLabel: '1 час назад',
    linkedDocumentId: 'd6',
  },
  {
    id: 'a4',
    actor: 'Внешний доступ',
    description: 'предоставлен группе Legal Partners Group',
    timestampLabel: '2 часа назад',
  },
];


const emptyRichDocument = (): DashboardRichContentDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

interface GatewayDocumentResponse {
  id: string;
  title: string;
  category: DashboardDocumentCategory;
  status: DashboardDocumentStatus;
  ownerUserId?: string;
  owner_user_id?: string;
  owner_user_name?: string;
  version?: number | string;
  updatedAt?: string;
  updated_at?: string;
  contentDocument?: DashboardRichContentDocument;
  content_document_json?: string;
  contentDocumentJson?: string;
}

interface GatewaySearchDocumentsResponse {
  items: Array<GatewayDocumentResponse>;
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

const normalizeGatewayDocument = (
  response: GatewayDocumentResponse,
): DashboardEditableDocument => ({
  id: response.id,
  title: response.title,
  category: response.category,
  status: response.status,
  version: typeof response.version === 'string' ? Number(response.version) : response.version ?? 1,
  contentDocument:
    parseGatewayContentDocument(response.contentDocument) ??
    parseGatewayContentDocument(response.content_document_json) ??
    parseGatewayContentDocument(response.contentDocumentJson) ??
    undefined,
});

const normalizeDocumentItem = (response: GatewayDocumentResponse): DocumentItem => ({
  id: response.id,
  title: response.title,
  category: response.category,
  status: response.status,
  updatedAt: response.updatedAt ?? response.updated_at ?? '',
  sizeKb: 0,
  version: typeof response.version === 'string' ? Number(response.version) : response.version,
  ownerUserId: response.ownerUserId ?? response.owner_user_id,
  ownerUserName: response.owner_user_name,
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
    status: response.status,
    version: typeof response.version === 'string' ? Number(response.version) : response.version ?? 1,
    updatedAt: response.updatedAt ?? response.updated_at ?? '',
    body: extractRichContentText(contentDocument),
    contentDocument,
    contentDocumentJson: contentDocument ? JSON.stringify(contentDocument, null, 2) : undefined,
    ownerUserId: response.ownerUserId ?? response.owner_user_id,
    ownerUserName: response.owner_user_name,
  };
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
    return of(MOCK_WEEKLY_VOLUME)
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
    if (query.status) {
      params['status'] = query.status;
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
    const text = query.text?.trim().toLowerCase();
    let activity = [...MOCK_ACTIVITY];

    if (text && text.length > 0) {
      activity = activity.filter((activityItem) =>
        `${activityItem.actor} ${activityItem.description}`
          .toLowerCase()
          .includes(text),
      );
    }

    return of(activity)
  }

  public getStorageUsage(): Observable<StorageUsage> {
    return of({
      usedTb: 1.2,
      totalTb: 1.5,
      usedPercent: 80,
    })
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
      .post<{ id: string; title: string; category: DashboardDocumentCategory; status: DashboardDocumentStatus; version?: number }>(
        '/api/documents',
        payload,
      )
      .pipe(
        map((response) => {
                  return {
            id: response.id,
            title: response.title,
            category: response.category,
            status: response.status,
            contentDocument: payload.contentDocument ?? emptyRichDocument(),
            version: response.version ?? 1,
          };
        }),
      );
  }

  public getDocumentById(id: string): Observable<DashboardEditableDocument> {
    return this.http.get<GatewayDocumentResponse>(`/api/documents/${id}`).pipe(
      map((response) => normalizeGatewayDocument(response)),
    );
  }

   updateDocument(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    return this.http
      .patch<GatewayDocumentResponse>(`/api/documents/${id}`, {
        title: payload.title,
        expectedVersion: payload.expectedVersion ?? 1,
        status: payload.status,
        contentDocument: payload.contentDocument,
      })
      .pipe(
        map((response) => ({
          id: response.id,
          title: response.title,
          status: response.status,
          category: response.category,
          updatedAt: response.updatedAt ?? response.updated_at ?? '',
          sizeKb: 0,
          version: typeof response.version === 'string' ? parseInt(response.version, 10) : response.version,
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
