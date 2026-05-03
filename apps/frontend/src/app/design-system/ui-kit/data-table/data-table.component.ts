import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiDropdown } from '@taiga-ui/core/portals/dropdown';
import { DropdownMenuComponent } from '../dropdown-menu/dropdown-menu.component';
import { UiKitDropdownItem, UiKitSortDirection, UiKitSortState, UiKitTableColumn } from '../ui-kit.models';

type TableRow = Record<string, string | number | null | undefined>;

@Component({
  selector: 'edo-dogx-data-table',
  imports: [TuiButton, TuiDropdown, DropdownMenuComponent],
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
                    @if (actionMenuItems().length > 0) {
                      <button
                        tuiButton
                        appearance="secondary"
                        size="s"
                        type="button"
                        [tuiDropdown]="actionMenu"
                        [tuiDropdownOpen]="isActionMenuOpen(row)"
                        tuiDropdownAlign="end"
                        tuiDropdownDirection="bottom"
                        tuiDropdownLimitWidth="min"
                        (tuiDropdownOpenChange)="onActionMenuOpenChange(row, $event)"
                      >
                        {{ rowActionLabel() }}
                      </button>

                      <ng-template #actionMenu>
                        <edo-dogx-dropdown-menu
                          [items]="actionMenuItems()"
                          (itemPressed)="onActionMenuItemPressed(row, $event)"
                        />
                      </ng-template>
                    } @else {
                      <button
                        tuiButton
                        appearance="secondary"
                        size="s"
                        type="button"
                        (click)="rowAction.emit(row)"
                      >
                        {{ rowActionLabel() }}
                      </button>
                    }
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
  public readonly actionMenuItems = input<Array<UiKitDropdownItem>>([]);
  public readonly emptyText = input('No data available.');
  public readonly sort = input<UiKitSortState | null>(null);
  private readonly openActionMenuRowKey = signal<string | null>(null);

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

  protected isActionMenuOpen(row: TableRow): boolean {
    return this.openActionMenuRowKey() === this.getRowKey(row);
  }

  protected onActionMenuOpenChange(row: TableRow, open: boolean): void {
    this.openActionMenuRowKey.set(open ? this.getRowKey(row) : null);
    if (open) {
      this.rowAction.emit(row);
    }
  }

  protected onActionMenuItemPressed(row: TableRow, actionId: string): void {
    this.openActionMenuRowKey.set(null);
    this.rowMenuAction.emit({ row, actionId });
  }

  private getRowKey(row: TableRow): string {
    return String(row['id'] ?? this.sortedRows().indexOf(row));
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
  public readonly rowMenuAction = output<{ row: TableRow; actionId: string }>();
  public readonly sortChanged = output<UiKitSortState>();
}
