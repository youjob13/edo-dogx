import type { FastifySessionObject } from '@fastify/session';
import type Redis from 'ioredis';
import type { SessionStorePort } from '../../../ports/outbound/session-store.port.js';

const SESSION_KEY_PREFIX = 'sess:';
const DEFAULT_TTL_SECONDS = 86_400; // 24 hours

export class RedisSessionAdapter implements SessionStorePort {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ) {}

  set(
    sessionId: string,
    session: FastifySessionObject,
    callback: (err?: Error | null) => void,
  ): void {
    const sessionWithCookie = session as FastifySessionObject & {
      cookie?: { maxAge?: number };
    };
    const ttl = sessionWithCookie.cookie?.maxAge
      ? Math.ceil(sessionWithCookie.cookie.maxAge / 1000)
      : this.ttlSeconds;

    this.redis
      .set(
        `${SESSION_KEY_PREFIX}${sessionId}`,
        JSON.stringify(session),
        'EX',
        ttl,
      )
      .then(() => callback(null))
      .catch((err: Error) => callback(err));
  }

  get(
    sessionId: string,
    callback: (
      err: Error | null,
      session?: FastifySessionObject | null,
    ) => void,
  ): void {
    this.redis
      .get(`${SESSION_KEY_PREFIX}${sessionId}`)
      .then((data) => {
        if (!data) {
          callback(null, null);
          return;
        }
        callback(null, JSON.parse(data) as FastifySessionObject);
      })
      .catch((err: Error) => callback(err));
  }

  destroy(sessionId: string, callback: (err?: Error | null) => void): void {
    this.redis
      .del(`${SESSION_KEY_PREFIX}${sessionId}`)
      .then(() => callback(null))
      .catch((err: Error) => callback(err));
  }
}
