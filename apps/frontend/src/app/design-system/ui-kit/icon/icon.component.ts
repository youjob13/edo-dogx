import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiKitIconName } from '../ui-kit.models';

const ICON_MAP: Record<UiKitIconName, string> = {
  dashboard: 'dashboard',
  documents: 'description',
  tasks: 'assignment_turned_in',
  archive: 'inventory_2',
  settings: 'settings',
  search: 'search',
  upload: 'cloud_upload',
  notifications: 'notifications',
  history: 'history',
  account: 'account_circle',
  add: 'add',
  more: 'more_vert',
  download: 'download',
  edit: 'edit',
  preview: 'visibility',
  warning: 'priority_high',
  success: 'check_circle',
  pending: 'pending',
  file: 'description',
  spreadsheet: 'table_chart',
  image: 'image',
};

@Component({
  selector: 'edo-dogx-icon',
  template: `
    <span
      class="material-symbols-outlined edo-ui-kit-icon"
      [class.edo-ui-kit-icon--decorative]="decorative()"
      [class.edo-ui-kit-icon--clickable]="clickable()"
      [style.font-size.px]="size()"
      [attr.aria-hidden]="decorative()"
      [attr.aria-label]="decorative() ? null : ariaLabel()"
    >
      {{ symbol() }}
    </span>
  `,
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  public readonly name = input<UiKitIconName>('file');
  public readonly symbolName = input<string>('');
  public readonly size = input(20);
  public readonly decorative = input(true);
  public readonly clickable = input(false);
  public readonly ariaLabel = input('Иконка');

  protected readonly symbol = computed(() => {
    const direct = this.symbolName().trim();
    if (direct.length > 0) {
      return direct;
    }

    return ICON_MAP[this.name()];
  });
}
