import { Issuer, generators, type Client } from 'openid-client';
import type { PkceState } from '../../../domain/auth.js';
import type { TokenData, OidcClientPort } from '../../../ports/outbound/oidc-client.port.js';

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

export class KeycloakAdapter implements OidcClientPort {
  private constructor(
    private readonly client: Client,
    private readonly config: KeycloakConfig,
  ) {}

  static async create(
    config: KeycloakConfig,
    { retries = 10, retryDelayMs = 5000 } = {},
  ): Promise<KeycloakAdapter> {
    const issuerUrl = `${config.url}/realms/${config.realm}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const issuer = await Issuer.discover(issuerUrl);
        const client = new issuer.Client({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uris: [config.redirectUri],
          response_types: ['code'],
        });
        return new KeycloakAdapter(client, config);
      } catch (err) {
        lastError = err;
        console.warn(
          `[KeycloakAdapter] Issuer discovery failed (attempt ${attempt}/${retries}), retrying in ${retryDelayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    throw new Error(
      `[KeycloakAdapter] Could not discover Keycloak issuer at ${issuerUrl} after ${retries} attempts: ${String(lastError)}`,
    );
  }

  generatePkceState(): PkceState {
    return {
      codeVerifier: generators.codeVerifier(),
      state: generators.state(),
    };
  }

  buildAuthUrl(pkceState: PkceState, loginHint?: string): string {
    const params: Record<string, string> = {
      scope: 'openid email profile',
      redirect_uri: this.config.redirectUri,
      state: pkceState.state,
      code_challenge: generators.codeChallenge(pkceState.codeVerifier),
      code_challenge_method: 'S256',
    };
    if (loginHint) {
      params['login_hint'] = loginHint;
    }
    return this.client.authorizationUrl(params);
  }

  async exchangeCode(
    params: Record<string, string>,
    pkceState: PkceState,
  ): Promise<TokenData> {
    const tokenSet = await this.client.oauthCallback(
      this.config.redirectUri,
      params,
      {
        code_verifier: pkceState.codeVerifier,
        state: pkceState.state,
      },
    );

    const accessToken = tokenSet.access_token;
    if (!accessToken) {
      throw new Error('No access token in response');
    }

    const refreshToken = tokenSet.refresh_token ?? '';
    const idToken = tokenSet.id_token ?? '';
    const expiresAt = tokenSet.expires_at ? tokenSet.expires_at * 1000 : 0;

    const claims = tokenSet.claims();
    const accessPayload = decodeJwtPayload(accessToken);
    const realmAccess = accessPayload['realm_access'] as
      | { roles?: string[] }
      | undefined;

    return {
      userId: claims.sub,
      email: (claims['email'] as string) ?? '',
      roles: realmAccess?.roles ?? [],
      accessToken,
      refreshToken,
      idToken,
      expiresAt,
    };
  }

  buildLogoutUrl(idToken: string): string {
    return this.client.endSessionUrl({
      id_token_hint: idToken,
      post_logout_redirect_uri: this.config.postLogoutRedirectUri,
    });
  }

  buildRegisterUrl(): string {
    const url = new URL(
      `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/registrations`,
    );
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid');
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    return url.toString();
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1];
  if (!base64) {
    throw new Error('Invalid JWT: missing payload segment');
  }
  const json = Buffer.from(base64, 'base64url').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}
