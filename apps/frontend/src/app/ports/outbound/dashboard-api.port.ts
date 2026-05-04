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
  KanbanTaskMovePayload,
  KanbanTaskUpdateStatusPayload,
  AvailableApproverItem,
  AvailableDocumentItem,
  OrganizationMember,
} from '../../domain/dashboard/dashboard.models';
import { TaskResponse } from '@edo/types';

export interface DashboardApiPort {
  getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>>;
  createTaskBoard(payload: KanbanBoardCreatePayload): Observable<KanbanBoardSummary>;
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
  createTask(payload: KanbanTaskCreatePayload): Observable<TaskResponse>;
  updateTaskStatus(taskId: string, payload: KanbanTaskUpdateStatusPayload): Observable<KanbanTask>;
  getAvailableApprovers(): Observable<Array<AvailableApproverItem>>;
  getAvailableDocuments(limit?: number, offset?: number): Observable<{ documents: Array<AvailableDocumentItem>; limit: number; offset: number }>;
  getOrganizationMembers(organizationId: string): Observable<{ items: Array<OrganizationMember>; total: number }>;
  addBoardMember(boardId: string, userId: string): Observable<{ member: OrganizationMember }>;
}

export const DASHBOARD_API_PORT = new InjectionToken<DashboardApiPort>(
  'DASHBOARD_API_PORT',
);
