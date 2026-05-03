import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityItem,
  DashboardCreateDocumentPayload,
  DashboardEditableDocument,
  DashboardEditDocumentPayload,
  DashboardEditorControlProfile,
  DashboardEditorContextType,
  DashboardUpdateEditorControlProfilePayload,
  DashboardCreateExportPayload,
  DashboardExportRequest,
  DashboardPreviewDocument,
  DashboardQuery,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  WeeklyVolumePoint,
} from '../../domain/dashboard/dashboard.models';

export interface DocumentApiPort {
  getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>>;
  getDocumentsData(query?: DashboardQuery): Observable<PaginatedResult<DocumentItem>>;
  getActivity(query: DashboardQuery): Observable<Array<ActivityItem>>;
  getStorageUsage(): Observable<StorageUsage>;
  previewDocument(id: string): Observable<DashboardPreviewDocument>;
  downloadDocument(id: string): Observable<void>;
  createDocument(payload: DashboardCreateDocumentPayload): Observable<DashboardEditableDocument>;
  getDocumentById(id: string): Observable<DashboardEditableDocument>;
  updateDocument(id: string, payload: DashboardEditDocumentPayload): Observable<DocumentItem>;
  getEditorControlProfile(contextType: DashboardEditorContextType, contextKey: string): Observable<DashboardEditorControlProfile>;
  updateEditorControlProfile(
    profileId: string,
    payload: DashboardUpdateEditorControlProfilePayload,
  ): Observable<DashboardEditorControlProfile>;
  createExportRequest(
    documentId: string,
    payload: DashboardCreateExportPayload,
  ): Observable<DashboardExportRequest>;
  getExportRequest(documentId: string, exportRequestId: string): Observable<DashboardExportRequest>;
  downloadExportArtifact(documentId: string, exportRequestId: string): Observable<Blob>;
}

export const DOCUMENT_API_PORT = new InjectionToken<DocumentApiPort>(
  'DOCUMENT_API_PORT',
);
