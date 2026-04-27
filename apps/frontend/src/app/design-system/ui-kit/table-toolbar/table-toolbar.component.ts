import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { UiKitPaginationState, UiKitSortState } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-table-toolbar',
  template: `
    <div class="edo-ui-kit-table-toolbar">
      <div class="edo-ui-kit-table-toolbar__left">
        <ng-content select="[filters]" />
      </div>

      <div class="edo-ui-kit-table-toolbar__right">
        @if (sort()) {
          <button
            type="button"
            aria-label="Переключить сортировку таблицы"
            (click)="sortPressed.emit()"
          >
            Сортировка: {{ sortLabel() }}
          </button>
        }

        @if (pagination()) {
          <div class="edo-ui-kit-table-toolbar__pagination">
            <button
              type="button"
              aria-label="Перейти на предыдущую страницу"
              [disabled]="isFirstPage()"
              (click)="previousPagePressed.emit()"
            >
              Назад
            </button>
            <span aria-live="polite">{{ pageText() }}</span>
            <button
              type="button"
              aria-label="Перейти на следующую страницу"
              [disabled]="isLastPage()"
              (click)="nextPagePressed.emit()"
            >
              Вперёд
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './table-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableToolbarComponent {
  public readonly sort = input<UiKitSortState | null>(null);
  public readonly pagination = input<UiKitPaginationState | null>(null);

  protected readonly sortLabel = computed(() => {
    const sort = this.sort();
    if (!sort) {
      return '';
    }

    const direction = sort.direction === 'asc' ? 'по возрастанию' : 'по убыванию';
    return `${sort.key} (${direction})`;
  });

  protected readonly pageText = computed(() => {
    const pagination = this.pagination();
    if (!pagination) {
      return '';
    }

    const totalPages = Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize));
    return `Страница ${pagination.page} из ${totalPages}`;
  });

  protected readonly isFirstPage = computed(() => {
    const pagination = this.pagination();
    return !pagination || pagination.page <= 1;
  });

  protected readonly isLastPage = computed(() => {
    const pagination = this.pagination();
    if (!pagination) {
      return true;
    }

    const totalPages = Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize));
    return pagination.page >= totalPages;
  });

  public readonly sortPressed = output<void>();
  public readonly previousPagePressed = output<void>();
  public readonly nextPagePressed = output<void>();
}
