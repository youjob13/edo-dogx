import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../design-system/ui-kit';
import { DatePipe } from '@angular/common';

type SearchCategory = 'ALL' | 'HR' | 'FINANCE' | 'GENERAL';
type SearchStatus = 'ALL' | 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';

interface SearchResultItem {
  documentId: string;
  title: string;
  category: Exclude<SearchCategory, 'ALL'>;
  status: Exclude<SearchStatus, 'ALL'>;
  updatedAtLabel: string;
}

interface NotificationCenterItem {
  id: string;
  title: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
  createdAtLabel: string;
}

@Component({
  selector: 'edo-dogx-search-notification',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent, DatePipe],
  template: `
    <edo-dogx-page-section
      title="Поиск и уведомления"
      subtitle="Elasticsearch-проекция и центр уведомлений"
    >
      <edo-dogx-card title="Фильтры поиска" subtitle="Поиск по тексту, категории и статусу">
        <form class="search-ui__filters" (submit)="$event.preventDefault(); runSearch()">
          <label>
            <span>Текст</span>
            <input type="text" [formControl]="queryControl" autocomplete="off" />
          </label>

          <label>
            <span>Категория</span>
            <select [formControl]="categoryControl">
              @for (item of categories; track item.value) {
                <option [value]="item.value">{{ item.label }}</option>
              }
            </select>
          </label>

          <label>
            <span>Статус</span>
            <select [formControl]="statusControl">
              @for (item of statuses; track item.value) {
                <option [value]="item.value">{{ item.label }}</option>
              }
            </select>
          </label>

          <edo-dogx-button label="Найти" appearance="primary" size="m" (pressed)="runSearch()" />
        </form>

        @if (message()) {
          <p class="search-ui__message" aria-live="polite">{{ message() }}</p>
        }
      </edo-dogx-card>

      <edo-dogx-card title="Результаты поиска" subtitle="Синхронизированные проекции документов">
        <ul class="search-ui__results" aria-label="Результаты поиска документов">
          @for (item of filteredResults(); track item.documentId) {
            <li class="search-ui__result-item">
              <p><strong>{{ item.title }}</strong></p>
              <p>ID: {{ item.documentId }}</p>
              <p>Категория: {{ item.category }}</p>
              <p>Статус: {{ item.status }}</p>
              <p>Обновлен: {{ item.updatedAtLabel | date: 'medium' }}</p>
            </li>
          }
        </ul>
      </edo-dogx-card>

      <edo-dogx-card title="Центр уведомлений" subtitle="События жизненного цикла документов">
        <ul class="search-ui__notifications" aria-label="Центр уведомлений">
          @for (item of notifications(); track item.id) {
            <li class="search-ui__notification-item">
              <p><strong>{{ item.title }}</strong></p>
              <p>Статус доставки: {{ item.status }}</p>
              <p>Создано: {{ item.createdAtLabel }}</p>
            </li>
          }
        </ul>
      </edo-dogx-card>
    </edo-dogx-page-section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .search-ui__filters {
        display: grid;
        gap: 0.75rem;
      }

      .search-ui__filters label {
        display: grid;
        gap: 0.35rem;
      }

      .search-ui__filters span {
        color: var(--edo-ui-ink-muted);
        font-size: 0.75rem;
      }

      .search-ui__filters input,
      .search-ui__filters select {
        border-radius: var(--edo-ui-radius-m);
        border: 1px solid var(--edo-ui-border-subtle);
        background: var(--edo-ui-surface-primary);
        color: var(--edo-ui-ink-primary);
        min-height: 2.25rem;
        font: inherit;
        padding: 0.4rem 0.65rem;
      }

      .search-ui__message {
        margin-top: 0.75rem;
        color: var(--edo-ui-ink-muted);
      }

      .search-ui__results,
      .search-ui__notifications {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.75rem;
      }

      .search-ui__result-item,
      .search-ui__notification-item {
        border: 1px solid var(--edo-ui-border-subtle);
        border-radius: var(--edo-ui-radius-m);
        background: var(--edo-ui-surface-secondary);
        padding: 0.75rem;
      }

      .search-ui__result-item p,
      .search-ui__notification-item p {
        margin: 0;
        color: var(--edo-ui-ink-muted);
      }

      @media (min-width: 960px) {
        .search-ui__filters {
          grid-template-columns: 1.4fr repeat(2, minmax(0, 1fr)) auto;
          align-items: end;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchNotificationComponent {
  protected readonly categories = [
    { value: 'ALL', label: 'Все категории' },
    { value: 'HR', label: 'HR' },
    { value: 'FINANCE', label: 'FINANCE' },
    { value: 'GENERAL', label: 'GENERAL' },
  ] as const;

  protected readonly statuses = [
    { value: 'ALL', label: 'Все статусы' },
    { value: 'DRAFT', label: 'DRAFT' },
    { value: 'IN_REVIEW', label: 'IN_REVIEW' },
    { value: 'APPROVED', label: 'APPROVED' },
    { value: 'ARCHIVED', label: 'ARCHIVED' },
  ] as const;

  protected readonly queryControl = new FormControl('', { nonNullable: true });
  protected readonly categoryControl = new FormControl<SearchCategory>('ALL', {
    nonNullable: true,
  });
  protected readonly statusControl = new FormControl<SearchStatus>('ALL', {
    nonNullable: true,
  });
  protected readonly message = signal('');

  private readonly resultItems = signal<Array<SearchResultItem>>([
    {
      documentId: 'doc-hr-001',
      title: 'Трудовой договор 2026',
      category: 'HR',
      status: 'IN_REVIEW',
      updatedAtLabel: '01.05.2026 09:20',
    },
    {
      documentId: 'doc-fin-002',
      title: 'Финансовый отчет Q1',
      category: 'FINANCE',
      status: 'APPROVED',
      updatedAtLabel: '01.05.2026 09:18',
    },
    {
      documentId: 'doc-gen-003',
      title: 'Общий регламент закупок',
      category: 'GENERAL',
      status: 'DRAFT',
      updatedAtLabel: '01.05.2026 09:12',
    },
  ]);

  protected readonly notifications = signal<Array<NotificationCenterItem>>([
    {
      id: 'notif-1',
      title: 'Документ doc-hr-001 отправлен на согласование',
      status: 'SENT',
      createdAtLabel: '01.05.2026 09:21',
    },
    {
      id: 'notif-2',
      title: 'Документ doc-fin-002 ожидает подпись',
      status: 'PENDING',
      createdAtLabel: '01.05.2026 09:22',
    },
  ]);

  protected readonly filteredResults = computed(() => {
    const query = this.queryControl.value.trim().toLowerCase();
    const category = this.categoryControl.value;
    const status = this.statusControl.value;

    return this.resultItems().filter((item) => {
      if (query && !item.title.toLowerCase().includes(query) && !item.documentId.toLowerCase().includes(query)) {
        return false;
      }
      if (category !== 'ALL' && item.category !== category) {
        return false;
      }
      if (status !== 'ALL' && item.status !== status) {
        return false;
      }
      return true;
    });
  });

  protected runSearch(): void {
    this.message.set(`Найдено документов: ${this.filteredResults().length}.`);
  }
}
