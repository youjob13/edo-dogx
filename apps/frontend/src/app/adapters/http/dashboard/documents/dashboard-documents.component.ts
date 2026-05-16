import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  DrawerComponent,
  ModalComponent,
  PageSectionComponent,
  TableToolbarComponent,
  ToolbarSearchComponent,
  UiKitPaginationState,
  UiKitSortState,
} from '../../../../design-system/ui-kit';
import {
  DashboardEditDocumentPayload,
  DashboardExportFormat,
  DashboardPreviewDocument,
  DashboardDocumentCategory,
  DocumentItem,
} from '../../../../domain/dashboard/dashboard.models';
import { debounceTime, filter, finalize, forkJoin, map, merge, switchMap, take, throwError, timer } from 'rxjs';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';

@Component({
  selector: 'edo-dogx-dashboard-documents',
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    TableToolbarComponent,
    ToolbarSearchComponent,
    DrawerComponent,
    ModalComponent,
    ButtonComponent,
    DatePipe
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

 protected readonly categoryOptions: Array<{ value: DashboardDocumentCategory | 'all'; label: string }> = [
    { value: 'all', label: 'Р’СЃРµ РєР°С‚РµРіРѕСЂРёРё' },
    { value: 'HR', label: 'РљР°РґСЂРѕРІС‹Р№' },
    { value: 'FINANCE', label: 'Р¤РёРЅР°РЅСЃС‹' },
    { value: 'GENERAL', label: 'РћР±С‰РµРµ' },
  ];


  protected readonly categoryFilterControl = new FormControl<DashboardDocumentCategory | 'all'>('all', {
    nonNullable: true,
  });
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly editFilenameControl = new FormControl('', { nonNullable: true });

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
  protected readonly versionsByDocument = signal<Record<string, Array<number>>>({});
  protected readonly selectedVersionByDocument = signal<Record<string, number>>({});

  protected readonly rowView = computed<Array<Record<string, string>>>(() => {
    const sort = this.sortState();
    const rows = [...this.documents()];
    rows.sort((left, right) => {
      if (sort.key === 'title') {
        return sort.direction === 'asc'
          ? left.title.localeCompare(right.title, 'ru')
          : right.title.localeCompare(left.title, 'ru');
      }
      if (sort.key === 'categoryLabel') {
        return sort.direction === 'asc'
          ? left.category.localeCompare(right.category, 'ru')
          : right.category.localeCompare(left.category, 'ru');
      }
      return sort.direction === 'asc'
        ? left.updatedAt.localeCompare(right.updatedAt, 'ru')
        : right.updatedAt.localeCompare(left.updatedAt, 'ru');
    });

    return rows.map((item) => ({
      id: item.id,
      title: item.title,
      categoryLabel: this.getCategoryLabel(item.category),
      ownerUserName: item.ownerUserName ?? '-',
      modifiedAtLabel: item.updatedAt,
    }));
  });

  protected readonly selectedDocument = computed(() => {
    const selectedId = this.selectedDocumentId();
    if (!selectedId) {
      return null;
    }

    return this.documents().find((item) => item.id === selectedId) ?? null;
  });

  protected openCreatePage(): void {
    this.router.navigate(['/dashboard/documents/new']);
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const query = params.get('q')?.trim() ?? '';
      const category = params.get('category');
      const sort = params.get('sort');
      const dir = params.get('dir');
      const page = Number(params.get('page') ?? '1');
      const size = Number(params.get('size') ?? `${this.defaultPageSize}`);

      if (this.searchControl.value !== query) {
        this.searchControl.setValue(query, { emitEvent: false });
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

    merge(this.categoryFilterControl.valueChanges, this.searchControl.valueChanges)
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

  protected versionOptions(documentId: string): Array<number> {
    return this.versionsByDocument()[documentId] ?? [];
  }

  protected selectedVersion(documentId: string): number {
    return this.selectedVersionByDocument()[documentId] ?? 1;
  }

  protected setSelectedVersion(documentId: string, rawValue: string): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    this.selectedVersionByDocument.update((state) => ({ ...state, [documentId]: parsed }));
  }

  protected previewVersion(documentId: string): void {
    const version = this.selectedVersion(documentId);
    this.documentUseCases.getDocumentVersion(documentId, version).pipe(take(1)).subscribe((payload) => {
      const raw = String(payload['content_document_json'] ?? payload['contentDocumentJson'] ?? '{}');
      let contentDocument: DashboardPreviewDocument['contentDocument'] | undefined;
      try {
        contentDocument = JSON.parse(raw) as DashboardPreviewDocument['contentDocument'];
      } catch {
        contentDocument = undefined;
      }

      const base = this.documents().find((item) => item.id === documentId);
      if (!base) {
        return;
      }

      this.previewDocument.set({
        id: documentId,
        title: String(payload['title'] ?? base.title),
        category: base.category,
        version,
        updatedAt: String(payload['created_at'] ?? base.updatedAt),
        body: contentDocument ? JSON.stringify(contentDocument) : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРѕРґРµСЂР¶РёРјРѕРµ РґРѕРєСѓРјРµРЅС‚Р°.',
        contentDocument,
        contentDocumentJson: contentDocument ? JSON.stringify(contentDocument, null, 2) : undefined,
        ownerUserId: base.ownerUserId,
        ownerUserName: base.ownerUserName,
      });
      this.previewOpen.set(true);
    });
  }

  protected editVersion(documentId: string): void {
    this.router.navigate(['/dashboard/documents', documentId, 'edit'], {
      queryParams: { version: this.selectedVersion(documentId) },
    });
  }

  protected downloadVersion(documentId: string, format: DashboardExportFormat): void {
    this.downloadDocumentExport(documentId, format, this.selectedVersion(documentId));
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
      expectedVersion: 1,
    };

    this.documentUseCases
      .updateDocument(selectedId, payload)
      .pipe(take(1))
      .subscribe((result) => {
        this.message.set(`Р”РѕРєСѓРјРµРЅС‚ ${result.title} СЃРѕС…СЂР°РЅРµРЅ.`);
        this.editOpen.set(false);
        this.loadDocuments();
      });
  }

  private loadDocuments(): void {
    const pagination = this.pagination();
    const sort = this.sortState();
    const sortBy = this.toDomainSortKey(sort.key);

    this.loading.set(true);
    this.documentUseCases
      .getDocuments({
        text: this.searchControl.value,
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
        this.loadVersionOptions(result.items);
      });
  }

  private loadVersionOptions(items: Array<DocumentItem>): void {
    if (items.length === 0) {
      this.versionsByDocument.set({});
      this.selectedVersionByDocument.set({});
      return;
    }

    forkJoin(
      items.map((item) =>
        this.documentUseCases.getDocumentVersions(item.id, { limit: 100, offset: 0 }).pipe(
          map((response) => ({
            id: item.id,
            versions: response.items
              .map((entry) => Number(entry['version_number'] ?? entry['versionNumber']))
              .filter((value) => Number.isFinite(value) && value > 0)
              .sort((a, b) => b - a),
            fallback: item.version ?? 1,
          })),
        ),
      ),
    )
      .pipe(take(1))
      .subscribe((rows) => {
        const versionsMap: Record<string, Array<number>> = {};
        const selectedMap: Record<string, number> = {};
        for (const row of rows) {
          const versions = row.versions.length > 0 ? row.versions : [row.fallback];
          versionsMap[row.id] = versions;
          selectedMap[row.id] = versions[0];
        }
        this.versionsByDocument.set(versionsMap);
        this.selectedVersionByDocument.set(selectedMap);
      });
  }

  private toDomainSortKey(key: string): 'title' | 'category' | 'status' | 'updatedAt' {
    if (key === 'title' || key === 'categoryLabel') {
      const mapped: Record<string, 'title' | 'category' | 'status'> = {
        title: 'title',
        categoryLabel: 'category',
      };

      return mapped[key];
    }

    return 'updatedAt';
  }

  protected getCategoryLabel(category: DashboardDocumentCategory): string {
    const labels: Record<DashboardDocumentCategory, string> = {
      HR: 'РљР°РґСЂРѕРІС‹Р№',
      FINANCE: 'Р¤РёРЅР°РЅСЃС‹',
      GENERAL: 'РћР±С‰РµРµ',
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

  private isCategory(value: string | null): value is DashboardDocumentCategory {
    return value === 'HR' || value === 'FINANCE' || value === 'GENERAL';
  }

  private downloadDocumentExport(documentId: string, format: DashboardExportFormat, sourceVersion?: number): void {
    this.message.set(`Р¤РѕСЂРјР°С‚ ${format}. РџРѕРґРґРµСЂР¶РёРІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ PDF Рё DOCX.`);

    this.documentUseCases
      .getDocumentById(documentId)
      .pipe(
        switchMap((document) =>
          this.documentUseCases.createExportRequest(documentId, {
            format,
            sourceVersion: sourceVersion ?? document.version,
          }),
        ),
        switchMap((request) => this.waitForExport(documentId, request.id)),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (request) => {
          this.startExportDownload(documentId, request.id);
          this.message.set('Р­РєСЃРїРѕСЂС‚ Р·Р°РїСѓС‰РµРЅ. РћР¶РёРґР°Р№С‚Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ.');
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ СЌРєСЃРїРѕСЂС‚';
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
    return value === 'title' || value === 'categoryLabel' || value === 'modifiedAtLabel';
  }
}

