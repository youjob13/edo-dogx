import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../adapters/http/dashboard/dashboard-layout.component').then(
        (m) => m.DashboardLayoutComponent,
      ),
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('../../adapters/http/dashboard/home/dashboard-home.component').then(
            (m) => m.DashboardHomeComponent,
          ),
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('../../adapters/http/dashboard/documents/dashboard-documents.component').then(
            (m) => m.DashboardDocumentsComponent,
          ),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('../../adapters/http/dashboard/tasks/dashboard-tasks.component').then(
            (m) => m.DashboardTasksComponent,
          ),
      },
      {
        path: 'archive',
        loadComponent: () =>
          import('../../adapters/http/dashboard/archive/dashboard-archive.component').then(
            (m) => m.DashboardArchiveComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('../../adapters/http/dashboard/settings/dashboard-settings.component').then(
            (m) => m.DashboardSettingsComponent,
          ),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];
