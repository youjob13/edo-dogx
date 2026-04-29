if (process.env['NODE_ENV'] !== 'production') {
  require('dotenv').config();
}

import Redis from 'ioredis';
import { buildApp } from './adapters/inbound/http/app.js';
import { RedisSessionAdapter } from './adapters/outbound/redis/session-store.adapter.js';
import { KeycloakAdapter } from './adapters/outbound/oidc/keycloak.adapter.js';
import { AuthService } from './application/auth.service.js';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

async function main(): Promise<void> {
  const port = parseInt(process.env['GATEWAY_PORT'] ?? '3000', 10);
  const sessionSecret = requireEnv('SESSION_SECRET');
  const cookieSecure = process.env['COOKIE_SECURE'] === 'true';

  // Redis
  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
  });

  // Keycloak OIDC adapter (discovers issuer at startup)
  const keycloakAdapter = await KeycloakAdapter.create({
    url: requireEnv('KEYCLOAK_URL'),
    publicUrl: process.env['KEYCLOAK_PUBLIC_URL'],
    realm: requireEnv('KEYCLOAK_REALM'),
    clientId: requireEnv('KEYCLOAK_CLIENT_ID'),
    clientSecret: requireEnv('KEYCLOAK_CLIENT_SECRET'),
    redirectUri:
      process.env['KEYCLOAK_REDIRECT_URI'] ??
      `http://localhost:${port}/auth/callback`,     // direct to gateway (bypasses /api proxy)
    postLogoutRedirectUri:
      process.env['KEYCLOAK_POST_LOGOUT_REDIRECT_URI'] ??
      `http://localhost:${process.env['FRONTEND_PORT'] ?? 4000}`,
  });

  const sessionStore = new RedisSessionAdapter(redis);
  const authService = new AuthService(keycloakAdapter);

  const app = buildApp({
    authService,
    sessionStore,
    config: {
      sessionSecret,
      cookieSecure,
      cookieMaxAgeMs: 86_400 * 1000, // 24 hours
    },
  });

  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

