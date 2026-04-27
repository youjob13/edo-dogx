import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { UiKitIconName } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-metric-card',
  imports: [IconComponent],
  template: `
    <button class="edo-ui-kit-metric-card" type="button" (click)="pressed.emit()">
      <div class="edo-ui-kit-metric-card__head">
        <span>{{ label() }}</span>
        <edo-dogx-icon [name]="icon()" [size]="20" />
      </div>
      <strong>{{ value() }}</strong>
      @if (hint()) {
        <p>{{ hint() }}</p>
      }
    </button>
  `,
  styleUrl: './metric-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCardComponent {
  public readonly label = input.required<string>();
  public readonly value = input.required<string>();
  public readonly hint = input('');
  public readonly icon = input<UiKitIconName>('pending');

  public readonly pressed = output<void>();
}
