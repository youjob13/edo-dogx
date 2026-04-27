import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { UiKitIconName } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-nav-item',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <a
      class="edo-ui-kit-nav-item"
      [routerLink]="route()"
      routerLinkActive="edo-ui-kit-nav-item--active"
      [routerLinkActiveOptions]="{ exact: exact() }"
    >
      <edo-dogx-icon [name]="icon()" [size]="20" />
      <span>{{ label() }}</span>
    </a>
  `,
  styleUrl: './nav-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavItemComponent {
  public readonly route = input.required<string>();
  public readonly label = input.required<string>();
  public readonly icon = input<UiKitIconName>('file');
  public readonly exact = input(false);
}
