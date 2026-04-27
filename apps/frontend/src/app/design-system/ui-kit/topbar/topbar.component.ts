import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'edo-dogx-topbar',
  template: `
    <div class="edo-ui-kit-topbar">
      <ng-content />
    </div>
  `,
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {}
