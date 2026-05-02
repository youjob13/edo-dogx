import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  DataTableComponent,
  DrawerComponent,
  DropdownMenuComponent,
  ModalComponent,
  PageSectionComponent,
  StatusChipComponent,
  TableToolbarComponent,
  ToolbarSearchComponent,
  UiKitDropdownItem,
  UiKitPaginationState,
  UiKitSortState,
  UiKitTableColumn,
} from '../../../../design-system/ui-kit';
import {
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardDocumentStatus,
  DashboardDocumentType,
  DocumentItem,
} from '../../../../domain/dashboard/dashboard.models';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import { debounceTime, finalize, merge, take } from 'rxjs';

@Component({
  selector: 'edo-dogx-dashboard-documents',
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    DataTableComponent,
    TableToolbarComponent,
    ToolbarSearchComponent,
    DropdownMenuComponent,
    DrawerComponent,
    ModalComponent,
    ButtonComponent,
    StatusChipComponent,
  ],
  templateUrl: './dashboard-documents.component.html',
  styleUrl: './dashboard-documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDocumentsComponent {
  private readonly useCases = inject(DashboardUseCases);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly defaultSort: UiKitSortState = { key: 'modifiedAtLabel', direction: 'desc' };
  private readonly defaultPageSize = 5;

  protected readonly columns: Array<UiKitTableColumn> = [
    { key: 'filename', label: 'Документ', sortable: true },
    { key: 'typeLabel', label: 'Тип', sortable: true },
    { key: 'statusLabel', label: 'Статус', sortable: true },
    { key: 'modifiedAtLabel', label: 'Изменен', sortable: true },
  ];

  protected readonly statusOptions: Array<{ value: DashboardDocumentStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все статусы' },
    { value: 'pending', label: 'Ожидает' },
    { value: 'review', label: 'На проверке' },
    { value: 'finalized', label: 'Утвержден' },
    { value: 'archived', label: 'В архиве' },
  ];

  protected readonly typeOptions: Array<{ value: DashboardDocumentType | 'all'; label: string }> = [
    { value: 'all', label: 'Все типы' },
    { value: 'pdf', label: 'PDF' },
    { value: 'legal', label: 'Юридический' },
    { value: 'spreadsheet', label: 'Таблица' },
    { value: 'image', label: 'Изображение' },
  ];

  protected readonly statusFilterControl = new FormControl<DashboardDocumentStatus | 'all'>('all', {
    nonNullable: true,
  });
  protected readonly typeFilterControl = new FormControl<DashboardDocumentType | 'all'>('all', {
    nonNullable: true,
  });
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly editFilenameControl = new FormControl('', { nonNullable: true });
  protected readonly editStatusControl = new FormControl<DashboardDocumentStatus>('pending', {
    nonNullable: true,
  });

  protected readonly sortState = signal<UiKitSortState>(this.defaultSort);
  protected readonly pagination = signal<UiKitPaginationState>({
    page: 1,
    pageSize: this.defaultPageSize,
    totalItems: 0,
  });
  protected readonly loading = signal(false);
  protected readonly documents = signal<Array<DocumentItem>>([]);
  protected readonly selectedDocumentId = signal<string | null>(null);
  protected readonly previewDocument = signal<DashboardPreviewDocument | null>(null);
  protected readonly previewOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly message = signal('');

  protected readonly rowView = computed<Array<Record<string, string>>>(() =>
    this.documents().map((item) => ({
      id: item.id,
      filename: item.title,
      typeLabel: this.getTypeLabel(item.type),
      statusLabel: this.getStatusLabel(item.status),
      // modifiedAtLabel: item.modifiedAtLabel,
    })),
  );

  protected readonly selectedDocument = computed(() => {
    const selectedId = this.selectedDocumentId();
    if (!selectedId) {
      return null;
    }

    return this.documents().find((item) => item.id === selectedId) ?? null;
  });

  protected readonly menuItems: Array<UiKitDropdownItem> = [
    { id: 'preview', label: 'Открыть предпросмотр', icon: 'preview' },
    { id: 'edit', label: 'Редактировать в отдельной странице', icon: 'edit' },
    { id: 'download', label: 'Скачать', icon: 'download' },
  ];

  protected openCreatePage(): void {
    this.router.navigate(['/dashboard/documents/new']);
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const query = params.get('q')?.trim() ?? '';
      const status = params.get('status');
      const type = params.get('type');
      const sort = params.get('sort');
      const dir = params.get('dir');
      const page = Number(params.get('page') ?? '1');
      const size = Number(params.get('size') ?? `${this.defaultPageSize}`);

      if (this.searchControl.value !== query) {
        this.searchControl.setValue(query, { emitEvent: false });
      }

      const normalizedStatus = this.isStatus(status) ? status : 'all';
      if (this.statusFilterControl.value !== normalizedStatus) {
        this.statusFilterControl.setValue(normalizedStatus, { emitEvent: false });
      }

      const normalizedType = this.isType(type) ? type : 'all';
      if (this.typeFilterControl.value !== normalizedType) {
        this.typeFilterControl.setValue(normalizedType, { emitEvent: false });
      }

      const normalizedSortKey = this.isSortKey(sort) ? sort : this.defaultSort.key;
      const normalizedSortDirection: UiKitSortState['direction'] = dir === 'asc' ? 'asc' : 'desc';
      this.sortState.set({ key: normalizedSortKey, direction: normalizedSortDirection });

      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const safeSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : this.defaultPageSize;
      this.pagination.update((state) => ({ ...state, page: safePage, pageSize: safeSize }));

      this.loadDocuments();
    });

    merge(this.statusFilterControl.valueChanges, this.typeFilterControl.valueChanges, this.searchControl.valueChanges)
      .pipe(debounceTime(150), takeUntilDestroyed())
      .subscribe(() => {
        this.pagination.update((state) => ({ ...state, page: 1 }));
        this.syncQueryParams();
      });
  }

  protected onSortChanged(state: UiKitSortState): void {
    this.sortState.set(state);
    this.pagination.update((value) => ({ ...value, page: 1 }));
    this.syncQueryParams();
  }

  protected onPageChanged(page: number): void {
    this.pagination.update((state) => ({ ...state, page }));
    this.syncQueryParams();
  }

  protected onPreviousPage(): void {
    this.pagination.update((state) => ({ ...state, page: Math.max(1, state.page - 1) }));
    this.syncQueryParams();
  }

  protected onNextPage(): void {
    const current = this.pagination();
    const maxPage = Math.max(1, Math.ceil(current.totalItems / current.pageSize));
    this.pagination.update((state) => ({ ...state, page: Math.min(maxPage, state.page + 1) }));
    this.syncQueryParams();
  }

  protected onToolbarSortPressed(): void {
    const sort = this.sortState();
    this.sortState.set({
      key: sort.key,
      direction: sort.direction === 'asc' ? 'desc' : 'asc',
    });
    this.syncQueryParams();
  }

  protected onRowAction(row: Record<string, unknown>): void {
    this.selectedDocumentId.set(String(row['id'] ?? ''));
  }

  protected onMenuAction(actionId: string): void {
    const selectedId = this.selectedDocumentId();
    if (!selectedId) {
      return;
    }

    if (actionId === 'preview') {
      this.useCases
        .previewDocument(selectedId)
        .pipe(take(1))
        .subscribe((preview) => {
          this.previewDocument.set(preview);
          this.previewOpen.set(true);
          this.message.set('Предпросмотр открыт.');
        });
      return;
    }

    if (actionId === 'edit') {
      const selected = this.selectedDocument();
      if (!selected) {
        return;
      }
      this.router.navigate(['/dashboard/documents', selected.id, 'edit']);
      return;
    }

    if (actionId === 'download') {
      this.useCases
        .downloadDocument(selectedId)
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
    const selectedId = this.selectedDocumentId();
    if (!selectedId) {
      return;
    }

    const payload: DashboardEditDocumentPayload = {
      filename: this.editFilenameControl.value,
      status: this.editStatusControl.value,
      expectedVersion: 1,
    };

    this.useCases
      .updateDocument(selectedId, payload)
      .pipe(take(1))
      .subscribe((result) => {
        this.message.set(`Документ ${result.title} обновлен.`);
        this.editOpen.set(false);
        this.loadDocuments();
      });
  }

  protected getStatusTone(status: DashboardDocumentStatus): DashboardDocumentStatus {
    return status;
  }

  private loadDocuments(): void {
    const pagination = this.pagination();
    const sort = this.sortState();
    const sortBy = this.toDomainSortKey(sort.key);

    this.loading.set(true);
    this.useCases
      .getDocuments(
      //   {
      //   text: this.searchControl.value,
      //   status:
      //     this.statusFilterControl.value === 'all'
      //       ? undefined
      //       : this.statusFilterControl.value,
      //   type:
      //     this.typeFilterControl.value === 'all'
      //       ? undefined
      //       : this.typeFilterControl.value,
      //   sortBy,
      //   sortDirection: sort.direction,
      //   page: pagination.page,
      //   pageSize: pagination.pageSize,
      // }
    )
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((result) => {
        this.documents.set(result.items);
        this.pagination.update((state) => ({ ...state, totalItems: result.total }));
      });
  }

  private toDomainSortKey(key: string): 'filename' | 'type' | 'status' | 'modifiedAtIso' {
    if (key === 'filename' || key === 'typeLabel' || key === 'statusLabel') {
      const mapped: Record<string, 'filename' | 'type' | 'status'> = {
        filename: 'filename',
        typeLabel: 'type',
        statusLabel: 'status',
      };

      return mapped[key];
    }

    return 'modifiedAtIso';
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

  private getTypeLabel(type: DashboardDocumentType): string {
    const labels: Record<DashboardDocumentType, string> = {
      pdf: 'PDF',
      legal: 'Юридический',
      spreadsheet: 'Таблица',
      image: 'Изображение',
    };

    return labels[type];
  }

  private syncQueryParams(): void {
    const pagination = this.pagination();
    const sort = this.sortState();
    const q = this.searchControl.value.trim();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: q || null,
        status: this.statusFilterControl.value === 'all' ? null : this.statusFilterControl.value,
        type: this.typeFilterControl.value === 'all' ? null : this.typeFilterControl.value,
        sort: sort.key === this.defaultSort.key ? null : sort.key,
        dir: sort.direction === this.defaultSort.direction ? null : sort.direction,
        page: pagination.page === 1 ? null : pagination.page,
        size: pagination.pageSize === this.defaultPageSize ? null : pagination.pageSize,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private isStatus(value: string | null): value is DashboardDocumentStatus {
    return value === 'pending' || value === 'review' || value === 'finalized' || value === 'archived';
  }

  private isType(value: string | null): value is DashboardDocumentType {
    return value === 'pdf' || value === 'legal' || value === 'spreadsheet' || value === 'image';
  }

  private isSortKey(value: string | null): value is UiKitSortState['key'] {
    return value === 'filename' || value === 'typeLabel' || value === 'statusLabel' || value === 'modifiedAtLabel';
  }
}
