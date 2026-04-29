import type { PkceState, AuthSession } from '../domain/auth.js';

declare module '@fastify/session' {
  interface FastifySessionObject {
    pkce?: PkceState;
    auth?: AuthSession;
  }
}
