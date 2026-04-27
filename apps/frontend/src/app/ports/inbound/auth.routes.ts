import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../adapters/http/auth/auth-layout.component').then(
        (m) => m.AuthLayoutComponent,
      ),
    children: [
      {
        path: 'sign-in',
        loadComponent: () =>
          import('../../adapters/http/auth/sign-in/sign-in.component').then(
            (m) => m.SignInComponent,
          ),
      },
      {
        path: 'sign-up',
        loadComponent: () =>
          import('../../adapters/http/auth/sign-up/sign-up.component').then(
            (m) => m.SignUpComponent,
          ),
      },
      {
        path: '',
        redirectTo: 'sign-in',
        pathMatch: 'full',
      },
    ],
  },
];