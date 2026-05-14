import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { SearchNotificationServiceClient } from '../../outbound/grpc/search_notification.client.js';
import { NotificationServiceClient } from '../../outbound/grpc/notification.client.js';

const searchNotificationClient = new SearchNotificationServiceClient();
const notificationClient = new NotificationServiceClient();

const searchRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{
    Querystring: {
      q?: string;
      limit?: number;
      offset?: number;
      entities?: string;
    };
  }>(
    '/',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('search.read')],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 50 },
            offset: { type: 'integer', minimum: 0 },
            entities: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query.q?.trim() ?? '';
      const limit =
        typeof request.query.limit === 'number' && request.query.limit > 0
          ? Math.min(request.query.limit, 50)
          : 10;
      const offset =
        typeof request.query.offset === 'number' && request.query.offset >= 0
          ? request.query.offset
          : 0;
      const entitiesParam = request.query.entities?.trim().toLowerCase();
      const entities =
        entitiesParam && entitiesParam.length > 0
          ? entitiesParam
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item === 'document' || item === 'task')
              .map((item) =>
                item === 'task' ? 'SEARCH_ENTITY_TYPE_TASK' : 'SEARCH_ENTITY_TYPE_DOCUMENT',
              )
          : ['SEARCH_ENTITY_TYPE_DOCUMENT', 'SEARCH_ENTITY_TYPE_TASK'];

      try {
        const response = (await searchNotificationClient.searchGlobal({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          query: q,
          limit,
          offset,
          entities,
        })) as { items?: Array<Record<string, unknown>>; total?: number };

        const items = Array.isArray(response.items)
          ? response.items.map((item) => ({
              entityType: String(item.entity_type ?? item.entityType ?? ''),
              id: String(item.id ?? ''),
              title: String(item.title ?? ''),
              subtitle: String(item.subtitle ?? ''),
              status: String(item.status ?? ''),
              updatedAt: String(item.updated_at ?? item.updatedAt ?? ''),
              route: String(item.route ?? ''),
              documentId: String(item.document_id ?? item.documentId ?? ''),
              taskId: String(item.task_id ?? item.taskId ?? ''),
              boardId: String(item.board_id ?? item.boardId ?? ''),
              category: String(item.category ?? ''),
            }))
          : [];
        return reply.send({ items, total: Number(response.total ?? items.length) });
      } catch (error) {
        request.log.error({ error }, 'search-notification-service global search failed');
        return reply.code(503).send({ error: 'search-notification-service unavailable' });
      }
    },
  );

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
        const response = await notificationClient.listNotifications({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          organization_id: 'org-main',
          limit: 20,
          offset: 0,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'search-notification-service notification center failed');
        return reply.code(503).send({ error: 'search-notification-service unavailable' });
      }
    },
  );
};

export default searchRoutes;
