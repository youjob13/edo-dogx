import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Component({
  selector: 'edo-dogx-app-shell',
  template: `
    <div class="edo-ui-kit-app-shell" [class.theme-dark]="themeMode() === 'dark'">
      <aside class="edo-ui-kit-app-shell__sidebar">
        <ng-content select="[sidebar]" />
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
}
