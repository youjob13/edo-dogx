import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  DataTableComponent,
  DrawerComponent,
  ModalComponent,
  PageSectionComponent,
  StatusChipComponent,
  TableToolbarComponent,
  ToolbarSearchComponent,
  UiKitChipTone,
  UiKitDropdownItem,
  UiKitPaginationState,
  UiKitSortState,
  UiKitTableColumn,
} from '../../../../design-system/ui-kit';
import {
  DashboardEditDocumentPayload,
  DashboardExportFormat,
  DashboardPreviewDocument,
  DashboardDocumentCategory,
  DashboardDocumentStatus,
  DocumentItem,
} from '../../../../domain/dashboard/dashboard.models';
import { debounceTime, filter, finalize, merge, switchMap, take, throwError, timer } from 'rxjs';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';

@Component({
  selector: 'edo-dogx-dashboard-documents',
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    DataTableComponent,
    TableToolbarComponent,
    ToolbarSearchComponent,
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
  private readonly documentUseCases = inject(DocumentUseCases);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly defaultSort: UiKitSortState = { key: 'modifiedAtLabel', direction: 'desc' };
  private readonly defaultPageSize = 5;

  protected readonly columns: Array<UiKitTableColumn> = [
    { key: 'title', label: 'Документ', sortable: true },
    { key: 'categoryLabel', label: 'Категория', sortable: true },
    { key: 'statusLabel', label: 'Статус', sortable: true },
    { key: 'ownerUserName', label: 'Владелец', sortable: false },
    { key: 'modifiedAtLabel', label: 'Изменен', sortable: true },
  ];

  protected readonly statusOptions: Array<{ value: DashboardDocumentStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Все статусы' },
    { value: 'DRAFT', label: 'Ожидает' },
    { value: 'IN_REVIEW', label: 'На проверке' },
    { value: 'APPROVED', label: 'Утвержден' },
    { value: 'ARCHIVED', label: 'В архиве' },
  ];

  protected readonly categoryOptions: Array<{ value: DashboardDocumentCategory | 'all'; label: string }> = [
    { value: 'all', label: 'Все категории' },
    { value: 'HR', label: 'HR' },
    { value: 'FINANCE', label: 'Финансы' },
    { value: 'GENERAL', label: 'Общее' },
  ];

  protected readonly statusFilterControl = new FormControl<DashboardDocumentStatus | 'all'>('all', {
    nonNullable: true,
  });
  protected readonly categoryFilterControl = new FormControl<DashboardDocumentCategory | 'all'>('all', {
    nonNullable: true,
  });
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly editFilenameControl = new FormControl('', { nonNullable: true });
  protected readonly editStatusControl = new FormControl<DashboardDocumentStatus>('DRAFT', {
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
      title: item.title,
      categoryLabel: this.getCategoryLabel(item.category),
      statusLabel: this.getStatusLabel(item.status),
      ownerUserName: item.ownerUserName ?? '-',
      modifiedAtLabel: item.updatedAt,
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
    { id: 'download-pdf', label: 'Скачать PDF', icon: 'download' },
    { id: 'download-docx', label: 'Скачать DOCX', icon: 'download' },
  ];

  protected openCreatePage(): void {
    this.router.navigate(['/dashboard/documents/new']);
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const query = params.get('q')?.trim() ?? '';
      const status = params.get('status');
      const category = params.get('category');
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

      const normalizedCategory = this.isCategory(category) ? category : 'all';
      if (this.categoryFilterControl.value !== normalizedCategory) {
        this.categoryFilterControl.setValue(normalizedCategory, { emitEvent: false });
      }

      const normalizedSortKey = this.isSortKey(sort) ? sort : this.defaultSort.key;
      const normalizedSortDirection: UiKitSortState['direction'] = dir === 'asc' ? 'asc' : 'desc';
      this.sortState.set({ key: normalizedSortKey, direction: normalizedSortDirection });

      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const safeSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : this.defaultPageSize;
      this.pagination.update((state) => ({ ...state, page: safePage, pageSize: safeSize }));

      this.loadDocuments();
    });

    merge(this.statusFilterControl.valueChanges, this.categoryFilterControl.valueChanges, this.searchControl.valueChanges)
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

  protected onRowMenuAction(event: { row: Record<string, unknown>; actionId: string }): void {
    this.selectedDocumentId.set(String(event.row['id'] ?? ''));
    this.onMenuAction(event.actionId);
  }

  protected onMenuAction(actionId: string): void {
    const selectedId = this.selectedDocumentId();
    if (!selectedId) {
      return;
    }

    if (actionId === 'preview') {
      this.documentUseCases
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

    if (actionId === 'download' || actionId === 'download-pdf' || actionId === 'download-docx') {
      this.downloadDocumentExport(selectedId, actionId === 'download-docx' ? 'DOCX' : 'PDF');
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
      title: this.editFilenameControl.value,
      status: this.editStatusControl.value,
      expectedVersion: 1,
    };

    this.documentUseCases
      .updateDocument(selectedId, payload)
      .pipe(take(1))
      .subscribe((result) => {
        this.message.set(`Документ ${result.title} обновлен.`);
        this.editOpen.set(false);
        this.loadDocuments();
      });
  }

  protected getStatusTone(status: DashboardDocumentStatus): UiKitChipTone {
    return status.toLowerCase() as UiKitChipTone;
  }

  private loadDocuments(): void {
    const pagination = this.pagination();
    const sort = this.sortState();
    const sortBy = this.toDomainSortKey(sort.key);

    this.loading.set(true);
    this.documentUseCases
      .getDocuments({
        text: this.searchControl.value,
        status:
          this.statusFilterControl.value === 'all'
            ? undefined
            : this.statusFilterControl.value,
        category:
          this.categoryFilterControl.value === 'all'
            ? undefined
            : this.categoryFilterControl.value,
        sortBy,
        sortDirection: sort.direction,
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((result) => {
        this.documents.set(result.items);
        this.pagination.update((state) => ({ ...state, totalItems: result.total }));
      });
  }

  private toDomainSortKey(key: string): 'title' | 'category' | 'status' | 'updatedAt' {
    if (key === 'title' || key === 'categoryLabel' || key === 'statusLabel') {
      const mapped: Record<string, 'title' | 'category' | 'status'> = {
        title: 'title',
        categoryLabel: 'category',
        statusLabel: 'status',
      };

      return mapped[key];
    }

    return 'updatedAt';
  }

  protected getStatusLabel(status: DashboardDocumentStatus): string {
    const labels: Record<DashboardDocumentStatus, string> = {
      DRAFT: 'Ожидает',
      IN_REVIEW: 'На проверке',
      APPROVED: 'Утвержден',
      ARCHIVED: 'В архиве',
    };

    return labels[status];
  }

  protected getCategoryLabel(category: DashboardDocumentCategory): string {
    const labels: Record<DashboardDocumentCategory, string> = {
      HR: 'HR',
      FINANCE: 'Финансы',
      GENERAL: 'Общее',
    };

    return labels[category];
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
        category: this.categoryFilterControl.value === 'all' ? null : this.categoryFilterControl.value,
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
    return value === 'DRAFT' || value === 'IN_REVIEW' || value === 'APPROVED' || value === 'ARCHIVED';
  }

  private isCategory(value: string | null): value is DashboardDocumentCategory {
    return value === 'HR' || value === 'FINANCE' || value === 'GENERAL';
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

  private isSortKey(value: string | null): value is UiKitSortState['key'] {
    return value === 'title' || value === 'categoryLabel' || value === 'statusLabel' || value === 'modifiedAtLabel';
  }
}
