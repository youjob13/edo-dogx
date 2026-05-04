import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { AuthPort } from '../../../ports/inbound/auth.port.js';
import type { SessionStorePort } from '../../../ports/outbound/session-store.port.js';
import authRoutes from './auth/auth.routes.js';
import documentsRoutes from './documents.routes.js';
import editorControlProfilesRoutes from './editor-control-profiles.routes.js';
import exportsRoutes from './exports.routes.js';
import signaturesRoutes from './signatures.routes.js';
import categoryRoutes from './category.routes.js';
import searchRoutes from './search.routes.js';
import tasksRoutes from './tasks.routes.js';
import boardsRoutes from './boards.routes.js';
import type { AuthSession } from '../../../domain/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void>;
  }
}

export interface AppConfig {
  sessionSecret: string;
  cookieSecure: boolean;
  cookieMaxAgeMs: number;
}

export interface AppDeps {
  authService: AuthPort;
  sessionStore: SessionStorePort;
  config: AppConfig;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const { authService, sessionStore, config } = deps;

  const app = Fastify({ logger: true });

  void app.register(fastifyCookie);

  void app.register(fastifySession, {
    secret: config.sessionSecret,
    store: sessionStore as Parameters<typeof fastifySession>[1]['store'],
    saveUninitialized: false,
    cookie: {
      secure: config.cookieSecure,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.cookieMaxAgeMs,
    },
  });

  // Decorator for protecting future proxy routes
  app.decorate(
    'authenticate',
    async function (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const authData = request.session.auth as AuthSession | undefined;
      if (!authData) {
        await reply.code(401).send({ error: 'Unauthorized' });
      }
    },
  );

  void app.register(authRoutes, { prefix: '/auth', authService });
  void app.register(documentsRoutes, { prefix: '/api/documents' });
  void app.register(exportsRoutes, { prefix: '/api/documents' });
  void app.register(editorControlProfilesRoutes, { prefix: '/api/editor-control-profiles' });
  void app.register(signaturesRoutes, { prefix: '/api/documents' });
  void app.register(categoryRoutes, { prefix: '/api/categories' });
  void app.register(searchRoutes, { prefix: '/api/search' });
  void app.register(tasksRoutes, { prefix: '/api' });
  void app.register(boardsRoutes, { prefix: '/api' });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}

