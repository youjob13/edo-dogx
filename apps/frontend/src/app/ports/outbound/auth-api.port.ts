import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { SignInRequest, SignUpRequest } from '../../domain/auth/auth.models';

export interface AuthApiPort {
  signIn(payload: SignInRequest): Observable<void>;
  signUp(payload: SignUpRequest): Observable<void>;
}

export const AUTH_API_PORT = new InjectionToken<AuthApiPort>('AUTH_API_PORT');