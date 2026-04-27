import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CardComponent } from '../../../design-system/ui-kit/card/card.component';
import { StatusChipComponent } from '../../../design-system/ui-kit/status-chip/status-chip.component';

@Component({
  selector: 'edo-dogx-auth-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CardComponent, StatusChipComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {}