import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TuiButton } from '@taiga-ui/core/components/button';
import { UiKitSortDirection, UiKitSortState, UiKitTableColumn } from '../ui-kit.models';

type TableRow = Record<string, string | number | null | undefined>;

@Component({
  selector: 'edo-dogx-data-table',
  imports: [TuiButton],
  template: `
    <div class="edo-ui-kit-table-shell">
      @if (caption()) {
        <header>
          <h3>{{ caption() }}</h3>
        </header>
      }

      <div class="edo-ui-kit-table-scroll">
        <table>
          <thead>
            <tr>
              @for (column of columns(); track column.key) {
                <th
                  [class.edo-ui-kit-table__cell--right]="column.align === 'right'"
                  [class.edo-ui-kit-table__head--sortable]="column.sortable"
                  [attr.aria-sort]="getAriaSort(column)"
                >
                  <button
                    type="button"
                    class="edo-ui-kit-table__sort-trigger"
                    [disabled]="!column.sortable"
                    [attr.aria-label]="getSortButtonAriaLabel(column)"
                    (click)="onSortPressed(column)"
                  >
                    {{ column.label }}
                    @if (isColumnSorted(column.key)) {
                      <span>
                        {{ activeSortDirection() === 'asc' ? '▲' : '▼' }}
                      </span>
                    }
                  </button>
                </th>
              }

              @if (rowActionLabel()) {
                <th class="edo-ui-kit-table__action-head">Действия</th>
              }
            </tr>
          </thead>

          <tbody>
            @for (row of sortedRows(); track $index) {
              <tr>
                @for (column of columns(); track column.key) {
                  <td
                    [class.edo-ui-kit-table__cell--right]="column.align === 'right'"
                    [class.edo-ui-kit-table__cell--center]="column.align === 'center'"
                  >
                    {{ row[column.key] ?? '—' }}
                  </td>
                }

                @if (rowActionLabel()) {
                  <td class="edo-ui-kit-table__action">
                    <button
                      tuiButton
                      appearance="secondary"
                      size="s"
                      type="button"
                      (click)="rowAction.emit(row)"
                    >
                      {{ rowActionLabel() }}
                    </button>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="columns().length + (rowActionLabel() ? 1 : 0)">
                  <p class="edo-ui-kit-table__empty">{{ emptyText() }}</p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  public readonly caption = input('');
  public readonly columns = input.required<Array<UiKitTableColumn>>();
  public readonly rows = input<Array<TableRow>>([]);
  public readonly rowActionLabel = input('');
  public readonly emptyText = input('No data available.');
  public readonly sort = input<UiKitSortState | null>(null);

  protected readonly activeSortDirection = computed<UiKitSortDirection>(() => {
    return this.sort()?.direction ?? 'asc';
  });

  protected readonly sortedRows = computed(() => {
    const sort = this.sort();
    const rows = [...this.rows()];
    if (!sort) {
      return rows;
    }

    rows.sort((left, right) => {
      const leftValue = left[sort.key];
      const rightValue = right[sort.key];

      if (leftValue == null && rightValue == null) {
        return 0;
      }

      if (leftValue == null) {
        return sort.direction === 'asc' ? -1 : 1;
      }

      if (rightValue == null) {
        return sort.direction === 'asc' ? 1 : -1;
      }

      const normalizedLeft = String(leftValue).toLowerCase();
      const normalizedRight = String(rightValue).toLowerCase();
      const comparison = normalizedLeft.localeCompare(normalizedRight, 'ru');

      return sort.direction === 'asc' ? comparison : comparison * -1;
    });

    return rows;
  });

  protected isColumnSorted(columnKey: string): boolean {
    return this.sort()?.key === columnKey;
  }

  protected onSortPressed(column: UiKitTableColumn): void {
    if (!column.sortable) {
      return;
    }

    const currentSort = this.sort();
    const nextDirection: UiKitSortDirection =
      currentSort?.key === column.key && currentSort.direction === 'asc' ? 'desc' : 'asc';

    this.sortChanged.emit({
      key: column.key,
      direction: nextDirection,
    });
  }

  protected getAriaSort(column: UiKitTableColumn): 'none' | 'ascending' | 'descending' | null {
    if (!column.sortable) {
      return null;
    }

    if (!this.isColumnSorted(column.key)) {
      return 'none';
    }

    return this.activeSortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected getSortButtonAriaLabel(column: UiKitTableColumn): string {
    if (!column.sortable) {
      return column.label;
    }

    const nextDirection =
      this.sort()?.key === column.key && this.sort()?.direction === 'asc'
        ? 'по убыванию'
        : 'по возрастанию';

    return `Сортировать по колонке ${column.label} ${nextDirection}`;
  }

  public readonly rowAction = output<TableRow>();
  public readonly sortChanged = output<UiKitSortState>();
}
