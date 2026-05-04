import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import {
  KanbanTask,
  KanbanTaskDetails,
  KanbanTaskStatus,
} from '../../../../domain/dashboard/dashboard.models';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../../design-system/ui-kit';

@Component({
  selector: 'edo-dogx-dashboard-task-details',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent],
  templateUrl: './dashboard-task-details.component.html',
  styleUrl: './dashboard-task-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardTaskDetailsComponent {
  private readonly useCases = inject(DashboardUseCases);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly assigneeControl = new FormControl('', { nonNullable: true });
  protected readonly statusControl = new FormControl<KanbanTaskStatus>('pending', {
    nonNullable: true,
  });
  protected readonly commentControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(false);
  protected readonly details = signal<KanbanTaskDetails | null>(null);
  protected readonly message = signal('');

  protected readonly task = computed(() => this.details()?.task ?? null);
  protected readonly canManage = computed(() => this.details()?.canManage ?? false);

  constructor() {
    this.route.paramMap.pipe(take(1)).subscribe((params) => {
      const boardId = params.get('boardId');
      const taskId = params.get('taskId');

      if (!boardId || !taskId) {
        this.router.navigate(['/dashboard/tasks']);
        return;
      }

      this.loadTask(boardId, taskId);
    });
  }

  protected assignTask(): void {
    const details = this.details();
    if (!details || !details.canManage) {
      return;
    }

    this.useCases
      .assignTask(details.board.id, details.task.id, {
        assigneeId: this.assigneeControl.value || null,
      })
      .pipe(take(1))
      .subscribe((task) => {
        this.applyUpdatedTask(task);
        this.message.set('Исполнитель задачи обновлен.');
      });
  }

  protected moveTask(): void {
    const details = this.details();
    if (!details || !details.canManage) {
      return;
    }

    this.useCases
      .moveTask(details.board.id, details.task.id, {
        status: this.statusControl.value,
      })
      .pipe(take(1))
      .subscribe((task) => {
        this.applyUpdatedTask(task);
        this.message.set(`Задача перемещена в колонку «${this.getStatusLabel(task.status)}».`);
      });
  }

  protected addComment(): void {
    const details = this.details();
    if (!details || !details.canManage) {
      return;
    }

    const text = this.commentControl.value.trim();
    if (!text) {
      return;
    }

    this.useCases
      .addTaskComment(details.board.id, details.task.id, { text })
      .pipe(take(1))
      .subscribe((task) => {
        this.applyUpdatedTask(task);
        this.commentControl.setValue('');
        this.message.set('Комментарий добавлен.');
      });
  }

  protected navigateBackToBoard(): void {
    this.router.navigate(['/dashboard/tasks']);
  }

  protected getStatusLabel(status: KanbanTaskStatus): string {
    const labels: Record<KanbanTaskStatus, string> = {
      pending: 'Ожидает проверки',
      in_review: 'На проверке',
      approved: 'Одобрено',
      declined: 'Отклонено',
    };

    return labels[status];
  }

  private loadTask(boardId: string, taskId: string): void {
    this.loading.set(true);
    this.useCases
      .getTaskDetails(boardId, taskId)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((details) => {
        this.details.set(details);
        this.assigneeControl.setValue(details.task.assigneeId ?? '');
        this.statusControl.setValue(details.task.status);
      });
  }

  private applyUpdatedTask(task: KanbanTask): void {
    this.details.update((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        task,
      };
    });

    this.assigneeControl.setValue(task.assigneeId ?? '');
    this.statusControl.setValue(task.status);
  }
}
