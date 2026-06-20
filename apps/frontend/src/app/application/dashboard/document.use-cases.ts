import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityItem,
  DashboardApproveWorkflowPayload,
  DashboardArchiveDocumentPayload,
  DashboardArchiveDocumentResult,
  DashboardConflictError,
  DashboardCreateDocumentPayload,
  DashboardCreateProductPayload,
  DashboardCreateExportPayload,
  DashboardEditableDocument,
  DashboardEditDocumentPayload,
  DashboardEditorContextType,
  DashboardEditorControlProfile,
  DashboardExportRequest,
  DashboardRequestWorkflowChangesPayload,
  DashboardSubmitWorkflowPayload,
  DashboardUpdateEditorControlProfilePayload,
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
import {
  DOCUMENT_API_PORT,
  DocumentApiPort,
} from '../../ports/outbound/document-api.port';

@Injectable({ providedIn: 'root' })
export class DocumentUseCases {
  private readonly api: DocumentApiPort = inject(DOCUMENT_API_PORT);

  public getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>> {
    return this.api.getWeeklyVolume();
  }

  public getDocuments(query?: DashboardQuery): Observable<PaginatedResult<DocumentItem>> {
    return this.api.getDocumentsData(query);
  }

  public getActivity(query: DashboardQuery): Observable<Array<ActivityItem>> {
    return this.api.getActivity(query);
  }

  public getStorageUsage(): Observable<StorageUsage> {
    return this.api.getStorageUsage();
  }

  public previewDocument(id: string): Observable<DashboardPreviewDocument> {
    return this.api.previewDocument(id);
  }

  public createDocument(payload: DashboardCreateDocumentPayload): Observable<DashboardEditableDocument> {
    return this.api.createDocument(payload);
  }

  public createProduct(payload: DashboardCreateProductPayload): Observable<DashboardProduct> {
    return this.api.createProduct(payload);
  }

  public getProducts(): Observable<Array<DashboardProduct>> {
    return this.api.getProducts();
  }

  public getProductById(id: string): Observable<DashboardProduct> {
    return this.api.getProductById(id);
  }

  public getDocumentById(id: string): Observable<DashboardEditableDocument> {
    return this.api.getDocumentById(id);
  }

  public getDocumentVersions(
    id: string,
    options?: { limit?: number; offset?: number },
  ): Observable<{ items: Array<Record<string, unknown>>; total: number }> {
    return this.api.getDocumentVersions(id, options);
  }

  public getDocumentVersion(id: string, versionNumber: number): Observable<Record<string, unknown>> {
    return this.api.getDocumentVersion(id, versionNumber);
  }

  public updateDocument(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    return this.api.updateDocument(id, payload);
  }

  public submitWorkflow(
    id: string,
    payload: DashboardSubmitWorkflowPayload,
  ): Observable<DashboardWorkflowInstance> {
    return this.api.submitWorkflow(id, payload);
  }

  public approveWorkflow(
    id: string,
    payload: DashboardApproveWorkflowPayload,
  ): Observable<DashboardWorkflowInstance> {
    return this.api.approveWorkflow(id, payload);
  }

  public requestWorkflowChanges(
    id: string,
    payload: DashboardRequestWorkflowChangesPayload,
  ): Observable<DashboardWorkflowInstance> {
    return this.api.requestWorkflowChanges(id, payload);
  }

  public archiveDocument(
    id: string,
    payload: DashboardArchiveDocumentPayload,
  ): Observable<DashboardArchiveDocumentResult> {
    return this.api.archiveDocument(id, payload);
  }

  public getWorkflow(id: string): Observable<DashboardWorkflowInstance> {
    return this.api.getWorkflow(id);
  }

  public getWorkflowEvents(
    id: string,
    options?: { limit?: number; offset?: number },
  ): Observable<{ items: Array<DashboardWorkflowEvent>; total: number }> {
    return this.api.getWorkflowEvents(id, options);
  }

  public getEditorControlProfile(
    contextType: DashboardEditorContextType,
    contextKey: string,
  ): Observable<DashboardEditorControlProfile> {
    return this.api.getEditorControlProfile(contextType, contextKey);
  }

  public updateEditorControlProfile(
    profileId: string,
    payload: DashboardUpdateEditorControlProfilePayload,
  ): Observable<DashboardEditorControlProfile> {
    return this.api.updateEditorControlProfile(profileId, payload);
  }

  public createExportRequest(
    documentId: string,
    payload: DashboardCreateExportPayload,
  ): Observable<DashboardExportRequest> {
    return this.api.createExportRequest(documentId, payload);
  }

  public getExportRequest(documentId: string, exportRequestId: string): Observable<DashboardExportRequest> {
    return this.api.getExportRequest(documentId, exportRequestId);
  }

  public downloadExportArtifact(documentId: string, exportRequestId: string): Observable<Blob> {
    return this.api.downloadExportArtifact(documentId, exportRequestId);
  }

  public parseConflictError(error: unknown): DashboardConflictError | null {
    if (!(error instanceof Error) || !error.message.includes('VERSION_CONFLICT')) {
      return null;
    }

    const expectedMatch = /expected=(\d+)/i.exec(error.message);
    const currentMatch = /current=(\d+)/i.exec(error.message);

    return {
      code: 'VERSION_CONFLICT',
      message: 'Документ изменился в другой сессии',
      expectedVersion: expectedMatch ? Number(expectedMatch[1]) : 0,
      currentVersion: currentMatch ? Number(currentMatch[1]) : 0,
    };
  }
}

