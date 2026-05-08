import { provideTaiga } from "@taiga-ui/core";
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { DOCUMENT_API_PORT } from './ports/outbound/document-api.port';

import { routes } from './app.routes';
import { DashboardHttpAdapter } from "./adapters/outbound/documents.http.adapter";
import { TaskBoardsHttpAdapter } from "./adapters/outbound/task-boards.http.adapter";
import { TASK_BOARDS_API_PORT } from "./ports/outbound/task-boards-api.port";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideTaiga(),
    {
      provide: TASK_BOARDS_API_PORT,
      useExisting: TaskBoardsHttpAdapter,
    },
    {
      provide: DOCUMENT_API_PORT,
      useExisting: DashboardHttpAdapter,
    },
    ],
};
