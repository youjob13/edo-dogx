import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { NotificationServiceClient } from '../../outbound/grpc/notification.client.js';
import { notificationSseHub } from './notifications.sse-hub.js';

const notificationClient = new NotificationServiceClient();

const notificationsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{
    Querystring: { limit?: number; offset?: number; organizationId?: string };
  }>(
    '/notifications',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('notifications.read')],
    },
    async (request, reply) => {
      const userId = request.session.auth?.userId ?? 'gateway-user';
      const organizationId = request.query.organizationId ?? 'org-main';
      const limit = typeof request.query.limit === 'number' ? Math.min(Math.max(request.query.limit, 1), 100) : 20;
      const offset = typeof request.query.offset === 'number' ? Math.max(request.query.offset, 0) : 0;

      try {
        const response = (await notificationClient.listNotifications({
          actor_user_id: userId,
          organization_id: organizationId,
          limit,
          offset,
        })) as { items?: Array<Record<string, unknown>>; total?: number };

        const items = Array.isArray(response.items)
          ? response.items.map((item) => ({
              id: String(item.id ?? ''),
              recipientUserId: String(item.recipient_user_id ?? item.recipientUserId ?? ''),
              organizationId: String(item.organization_id ?? item.organizationId ?? ''),
              eventType: String(item.event_type ?? item.eventType ?? ''),
              title: String(item.title ?? ''),
              body: String(item.body ?? ''),
              entityType: String(item.entity_type ?? item.entityType ?? ''),
              entityId: String(item.entity_id ?? item.entityId ?? ''),
              status: String(item.status ?? ''),
              isRead: Boolean(item.is_read ?? item.isRead),
              createdAt: String(item.created_at ?? item.createdAt ?? ''),
              deliveredAt: String(item.delivered_at ?? item.deliveredAt ?? ''),
              readAt: String(item.read_at ?? item.readAt ?? ''),
            }))
          : [];

        return reply.send({ items, total: Number(response.total ?? items.length) });
      } catch (error) {
        request.log.error({ error }, 'notification-service list notifications failed');
        return reply.code(503).send({ error: 'notification-service unavailable' });
      }
    },
  );

  fastify.get<{ Querystring: { organizationId?: string } }>(
    '/notifications/unread-count',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('notifications.read')],
    },
    async (request, reply) => {
      try {
        const response = (await notificationClient.getUnreadCount({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          organization_id: request.query.organizationId ?? 'org-main',
        })) as { total?: number };
        return reply.send({ total: Number(response.total ?? 0) });
      } catch (error) {
        request.log.error({ error }, 'notification-service unread count failed');
        return reply.code(503).send({ error: 'notification-service unavailable' });
      }
    },
  );

  fastify.post<{ Params: { notificationId: string }; Querystring: { organizationId?: string } }>(
    '/notifications/:notificationId/read',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('notifications.read')],
    },
    async (request, reply) => {
      const userId = request.session.auth?.userId ?? 'gateway-user';
      const organizationId = request.query.organizationId ?? 'org-main';
      try {
        const response = (await notificationClient.markNotificationRead({
          actor_user_id: userId,
          organization_id: organizationId,
          notification_id: request.params.notificationId,
        })) as { item?: Record<string, unknown> };

        const item = response.item ?? {};
        notificationSseHub.publish(userId, {
          type: 'read',
          payload: { id: String(item['id'] ?? request.params.notificationId) },
        });

        return reply.send({
          item: {
            id: String(item['id'] ?? ''),
            isRead: Boolean(item['is_read'] ?? item['isRead']),
            readAt: String(item['read_at'] ?? item['readAt'] ?? ''),
          },
        });
      } catch (error) {
        request.log.error({ error }, 'notification-service mark read failed');
        return reply.code(503).send({ error: 'notification-service unavailable' });
      }
    },
  );

  fastify.get<{ Querystring: { organizationId?: string } }>(
    '/notifications/stream',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('notifications.read')],
    },
    async (request, reply) => {
      const userId = request.session.auth?.userId ?? 'gateway-user';
      const organizationId = request.query.organizationId ?? 'org-main';

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      notificationSseHub.subscribe(userId, reply);

      try {
        const response = (await notificationClient.getUnreadCount({
          actor_user_id: userId,
          organization_id: organizationId,
        })) as { total?: number };
        notificationSseHub.publish(userId, {
          type: 'ready',
          payload: { unreadCount: Number(response.total ?? 0) },
        });
      } catch {
        notificationSseHub.publish(userId, {
          type: 'ready',
          payload: { unreadCount: 0 },
        });
      }

      const heartbeat = setInterval(() => {
        void reply.raw.write(`event: heartbeat\ndata: {}\n\n`);
      }, 30000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        notificationSseHub.unsubscribe(userId, reply);
      });

      return reply;
    },
  );
};

export default notificationsRoutes;
