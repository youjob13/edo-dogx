import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';

interface DocumentDto {
  id: string;
  title: string;
  category: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';
  version: number;
  updatedAt: string;
}

const documentStore = new Map<string, DocumentDto>();

const allowedStatuses = new Set(['DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED']);

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

      const id = `doc-${Date.now()}`;
      const now = new Date().toISOString();
      const draft: DocumentDto = {
        id,
        title: title.trim(),
        category: category.trim(),
        status: 'DRAFT',
        version: 1,
        updatedAt: now,
      };
      documentStore.set(id, draft);
      return reply.code(201).send(draft);
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

      const items = [...documentStore.values()].filter((doc) => {
        if (q && !doc.title.toLowerCase().includes(q.toLowerCase())) {
          return false;
        }
        if (status && doc.status !== status) {
          return false;
        }
        if (category && doc.category !== category) {
          return false;
        }
        return true;
      });

      return reply.send({
        items: items.slice(offset, offset + limit),
        total: items.length,
        limit,
        offset,
      });
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

      const record = documentStore.get(documentId);
      if (!record) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      record.status = 'IN_REVIEW';
      record.version += 1;
      record.updatedAt = new Date().toISOString();
      documentStore.set(record.id, record);
      return reply.code(202).send({ id: record.id, status: record.status, version: record.version });
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

      const record = documentStore.get(documentId);
      if (!record) {
        return reply.code(404).send({ error: 'Document not found' });
      }
      if (record.version !== expectedVersion) {
        return reply.code(409).send({ error: 'Document version mismatch' });
      }

      record.status = 'APPROVED';
      record.version += 1;
      record.updatedAt = new Date().toISOString();
      documentStore.set(record.id, record);
      return reply.code(202).send({ id: record.id, status: record.status, version: record.version });
    },
  );
};

export default documentsRoutes;
