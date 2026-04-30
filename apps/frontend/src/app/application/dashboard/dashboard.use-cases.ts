import { Injectable, inject } from '@angular/core';
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
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardQuery,
  DashboardSummary,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  WeeklyVolumePoint,
} from '../../domain/dashboard/dashboard.models';
import {
  DASHBOARD_API_PORT,
  DashboardApiPort,
} from '../../ports/outbound/dashboard-api.port';

@Injectable({ providedIn: 'root' })
export class DashboardUseCases {
  private readonly api: DashboardApiPort = inject(DASHBOARD_API_PORT);

  public getDashboardSummary(query: DashboardQuery): Observable<DashboardSummary> {
    return this.api.getDashboardSummary(query);
  }

  public getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>> {
    return this.api.getWeeklyVolume();
  }

  public getDocuments(query: DashboardQuery): Observable<PaginatedResult<DocumentItem>> {
    return this.api.getDocuments(query);
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

  public downloadDocument(id: string): Observable<void> {
    return this.api.downloadDocument(id);
  }

  public updateDocument(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    return this.api.updateDocument(id, payload);
  }

  public getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>> {
    return this.api.getTaskBoards(organizationId);
  }

  public getTaskBoard(boardId: string): Observable<KanbanBoardDetails> {
    return this.api.getTaskBoard(boardId);
  }

  public getTaskDetails(boardId: string, taskId: string): Observable<KanbanTaskDetails> {
    return this.api.getTaskDetails(boardId, taskId);
  }

  public assignTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskAssignPayload,
  ): Observable<KanbanTask> {
    return this.api.assignTask(boardId, taskId, payload);
  }

  public moveTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskMovePayload,
  ): Observable<KanbanTask> {
    return this.api.moveTask(boardId, taskId, payload);
  }

  public addTaskComment(
    boardId: string,
    taskId: string,
    payload: KanbanTaskCommentPayload,
  ): Observable<KanbanTask> {
    return this.api.addTaskComment(boardId, taskId, payload);
  }
}
