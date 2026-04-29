import { Routes } from '@angular/router';

export const routes: Routes = [
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
		redirectTo: '/dashboard',
	},
];
