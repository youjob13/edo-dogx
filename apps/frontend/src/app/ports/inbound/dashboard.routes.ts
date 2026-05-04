import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';
import { unsavedChangesGuard } from '../../guards/unsaved-changes.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
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
        path: 'documents/new',
        loadComponent: () =>
          import('../../adapters/http/dashboard/documents/dashboard-document-create.component').then(
            (m) => m.DashboardDocumentCreateComponent,
          ),
      },
      {
        path: 'documents/:id/edit',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('../../adapters/http/dashboard/documents/dashboard-document-edit.component').then(
            (m) => m.DashboardDocumentEditComponent,
          ),
      },
      {
        path: 'signatures',
        loadComponent: () =>
          import('../../adapters/http/dashboard/signature-panel.component').then(
            (m) => m.SignaturePanelComponent,
          ),
      },
      {
        path: 'category-workflow',
        loadComponent: () =>
          import('../../adapters/http/dashboard/category-workflow.component').then(
            (m) => m.CategoryWorkflowComponent,
          ),
      },
      {
        path: 'tasks/:boardId/task/:taskId',
        loadComponent: () =>
          import('../../adapters/http/dashboard/tasks/dashboard-task-details.component').then(
            (m) => m.DashboardTaskDetailsComponent,
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
        path: 'profile',
        loadComponent: () =>
          import('../../adapters/http/dashboard/profile/dashboard-profile.component').then(
            (m) => m.DashboardProfileComponent,
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
