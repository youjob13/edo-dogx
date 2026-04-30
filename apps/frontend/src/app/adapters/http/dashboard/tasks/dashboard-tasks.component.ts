import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, take } from 'rxjs';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import {
  KanbanBoardDetails,
  KanbanTask,
  KanbanTaskGroupBy,
  KanbanTaskStatus,
} from '../../../../domain/dashboard/dashboard.models';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../../design-system/ui-kit';

interface TaskGroupView {
  readonly id: string;
  readonly label: string;
  readonly tasks: Array<KanbanTask>;
}

interface TaskColumnView {
  readonly status: KanbanTaskStatus;
  readonly label: string;
  readonly groups: Array<TaskGroupView>;
}

@Component({
  selector: 'edo-dogx-dashboard-tasks',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent],
  templateUrl: './dashboard-tasks.component.html',
  styleUrl: './dashboard-tasks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardTasksComponent {
  private readonly useCases = inject(DashboardUseCases);
  private readonly router = inject(Router);
  private readonly statusOrder: Array<KanbanTaskStatus> = ['todo', 'inProgress', 'review', 'done'];

  protected readonly organizationOptions: Array<{ value: string; label: string }> = [
    { value: 'org-main', label: 'ЭДО Group' },
    { value: 'org-empty', label: 'Пустая организация' },
  ];

  protected readonly groupingOptions: Array<{ value: KanbanTaskGroupBy; label: string }> = [
    { value: 'assignee', label: 'По исполнителю' },
    { value: 'department', label: 'По подразделению' },
    { value: 'group', label: 'По группе задач' },
  ];

  protected readonly organizationControl = new FormControl('org-main', { nonNullable: true });
  protected readonly boardControl = new FormControl('', { nonNullable: true });
  protected readonly groupingControl = new FormControl<KanbanTaskGroupBy>('assignee', {
    nonNullable: true,
  });
  private readonly grouping = toSignal(this.groupingControl.valueChanges, {
    initialValue: this.groupingControl.value,
  });

  protected readonly loading = signal(false);
  protected readonly boards = signal<Array<{ id: string; name: string }>>([]);
  protected readonly selectedBoard = signal<KanbanBoardDetails | null>(null);
  protected readonly message = signal('');

  protected readonly columns = computed<Array<TaskColumnView>>(() => {
    const board = this.selectedBoard();
    if (!board) {
      return [];
    }

    const grouping = this.grouping();

    return this.statusOrder.map((status) => {
      const taskPool = board.tasks.filter((task) => task.status === status);
      const groupedMap = new Map<string, Array<KanbanTask>>();

      taskPool.forEach((task) => {
        const key = this.resolveGroupKey(task, grouping);
        const current = groupedMap.get(key) ?? [];
        groupedMap.set(key, [...current, task]);
      });

      const groups = [...groupedMap.entries()]
        .map(([key, tasks]) => ({
          id: `${grouping}:${key}`,
          label: this.resolveGroupLabel(tasks[0]!, grouping),
          tasks,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'ru'));

      return {
        status,
        label: this.getStatusLabel(status),
        groups,
      };
    });
  });

  protected readonly hasBoards = computed(() => this.boards().length > 0);

  constructor() {
    this.organizationControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((organizationId) => {
      this.loadBoards(organizationId);
    });

    this.boardControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((boardId) => {
      this.loadBoard(boardId);
    });

    this.loadBoards(this.organizationControl.value);
  }

  protected onAssigneeChanged(taskId: string, value: string): void {
    const boardId = this.selectedBoard()?.id;
    if (!boardId) {
      return;
    }

    this.useCases
      .assignTask(boardId, taskId, { assigneeId: value || null })
      .pipe(take(1))
      .subscribe((task) => {
        this.updateTaskInBoard(task);
        this.message.set(`Исполнитель задачи «${task.title}» обновлен.`);
      });
  }

  protected onMoveTask(taskId: string, direction: 'prev' | 'next'): void {
    const board = this.selectedBoard();
    if (!board) {
      return;
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const currentIndex = this.statusOrder.indexOf(task.status);
    const nextIndex =
      direction === 'prev'
        ? Math.max(0, currentIndex - 1)
        : Math.min(this.statusOrder.length - 1, currentIndex + 1);

    const nextStatus = this.statusOrder[nextIndex];
    if (nextStatus === task.status) {
      return;
    }

    this.useCases
      .moveTask(board.id, task.id, { status: nextStatus })
      .pipe(take(1))
      .subscribe((updatedTask) => {
        this.updateTaskInBoard(updatedTask);
        this.message.set(`Задача «${updatedTask.title}» перемещена в колонку «${this.getStatusLabel(nextStatus)}».`);
      });
  }

  protected canMoveLeft(task: KanbanTask): boolean {
    return this.statusOrder.indexOf(task.status) > 0;
  }

  protected canMoveRight(task: KanbanTask): boolean {
    return this.statusOrder.indexOf(task.status) < this.statusOrder.length - 1;
  }

  protected openTaskDetails(boardId: string, taskId: string): void {
    this.router.navigate(['/dashboard/tasks', boardId, 'task', taskId]);
  }

  protected getBoardMembers() {
    return this.selectedBoard()?.members ?? [];
  }

  protected trackByGroup(_: number, group: TaskGroupView): string {
    return group.id;
  }

  protected trackByTask(_: number, task: KanbanTask): string {
    return task.id;
  }

  private loadBoards(organizationId: string): void {
    this.loading.set(true);
    this.useCases
      .getTaskBoards(organizationId)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((boards) => {
        this.boards.set(boards.map((board) => ({ id: board.id, name: board.name })));

        if (boards.length === 0) {
          this.boardControl.setValue('', { emitEvent: false });
          this.selectedBoard.set(null);
          this.message.set('В выбранной организации пока нет канбан-досок.');
          return;
        }

        const currentBoard = this.boardControl.value;
        const hasCurrentBoard = boards.some((board) => board.id === currentBoard);
        const boardToLoad = hasCurrentBoard ? currentBoard : boards[0]!.id;
        this.boardControl.setValue(boardToLoad, { emitEvent: false });
        this.loadBoard(boardToLoad);
      });
  }

  private loadBoard(boardId: string): void {
    if (!boardId) {
      this.selectedBoard.set(null);
      return;
    }

    this.loading.set(true);
    this.useCases
      .getTaskBoard(boardId)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((board) => {
        this.selectedBoard.set(board);
      });
  }

  private resolveGroupKey(task: KanbanTask, grouping: KanbanTaskGroupBy): string {
    if (grouping === 'department') {
      return task.department;
    }

    if (grouping === 'group') {
      return task.groupId;
    }

    return task.assigneeId ?? 'unassigned';
  }

  private resolveGroupLabel(task: KanbanTask, grouping: KanbanTaskGroupBy): string {
    if (grouping === 'department') {
      return task.department;
    }

    if (grouping === 'group') {
      return task.groupName;
    }

    return task.assigneeName;
  }

  protected getStatusLabel(status: KanbanTaskStatus): string {
    const labels: Record<KanbanTaskStatus, string> = {
      todo: 'К выполнению',
      inProgress: 'В работе',
      review: 'Проверка',
      done: 'Готово',
    };

    return labels[status];
  }

  private updateTaskInBoard(updatedTask: KanbanTask): void {
    this.selectedBoard.update((board) => {
      if (!board) {
        return board;
      }

      return {
        ...board,
        tasks: board.tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
      };
    });
  }
}
