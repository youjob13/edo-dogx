import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  KanbanBoardDetails,
  KanbanBoardSummary,
  KanbanTask,
  KanbanTaskAssignPayload,
  KanbanTaskCommentPayload,
  KanbanTaskCreatePayload,
  KanbanTaskDetails,
  KanbanTaskMovePayload,
  KanbanTaskUpdateStatusPayload,
  AvailableApproverItem,
  AvailableDocumentItem,
} from '../../domain/dashboard/dashboard.models';
import { DashboardApiPort } from '../../ports/outbound/dashboard-api.port';
import type { CreateTaskRequest, TaskResponse } from '@edo/types';

@Injectable({ providedIn: 'root' })
export class DashboardMockHttpAdapter implements DashboardApiPort {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api';

  public getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>> {
    return this.http.get<Array<KanbanBoardSummary>>(`${this.apiBaseUrl}/boards`, {
      params: { organizationId },
    });
  }

  public getTaskBoard(boardId: string): Observable<KanbanBoardDetails> {
    return this.http.get<KanbanBoardDetails>(`${this.apiBaseUrl}/boards/${boardId}`);
  }

  public getTaskDetails(boardId: string, taskId: string): Observable<KanbanTaskDetails> {
    return this.http.get<KanbanTaskDetails>(`${this.apiBaseUrl}/tasks/${taskId}`);
  }

  public assignTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskAssignPayload,
  ): Observable<KanbanTask> {
    return this.http.patch<KanbanTask>(`${this.apiBaseUrl}/tasks/${taskId}`, payload);
  }

  public moveTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskMovePayload,
  ): Observable<KanbanTask> {
    return this.http.patch<KanbanTask>(`${this.apiBaseUrl}/tasks/${taskId}/status`, payload);
  }

  public addTaskComment(
    boardId: string,
    taskId: string,
    payload: KanbanTaskCommentPayload,
  ): Observable<KanbanTask> {
    return this.http.post<KanbanTask>(`${this.apiBaseUrl}/tasks/${taskId}/comments`, payload);
  }

  public createTask(payload: KanbanTaskCreatePayload): Observable<TaskResponse> {
    const createRequest: CreateTaskRequest = {
      title: payload.title,
      description: payload.description,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
      approverId: payload.approverId,
      approverName: payload.approverName,
      taskType: payload.taskType,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      priority: payload.priority,
      attachmentIds: payload.attachmentIds,
    };

    return this.http.post<TaskResponse>(`${this.apiBaseUrl}/tasks`, createRequest);
  }

  public updateTaskStatus(taskId: string, payload: KanbanTaskUpdateStatusPayload): Observable<KanbanTask> {
    return this.http.patch<KanbanTask>(`${this.apiBaseUrl}/tasks/${taskId}/status`, payload);
  }

  public getAvailableApprovers(): Observable<Array<AvailableApproverItem>> {
    return this.http.get<Array<AvailableApproverItem>>(`${this.apiBaseUrl}/tasks/available-approvers`);
  }

  public getAvailableDocuments(
    limit = 50,
    offset = 0,
  ): Observable<{ documents: Array<AvailableDocumentItem>; limit: number; offset: number }> {
    return this.http.get<{ documents: Array<AvailableDocumentItem>; limit: number; offset: number }>(
      `${this.apiBaseUrl}/tasks/available-documents`,
      {
        params: { limit, offset },
      },
    );
  }
}
