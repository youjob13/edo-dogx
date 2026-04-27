import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'edo-dogx-sidebar',
  template: `
    <aside class="edo-ui-kit-sidebar">
      <ng-content />
    </aside>
  `,
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {}
