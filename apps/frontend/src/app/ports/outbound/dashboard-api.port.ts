import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  KanbanBoardDetails,
  KanbanBoardSummary,
  KanbanTask,
  KanbanTaskAssignPayload,
  KanbanTaskCommentPayload,
  KanbanTaskDetails,
  KanbanTaskMovePayload,
} from '../../domain/dashboard/dashboard.models';

export interface DashboardApiPort {
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
