import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, take } from 'rxjs';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import {
  AvailableApproverItem,
  AvailableDocumentItem,
  KanbanBoardCreatePayload,
  KanbanBoardDetails,
  KanbanBoardMember,
  KanbanTask,
  KanbanTaskCreatePayload,
  KanbanTaskGroupBy,
  KanbanTaskStatus,
  OrganizationMember,
  TaskType,
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
  private readonly statusOrder: Array<KanbanTaskStatus> = ['pending', 'in_review', 'approved', 'declined'];

  protected readonly organizationOptions: Array<{ value: string; label: string }> = [
    { value: 'org-main', label: 'ЭДО Group' },
    { value: 'org-empty', label: 'Пустая организация' },
  ];

  protected readonly groupingOptions: Array<{ value: KanbanTaskGroupBy; label: string }> = [
    { value: 'assignee', label: 'По исполнителю' },
    { value: 'department', label: 'По подразделению' },
    { value: 'group', label: 'По группе задач' },
  ];

  protected readonly taskTypeOptions: Array<{ value: TaskType; label: string }> = [
    { value: 'general', label: 'Общая задача' },
    { value: 'approval', label: 'Требует одобрения' },
  ];

  protected readonly organizationControl = new FormControl('org-main', { nonNullable: true });
  protected readonly boardControl = new FormControl('', { nonNullable: true });
  protected readonly memberToAddControl = new FormControl('', { nonNullable: true });
  protected readonly groupingControl = new FormControl<KanbanTaskGroupBy>('assignee', {
    nonNullable: true,
  });
  private readonly grouping = toSignal(this.groupingControl.valueChanges, {
    initialValue: this.groupingControl.value,
  });

  // Task creation form
  protected readonly showCreateTaskModal = signal(false);
  protected readonly showCreateBoardModal = signal(false);
  protected readonly createTaskForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    description: new FormControl('', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    approverId: new FormControl('', { nonNullable: true }),
    taskType: new FormControl<TaskType>('general', { nonNullable: true }),
    dueDate: new FormControl('', { nonNullable: true }),
    priority: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(5)] }),
    attachmentIds: new FormControl<string[]>([], { nonNullable: true }),
  });
  protected readonly createBoardForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    description: new FormControl('', { nonNullable: true }),
  });

  protected readonly loading = signal(false);
  protected readonly boards = signal<Array<{ id: string; name: string }>>([]);
  protected readonly selectedBoard = signal<KanbanBoardDetails | null>(null);
  protected readonly message = signal('');

  // Available approvers and documents for task creation
  protected readonly availableApprovers = signal<AvailableApproverItem[]>([]);
  protected readonly availableDocuments = signal<AvailableDocumentItem[]>([]);
  protected readonly organizationMembers = signal<OrganizationMember[]>([]);
  protected readonly loadingApprovers = signal(false);
  protected readonly loadingDocuments = signal(false);
  protected readonly loadingMembers = signal(false);

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
      this.loadOrganizationMembers(organizationId);
      this.loadBoards(organizationId);
    });

    this.boardControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((boardId) => {
      this.loadBoard(boardId);
    });

    this.loadOrganizationMembers(this.organizationControl.value);
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

  protected openCreateTaskModal(): void {
    const board = this.selectedBoard();
    if (!board) {
      return;
    }

    this.showCreateTaskModal.set(true);
    this.loadAvailableApprovers(/*board.id*/);
    this.loadAvailableDocuments(/*board.id*/);
  }

  protected openCreateBoardModal(): void {
    this.showCreateBoardModal.set(true);
  }

  protected closeCreateTaskModal(): void {
    this.showCreateTaskModal.set(false);
    this.createTaskForm.reset({
      taskType: 'general',
      priority: 1,
      attachmentIds: [],
    });
  }

  protected closeCreateBoardModal(): void {
    this.showCreateBoardModal.set(false);
    this.createBoardForm.reset({
      name: '',
      description: '',
    });
  }

  protected onCreateBoard(): void {
    const organizationId = this.organizationControl.value;
    if (!organizationId || !this.createBoardForm.valid) {
      return;
    }

    const formValue = this.createBoardForm.value;
    const payload: KanbanBoardCreatePayload = {
      organizationId,
      name: formValue.name?.trim() ?? '',
      description: formValue.description?.trim() || undefined,
    };

    this.loading.set(true);
    this.useCases
      .createTaskBoard(payload)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (board) => {
          this.closeCreateBoardModal();
          this.loadBoards(organizationId, board.id);
          this.message.set(`Доска "${board.name}" создана.`);
        },
        error: (error) => {
          console.error('Failed to create task board:', error);
          this.message.set('Не удалось создать доску. Повторите попытку.');
        },
      });
  }

  protected onCreateTask(): void {
    const board = this.selectedBoard();
    if (!board || !this.createTaskForm.valid) {
      return;
    }

    const formValue = this.createTaskForm.value;
    const assignee = board.members.find((member) => member.id === formValue.assigneeId);
    const approver = formValue.approverId
      ? board.members.find((member) => member.id === formValue.approverId)
      : undefined;

    const payload: KanbanTaskCreatePayload = {
      boardId: board.id,
      title: formValue.title!,
      description: formValue.description || undefined,
      assigneeId: formValue.assigneeId!,
      assigneeName: assignee?.fullName || '',
      approverId: approver?.id,
      approverName: approver?.fullName,
      taskType: formValue.taskType!,
      dueDate: formValue.dueDate || undefined,
      priority: formValue.priority,
      attachmentIds: formValue.attachmentIds!.length > 0 ? formValue.attachmentIds : undefined,
    };

    this.loading.set(true);
    this.useCases
      .createTask(payload)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (task) => {
          // Reload the board to get full KanbanTask details with all required fields
          const boardId = board.id;
          this.loadBoard(boardId);
          this.closeCreateTaskModal();
          this.message.set(`Задача "${task.title}" успешно создана.`);
        },
        error: (error) => {
          console.error('Failed to create task:', error);
          this.message.set('Ошибка при создании задачи. Попробуйте еще раз.');
        },
      });
  }

  protected onApproveTask(taskId: string): void {
    const board = this.selectedBoard();
    if (!board) {
      return;
    }

    this.useCases
      .updateTaskStatus(taskId, { status: 'approved', decision: 'approved' })
      .pipe(take(1))
      .subscribe((task) => {
        this.updateTaskInBoard(task);
        this.message.set(`Задача "${task.title}" одобрена.`);
      });
  }

  protected onDeclineTask(taskId: string): void {
    const board = this.selectedBoard();
    if (!board) {
      return;
    }

    const comment = prompt('Комментарий к отклонению:');
    this.useCases
      .updateTaskStatus(taskId, {
        status: 'declined',
        decision: 'declined',
        decisionComment: comment || undefined
      })
      .pipe(take(1))
      .subscribe((task) => {
        this.updateTaskInBoard(task);
        this.message.set(`Задача "${task.title}" отклонена.`);
      });
  }

  protected canApproveTask(task: KanbanTask): boolean {
    return task.taskType === 'approval' && task.status === 'in_review' && task.approverId === 'current-user-id'; // TODO: get current user ID
  }

  protected onAttachmentToggle(documentId: string, checked: boolean): void {
    const currentAttachments = this.createTaskForm.get('attachmentIds')?.value || [];
    if (checked) {
      this.createTaskForm.patchValue({
        attachmentIds: [...currentAttachments, documentId]
      });
    } else {
      this.createTaskForm.patchValue({
        attachmentIds: currentAttachments.filter(id => id !== documentId)
      });
    }
  }

  protected getBoardMembers(): Array<KanbanBoardMember> {
    /*
      department: 'ЭДО Group',
      fullName: 'Петя Петров'
    }]
    */
    return this.selectedBoard()?.members ?? [];
  }

  protected getMembersAvailableToAdd(): Array<OrganizationMember> {
    const boardMemberIds = new Set(this.getBoardMembers().map((member) => member.id));
    return this.organizationMembers().filter((member) => !boardMemberIds.has(member.id));
  }

  protected addMemberToBoard(): void {
    const board = this.selectedBoard();
    const userId = this.memberToAddControl.value;
    if (!board || !userId) {
      return;
    }

    this.loadingMembers.set(true);
    this.useCases
      .addBoardMember(board.id, userId)
      .pipe(
        take(1),
        finalize(() => this.loadingMembers.set(false)),
      )
      .subscribe({
        next: () => {
          this.memberToAddControl.setValue('');
          this.loadBoard(board.id);
          this.message.set('Участник добавлен в доску.');
        },
        error: (error) => {
          console.error('Failed to add member to board:', error);
          this.message.set('Не удалось добавить участника в доску.');
        },
      });
  }

  protected trackByGroup(_: number, group: TaskGroupView): string {
    return group.id;
  }

  protected trackByTask(_: number, task: KanbanTask): string {
    return task.id;
  }

  private loadAvailableApprovers(): void {
    const boardMembers = this.selectedBoard()?.members ?? [];
    this.availableApprovers.set(
      boardMembers.map((member) => ({
        userId: member.id,
        userName: member.fullName,
      })),
    );
  }

  private loadAvailableDocuments(): void {
    this.loadingDocuments.set(true);
    this.useCases
      .getAvailableDocuments(50, 0)
      .pipe(
        take(1),
        finalize(() => this.loadingDocuments.set(false)),
      )
      .subscribe((result) => {
        this.availableDocuments.set(result.documents);
      });
  }

  private loadBoards(organizationId: string, preferredBoardId?: string): void {
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
        const hasPreferredBoard = preferredBoardId ? boards.some((board) => board.id === preferredBoardId) : false;
        const hasCurrentBoard = boards.some((board) => board.id === currentBoard);
        const boardToLoad = hasPreferredBoard
          ? preferredBoardId!
          : hasCurrentBoard
            ? currentBoard
            : boards[0]!.id;
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
        this.loadAvailableApprovers();
      });
  }

  private loadOrganizationMembers(organizationId: string): void {
    if (!organizationId) {
      this.organizationMembers.set([]);
      return;
    }

    this.loadingMembers.set(true);
    this.useCases
      .getOrganizationMembers(organizationId)
      .pipe(
        take(1),
        finalize(() => this.loadingMembers.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.organizationMembers.set(response.items);
        },
        error: (error) => {
          console.error('Failed to load organization members:', error);
          this.organizationMembers.set([]);
        },
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
      pending: 'Ожидает проверки',
      in_review: 'На проверке',
      approved: 'Одобрено',
      declined: 'Отклонено',
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
