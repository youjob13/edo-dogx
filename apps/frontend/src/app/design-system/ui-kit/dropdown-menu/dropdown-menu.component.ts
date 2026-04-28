import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { UiKitDropdownItem } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-dropdown-menu',
  imports: [IconComponent],
  template: `
    <div class="edo-ui-kit-dropdown" role="menu" [attr.aria-label]="ariaLabel()">
      @for (item of items(); track item.id) {
        <button
          type="button"
          role="menuitem"
          [class.edo-ui-kit-dropdown__item--danger]="item.danger"
          (click)="itemPressed.emit(item.id)"
        >
          @if (item.icon) {
            <edo-dogx-icon [name]="item.icon" [size]="18" />
          }
          <span>{{ item.label }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './dropdown-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenuComponent {
  public readonly items = input<Array<UiKitDropdownItem>>([]);
  public readonly ariaLabel = input('Меню действий');

  public readonly itemPressed = output<string>();
}
