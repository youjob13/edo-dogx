import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../../design-system/ui-kit';

@Component({
  selector: 'edo-dogx-dashboard-archive',
  imports: [PageSectionComponent, CardComponent, ButtonComponent],
  templateUrl: './dashboard-archive.component.html',
  styleUrl: './dashboard-archive.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardArchiveComponent {
  protected readonly message = signal('');

  protected onActionPressed(): void {
    this.message.set('Открыт архив (заглушка).');
  }
}
