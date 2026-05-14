import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';

const documentClient = new DocumentServiceClient();

const activityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{
    Querystring: {
      q?: string;
      limit?: number;
      offset?: number;
      organizationId?: string;
    };
  }>(
    '/activity',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
            organizationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const limit = typeof request.query.limit === 'number' ? Math.min(Math.max(request.query.limit, 1), 100) : 20;
      const offset = typeof request.query.offset === 'number' ? Math.max(request.query.offset, 0) : 0;

      try {
        const response = (await documentClient.listActivityEvents({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          organization_id: request.query.organizationId ?? 'org-main',
          limit,
          offset,
          query: request.query.q?.trim() ?? '',
        })) as { items?: Array<Record<string, unknown>>; total?: number };

        const items = Array.isArray(response.items)
          ? response.items.map((item) => ({
              id: String(item.id ?? ''),
              organizationId: String(item.organization_id ?? item.organizationId ?? ''),
              actorUserId: String(item.actor_user_id ?? item.actorUserId ?? ''),
              actorUserName: String(item.actor_user_name ?? item.actorUserName ?? ''),
              entityType: String(item.entity_type ?? item.entityType ?? ''),
              entityId: String(item.entity_id ?? item.entityId ?? ''),
              actionType: String(item.action_type ?? item.actionType ?? ''),
              summary: String(item.summary ?? ''),
              occurredAt: String(item.occurred_at ?? item.occurredAt ?? ''),
              documentId: String(item.document_id ?? item.documentId ?? ''),
              taskId: String(item.task_id ?? item.taskId ?? ''),
              boardId: String(item.board_id ?? item.boardId ?? ''),
            }))
          : [];

        return reply.send({ items, total: Number(response.total ?? items.length) });
      } catch (error) {
        request.log.error({ error }, 'document-service list activity events failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );
};

export default activityRoutes;
