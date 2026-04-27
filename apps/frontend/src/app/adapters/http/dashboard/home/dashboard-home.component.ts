import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ActivityFeedComponent,
  BarMiniChartComponent,
  ButtonComponent,
  CardComponent,
  DataTableComponent,
  DrawerComponent,
  DropdownMenuComponent,
  MetricCardComponent,
  ModalComponent,
  PageSectionComponent,
  ProgressMeterComponent,
  StatusChipComponent,
  UiKitDropdownItem,
  UiKitSortState,
  UiKitTableColumn,
  UiKitActivityItem,
  UiKitChartBar,
} from '../../../../design-system/ui-kit';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import {
  DashboardDocumentStatus,
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DocumentItem,
  WeeklyVolumePoint,
} from '../../../../domain/dashboard/dashboard.models';
import { take } from 'rxjs';

@Component({
  selector: 'edo-dogx-dashboard-home',
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    MetricCardComponent,
    BarMiniChartComponent,
    DataTableComponent,
    DropdownMenuComponent,
    DrawerComponent,
    ModalComponent,
    StatusChipComponent,
    ButtonComponent,
    ActivityFeedComponent,
    ProgressMeterComponent,
  ],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHomeComponent {
  private readonly useCases = inject(DashboardUseCases);
  private readonly route = inject(ActivatedRoute);

  protected readonly recentDocumentColumns: ReadonlyArray<UiKitTableColumn> = [
    { key: 'filename', label: 'Документ', sortable: true },
    { key: 'statusLabel', label: 'Статус', sortable: true },
    { key: 'modifiedAtLabel', label: 'Обновлен', sortable: true },
  ];

  protected readonly documentSort = signal<UiKitSortState>({ key: 'modifiedAtLabel', direction: 'desc' });
  protected readonly quickStatusFilter = signal<DashboardDocumentStatus | null>(null);
  protected readonly globalSearch = signal('');
  protected readonly recentDocuments = signal<ReadonlyArray<DocumentItem>>([]);
  protected readonly selectedDocumentId = signal<string | null>(null);
  protected readonly previewDocument = signal<DashboardPreviewDocument | null>(null);
  protected readonly previewOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly storageDetailsOpen = signal(false);
  protected readonly editFilenameControl = new FormControl('', { nonNullable: true });
  protected readonly editStatusControl = new FormControl<DashboardDocumentStatus>('pending', {
    nonNullable: true,
  });

  protected readonly pendingApprovalCount = signal(0);
  protected readonly pendingApprovalDelta = signal(0);
  protected readonly actionItemsCount = signal(0);
  protected readonly overdueNoticesCount = signal(0);
  protected readonly weeklyVolume = signal<ReadonlyArray<WeeklyVolumePoint>>([]);
  protected readonly selectedDay = signal<WeeklyVolumePoint['day'] | null>(null);
  protected readonly storagePercent = signal(0);
  protected readonly storageLabel = signal('0 / 0 ТБ');
  protected readonly activity = signal<ReadonlyArray<UiKitActivityItem>>([]);
  protected readonly activityDocumentMap = signal<Record<string, string | undefined>>({});
  protected readonly message = signal('');

  protected readonly documentMenuItems: ReadonlyArray<UiKitDropdownItem> = [
    { id: 'preview', label: 'Предпросмотр', icon: 'preview' },
    { id: 'edit', label: 'Редактировать', icon: 'edit' },
    { id: 'download', label: 'Скачать', icon: 'download' },
  ];

  protected readonly chartBars = computed<ReadonlyArray<UiKitChartBar>>(() => {
    const selected = this.selectedDay();

    return this.weeklyVolume().map((item) => ({
      label: item.day.toUpperCase(),
      value: item.value,
      highlighted: selected === item.day,
    }));
  });

  protected readonly recentDocumentRows = computed<ReadonlyArray<Record<string, string>>>(() =>
    this.filteredRecentDocuments().map((item) => ({
      id: item.id,
      filename: item.filename,
      statusLabel: this.getStatusLabel(item.status),
      modifiedAtLabel: item.modifiedAtLabel,
    })),
  );

  protected readonly filteredRecentDocuments = computed(() => {
    const selectedStatus = this.quickStatusFilter();
    const selectedDay = this.selectedDay();

    return this.recentDocuments().filter((item) => {
      const statusMatch = !selectedStatus || item.status === selectedStatus;
      if (!statusMatch) {
        return false;
      }

      if (!selectedDay) {
        return true;
      }

      return this.weekdayFromIso(item.modifiedAtIso) === selectedDay;
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

    this.loadSummary();
    this.loadWeeklyVolume();
    this.loadRecentDocuments();
    this.loadStorage();
    this.loadActivity();
  }

  protected onMetricPressed(metric: 'pending' | 'review'): void {
    this.quickStatusFilter.set(metric === 'pending' ? 'pending' : 'review');
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
    this.selectedDocumentId.set(String(row['id'] ?? ''));
  }

  protected onDocumentMenuAction(actionId: string): void {
    const id = this.selectedDocumentId();
    if (!id) {
      return;
    }

    if (actionId === 'preview') {
      this.useCases
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

      this.editFilenameControl.setValue(selected.filename);
      this.editStatusControl.setValue(selected.status);
      this.editOpen.set(true);
      return;
    }

    if (actionId === 'download') {
      this.useCases
        .downloadDocument(id)
        .pipe(take(1))
        .subscribe(() => {
          this.message.set('Скачивание документа запущено (мок-режим).');
        });
    }
  }

  protected closePreview(): void {
    this.previewOpen.set(false);
    this.previewDocument.set(null);
  }

  protected closeEdit(): void {
    this.editOpen.set(false);
  }

  protected saveEdit(): void {
    const id = this.selectedDocumentId();
    if (!id) {
      return;
    }

    const payload: DashboardEditDocumentPayload = {
      filename: this.editFilenameControl.value,
      status: this.editStatusControl.value,
    };

    this.useCases
      .updateDocument(id, payload)
      .pipe(take(1))
      .subscribe((updated) => {
        this.message.set(`Документ ${updated.filename} обновлен.`);
        this.editOpen.set(false);
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
      this.message.set(`Открыта активность ${id}.`);
      return;
    }

    this.selectedDocumentId.set(documentId);
    this.useCases
      .previewDocument(documentId)
      .pipe(take(1))
      .subscribe((preview) => {
        this.previewDocument.set(preview);
        this.previewOpen.set(true);
        this.message.set(`Открыта связанная активность ${id}.`);
      });
  }

  protected resetQuickFilters(): void {
    this.quickStatusFilter.set(null);
    this.selectedDay.set(null);
    this.message.set('Быстрые фильтры сброшены.');
  }

  protected getStatusTone(status: DashboardDocumentStatus): DashboardDocumentStatus {
    return status;
  }

  protected getStatusLabel(status: DashboardDocumentStatus): string {
    const labels: Record<DashboardDocumentStatus, string> = {
      pending: 'Ожидает',
      review: 'На проверке',
      finalized: 'Утвержден',
      archived: 'В архиве',
    };

    return labels[status];
  }

  private loadSummary(): void {
    this.useCases
      .getDashboardSummary({ page: 1, pageSize: 50 })
      .pipe(take(1))
      .subscribe((summary) => {
        this.pendingApprovalCount.set(summary.pendingApprovalCount);
        this.pendingApprovalDelta.set(summary.pendingApprovalDelta);
        this.actionItemsCount.set(summary.actionItemsCount);
        this.overdueNoticesCount.set(summary.overdueNoticesCount);
      });
  }

  private loadWeeklyVolume(): void {
    this.useCases
      .getWeeklyVolume()
      .pipe(take(1))
      .subscribe((volume) => this.weeklyVolume.set(volume));
  }

  private loadStorage(): void {
    this.useCases
      .getStorageUsage()
      .pipe(take(1))
      .subscribe((storage) => {
        this.storagePercent.set(storage.usedPercent);
        this.storageLabel.set(`${storage.usedTb.toFixed(1)} / ${storage.totalTb.toFixed(1)} ТБ`);
      });
  }

  private loadRecentDocuments(): void {
    this.useCases
      .getDocuments({
        text: this.globalSearch(),
        page: 1,
        pageSize: 12,
      })
      .pipe(take(1))
      .subscribe((result) => {
        this.recentDocuments.set(result.items);
      });
  }

  private loadActivity(): void {
    this.useCases
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
      });
  }

  private weekdayFromIso(value: string): WeeklyVolumePoint['day'] {
    const date = new Date(value);
    const index = date.getUTCDay();
    const map: ReadonlyArray<WeeklyVolumePoint['day']> = [
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
