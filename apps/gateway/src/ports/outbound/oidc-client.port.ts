import type { PkceState } from '../../domain/auth.js';

export interface TokenData {
  readonly userId: string;
  readonly email: string;
  readonly roles: string[];
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly idToken: string;
  /** Unix timestamp in milliseconds */
  readonly expiresAt: number;
}

export interface OidcClientPort {
  generatePkceState(): PkceState;
  buildAuthUrl(pkceState: PkceState, loginHint?: string): string;
  exchangeCode(
    params: Record<string, string>,
    pkceState: PkceState,
  ): Promise<TokenData>;
  buildLogoutUrl(idToken: string): string;
  buildRegisterUrl(): string;
}
