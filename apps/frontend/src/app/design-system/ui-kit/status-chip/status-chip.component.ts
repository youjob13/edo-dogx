import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiKitChipTone } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-status-chip',
  template: `
    <span
      class="edo-ui-kit-chip"
      [class.edo-ui-kit-chip--success]="tone() === 'success'"
      [class.edo-ui-kit-chip--warning]="tone() === 'warning'"
      [class.edo-ui-kit-chip--draft]="tone() === 'draft'"
      [class.edo-ui-kit-chip--error]="tone() === 'error'"
      [class.edo-ui-kit-chip--finalized]="tone() === 'finalized'"
      [class.edo-ui-kit-chip--review]="tone() === 'review'"
      [class.edo-ui-kit-chip--archived]="tone() === 'archived'"
      [class.edo-ui-kit-chip--pending]="tone() === 'pending'"
    >
      {{ label() }}
    </span>
  `,
  styleUrl: './status-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChipComponent {
  public readonly label = input.required<string>();
  public readonly tone = input<UiKitChipTone>('draft');
}
