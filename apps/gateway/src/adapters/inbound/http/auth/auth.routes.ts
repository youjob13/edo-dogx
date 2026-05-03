import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { AuthPort } from '../../../../ports/inbound/auth.port.js';
import type { AuthSession, PkceState } from '../../../../domain/auth.js';

interface AuthRoutesOptions {
  authService: AuthPort;
}

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AuthRoutesOptions,
) => {
  const { authService } = opts;

  // GET /api/auth/login — initiate PKCE flow
  fastify.get<{ Querystring: { login_hint?: string } }>(
    '/login',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            login_hint: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { login_hint } = request.query;
      const { authUrl, pkceState } = authService.initiateLogin(login_hint);
      request.session.pkce = pkceState;
      return reply.redirect(authUrl);
    },
  );

  // GET /api/auth/callback — exchange code for tokens
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    '/callback',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const pkceState = request.session.pkce as PkceState | undefined;
      if (!pkceState) {
        return reply
          .code(400)
          .send({ error: 'Invalid session: missing PKCE state' });
      }

      if (request.query.error) {
        request.log.warn({ error: request.query.error }, 'Keycloak auth error');
        return reply.redirect('/auth/sign-in?error=auth_failed');
      }

      const params = request.query as Record<string, string>;

      try {
        const authSession = await authService.handleCallback(params, pkceState);
        request.session.pkce = undefined;
        request.session.auth = authSession;
        const redirectTo = pkceState.redirectTo ?? '/dashboard';
        return reply.redirect(redirectTo);
      } catch (err) {
        request.log.error({ err }, 'OAuth2 callback failed');
        return reply.redirect('/auth/sign-in?error=auth_failed');
      }
    },
  );

  // GET /api/auth/logout — destroy session and redirect to Keycloak logout
  fastify.get('/logout', async (request, reply) => {
    const authData = request.session.auth as AuthSession | undefined;
    const logoutUrl = authData ? authService.logout(authData.idToken) : '/';

    await new Promise<void>((resolve, reject) => {
      request.session.destroy((err) => {
        if (err) reject(err as Error);
        else resolve();
      });
    });

    return reply.redirect(logoutUrl);
  });

  // GET /api/auth/me — return current user from session
  fastify.get(
    '/me',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['userId', 'email', 'roles'],
            properties: {
              userId: { type: 'string' },
              userName: { type: 'string' },
              email: { type: 'string' },
              roles: { type: 'array', items: { type: 'string' } },
            },
          },
          401: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authData = request.session.auth as AuthSession | undefined;
      if (!authData) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      return authService.getCurrentUser(authData);
    },
  );

  // GET /api/auth/register — redirect to Keycloak self-registration
  fastify.get('/register', async (request, reply) => {
    const { authUrl, pkceState } = authService.initiateRegister();
    request.session.pkce = pkceState;
    return reply.redirect(authUrl);
  });
};

export default authRoutes;
