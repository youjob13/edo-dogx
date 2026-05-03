import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  KanbanBoardDetails,
  KanbanBoardMember,
  KanbanBoardSummary,
  KanbanTask,
  KanbanTaskAssignPayload,
  KanbanTaskComment,
  KanbanTaskCommentPayload,
  KanbanTaskDetails,
  KanbanTaskMovePayload,
  KanbanTaskStatus,
} from '../../domain/dashboard/dashboard.models';
import { DashboardApiPort } from '../../ports/outbound/dashboard-api.port';

const CURRENT_USER_ID = 'u1';

interface MutableTaskBoard {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string;
  readonly allowedGrouping: Array<'assignee' | 'department' | 'group'>;
  readonly members: Array<KanbanBoardMember>;
  readonly tasks: Array<KanbanTask>;
}

const cloneComment = (comment: KanbanTaskComment): KanbanTaskComment => ({ ...comment });

const cloneTask = (task: KanbanTask): KanbanTask => ({
  ...task,
  comments: task.comments.map(cloneComment),
});

const cloneBoardMember = (member: KanbanBoardMember): KanbanBoardMember => ({ ...member });

const cloneBoard = (board: MutableTaskBoard): MutableTaskBoard => ({
  ...board,
  allowedGrouping: [...board.allowedGrouping],
  members: board.members.map(cloneBoardMember),
  tasks: board.tasks.map(cloneTask),
});

const toBoardSummary = (board: MutableTaskBoard): KanbanBoardSummary => ({
  id: board.id,
  organizationId: board.organizationId,
  name: board.name,
  description: board.description,
  membersCount: board.members.length,
  tasksCount: board.tasks.length,
});

const statusSequence: Array<KanbanTaskStatus> = ['todo', 'inProgress', 'review', 'done'];

const mockTaskBoardsSeed = (): Array<MutableTaskBoard> => {
  const legalMembers: Array<KanbanBoardMember> = [
    { id: 'u1', fullName: 'Ирина Ковалева', department: 'Юридический отдел' },
    { id: 'u2', fullName: 'Олег Сафонов', department: 'Финансовый отдел' },
    { id: 'u3', fullName: 'Марина Жукова', department: 'Канцелярия' },
  ];

  const hrMembers: Array<KanbanBoardMember> = [
    { id: 'u1', fullName: 'Ирина Ковалева', department: 'Юридический отдел' },
    { id: 'u4', fullName: 'Станислав Ким', department: 'HR' },
    { id: 'u5', fullName: 'Наталья Петрова', department: 'IT' },
  ];

  return [
    {
      id: 'board-legal',
      organizationId: 'org-main',
      name: 'Юр. договоры и согласования',
      description: 'Поток обработки договоров с внутренним и внешним согласованием.',
      allowedGrouping: ['assignee', 'department', 'group'],
      members: legalMembers,
      tasks: [
        {
          id: 't-101',
          title: 'Проверка NDA для подрядчика',
          description: 'Проверить риски и внести правки в NDA перед подписанием.',
          status: 'todo',
          assigneeId: 'u1',
          assigneeName: 'Ирина Ковалева',
          department: 'Юридический отдел',
          groupId: 'g-contract-17',
          groupName: 'Договор 17/2026',
          dueDateLabel: 'до 12 мая',
          comments: [
            {
              id: 'c-1001',
              authorId: 'u3',
              authorName: 'Марина Жукова',
              text: 'Отправила актуальную версию приложения.',
              createdAtLabel: '2 часа назад',
            },
          ],
        },
        {
          id: 't-102',
          title: 'Согласовать лимит по штрафам',
          description: 'Нужно финальное согласование от финансов перед отправкой.',
          status: 'inProgress',
          assigneeId: 'u2',
          assigneeName: 'Олег Сафонов',
          department: 'Финансовый отдел',
          groupId: 'g-contract-17',
          groupName: 'Договор 17/2026',
          dueDateLabel: 'до 8 мая',
          comments: [],
        },
        {
          id: 't-103',
          title: 'Подготовить карточку контрагента',
          description: 'Проверить реквизиты и статус аккредитации в системе.',
          status: 'review',
          assigneeId: null,
          assigneeName: 'Не назначен',
          department: 'Канцелярия',
          groupId: 'g-vendor-9',
          groupName: 'Контрагент Альфа',
          dueDateLabel: 'до 6 мая',
          comments: [],
        },
        {
          id: 't-104',
          title: 'Архивировать подписанный пакет',
          description: 'Загрузить финальные документы в архив и закрыть задачу.',
          status: 'done',
          assigneeId: 'u3',
          assigneeName: 'Марина Жукова',
          department: 'Канцелярия',
          groupId: 'g-archive-4',
          groupName: 'Архив Q2',
          dueDateLabel: 'завершено',
          comments: [],
        },
      ],
    },
    {
      id: 'board-hr',
      organizationId: 'org-main',
      name: 'Адаптация сотрудников',
      description: 'План задач для онбординга и выдачи доступов новым сотрудникам.',
      allowedGrouping: ['assignee', 'department', 'group'],
      members: hrMembers,
      tasks: [
        {
          id: 't-201',
          title: 'Выдать доступ в ЭДО и CRM',
          description: 'Создать учетные записи и передать временный пароль.',
          status: 'todo',
          assigneeId: 'u5',
          assigneeName: 'Наталья Петрова',
          department: 'IT',
          groupId: 'g-onboard-77',
          groupName: 'Онбординг #77',
          dueDateLabel: 'до 5 мая',
          comments: [],
        },
        {
          id: 't-202',
          title: 'Подписать политику ИБ',
          description: 'Сотрудник должен ознакомиться и подтвердить подписание.',
          status: 'inProgress',
          assigneeId: 'u4',
          assigneeName: 'Станислав Ким',
          department: 'HR',
          groupId: 'g-onboard-77',
          groupName: 'Онбординг #77',
          dueDateLabel: 'до 7 мая',
          comments: [],
        },
      ],
    },
  ];
};

@Injectable({ providedIn: 'root' })
export class DashboardMockHttpAdapter implements DashboardApiPort {
  private readonly http = inject(HttpClient);
  private taskBoards = mockTaskBoardsSeed();

  public getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>> {
    const boards = this.taskBoards
      .filter((board) => board.organizationId === organizationId)
      .map((board) => toBoardSummary(cloneBoard(board)));

    return of(boards)
  }

  public getTaskBoard(boardId: string): Observable<KanbanBoardDetails> {
    const board = this.taskBoards.find((item) => item.id === boardId);

    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена'))
    }

    const cloned = cloneBoard(board);

    return of({
      id: cloned.id,
      organizationId: cloned.organizationId,
      name: cloned.name,
      description: cloned.description,
      allowedGrouping: [...cloned.allowedGrouping],
      members: cloned.members,
      tasks: cloned.tasks,
    })
  }

  public getTaskDetails(boardId: string, taskId: string): Observable<KanbanTaskDetails> {
    const board = this.taskBoards.find((item) => item.id === boardId);

    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена'))
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена'))
    }

    const canManage = board.members.some((member) => member.id === CURRENT_USER_ID);

    return of({
      board: toBoardSummary(cloneBoard(board)),
      task: cloneTask(task),
      members: board.members.map(cloneBoardMember),
      currentUserId: CURRENT_USER_ID,
      canManage,
    })
  }

  public assignTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskAssignPayload,
  ): Observable<KanbanTask> {
    const board = this.taskBoards.find((item) => item.id === boardId);
    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена'))
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена'))
    }

    let updated: KanbanTask;

    if (payload.assigneeId) {
      const assignee = board.members.find((member) => member.id === payload.assigneeId);
      if (!assignee) {
        return throwError(() => new Error('Исполнитель не входит в доску'))
      }

      updated = {
        ...task,
        assigneeId: assignee.id,
        assigneeName: assignee.fullName,
        department: assignee.department,
      };
    } else {
      updated = {
        ...task,
        assigneeId: null,
        assigneeName: 'Не назначен',
      };
    }

    this.taskBoards = this.taskBoards.map((item) =>
      item.id === boardId
        ? {
            ...item,
            tasks: item.tasks.map((boardTask) =>
              boardTask.id === taskId ? updated : boardTask,
            ),
          }
        : item,
    );

    return of(cloneTask(updated))
  }

  public moveTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskMovePayload,
  ): Observable<KanbanTask> {
    const board = this.taskBoards.find((item) => item.id === boardId);
    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена'))
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена'))
    }

    if (!statusSequence.includes(payload.status)) {
      return throwError(() => new Error('Некорректный статус задачи'))
    }

    const updated: KanbanTask = {
      ...task,
      status: payload.status,
    };

    this.taskBoards = this.taskBoards.map((item) =>
      item.id === boardId
        ? {
            ...item,
            tasks: item.tasks.map((boardTask) =>
              boardTask.id === taskId ? updated : boardTask,
            ),
          }
        : item,
    );

    return of(cloneTask(updated))
  }

  public addTaskComment(
    boardId: string,
    taskId: string,
    payload: KanbanTaskCommentPayload,
  ): Observable<KanbanTask> {
    const board = this.taskBoards.find((item) => item.id === boardId);
    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена'))
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена'))
    }

    const text = payload.text.trim();
    if (!text) {
      return throwError(() => new Error('Комментарий не может быть пустым'))
    }

    const author = board.members.find((member) => member.id === CURRENT_USER_ID);
    const updated: KanbanTask = {
      ...task,
      comments: [
        ...task.comments,
        {
          id: `c-${Date.now()}`,
          authorId: CURRENT_USER_ID,
          authorName: author?.fullName ?? 'Пользователь',
          text,
          createdAtLabel: 'только что',
        },
      ],
    };

    this.taskBoards = this.taskBoards.map((item) =>
      item.id === boardId
        ? {
            ...item,
            tasks: item.tasks.map((boardTask) =>
              boardTask.id === taskId ? updated : boardTask,
            ),
          }
        : item,
    );

    return of(cloneTask(updated))
  }
}
