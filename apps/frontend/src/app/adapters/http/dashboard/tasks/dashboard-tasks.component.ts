import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../../design-system/ui-kit';

@Component({
  selector: 'edo-dogx-dashboard-tasks',
  imports: [PageSectionComponent, CardComponent, ButtonComponent],
  templateUrl: './dashboard-tasks.component.html',
  styleUrl: './dashboard-tasks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardTasksComponent {
  protected readonly message = signal('');

  protected onActionPressed(): void {
    this.message.set('Открыты задачи (заглушка).');
  }
}
