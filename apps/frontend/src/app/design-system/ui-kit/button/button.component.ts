import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiButton } from '@taiga-ui/core/components/button';
import { UiKitButtonAppearance, UiKitButtonSize } from '../ui-kit.models';
import { IconComponent } from '../icon/icon.component';
import { UiKitIconName } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-button',
  imports: [TuiButton, IconComponent],
  template: `
    <button
      tuiButton
      [appearance]="appearance()"
      [size]="size()"
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class.edo-ui-kit-button--block]="block()"
      [class.edo-ui-kit-button--icon-only]="iconOnly()"
      [attr.aria-busy]="loading()"
      [attr.aria-label]="iconOnly() ? ariaLabel() : null"
      (click)="pressed.emit()"
    >
      @if (icon()) {
        <edo-dogx-icon [name]="icon()!" [size]="18" />
      }
      {{ loading() ? loadingLabel() : label() }}
    </button>
  `,
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  public readonly label = input.required<string>();
  public readonly appearance = input<UiKitButtonAppearance>('primary');
  public readonly size = input<UiKitButtonSize>('m');
  public readonly type = input<'button' | 'submit' | 'reset'>('button');
  public readonly block = input(false);
  public readonly disabled = input(false);
  public readonly loading = input(false);
  public readonly loadingLabel = input('Выполняется...');
  public readonly icon = input<UiKitIconName | null>(null);
  public readonly iconOnly = input(false);
  public readonly ariaLabel = input('Кнопка');

  public readonly pressed = output<void>();
}
