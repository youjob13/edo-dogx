import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import {
  AppShellComponent,
  DrawerComponent,
  DropdownMenuComponent,
  ModalComponent,
  NavItemComponent,
  SidebarComponent,
  ToolbarSearchComponent,
  TopbarActionComponent,
  TopbarComponent,
  UiKitDropdownItem,
} from '../../../design-system/ui-kit';

@Component({
  selector: 'edo-dogx-dashboard-layout',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  imports: [
    AppShellComponent,
    SidebarComponent,
    TopbarComponent,
    NavItemComponent,
    TopbarActionComponent,
    ToolbarSearchComponent,
    DropdownMenuComponent,
    DrawerComponent,
    ModalComponent,
    RouterOutlet,
    ReactiveFormsModule,
  ],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLayoutComponent {
  private readonly themeStorageKey = 'edo-dashboard-theme';
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly lastAction = signal('');
  protected readonly uploadOpen = signal(false);
  protected readonly historyOpen = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly themeMode = signal<'light' | 'dark'>('light');

  protected readonly accountItems = computed<Array<UiKitDropdownItem>>(() => [
    { id: 'profile', label: 'Профиль', icon: 'account' },
    {
      id: 'toggle-theme',
      label: this.themeMode() === 'dark' ? 'Тема: темная (переключить)' : 'Тема: светлая (переключить)',
      icon: 'settings',
    },
    { id: 'settings', label: 'Настройки', icon: 'settings' },
  ]);

  protected readonly notificationItems: Array<UiKitDropdownItem> = [
    { id: 'n1', label: 'Новый договор требует проверки', icon: 'warning' },
    { id: 'n2', label: 'Отчет за неделю готов', icon: 'success' },
  ];

  constructor() {
    this.initializeThemeMode();
  }

  protected onSearchSubmit(): void {
    const query = this.searchControl.value.trim();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null, page: null },
      queryParamsHandling: 'merge',
    });

    this.lastAction.set(`Поиск по панели: ${query || 'пустой запрос'}`);
  }

  protected onUploadPressed(): void {
    this.uploadOpen.set(true);
  }

  protected onNotificationsPressed(): void {
    this.notificationsOpen.update((current) => !current);
    this.accountOpen.set(false);
  }

  protected onHistoryPressed(): void {
    this.historyOpen.set(true);
  }

  protected onAccountPressed(): void {
    this.accountOpen.update((current) => !current);
    this.notificationsOpen.set(false);
  }

  protected onNotificationSelected(id: string): void {
    this.notificationsOpen.set(false);
    this.lastAction.set(`Открыто уведомление: ${id}`);
  }

  protected onAccountSelected(id: string): void {
    if (id === 'toggle-theme') {
      this.toggleThemeMode();
      this.accountOpen.set(false);
      this.lastAction.set(
        this.themeMode() === 'dark'
          ? 'Активирована темная тема.'
          : 'Активирована светлая тема.',
      );
      return;
    }

    if (id === 'profile') {
      this.accountOpen.set(false);
      this.router.navigate(['/dashboard/profile']);
      return;
    }

    if (id === 'settings') {
      this.accountOpen.set(false);
      this.router.navigate(['/dashboard/settings']);
      return;
    }

    this.accountOpen.set(false);
    this.lastAction.set(`Открыт раздел аккаунта: ${id}`);
  }

  protected closeUpload(): void {
    this.uploadOpen.set(false);
  }

  protected confirmUpload(): void {
    this.uploadOpen.set(false);
    this.lastAction.set('Запуск загрузки документов (мок-режим).');
  }

  protected closeHistory(): void {
    this.historyOpen.set(false);
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }

    const hasOpenedMenus = this.notificationsOpen() || this.accountOpen();
    if (!hasOpenedMenus) {
      return;
    }

    this.notificationsOpen.set(false);
    this.accountOpen.set(false);
  }

  private initializeThemeMode(): void {
    if (!this.isBrowser) {
      this.themeMode.set('light');
      return;
    }

    const saved = localStorage.getItem(this.themeStorageKey);
    if (saved === 'light' || saved === 'dark') {
      this.themeMode.set(saved);
      return;
    }

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.themeMode.set(prefersDark ? 'dark' : 'light');
  }

  private toggleThemeMode(): void {
    const next = this.themeMode() === 'dark' ? 'light' : 'dark';
    this.themeMode.set(next);

    if (this.isBrowser) {
      localStorage.setItem(this.themeStorageKey, next);
    }
  }
}
