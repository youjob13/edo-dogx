import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UiKitChartBar } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-bar-mini-chart',
  template: `
    <div class="edo-ui-kit-bar-chart">
      @for (bar of bars(); track bar.label) {
        <button
          type="button"
          class="edo-ui-kit-bar-chart__bar"
          [class.edo-ui-kit-bar-chart__bar--active]="bar.highlighted"
          [style.height.%]="bar.value"
          [attr.aria-label]="bar.label"
          (click)="barPressed.emit(bar.label)"
        ></button>
      }
    </div>

    <div class="edo-ui-kit-bar-chart__labels">
      @for (bar of bars(); track bar.label) {
        <span>{{ bar.label }}</span>
      }
    </div>
  `,
  styleUrl: './bar-mini-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarMiniChartComponent {
  public readonly bars = input<ReadonlyArray<UiKitChartBar>>([]);

  public readonly barPressed = output<string>();
}
