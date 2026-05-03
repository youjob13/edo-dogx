import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../design-system/ui-kit';
import { DashboardDocumentStatus, DocumentItem } from '../../../domain/dashboard/dashboard.models';
import { DatePipe } from '@angular/common';
import { DocumentUseCases } from '../../../application/dashboard/document.use-cases';

@Component({
  selector: 'edo-dogx-dashboard-document-lifecycle',
  imports: [PageSectionComponent, CardComponent, ButtonComponent, DatePipe],
  template: `
    <edo-dogx-page-section
      title="Жизненный цикл документа"
      subtitle="Черновик -> На проверке -> Утвержден -> Архив"
    >
      <edo-dogx-card
        title="Управление документами"
        subtitle="Демонстрация переходов статусов для Phase 3 US1"
      >
        <div class="lifecycle-grid">
          @for (doc of documents(); track doc.id) {
            <article class="lifecycle-card">
              <h3>{{ doc.title }}</h3>
              <p>Текущий статус: <strong>{{ labelFor(doc.status) }}</strong></p>
              <p>Обновлен: {{ doc.updatedAt | date: 'medium' }}</p>

              <div class="actions">
                <edo-dogx-button
                  label="Отправить на проверку"
                  size="s"
                  appearance="secondary"
                  [disabled]="doc.status !== 'DRAFT'"
                  (pressed)="setStatus(doc, 'IN_REVIEW')"
                />
                <edo-dogx-button
                  label="Утвердить"
                  size="s"
                  appearance="primary"
                  [disabled]="doc.status !== 'IN_REVIEW'"
                  (pressed)="setStatus(doc, 'APPROVED')"
                />
                <edo-dogx-button
                  label="Архивировать"
                  size="s"
                  appearance="secondary"
                  [disabled]="doc.status !== 'APPROVED'"
                  (pressed)="setStatus(doc, 'ARCHIVED')"
                />
              </div>
            </article>
          }
        </div>

        @if (message()) {
          <p class="message" aria-live="polite">{{ message() }}</p>
        }
      </edo-dogx-card>
    </edo-dogx-page-section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .lifecycle-grid {
        display: grid;
        gap: 0.75rem;
      }

      .lifecycle-card {
        border: 1px solid var(--edo-ui-border-subtle);
        border-radius: var(--edo-ui-radius-m);
        padding: 0.75rem;
        background: var(--edo-ui-surface-secondary);
      }

      .lifecycle-card h3,
      .lifecycle-card p {
        margin: 0;
      }

      .lifecycle-card p {
        margin-top: 0.25rem;
        color: var(--edo-ui-ink-muted);
      }

      .actions {
        margin-top: 0.75rem;
        display: grid;
        gap: 0.5rem;
      }

      .message {
        margin-top: 0.75rem;
        font-size: 0.875rem;
        color: var(--edo-ui-ink-muted);
      }

      @media (min-width: 720px) {
        .actions {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly documentUseCases = inject(DocumentUseCases);

  protected readonly message = signal('');
  private readonly items = signal<Array<DocumentItem>>([]);
  protected readonly documents = computed(() => this.items());

  constructor() {
    this.documentUseCases
      .getDocuments({ page: 1, pageSize: 6, sortBy: 'updatedAt', sortDirection: 'desc' })
      .pipe(takeUntilDestroyed())
      .subscribe((result) => this.items.set(result.items));
  }

  protected labelFor(status: DashboardDocumentStatus): string {
    const labels: Record<DashboardDocumentStatus, string> = {
      DRAFT: 'Черновик',
      IN_REVIEW: 'На проверке',
      APPROVED: 'Утвержден',
      ARCHIVED: 'Архив',
    };

    return labels[status];
  }

  protected setStatus(document: DocumentItem, nextStatus: DashboardDocumentStatus): void {
    this.documentUseCases
      .updateDocument(document.id, { title: document.title, status: nextStatus })
      .pipe(takeUntilDestroyed())
      .subscribe((updated) => {
        this.items.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        this.message.set(`Статус документа ${updated.title} обновлен.`);
      });
  }
}
