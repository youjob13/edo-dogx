import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { UiKitActivityItem } from '../ui-kit.models';

@Component({
  selector: 'edo-dogx-activity-feed',
  imports: [IconComponent],
  template: `
    <div class="edo-ui-kit-activity-feed">
      @for (item of items(); track item.id) {
        <button type="button" class="edo-ui-kit-activity-feed__item" (click)="itemPressed.emit(item.id)">
          <edo-dogx-icon [name]="item.icon ?? 'file'" [size]="18" />
          <div>
            <p class="edo-ui-kit-activity-feed__title">{{ item.title }}</p>
            <p class="edo-ui-kit-activity-feed__desc">{{ item.description }}</p>
            <span>{{ item.timestamp }}</span>
          </div>
        </button>
      } @empty {
        <p class="edo-ui-kit-activity-feed__empty">Нет активности.</p>
      }
    </div>
  `,
  styleUrl: './activity-feed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFeedComponent {
  public readonly items = input<ReadonlyArray<UiKitActivityItem>>([]);

  public readonly itemPressed = output<string>();
}
