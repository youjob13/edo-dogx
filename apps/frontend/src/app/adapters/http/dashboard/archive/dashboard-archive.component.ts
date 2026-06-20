import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, finalize, take } from 'rxjs';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';
import {
  DashboardDocumentCategory,
  DashboardPreviewDocument,
  DocumentItem,
} from '../../../../domain/dashboard/dashboard.models';
import {
  CardComponent,
  DrawerComponent,
  PageSectionComponent,
  StatusChipComponent,
} from '../../../../design-system/ui-kit';
import { buildDocumentPreviewBlocks } from '../dashboard-document-preview';

@Component({
  selector: 'edo-dogx-dashboard-archive',
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    DrawerComponent,
    StatusChipComponent,
    DatePipe,
  ],
  templateUrl: './dashboard-archive.component.html',
  styleUrl: './dashboard-archive.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardArchiveComponent {
  private readonly documentUseCases = inject(DocumentUseCases);
  private readonly router = inject(Router);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly archivedDocuments = signal<Array<DocumentItem>>([]);
  protected readonly previewDocument = signal<DashboardPreviewDocument | null>(null);
  protected readonly previewOpen = signal(false);
  protected readonly previewBlocks = computed(() => {
    const preview = this.previewDocument();

    return buildDocumentPreviewBlocks(preview?.contentDocument, preview?.body ?? '');
  });

  protected readonly filteredDocuments = computed(() => {
    const query = this.searchControl.value.trim().toLowerCase();
    if (!query) {
      return this.archivedDocuments();
    }

    return this.archivedDocuments().filter((item) => {
      const haystack = [
        item.title,
        item.ownerUserName ?? '',
        this.getCategoryLabel(item.category),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  constructor() {
    this.loadArchivedDocuments();
    this.searchControl.valueChanges.pipe(debounceTime(150)).subscribe(() => {
      this.message.set('');
    });
  }

  protected preview(item: DocumentItem): void {
    this.documentUseCases
      .previewDocument(item.id)
      .pipe(take(1))
      .subscribe({
        next: (document) => {
          this.previewDocument.set(document);
          this.previewOpen.set(true);
        },
        error: (error: unknown) => {
          this.message.set(error instanceof Error ? error.message : 'Не удалось открыть предпросмотр');
        },
      });
  }

  protected openDocument(item: DocumentItem): void {
    this.router.navigate(['/dashboard/documents', item.id, 'edit']);
  }

  protected closePreview(): void {
    this.previewOpen.set(false);
    this.previewDocument.set(null);
  }

  protected getCategoryLabel(category: DashboardDocumentCategory): string {
    const labels: Record<DashboardDocumentCategory, string> = {
      HR: 'Кадровый',
      FINANCE: 'Финансы',
      GENERAL: 'Общее',
      PRODUCT: 'Изделие',
    };

    return labels[category];
  }

  private loadArchivedDocuments(): void {
    this.loading.set(true);
    this.message.set('');

    this.documentUseCases
      .getDocuments({
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        page: 1,
        pageSize: 100,
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.archivedDocuments.set(response.items.filter((item) => item.status === 'ARCHIVED'));
        },
        error: (error: unknown) => {
          this.message.set(error instanceof Error ? error.message : 'Не удалось загрузить архив');
          this.archivedDocuments.set([]);
        },
      });
  }
}
