import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: 'guest',
		loadComponent: () =>
			import('./adapters/http/guest/guest-page.component').then(
				(m) => m.GuestPageComponent,
			),
	},
	{
		path: 'dashboard',
		loadChildren: () =>
			import('./ports/inbound/dashboard.routes').then(
				(m) => m.DASHBOARD_ROUTES,
			),
	},
	{
		path: '',
		redirectTo: '/dashboard',
		pathMatch: 'full',
	},
	{
		path: '**',
		redirectTo: '/guest',
	},
];
