import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SignInRequest, SignUpRequest } from '../../domain/auth/auth.models';
import { AUTH_API_PORT, AuthApiPort } from '../../ports/outbound/auth-api.port';

@Injectable({ providedIn: 'root' })
export class AuthUseCases {
  private readonly authApi: AuthApiPort = inject(AUTH_API_PORT);

  public signIn(payload: SignInRequest): Observable<void> {
    return this.authApi.signIn(payload);
  }

  public signUp(payload: SignUpRequest): Observable<void> {
    return this.authApi.signUp(payload);
  }
}