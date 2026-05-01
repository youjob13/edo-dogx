import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';

const allowedStatuses = new Set(['DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED']);
const documentClient = new DocumentServiceClient();

const documentsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{ Body: { title: string; category: string } }>(
    '/',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.create')],
      schema: {
        body: {
          type: 'object',
          required: ['title', 'category'],
          properties: {
            title: { type: 'string', minLength: 1 },
            category: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { title, category } = request.body;
      if (typeof title !== 'string' || title.trim() === '') {
        return reply.code(400).send({ error: 'title is required' });
      }
      if (typeof category !== 'string' || category.trim() === '') {
        return reply.code(400).send({ error: 'category is required' });
      }

      try {
        const response = await documentClient.createDraft({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          title: title.trim(),
          category: category.trim(),
        });
        return reply.code(201).send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service create draft failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );

  fastify.get<{
    Querystring: {
      q?: string;
      status?: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';
      category?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            status: { type: 'string' },
            category: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = typeof request.query.q === 'string' ? request.query.q : undefined;
      const status =
        typeof request.query.status === 'string' && allowedStatuses.has(request.query.status)
          ? request.query.status
          : undefined;
      const category =
        typeof request.query.category === 'string' ? request.query.category : undefined;
      const limit =
        typeof request.query.limit === 'number' && request.query.limit > 0
          ? Math.min(request.query.limit, 100)
          : 20;
      const offset =
        typeof request.query.offset === 'number' && request.query.offset >= 0
          ? request.query.offset
          : 0;

      if (request.query.status && !status) {
        return reply.code(400).send({ error: 'invalid status filter' });
      }

      try {
        const response = await documentClient.searchDocuments({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          query: q,
          status,
          category,
          limit,
          offset,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service search failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );

  fastify.post<{ Params: { documentId: string } }>(
    '/:documentId/workflow/submit',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.submit')],
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
        const response = await documentClient.submitWorkflow({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
        });
        return reply.code(202).send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service submit workflow failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );

  fastify.post<{ Params: { documentId: string }; Body: { expectedVersion: number } }>(
    '/:documentId/workflow/approve',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.approve')],
      schema: {
        params: {
          type: 'object',
          required: ['documentId'],
          properties: {
            documentId: { type: 'string', minLength: 1 },
          },
        },
        body: {
          type: 'object',
          required: ['expectedVersion'],
          properties: {
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const { expectedVersion } = request.body;
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }
      if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
        return reply.code(400).send({ error: 'expectedVersion must be a positive integer' });
      }

      try {
        const response = await documentClient.approveWorkflow({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          expected_version: expectedVersion,
        });
        return reply.code(202).send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service approve workflow failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );
};

export default documentsRoutes;
