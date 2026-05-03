import type { UserProfile } from '@edo/types';
import type { AuthSession, PkceState } from '../domain/auth.js';
import type {
  AuthPort,
  InitiateLoginResult,
} from '../ports/inbound/auth.port.js';
import type { OidcClientPort } from '../ports/outbound/oidc-client.port.js';

export class AuthService implements AuthPort {
  constructor(private readonly oidcClient: OidcClientPort) {}

  initiateLogin(loginHint?: string): InitiateLoginResult {
    const pkceState = this.oidcClient.generatePkceState();
    const authUrl = this.oidcClient.buildAuthUrl(pkceState, loginHint);
    return { authUrl, pkceState };
  }

  initiateRegister(): InitiateLoginResult {
    const pkceState = this.oidcClient.generatePkceState();
    const authUrl = this.oidcClient.buildRegisterUrl(pkceState);
    return { authUrl, pkceState };
  }

  async handleCallback(
    params: Record<string, string>,
    pkceState: PkceState,
  ): Promise<AuthSession> {
    const tokenData = await this.oidcClient.exchangeCode(params, pkceState);
    return {
      userId: tokenData.userId,
      email: tokenData.email,
      roles: tokenData.roles,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      idToken: tokenData.idToken,
      expiresAt: tokenData.expiresAt,
    };
  }

  logout(idToken: string): string {
    return this.oidcClient.buildLogoutUrl(idToken);
  }

  getCurrentUser(session: AuthSession): UserProfile {
    return {
      userId: session.userId,
      userName: session.email, // temporary use email instead of name
      email: session.email,
      roles: session.roles,
    };
  }
}
