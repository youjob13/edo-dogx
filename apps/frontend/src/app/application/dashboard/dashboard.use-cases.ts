import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  KanbanBoardDetails,
  KanbanBoardSummary,
  KanbanTask,
  KanbanTaskAssignPayload,
  KanbanTaskCommentPayload,
  KanbanTaskDetails,
  KanbanTaskMovePayload,
  DashboardConflictError,
} from '../../domain/dashboard/dashboard.models';
import { DashboardApiPort, DASHBOARD_API_PORT } from '../../ports/outbound/dashboard-api.port';


@Injectable({ providedIn: 'root' })
export class DashboardUseCases {
  private readonly api: DashboardApiPort = inject(DASHBOARD_API_PORT);

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
