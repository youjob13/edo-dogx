import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActivityFeedComponent,
  BarMiniChartComponent,
  ButtonComponent,
  CardComponent,
  DataTableComponent,
  DrawerComponent,
  MetricCardComponent,
  ModalComponent,
  PageSectionComponent,
  ProgressMeterComponent,
  UiKitDropdownItem,
  UiKitSortState,
  UiKitTableColumn,
  UiKitActivityItem,
  UiKitChartBar,
} from '../../../../design-system/ui-kit';
import {
  DashboardDocumentCategory,
  DashboardEditableDocument,
  DashboardEditDocumentPayload,
  DashboardExportFormat,
  KanbanTaskStatus,
  KanbanTask,
  DashboardPreviewDocument,
  DocumentItem,
  WeeklyVolumePoint,
} from '../../../../domain/dashboard/dashboard.models';
import { filter, forkJoin, switchMap, take, throwError, timer } from 'rxjs';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';
import { TaskBoardUseCases } from '../../../../application/dashboard/task-board.use-cases';

type RecentDashboardItem =
  | {
      kind: 'document';
      id: string;
      title: string;
      typeLabel: string;
      statusLabel: string;
      updatedAt: string;
      document: DocumentItem;
    }
  | {
      kind: 'task';
      id: string;
      title: string;
      typeLabel: string;
      statusLabel: string;
      updatedAt: string;
      task: KanbanTask;
    };

@Component({
  selector: 'edo-dogx-dashboard-home',
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    MetricCardComponent,
    BarMiniChartComponent,
    DataTableComponent,
    DrawerComponent,
    ModalComponent,
    ButtonComponent,
    ActivityFeedComponent,
    ProgressMeterComponent,
  ],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHomeComponent {
  private readonly documentUseCases = inject(DocumentUseCases);
  private readonly taskBoardUseCases = inject(TaskBoardUseCases);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  protected readonly recentDocumentColumns: Array<UiKitTableColumn> = [
    { key: 'typeLabel', label: 'Тип', sortable: true },
    { key: 'title', label: 'Название', sortable: true },
    { key: 'statusLabel', label: 'Статус', sortable: true },
    { key: 'modifiedAtLabel', label: 'Обновлено', sortable: true },
  ];

  protected readonly documentSort = signal<UiKitSortState>({ key: 'modifiedAtLabel', direction: 'desc' });
  protected readonly globalSearch = signal('');
  protected readonly recentDocuments = signal<Array<DocumentItem>>([]);
  protected readonly recentItems = signal<Array<RecentDashboardItem>>([]);
  protected readonly selectedDocumentId = signal<string | null>(null);
  protected readonly previewDocument = signal<DashboardPreviewDocument | null>(null);
  protected readonly editableDocument = signal<DashboardEditableDocument | null>(null);
  protected readonly previewOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly storageDetailsOpen = signal(false);
  protected readonly editFilenameControl = new FormControl('', { nonNullable: true });


  protected readonly pendingApprovalCount = signal(0);
  protected readonly pendingApprovalDelta = signal(0);
  protected readonly actionItemsCount = signal(0);
  protected readonly overdueNoticesCount = signal(0);
  protected readonly weeklyVolume = signal<Array<WeeklyVolumePoint>>([]);
  protected readonly selectedDay = signal<WeeklyVolumePoint['day'] | null>(null);
  protected readonly storagePercent = signal(0);
  protected readonly storageLabel = signal('0 / 0 ТБ');
  protected readonly activity = signal<Array<UiKitActivityItem>>([]);
  protected readonly activityDocumentMap = signal<Record<string, string | undefined>>({});
  protected readonly activityTaskMap = signal<Record<string, { taskId?: string; boardId?: string }>>({});
  protected readonly message = signal('');

  protected readonly documentMenuItems: Array<UiKitDropdownItem> = [
    { id: 'preview', label: 'Предпросмотр', icon: 'preview' },
    { id: 'edit', label: 'Редактировать', icon: 'edit' },
    { id: 'download-pdf', label: 'Скачать PDF', icon: 'download' },
    { id: 'download-docx', label: 'Скачать DOCX', icon: 'download' },
  ];

  protected readonly chartBars = computed<Array<UiKitChartBar>>(() => {
    const selected = this.selectedDay();

    return this.weeklyVolume().map((item) => ({
      label: item.day.toUpperCase(),
      value: item.value,
      highlighted: selected === item.day,
    }));
  });

  protected readonly recentDocumentRows = computed<Array<Record<string, string>>>(() =>
    this.filteredRecentItems().map((item) => ({
      id: item.id,
      itemKind: item.kind,
      typeLabel: item.typeLabel,
      title: item.title,
      statusLabel: item.statusLabel,
      modifiedAtLabel: item.updatedAt,
    })),
  );

  protected readonly filteredRecentItems = computed(() => {
    const selectedDay = this.selectedDay();

    return this.recentItems().filter((item) => {
      if (!selectedDay) {
        return true;
      }

      return this.weekdayFromIso(item.updatedAt) === selectedDay;
    });
  });

  protected readonly selectedDocument = computed(() => {
    const selectedId = this.selectedDocumentId();
    if (!selectedId) {
      return null;
    }

    return this.recentDocuments().find((item) => item.id === selectedId) ?? null;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const query = params.get('q')?.trim() ?? '';
      this.globalSearch.set(query);
      this.loadRecentDocuments();
    });

    this.loadWeeklyVolume();
    this.loadStorage();
    this.loadActivity();
    this.loadTaskMetrics();
  }

  protected onMetricPressed(metric: 'pending' | 'in_review'): void {
    this.message.set(
      metric === 'pending'
         ? 'Быстрый фильтр: ожидают подтверждения.'
        : 'Быстрый фильтр: требуют внимания.',
    );
  }

  protected onBarPressed(label: string): void {
    const normalized = label.trim().toLowerCase();
    const day = this.weeklyVolume().find((item) => item.day === normalized);
    if (!day) {
      return;
    }

    this.selectedDay.set(day.day);
    this.message.set(`Выбран день: ${label.toUpperCase()}.`);
  }

  protected onRecentDocumentSortChanged(state: UiKitSortState): void {
    this.documentSort.set(state);
  }

  protected onRecentDocumentAction(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    const item = this.recentItems().find((recentItem) => recentItem.id === id);
    if (!item) {
      return;
    }

    if (item.kind === 'task') {
      const boardId = item.task.boardId;
      if (!boardId) {
        this.message.set('Не удалось открыть задачу: не найдена доска.');
        return;
      }

      this.router.navigate(['/dashboard/tasks', boardId, 'task', item.task.id]);
      return;
    }

    this.selectedDocumentId.set(item.document.id);
    this.documentUseCases
      .previewDocument(item.document.id)
      .pipe(take(1))
      .subscribe((preview) => {
        this.previewDocument.set(preview);
        this.previewOpen.set(true);
      });
  }

  protected onRecentDocumentMenuAction(event: { row: Record<string, unknown>; actionId: string }): void {
    this.selectedDocumentId.set(String(event.row['id'] ?? ''));
    this.onDocumentMenuAction(event.actionId);
  }

  protected onDocumentMenuAction(actionId: string): void {
    const id = this.selectedDocumentId();
    if (!id) {
      return;
    }

    if (actionId === 'preview') {
      this.documentUseCases
        .previewDocument(id)
        .pipe(take(1))
        .subscribe((preview) => {
          this.previewDocument.set(preview);
          this.previewOpen.set(true);
        });
      return;
    }

    if (actionId === 'edit') {
      const selected = this.selectedDocument();
      if (!selected) {
        return;
      }

      this.documentUseCases
        .getDocumentById(selected.id)
        .pipe(take(1))
        .subscribe((document) => {
          this.editableDocument.set(document);
          this.editFilenameControl.setValue(document.title);
          // this.editStatusControl.setValue(document.status);
          this.editOpen.set(true);
        });
      return;
    }

    if (actionId === 'download' || actionId === 'download-pdf' || actionId === 'download-docx') {
      this.downloadDocumentExport(id, actionId === 'download-docx' ? 'DOCX' : 'PDF');
    }
  }

  protected closePreview(): void {
    this.previewOpen.set(false);
    this.previewDocument.set(null);
  }

  protected closeEdit(): void {
    this.editOpen.set(false);
    this.editableDocument.set(null);
  }

  protected saveEdit(): void {
    const id = this.selectedDocumentId();
    if (!id) {
      return;
    }

    const currentDocument = this.editableDocument();
    const document$ = currentDocument?.id === id
      ? this.documentUseCases.updateDocument(id, this.createEditPayload(currentDocument))
      : this.documentUseCases.getDocumentById(id).pipe(
          switchMap((document) => this.documentUseCases.updateDocument(id, this.createEditPayload(document))),
        );

    document$
      .pipe(take(1))
      .subscribe((updated) => {
        this.message.set(`Документ ${updated.title} обновлен.`);
        this.editOpen.set(false);
        this.editableDocument.set(null);
        this.loadRecentDocuments();
      });
  }

  protected openStorageDetails(): void {
    this.storageDetailsOpen.set(true);
  }

  protected closeStorageDetails(): void {
    this.storageDetailsOpen.set(false);
  }

    protected onActivityPressed(id: string): void {
    const documentId = this.activityDocumentMap()[id];
    if (!documentId) {
      const taskRef = this.activityTaskMap()[id];
      if (taskRef?.taskId && taskRef?.boardId) {
        this.router.navigate(['/dashboard/tasks', taskRef.boardId, 'task', taskRef.taskId]);
        this.message.set(`Открыта активность ${id}.`);
        return;
      }

      this.message.set(`Открыта активность ${id}.`);
      return;
    }

    this.selectedDocumentId.set(documentId);
    this.documentUseCases
      .previewDocument(documentId)
      .pipe(take(1))
      .subscribe((preview) => {
        this.previewDocument.set(preview);
        this.previewOpen.set(true);
        this.message.set(`Открыта связанная активность ${id}.`);
      });
  }

  protected resetQuickFilters(): void {
    this.selectedDay.set(null);
    this.message.set('Быстрые фильтры сброшены.');
  }

  protected getCategoryLabel(category: DashboardDocumentCategory): string {
    const labels: Record<DashboardDocumentCategory, string> = {
      HR: 'Кадровый',
      FINANCE: 'Финансы',
      GENERAL: 'Общее',
    };

    return labels[category];
  }

  private updateSummaryFromTasks(tasks: Array<KanbanTask>): void {
    const now = new Date();
    const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;

    this.pendingApprovalCount.set(tasks.filter((task) => task.status === 'pending').length);
    this.actionItemsCount.set(tasks.filter((task) => task.status === 'in_review').length);
    this.pendingApprovalDelta.set(
      tasks.filter((task) => {
        const createdAt = new Date(task.createdAt).getTime();
        return Number.isFinite(createdAt) && createdAt >= dayAgo;
      }).length,
    );
    this.overdueNoticesCount.set(
      tasks.filter((task) => {
        if (task.status === 'approved' || task.status === 'declined' || !task.dueDate) {
          return false;
        }

        const dueTime = new Date(task.dueDate).getTime();
        return Number.isFinite(dueTime) && dueTime < now.getTime();
      }).length,
    );
  }

  private loadTaskMetrics(): void {
    this.taskBoardUseCases
      .listTasks({ scope: 'mine', status: 'pending,in_review' })
      .pipe(take(1))
      .subscribe((tasks) => this.updateSummaryFromTasks(tasks));
  }

  private loadWeeklyVolume(): void {
    this.documentUseCases
      .getWeeklyVolume()
      .pipe(take(1))
      .subscribe((volume) => this.weeklyVolume.set(volume));
  }

  private loadStorage(): void {
    this.documentUseCases
      .getStorageUsage()
      .pipe(take(1))
      .subscribe((storage) => {
        this.storagePercent.set(storage.usedPercent);
        this.storageLabel.set(`${storage.usedTb.toFixed(1)} / ${storage.totalTb.toFixed(1)} ТБ`);
      });
  }

  private loadRecentDocuments(): void {
    forkJoin({
      documents: this.documentUseCases.getDocuments({
        text: this.globalSearch(),
        scope: 'mine',
        page: 1,
        pageSize: 12,
      }),
      tasks: this.taskBoardUseCases.listTasks({
        scope: 'mine',
        status: 'pending,in_review',
      }),
    })
      .pipe(take(1))
      .subscribe((result) => {
        this.recentDocuments.set(result.documents.items);
        this.recentItems.set(
          [
            ...result.documents.items.map((document) => this.createRecentDocumentItem(document)),
            ...result.tasks.map((task) => this.createRecentTaskItem(task)),
          ]
            .sort((left, right) => this.getTime(right.updatedAt) - this.getTime(left.updatedAt))
            .slice(0, 12),
        );
      });
  }

  private createRecentDocumentItem(document: DocumentItem): RecentDashboardItem {
    return {
      kind: 'document',
      id: `document:${document.id}`,
      title: document.title,
      typeLabel: 'Документ',
      statusLabel: this.getDocumentStatusLabel(document.status),
      updatedAt: document.updatedAt,
      document,
    };
  }

  private createRecentTaskItem(task: KanbanTask): RecentDashboardItem {
    return {
      kind: 'task',
      id: `task:${task.id}`,
      title: task.title,
      typeLabel: 'Задача',
      statusLabel: this.getTaskStatusLabel(task.status),
      updatedAt: this.toIsoString(task.updatedAt),
      task,
    };
  }

  private getDocumentStatusLabel(status: DocumentItem['status']): string {
    const labels: Record<DocumentItem['status'], string> = {
      DRAFT: 'Черновик',
      IN_REVIEW: 'На согласовании',
      CHANGES_REQUESTED: 'Нужны изменения',
      APPROVED: 'Согласован',
      ARCHIVED: 'В архиве',
    };

    return labels[status] ?? status;
  }

  private getTaskStatusLabel(status: KanbanTaskStatus): string {
    const labels: Record<KanbanTaskStatus, string> = {
      pending: 'Ожидает',
      in_review: 'На проверке',
      approved: 'Одобрена',
      declined: 'Отклонена',
    };

    return labels[status] ?? status;
  }

  private toIsoString(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  }

  private getTime(value: string): number {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  private loadActivity(): void {
    this.documentUseCases
      .getActivity({ page: 1, pageSize: 6 })
      .pipe(take(1))
      .subscribe((items) => {
        this.activity.set(
          items.map((item) => ({
            id: item.id,
            title: item.actor,
            description: item.description,
            timestamp: item.timestampLabel,
            icon: 'history',
          })),
        );

        this.activityDocumentMap.set(
          items.reduce<Record<string, string | undefined>>((acc, item) => {
            acc[item.id] = item.linkedDocumentId;
            return acc;
          }, {}),
        );
        this.activityTaskMap.set(
          items.reduce<Record<string, { taskId?: string; boardId?: string }>>((acc, item) => {
            acc[item.id] = { taskId: item.linkedTaskId, boardId: item.linkedBoardId };
            return acc;
          }, {}),
        );
      });
  }

  private createEditPayload(document: DashboardEditableDocument): DashboardEditDocumentPayload {
    return {
      title: this.editFilenameControl.value,
      contentDocument: document.contentDocument,
      expectedVersion: document.version,
    };
  }

  private downloadDocumentExport(documentId: string, format: DashboardExportFormat): void {
    this.message.set(`Готовим ${format}. Скачивание начнется автоматически.`);

    this.documentUseCases
      .getDocumentById(documentId)
      .pipe(
        switchMap((document) =>
          this.documentUseCases.createExportRequest(documentId, {
            format,
            sourceVersion: document.version,
          }),
        ),
        switchMap((request) => this.waitForExport(documentId, request.id)),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (request) => {
          this.startExportDownload(documentId, request.id);
          this.message.set('Файл готов. Скачивание началось.');
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось скачать документ';
          this.message.set(message);
        },
      });
  }

  private waitForExport(documentId: string, exportRequestId: string) {
    return timer(0, 1500).pipe(
      switchMap(() => this.documentUseCases.getExportRequest(documentId, exportRequestId)),
      filter((request) => request.status === 'SUCCEEDED' || request.status === 'FAILED'),
      take(1),
      switchMap((request) =>
        request.status === 'FAILED'
          ? throwError(() => new Error(request.errorMessage ?? 'Экспорт завершился с ошибкой.'))
          : [request],
      ),
    );
  }

  private startExportDownload(documentId: string, exportRequestId: string): void {
    if (!this.isBrowser) {
      return;
    }

    const link = globalThis.document.createElement('a');
    link.href = `/api/documents/${documentId}/exports/${exportRequestId}/download`;
    link.download = '';
    link.rel = 'noopener';
    globalThis.document.body.append(link);
    link.click();
    link.remove();
  }

  private weekdayFromIso(value: string): WeeklyVolumePoint['day'] {
    const date = new Date(value);
    const index = date.getUTCDay();
    const map: Array<WeeklyVolumePoint['day']> = [
      'sun',
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
    ];

    return map[index] ?? 'mon';
  }
}
