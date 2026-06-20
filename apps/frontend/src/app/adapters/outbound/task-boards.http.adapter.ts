import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import {
  KanbanBoardDetails,
  KanbanBoardSummary,
  KanbanTask,
  KanbanTaskAssignPayload,
  KanbanTaskCommentPayload,
  KanbanTaskCreatePayload,
  KanbanTaskDetails,
  KanbanTaskListQuery,
  KanbanTaskMovePayload,
  KanbanTaskUpdateStatusPayload,
  AvailableApproverItem,
  AvailableDocumentItem,
  KanbanBoardCreatePayload,
  OrganizationMember,
  TaskAttachmentAddPayload,
} from '../../domain/dashboard/dashboard.models';
import type { CreateTaskRequest, TaskResponse } from '@edo/types';
import { TaskBoardsApiPort } from '../../ports/outbound/task-boards-api.port';

interface GatewayTaskBoardsResponse {
  boards: Array<KanbanBoardSummary>;
  total: number;
  page: number;
  pageSize: number;
}

interface GatewayCreateTaskBoardResponse {
  board: KanbanBoardSummary;
}

interface GatewayAvailableApproversResponse {
  approvers: Array<AvailableApproverItem>;
}

interface GatewayOrganizationMembersResponse {
  items: Array<OrganizationMember>;
  total: number;
}

interface GatewayTaskDetailsResponse {
  board: KanbanBoardSummary;
  task: KanbanTask;
  members: Array<{ id: string; fullName: string; department: string }>;
  currentUserId: string;
  canEdit: boolean;
  canAssign: boolean;
  canMoveToReview: boolean;
  canApprove: boolean;
  canComment: boolean;
}

interface GatewayTaskResponse {
  task: KanbanTask;
}

interface GatewayTasksResponse {
  tasks: Array<KanbanTask>;
}

@Injectable({ providedIn: 'root' })
export class TaskBoardsHttpAdapter implements TaskBoardsApiPort {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api';

  public getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>> {
    return this.http
      .get<GatewayTaskBoardsResponse>(`${this.apiBaseUrl}/boards`, {
        params: { organizationId },
      })
      .pipe(map((response) => response.boards));
  }

  public createTaskBoard(payload: KanbanBoardCreatePayload): Observable<KanbanBoardSummary> {
    return this.http
      .post<GatewayCreateTaskBoardResponse>(`${this.apiBaseUrl}/boards`, payload)
      .pipe(map((response) => response.board));
  }

  public getTaskBoard(boardId: string): Observable<KanbanBoardDetails> {
    return this.http.get<KanbanBoardDetails>(`${this.apiBaseUrl}/boards/${boardId}`);
  }

  public listTasks(query: KanbanTaskListQuery = {}): Observable<Array<KanbanTask>> {
    const params: Record<string, string> = {};
    if (query.scope) {
      params['scope'] = query.scope;
    }
    if (query.status) {
      params['status'] = query.status;
    }
    if (query.taskType) {
      params['taskType'] = query.taskType;
    }
    if (query.assigneeId) {
      params['assigneeId'] = query.assigneeId;
    }

    return this.http.get<GatewayTasksResponse>(`${this.apiBaseUrl}/tasks`, { params }).pipe(
      map((response) =>
        (response.tasks ?? []).map((task) => this.normalizeTaskDetails(task, [])),
      ),
    );
  }

  public getTaskDetails(boardId: string, taskId: string): Observable<KanbanTaskDetails> {
    return this.http
      .get<GatewayTaskDetailsResponse>(`${this.apiBaseUrl}/tasks/${taskId}`, {
        params: { boardId },
      })
      .pipe(
        map((response) => ({
          board: {
            ...response.board,
            id: response.board?.id || boardId,
          },
          task: this.normalizeTaskDetails(response.task, response.members),
          members: response.members,
          currentUserId: response.currentUserId,
          canEdit: response.canEdit,
          canAssign: response.canAssign,
          canMoveToReview: response.canMoveToReview,
          canApprove: response.canApprove,
          canComment: response.canComment,
        })),
      );
  }

  public assignTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskAssignPayload,
  ): Observable<KanbanTask> {
    return this.http
      .patch<GatewayTaskResponse>(`${this.apiBaseUrl}/tasks/${taskId}/assignee`, payload)
      .pipe(switchMap((response) => this.hydrateTask(boardId, taskId, response.task)));
  }

  public moveTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskMovePayload,
  ): Observable<KanbanTask> {
    return this.http
      .patch<GatewayTaskResponse>(`${this.apiBaseUrl}/tasks/${taskId}/status`, payload)
      .pipe(switchMap((response) => this.hydrateTask(boardId, taskId, response.task)));
  }

  public addTaskComment(
    boardId: string,
    taskId: string,
    payload: KanbanTaskCommentPayload,
  ): Observable<KanbanTask> {
    return this.http
      .post<GatewayTaskResponse>(`${this.apiBaseUrl}/tasks/${taskId}/comments`, payload, {
        params: { boardId },
      })
      .pipe(switchMap((response) => this.hydrateTask(boardId, taskId, response.task)));
  }

  public addTaskAttachments(
    boardId: string,
    taskId: string,
    payload: TaskAttachmentAddPayload,
  ): Observable<KanbanTask> {
    return this.http
      .post<GatewayTaskResponse>(`${this.apiBaseUrl}/tasks/${taskId}/attachments`, payload, {
        params: { boardId },
      })
      .pipe(switchMap((response) => this.hydrateTask(boardId, taskId, response.task)));
  }

  public removeTaskAttachment(
    boardId: string,
    taskId: string,
    documentId: string,
  ): Observable<KanbanTask> {
    return this.http
      .delete<GatewayTaskResponse>(`${this.apiBaseUrl}/tasks/${taskId}/attachments/${documentId}`, {
        params: { boardId },
      })
      .pipe(switchMap((response) => this.hydrateTask(boardId, taskId, response.task)));
  }

  public createTask(payload: KanbanTaskCreatePayload): Observable<TaskResponse> {
    const createRequest: CreateTaskRequest = {
      boardId: payload.boardId,
      title: payload.title,
      description: payload.description,
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
      approverId: payload.approverId,
      approverName: payload.approverName,
      taskType: payload.taskType,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      attachmentIds: payload.attachmentIds,
    };

    return this.http
      .post<{task: TaskResponse}>(`${this.apiBaseUrl}/tasks`, createRequest)
      .pipe(map((response) => response.task));
  }

  public updateTaskStatus(
    taskId: string,
    payload: KanbanTaskUpdateStatusPayload,
  ): Observable<KanbanTask> {
    return this.http
      .patch<GatewayTaskResponse>(`${this.apiBaseUrl}/tasks/${taskId}/status`, payload)
      .pipe(map((response) => response.task));
  }

  public getAvailableApprovers(boardId: string): Observable<Array<AvailableApproverItem>> {
    return this.http
      .get<GatewayAvailableApproversResponse>(`${this.apiBaseUrl}/tasks/available-approvers`, {
        params: { boardId },
      })
      .pipe(map((response) => response.approvers));
  }

  public getAvailableDocuments(
    boardId: string,
    limit = 50,
    offset = 0,
  ): Observable<{ documents: Array<AvailableDocumentItem>; limit: number; offset: number }> {
    return this.http.get<{
      documents: Array<AvailableDocumentItem>;
      limit: number;
      offset: number;
    }>(`${this.apiBaseUrl}/tasks/available-documents`, {
      params: { boardId, limit, offset },
    });
  }

  public getOrganizationMembers(
    organizationId: string,
  ): Observable<{ items: Array<OrganizationMember>; total: number }> {
    return this.http.get<GatewayOrganizationMembersResponse>(
      `${this.apiBaseUrl}/organizations/${organizationId}/members`,
    );
  }

  public addBoardMember(
    boardId: string,
    userId: string,
  ): Observable<{ member: OrganizationMember }> {
    return this.http.post<{ member: OrganizationMember }>(
      `${this.apiBaseUrl}/boards/${boardId}/members`,
      {
        userId,
      },
    );
  }

  private normalizeTaskDetails(
    task: KanbanTask,
    members: Array<{ id: string; fullName: string; department: string }>,
  ): KanbanTask {
    const assigneeId = task.assigneeId ?? null;
    const assignee = assigneeId ? members.find((member) => member.id === assigneeId) : undefined;
    const dueDateLabel = task.dueDateLabel || this.formatDueDateLabel(task.dueDate);

    return {
      ...task,
      boardId: task.boardId,
      assigneeId,
      assigneeName: task.assigneeName || assignee?.fullName || 'Не назначен',
      department: task.department || assignee?.department || '',
      groupId: task.groupId || assigneeId || 'unassigned',
      groupName: task.groupName || assignee?.fullName || 'Не назначен',
      dueDateLabel,
      comments: Array.isArray(task.comments) ? task.comments : [],
      attachments: Array.isArray(task.attachments) ? task.attachments : [],
    };
  }

  private formatDueDateLabel(dueDate: KanbanTask['dueDate']): string {
    if (!dueDate) {
      return 'Без срока';
    }

    if (dueDate instanceof Date) {
      return dueDate.toISOString();
    }

    return dueDate;
  }

  private hydrateTask(
    boardId: string,
    taskId: string,
    task: Partial<KanbanTask> | null | undefined,
  ): Observable<KanbanTask> {
    if (!boardId || !taskId) {
      return of(
        this.normalizeTaskDetails(
          {
            ...(task ?? {}),
            id: task?.id || taskId,
            title: task?.title || '',
            status: task?.status || 'pending',
            assigneeId: task?.assigneeId ?? null,
            assigneeName: task?.assigneeName || 'Не назначен',
            department: task?.department || '',
            groupId: task?.groupId || (task?.assigneeId ?? 'unassigned'),
            groupName: task?.groupName || task?.assigneeName || 'Не назначен',
            dueDateLabel: task?.dueDateLabel || this.formatDueDateLabel(task?.dueDate),
            comments: Array.isArray(task?.comments) ? task.comments : [],
            creatorId: task?.creatorId || '',
            creatorName: task?.creatorName || '',
            attachments: Array.isArray(task?.attachments) ? task.attachments : [],
            taskType: task?.taskType || 'general',
            createdAt: task?.createdAt || new Date(),
            updatedAt: task?.updatedAt || new Date(),
          } as KanbanTask,
          [],
        ),
      );
    }

    return this.getTaskDetails(boardId, taskId).pipe(map((details) => details.task));
  }
}
