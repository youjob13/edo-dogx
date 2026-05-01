import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { SearchNotificationServiceClient } from '../../outbound/grpc/search_notification.client.js';

const searchNotificationClient = new SearchNotificationServiceClient();

const searchRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{
    Querystring: {
      q?: string;
      category?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/documents',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('search.read')],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            category: { type: 'string' },
            status: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query.q?.trim().toLowerCase() ?? '';
      const category = request.query.category?.trim().toUpperCase() ?? '';
      const status = request.query.status?.trim().toUpperCase() ?? '';
      const limit =
        typeof request.query.limit === 'number' && request.query.limit > 0
          ? Math.min(request.query.limit, 100)
          : 20;
      const offset =
        typeof request.query.offset === 'number' && request.query.offset >= 0
          ? request.query.offset
          : 0;

      try {
        const response = await searchNotificationClient.searchDocuments({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          query: q,
          status,
          category,
          limit,
          offset,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'search-notification-service search failed');
        return reply.code(503).send({ error: 'search-notification-service unavailable' });
      }
    },
  );

  fastify.get(
    '/notifications/center',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('notifications.read')],
    },
    async (request, reply) => {
      try {
        const response = await searchNotificationClient.emitNotification({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          event_type: 'notifications.center.read',
          recipient_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: '',
        });
        return reply.send({ items: [response] });
      } catch (error) {
        request.log.error({ error }, 'search-notification-service notification center failed');
        return reply.code(503).send({ error: 'search-notification-service unavailable' });
      }
    },
  );
};

export default searchRoutes;
