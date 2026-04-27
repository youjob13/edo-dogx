import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { UiKitIconName } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-topbar-action',
  imports: [IconButtonComponent],
  template: `
    <div class="edo-ui-kit-topbar-action">
      <edo-dogx-icon-button
        [icon]="icon()"
        [ariaLabel]="ariaLabel()"
        (pressed)="pressed.emit()"
      />
      @if (badgeCount() > 0) {
        <span class="edo-ui-kit-topbar-action__badge">{{ badgeCount() }}</span>
      }
    </div>
  `,
  styleUrl: './topbar-action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarActionComponent {
  public readonly icon = input<UiKitIconName>('notifications');
  public readonly ariaLabel = input('Действие верхней панели');
  public readonly badgeCount = input(0);

  public readonly pressed = output<void>();
}
