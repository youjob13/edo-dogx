import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { SignInRequest, SignUpRequest } from '../../domain/auth/auth.models';
import { AuthApiPort } from '../../ports/outbound/auth-api.port';

@Injectable({ providedIn: 'root' })
export class AuthHttpAdapter implements AuthApiPort {
  private readonly http = inject(HttpClient);

  public signIn(payload: SignInRequest): Observable<void> {
    return of(void 0)
    // return this.http
    //   .post<unknown>('/api/auth/login', payload, {
    //     withCredentials: true,
    //   })
    //   .pipe(map(() => undefined));
  }

  public signUp(payload: SignUpRequest): Observable<void> {
    return this.http
      .post<unknown>('/api/auth/register', payload, {
        withCredentials: true,
      })
      .pipe(map(() => undefined));
  }
}