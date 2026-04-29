import type { UserProfile } from '@edo/types';
import type { AuthSession, PkceState } from '../../domain/auth.js';

export interface InitiateLoginResult {
  readonly authUrl: string;
  readonly pkceState: PkceState;
}

export interface AuthPort {
  initiateLogin(loginHint?: string): InitiateLoginResult;
  handleCallback(
    params: Record<string, string>,
    pkceState: PkceState,
  ): Promise<AuthSession>;
  /** Returns the Keycloak end-session URL to redirect to. */
  logout(idToken: string): string;
  getCurrentUser(session: AuthSession): UserProfile;
  buildRegisterUrl(): string;
}
