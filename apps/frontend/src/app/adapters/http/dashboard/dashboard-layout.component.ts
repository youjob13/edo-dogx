import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, tap, of } from 'rxjs';
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
import { GlobalSearchHit } from '../../../domain/dashboard/dashboard.models';

@Component({
  selector: 'edo-dogx-dashboard-layout',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
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
    RouterLink,
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly lastAction = signal('');
  protected readonly uploadOpen = signal(false);
  protected readonly historyOpen = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly themeMode = signal<'light' | 'dark'>('light');
  protected readonly searchTooltipOpen = signal(false);
  protected readonly searchLoading = signal(false);
  protected readonly searchHits = signal<Array<GlobalSearchHit>>([]);

  protected readonly accountItems = computed<Array<UiKitDropdownItem>>(() => [
    { id: 'profile', label: 'Профиль', icon: 'account' },
    {
      id: 'toggle-theme',
      label:
        this.themeMode() === 'dark'
          ? 'Тема: темная (переключить)'
          : 'Тема: светлая (переключить)',
      icon: 'settings',
    },
    { id: 'settings', label: 'Настройки', icon: 'settings' },
    { id: 'logout', label: 'Выйти', icon: 'account' },
  ]);

  protected readonly notificationItems: Array<UiKitDropdownItem> = [
    { id: 'n1', label: 'Новый договор требует проверки', icon: 'warning' },
    { id: 'n2', label: 'Отчет за неделю готов', icon: 'success' },
  ];

  constructor() {
    this.initializeThemeMode();
    this.setupSearchTooltip();
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

    if (id === 'logout') {
      this.accountOpen.set(false);
      if (this.isBrowser) {
        window.location.assign('/api/auth/logout');
      }
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

    this.notificationsOpen.set(false);
    this.accountOpen.set(false);
    this.searchTooltipOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.closest('.dashboard-topbar__left') === null) {
      this.searchTooltipOpen.set(false);
    }
  }

  protected onSearchHitPressed(route: string): void {
    if (!route) {
      return;
    }

    this.searchTooltipOpen.set(false);
    this.router.navigateByUrl(route);
  }

  protected getEntityLabel(entityType: GlobalSearchHit['entityType']): string {
    return entityType === 'TASK' ? 'Задача' : 'Документ';
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

  private setupSearchTooltip(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((value) => {
          if (!value.trim()) {
            this.searchHits.set([]);
            this.searchTooltipOpen.set(false);
            this.searchLoading.set(false);
          } else {
            this.searchLoading.set(true);
          }
        }),
        switchMap((value) => {
          const query = value.trim();
          if (!query) {
            return of({ items: [] as Array<GlobalSearchHit> });
          }
          return this.http.get<{ items: Array<GlobalSearchHit> }>('/api/search', {
            params: { q: query, limit: 8 },
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.searchHits.set(Array.isArray(response.items) ? response.items : []);
          this.searchTooltipOpen.set(this.searchControl.value.trim().length > 0);
          this.searchLoading.set(false);
        },
        error: () => {
          this.searchHits.set([]);
          this.searchTooltipOpen.set(this.searchControl.value.trim().length > 0);
          this.searchLoading.set(false);
        },
      });
  }
}
