import { provideTaiga } from "@taiga-ui/core";
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { AUTH_API_PORT } from './ports/outbound/auth-api.port';
import { AuthHttpAdapter } from './adapters/outbound/auth-http.adapter';
import { DASHBOARD_API_PORT } from './ports/outbound/dashboard-api.port';
import { DashboardMockHttpAdapter } from './adapters/outbound/dashboard-mock-http.adapter';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideTaiga(),
    {
      provide: AUTH_API_PORT,
      useExisting: AuthHttpAdapter,
    },
    {
      provide: DASHBOARD_API_PORT,
      useExisting: DashboardMockHttpAdapter,
    },
    ],
};
