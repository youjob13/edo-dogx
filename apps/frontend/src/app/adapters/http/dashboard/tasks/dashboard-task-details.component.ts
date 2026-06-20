import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs';
import {
  KanbanTask,
  KanbanTaskDetails,
  KanbanTaskStatus,
} from '../../../../domain/dashboard/dashboard.models';
import {
  ButtonComponent,
  CardComponent,
  PageSectionComponent,
} from '../../../../design-system/ui-kit';
import { TaskBoardUseCases } from '../../../../application/dashboard/task-board.use-cases';

@Component({
  selector: 'edo-dogx-dashboard-task-details',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent],
  templateUrl: './dashboard-task-details.component.html',
  styleUrl: './dashboard-task-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardTaskDetailsComponent {
  private readonly useCases = inject(TaskBoardUseCases);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly assigneeControl = new FormControl('', { nonNullable: true });
  protected readonly statusControl = new FormControl<KanbanTaskStatus>('pending', {
    nonNullable: true,
  });
  protected readonly decisionCommentControl = new FormControl('', { nonNullable: true });
  protected readonly commentControl = new FormControl('', { nonNullable: true });
  protected readonly attachmentControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(false);
  protected readonly details = signal<KanbanTaskDetails | null>(null);
  protected readonly message = signal('');
  protected readonly availableDocuments = signal<Array<{ documentId: string; title: string; category: string }>>([]);

  protected readonly task = computed(() => this.details()?.task ?? null);
  protected readonly hasAnyCapability = computed(() => {
    const details = this.details();
    return Boolean(
      details &&
      (details.canEdit ||
        details.canAssign ||
        details.canMoveToReview ||
        details.canApprove ||
        details.canComment),
    );
  });
  protected canUpdateStatus(): boolean {
    const details = this.details();
    const task = details?.task;
    if (!details || !task) {
      return false;
    }

    if (this.statusControl.value === task.status) {
      return false;
    }

    if (this.statusControl.value === 'in_review') {
      return details.canMoveToReview;
    }

    return details.canEdit || task.assigneeId === details.currentUserId;
  }

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
    const assigneeId = this.assigneeControl.value;
    if (!details?.canAssign || !assigneeId) {
      return;
    }

    this.useCases
      .assignTask(details.board.id, details.task.id, {
        assigneeId,
      })
      .pipe(take(1))
      .subscribe({
        next: (task) => {
          this.applyUpdatedTask(task);
          this.loadTask(details.board.id, task.id);
          this.message.set('Исполнитель задачи обновлен.');
        },
        error: () => {
          this.message.set('Не удалось обновить исполнителя задачи.');
        },
      });
  }

  protected moveTask(): void {
    const details = this.details();
    if (!details || !this.canUpdateStatus()) {
      return;
    }

    this.useCases
      .moveTask(details.board.id, details.task.id, {
        status: this.statusControl.value,
      })
      .pipe(take(1))
      .subscribe({
        next: (task) => {
          this.applyUpdatedTask(task);
          this.loadTask(details.board.id, task.id);
          this.message.set(`Задача перемещена в колонку «${this.getStatusLabel(task.status)}».`);
        },
        error: () => {
          this.message.set('Не удалось изменить статус задачи.');
        },
      });
  }

  protected approveTask(): void {
    const details = this.details();
    if (!details?.canApprove) {
      return;
    }

    const decisionComment = this.decisionCommentControl.value.trim();
    this.useCases
      .updateTaskStatus(details.task.id, {
        status: 'approved',
        decision: 'approved',
        decisionComment: decisionComment || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: (task) => {
          this.applyUpdatedTask(task);
          this.loadTask(details.board.id, task.id);
          this.decisionCommentControl.setValue('');
          this.message.set('Задача одобрена.');
        },
        error: () => {
          this.message.set('Не удалось одобрить задачу.');
        },
      });
  }

  protected declineTask(): void {
    const details = this.details();
    const decisionComment = this.decisionCommentControl.value.trim();
    if (!details?.canApprove || !decisionComment) {
      this.message.set('Для отклонения задачи необходимо указать комментарий.');
      return;
    }

    this.useCases
      .updateTaskStatus(details.task.id, {
        status: 'declined',
        decision: 'declined',
        decisionComment,
      })
      .pipe(take(1))
      .subscribe({
        next: (task) => {
          this.applyUpdatedTask(task);
          this.loadTask(details.board.id, task.id);
          this.decisionCommentControl.setValue('');
          this.message.set('Задача отклонена.');
        },
        error: () => {
          this.message.set('Не удалось отклонить задачу.');
        },
      });
  }

  protected isFinalStatus(status: KanbanTaskStatus): boolean {
    return status === 'approved' || status === 'declined';
  }

  protected addComment(): void {
    const details = this.details();
    const text = this.commentControl.value.trim();
    if (!details?.canComment || !text) {
      return;
    }

    this.useCases
      .addTaskComment(details.board.id, details.task.id, { text })
      .pipe(take(1))
      .subscribe({
        next: (task) => {
          this.applyUpdatedTask(task);
          this.loadTask(details.board.id, task.id);
          this.commentControl.setValue('');
          this.message.set('Комментарий добавлен.');
        },
        error: () => {
          this.message.set('Не удалось добавить комментарий.');
        },
      });
  }

  protected canManageAttachments(): boolean {
    const details = this.details();
    return Boolean(details?.canEdit && details.board.id);
  }

  protected addAttachment(): void {
    const details = this.details();
    const documentId = this.attachmentControl.value;
    if (!details || !this.canManageAttachments() || !documentId) {
      return;
    }

    this.useCases
      .addTaskAttachments(details.board.id, details.task.id, { documentIds: [documentId] })
      .pipe(take(1))
      .subscribe({
        next: (task) => {
          this.applyUpdatedTask(task);
          this.loadTask(details.board.id, task.id);
          this.attachmentControl.setValue('');
          this.message.set('Вложение добавлено к задаче.');
        },
        error: () => {
          this.message.set('Не удалось добавить вложение.');
        },
      });
  }

  protected removeAttachment(documentId: string): void {
    const details = this.details();
    if (!details || !this.canManageAttachments()) {
      return;
    }

    this.useCases
      .removeTaskAttachment(details.board.id, details.task.id, documentId)
      .pipe(take(1))
      .subscribe({
        next: (task) => {
          this.applyUpdatedTask(task);
          this.loadTask(details.board.id, task.id);
          this.message.set('Вложение удалено из задачи.');
        },
        error: () => {
          this.message.set('Не удалось удалить вложение.');
        },
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
        this.loadAvailableDocuments(details.board.id);
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

  private loadAvailableDocuments(boardId: string): void {
    if (!boardId) {
      this.availableDocuments.set([]);
      return;
    }

    this.useCases
      .getAvailableDocuments(boardId, 100, 0)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.availableDocuments.set(result.documents);
        },
        error: () => {
          this.availableDocuments.set([]);
        },
      });
  }
}
