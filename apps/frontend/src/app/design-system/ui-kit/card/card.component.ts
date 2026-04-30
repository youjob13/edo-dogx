import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiButton } from '@taiga-ui/core/components/button';

@Component({
  selector: 'edo-dogx-card',
  imports: [TuiButton],
  template: `
    <article
      class="edo-ui-kit-card"
      [class.edo-ui-kit-card--flat]="flat()"
      [class.edo-ui-kit-card--full-height]="fullHeight()"
    >
      <header class="edo-ui-kit-card__header">
        <div>
          <h3>{{ title() }}</h3>
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </div>

        @if (actionLabel()) {
          <button
            tuiButton
            type="button"
            appearance="secondary"
            size="s"
            (click)="actionClick.emit()"
          >
            {{ actionLabel() }}
          </button>
        }
      </header>

      <div class="edo-ui-kit-card__body">
        <ng-content />
      </div>

      <footer>
        <ng-content select="[footer]" />
      </footer>
    </article>
  `,
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  public readonly title = input.required<string>();
  public readonly subtitle = input('');
  public readonly actionLabel = input('');
  public readonly flat = input(false);
  public readonly fullHeight = input(false);

  public readonly actionClick = output<void>();
}
