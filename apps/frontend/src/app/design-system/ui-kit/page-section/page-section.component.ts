import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'edo-dogx-page-section',
  template: `
    <section class="edo-ui-kit-page-section">
      @if (title()) {
        <header>
          <h2>{{ title() }}</h2>
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </header>
      }

      <div class="edo-ui-kit-page-section__body">
        <ng-content />
      </div>
    </section>
  `,
  styleUrl: './page-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageSectionComponent {
  public readonly title = input('');
  public readonly subtitle = input('');
}
