import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'edo-dogx-progress-meter',
  template: `
    <div class="edo-ui-kit-progress-meter">
      <div class="edo-ui-kit-progress-meter__track">
        <div class="edo-ui-kit-progress-meter__value" [style.width.%]="safePercent()"></div>
      </div>
      <p>{{ label() }}: {{ safePercent() }}%</p>
    </div>
  `,
  styleUrl: './progress-meter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressMeterComponent {
  public readonly label = input('Прогресс');
  public readonly percent = input(0);

  protected readonly safePercent = computed(() => Math.max(0, Math.min(100, this.percent())));
}
