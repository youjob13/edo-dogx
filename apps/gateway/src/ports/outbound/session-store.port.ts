import type { FastifySessionObject } from '@fastify/session';

/**
 * Matches the store interface expected by @fastify/session.
 * The Redis adapter implements this to back session storage.
 */
export interface SessionStorePort {
  set(
    sessionId: string,
    session: FastifySessionObject,
    callback: (err?: Error | null) => void,
  ): void;
  get(
    sessionId: string,
    callback: (
      err: Error | null,
      session?: FastifySessionObject | null,
    ) => void,
  ): void;
  destroy(sessionId: string, callback: (err?: Error | null) => void): void;
}
