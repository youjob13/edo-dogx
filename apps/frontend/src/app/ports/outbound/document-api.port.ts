import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityItem,
  DashboardApproveWorkflowPayload,
  DashboardArchiveDocumentPayload,
  DashboardArchiveDocumentResult,
  DashboardCreateDocumentPayload,
  DashboardCreateProductPayload,
  DashboardEditableDocument,
  DashboardEditDocumentPayload,
  DashboardEditorControlProfile,
  DashboardEditorContextType,
  DashboardUpdateEditorControlProfilePayload,
  DashboardCreateExportPayload,
  DashboardExportRequest,
  DashboardRequestWorkflowChangesPayload,
  DashboardSubmitWorkflowPayload,
  DashboardPreviewDocument,
  DashboardProduct,
  DashboardQuery,
  DashboardWorkflowEvent,
  DashboardWorkflowInstance,
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
  createDocument(payload: DashboardCreateDocumentPayload): Observable<DashboardEditableDocument>;
  createProduct(payload: DashboardCreateProductPayload): Observable<DashboardProduct>;
  getProducts(): Observable<Array<DashboardProduct>>;
  getProductById(id: string): Observable<DashboardProduct>;
  getDocumentById(id: string): Observable<DashboardEditableDocument>;
  getDocumentVersions(
    id: string,
    options?: { limit?: number; offset?: number },
  ): Observable<{ items: Array<Record<string, unknown>>; total: number }>;
  getDocumentVersion(id: string, versionNumber: number): Observable<Record<string, unknown>>;
  updateDocument(id: string, payload: DashboardEditDocumentPayload): Observable<DocumentItem>;
  submitWorkflow(id: string, payload: DashboardSubmitWorkflowPayload): Observable<DashboardWorkflowInstance>;
  approveWorkflow(id: string, payload: DashboardApproveWorkflowPayload): Observable<DashboardWorkflowInstance>;
  requestWorkflowChanges(
    id: string,
    payload: DashboardRequestWorkflowChangesPayload,
  ): Observable<DashboardWorkflowInstance>;
  archiveDocument(id: string, payload: DashboardArchiveDocumentPayload): Observable<DashboardArchiveDocumentResult>;
  getWorkflow(id: string): Observable<DashboardWorkflowInstance>;
  getWorkflowEvents(
    id: string,
    options?: { limit?: number; offset?: number },
  ): Observable<{ items: Array<DashboardWorkflowEvent>; total: number }>;
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
