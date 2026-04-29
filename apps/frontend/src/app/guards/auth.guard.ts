import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { type CanActivateFn } from '@angular/router';
import { catchError, map, of, throwError } from 'rxjs';
import type { UserProfile } from '@edo/types';

let retries = 0;
/**
 * Checks active session via GET /api/auth/me.
 * Redirects to the BFF login endpoint (Keycloak Authorization Code flow) on 401.
 * Passes through on the server to avoid breaking SSR.
 */
export const authGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const http = inject(HttpClient);
  const document = inject(DOCUMENT);

  return http.get<UserProfile>('/api/auth/me').pipe(
    map(() => true),
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        if (retries > 10) {
          return of(false)
        }
        retries += 1;
        document.location.href = '/api/auth/login';
        return of(false);
      }
      return throwError(() => err);
    }),
  );
};
