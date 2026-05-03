import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import {
  ActivityItem,
  DashboardCreateDocumentPayload,
  DashboardCreateExportPayload,
  DashboardEditableDocument,
  DashboardEditorContextType,
  DashboardEditorControlProfile,
  DashboardExportRequest,
  DashboardDocumentStatus,
  DashboardDocumentType,
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardQuery,
  DashboardRichContentDocument,
  DashboardSummary,
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
  category: 'HR' | 'FINANCE' | 'GENERAL';
  status: string;
  version?: number | string;
  updated_at: string;
  contentDocument?: DashboardRichContentDocument;
  content_document_json?: string;
  contentDocumentJson?: string;
}

const mapGatewayStatus = (status: string): DashboardDocumentStatus => {
  switch (status) {
    case 'IN_REVIEW':
      return 'review';
    case 'APPROVED':
      return 'finalized';
    case 'ARCHIVED':
      return 'archived';
    default:
      return 'pending';
  }
};

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
  status: mapGatewayStatus(response.status),
  version: typeof response.version === 'string' ? Number(response.version) : response.version ?? 1,
  contentDocument:
    parseGatewayContentDocument(response.contentDocument) ??
    parseGatewayContentDocument(response.content_document_json) ??
    parseGatewayContentDocument(response.contentDocumentJson) ??
    undefined,
});

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

  public getDashboardSummary(query: DashboardQuery): Observable<DashboardSummary> {
    return this.getDocumentsData(query).pipe(
      map((result) => {
        const pendingApprovalCount = result.items.filter(
          (documentItem) => documentItem.status === 'pending',
        ).length;

        const actionItemsCount = result.items.filter(
          (documentItem) => documentItem.status === 'review',
        ).length;

        return {
          pendingApprovalCount,
          pendingApprovalDelta: 2,
          actionItemsCount,
          overdueNoticesCount: 3,
        };
      }),
    );
  }

   getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>> {
    return of(MOCK_WEEKLY_VOLUME)
  }

  getDocumentsData(query: Params): Observable<PaginatedResult<DocumentItem>> {
   return this.http
      .get<PaginatedResult<DocumentItem>>(`/api/documents`, {
        params: query
      })
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
    const documentItem = [{id: 'asdasd', title: 'asdasd'}].find((item) => item.id === id);
    if (!documentItem) {
      return throwError(() => new Error('Документ не найден'))
    }

    return of({
      id: documentItem.id,
      title: documentItem.title,
      body: `Предпросмотр документа ${documentItem.title} (мок-данные).`,
    })
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
      .post<{ id: string; title: string; category: 'HR' | 'FINANCE' | 'GENERAL'; status?: string; version?: number }>(
        '/api/documents',
        payload,
      )
      .pipe(
        map((response) => {
          const mappedStatus: DashboardDocumentStatus =
            response.status === 'archived' ||
            response.status === 'review' ||
            response.status === 'finalized'
              ? response.status
              : 'pending';

          return {
            id: response.id,
            title: response.title,
            category: response.category,
            status: mappedStatus,
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
          status: mapGatewayStatus(response.status),
          updated_at: response.updated_at,
          type: 'pdf' as DashboardDocumentType, // current?.type ?? 'pdf',
          sizeKb: 0, // current?.sizeKb ?? 0,
          version: typeof response.version === 'string' ? parseInt(response.version, 10) : response.version,
        })),
      );
  }

  public updateDraft(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    return this.updateDocument(id, payload);
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
