import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  KanbanBoardDetails,
  KanbanBoardCreatePayload,
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
  OrganizationMember,
  TaskAttachmentAddPayload,
} from '../../domain/dashboard/dashboard.models';
import { TaskResponse } from '@edo/types';

export interface TaskBoardsApiPort {
  getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>>;
  createTaskBoard(payload: KanbanBoardCreatePayload): Observable<KanbanBoardSummary>;
  getTaskBoard(boardId: string): Observable<KanbanBoardDetails>;
  listTasks(query?: KanbanTaskListQuery): Observable<Array<KanbanTask>>;
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
  addTaskAttachments(
    boardId: string,
    taskId: string,
    payload: TaskAttachmentAddPayload,
  ): Observable<KanbanTask>;
  removeTaskAttachment(boardId: string, taskId: string, documentId: string): Observable<KanbanTask>;
  createTask(payload: KanbanTaskCreatePayload): Observable<TaskResponse>;
  updateTaskStatus(taskId: string, payload: KanbanTaskUpdateStatusPayload): Observable<KanbanTask>;
  getAvailableApprovers(boardId: string): Observable<Array<AvailableApproverItem>>;
  getAvailableDocuments(boardId: string, limit?: number, offset?: number): Observable<{ documents: Array<AvailableDocumentItem>; limit: number; offset: number }>;
  getOrganizationMembers(organizationId: string): Observable<{ items: Array<OrganizationMember>; total: number }>;
  addBoardMember(boardId: string, userId: string): Observable<{ member: OrganizationMember }>;
}

export const TASK_BOARDS_API_PORT = new InjectionToken<TaskBoardsApiPort>(
  'TASK_BOARDS_API_PORT',
);
