import { ChangeDetectionStrategy, Component, computed, input, model, ViewEncapsulation } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Component({
  selector: 'edo-dogx-app-shell',
  template: `
    <div
      class="edo-ui-kit-app-shell"
      [class.theme-dark]="themeMode() === 'dark'"
      [class.sidebar-collapsed]="collapsed()"
    >
      <aside class="edo-ui-kit-app-shell__sidebar">
        @if (collapsible()) {
          <button
            type="button"
            class="edo-ui-kit-app-shell__sidebar-toggle"
            [attr.aria-label]="collapseToggleLabel()"
            [attr.aria-pressed]="collapsed()"
            (click)="onSidebarToggle()"
          >
            <p aria-hidden="true">{{ collapsed() ? '»' : '«' }}</p>
          </button>
        }

        <div class="edo-ui-kit-app-shell__sidebar-content">
          <ng-content select="[sidebar]" />
        </div>
      </aside>

      <div class="edo-ui-kit-app-shell__content">
        <header class="edo-ui-kit-app-shell__topbar">
          <ng-content select="[topbar]" />
        </header>

        <main class="edo-ui-kit-app-shell__main">
          <ng-content />
        </main>
      </div>
    </div>
  `,
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  public readonly themeMode = input<ThemeMode>('light');
  public readonly collapsible = input(true);
  public readonly collapsed = model(false);

  public readonly collapseToggleLabel = computed(() =>
    this.collapsed() ? 'Развернуть боковую панель' : 'Свернуть боковую панель',
  );

  protected onSidebarToggle(): void {
    this.collapsed.update((value) => !value);
  }
}
