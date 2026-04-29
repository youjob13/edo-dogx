export interface AuthSession {
  readonly userId: string;
  readonly email: string;
  readonly roles: string[];
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly idToken: string;
  /** Unix timestamp in milliseconds */
  readonly expiresAt: number;
}

export interface PkceState {
  readonly codeVerifier: string;
  readonly state: string;
  readonly redirectTo?: string;
}
