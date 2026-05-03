import { provideTaiga } from "@taiga-ui/core";
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { DOCUMENT_API_PORT } from './ports/outbound/document-api.port';
import { DashboardMockHttpAdapter } from './adapters/outbound/dashboard-mock-http.adapter';

import { routes } from './app.routes';
import { DashboardHttpAdapter } from "./adapters/outbound/dashboard/documents.http.adapter";
import { DASHBOARD_API_PORT } from "./ports/outbound/dashboard-api.port";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideTaiga(),
    {
      provide: DASHBOARD_API_PORT,
      useExisting: DashboardMockHttpAdapter,
    },
    {
      provide: DOCUMENT_API_PORT,
      useExisting: DashboardHttpAdapter,
    },
    ],
};
