import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityItem,
  KanbanBoardDetails,
  KanbanBoardSummary,
  KanbanTask,
  KanbanTaskAssignPayload,
  KanbanTaskCommentPayload,
  KanbanTaskDetails,
  KanbanTaskMovePayload,
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
  DashboardSummary,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  WeeklyVolumePoint,
} from '../../domain/dashboard/dashboard.models';

export interface DashboardApiPort {
  getDashboardSummary(query: DashboardQuery): Observable<DashboardSummary>;
  getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>>;
  getDocuments(query: DashboardQuery): Observable<PaginatedResult<DocumentItem>>;
  getActivity(query: DashboardQuery): Observable<Array<ActivityItem>>;
  getStorageUsage(): Observable<StorageUsage>;
  previewDocument(id: string): Observable<DashboardPreviewDocument>;
  downloadDocument(id: string): Observable<void>;
  createDocument(payload: DashboardCreateDocumentPayload): Observable<DashboardEditableDocument>;
  getDocumentById(id: string): Observable<DashboardEditableDocument>;
  updateDraft(id: string, payload: DashboardEditDocumentPayload): Observable<DocumentItem>;
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
  getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>>;
  getTaskBoard(boardId: string): Observable<KanbanBoardDetails>;
  getTaskDetails(boardId: string, taskId: string): Observable<KanbanTaskDetails>;
  assignTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskAssignPayload,
  ): Observable<KanbanTask>;
  moveTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskMovePayload,
  ): Observable<KanbanTask>;
  addTaskComment(
    boardId: string,
    taskId: string,
    payload: KanbanTaskCommentPayload,
  ): Observable<KanbanTask>;
}

export const DASHBOARD_API_PORT = new InjectionToken<DashboardApiPort>(
  'DASHBOARD_API_PORT',
);
