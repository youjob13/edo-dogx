import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { UiKitIconName } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-icon-button',
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="edo-ui-kit-icon-button"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      (click)="pressed.emit()"
    >
      <edo-dogx-icon [name]="icon()" [decorative]="true" [size]="size()" />
    </button>
  `,
  styleUrl: './icon-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButtonComponent {
  public readonly icon = input<UiKitIconName>('more');
  public readonly ariaLabel = input('Действие');
  public readonly size = input(20);
  public readonly disabled = input(false);

  public readonly pressed = output<void>();
}
