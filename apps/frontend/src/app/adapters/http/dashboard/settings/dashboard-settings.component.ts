import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../../design-system/ui-kit';

@Component({
  selector: 'edo-dogx-dashboard-settings',
  imports: [PageSectionComponent, CardComponent, ButtonComponent],
  templateUrl: './dashboard-settings.component.html',
  styleUrl: './dashboard-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardSettingsComponent {
  protected readonly message = signal('');

  protected onActionPressed(): void {
    this.message.set('Открыты настройки (заглушка).');
  }
}
