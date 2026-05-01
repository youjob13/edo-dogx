import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';

interface SearchItem {
  documentId: string;
  title: string;
  category: 'HR' | 'FINANCE' | 'GENERAL';
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';
  updatedAt: string;
}

interface NotificationCenterItem {
  id: string;
  eventType: string;
  recipientUserId: string;
  documentId: string;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
  createdAt: string;
}

const searchIndex: SearchItem[] = [
  {
    documentId: 'doc-hr-001',
    title: 'Трудовой договор 2026',
    category: 'HR',
    status: 'IN_REVIEW',
    updatedAt: new Date().toISOString(),
  },
  {
    documentId: 'doc-fin-002',
    title: 'Финансовый отчет Q1',
    category: 'FINANCE',
    status: 'APPROVED',
    updatedAt: new Date().toISOString(),
  },
  {
    documentId: 'doc-gen-003',
    title: 'Общий регламент закупок',
    category: 'GENERAL',
    status: 'DRAFT',
    updatedAt: new Date().toISOString(),
  },
];

const notificationCenter: NotificationCenterItem[] = [
  {
    id: 'notif-1',
    eventType: 'documents.submitted',
    recipientUserId: 'user.hr@edo.local',
    documentId: 'doc-hr-001',
    deliveryStatus: 'SENT',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    eventType: 'documents.approved',
    recipientUserId: 'user.finance@edo.local',
    documentId: 'doc-fin-002',
    deliveryStatus: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];

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

      const filtered = searchIndex.filter((item) => {
        if (q && !item.title.toLowerCase().includes(q)) {
          return false;
        }
        if (category && item.category !== category) {
          return false;
        }
        if (status && item.status !== status) {
          return false;
        }
        return true;
      });

      return reply.send({
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      });
    },
  );

  fastify.get(
    '/notifications/center',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('notifications.read')],
    },
    async (_request, reply) => {
      return reply.send({ items: notificationCenter });
    },
  );
};

export default searchRoutes;
