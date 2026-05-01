import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { AuthorizationAuditServiceClient } from '../../outbound/grpc/authorization_audit.client.js';

const authorizationAuditClient = new AuthorizationAuditServiceClient();

const auditRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: { documentId: string } }>(
    '/:documentId/audit-events',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('audit.read')],
      schema: {
        params: {
          type: 'object',
          required: ['documentId'],
          properties: {
            documentId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }

      try {
        const response = await authorizationAuditClient.getAuditEvents({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'authorization-audit-service get audit events failed');
        return reply.code(503).send({ error: 'authorization-audit-service unavailable' });
      }
    },
  );
};

export default auditRoutes;
