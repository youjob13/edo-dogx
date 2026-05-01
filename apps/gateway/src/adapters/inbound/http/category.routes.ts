import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';

type CategoryCode = 'HR' | 'FINANCE' | 'GENERAL';

interface CategoryWorkflowConfig {
  category: CategoryCode;
  workflowCode: string;
  initialAssigneeRole: string;
  retentionClass: string;
}

const workflowByCategory: Record<CategoryCode, CategoryWorkflowConfig> = {
  HR: {
    category: 'HR',
    workflowCode: 'hr-approval',
    initialAssigneeRole: 'edms.hr',
    retentionClass: 'HR_STANDARD',
  },
  FINANCE: {
    category: 'FINANCE',
    workflowCode: 'finance-approval',
    initialAssigneeRole: 'edms.finance',
    retentionClass: 'FINANCE_LONG',
  },
  GENERAL: {
    category: 'GENERAL',
    workflowCode: 'general-approval',
    initialAssigneeRole: 'edms.approver',
    retentionClass: 'GENERAL_DEFAULT',
  },
};

const categoryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: { category: string } }>(
    '/:category/workflow-config',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('category.read')],
      schema: {
        params: {
          type: 'object',
          required: ['category'],
          properties: {
            category: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const category = request.params.category.toUpperCase() as CategoryCode;
      const config = workflowByCategory[category];
      if (!config) {
        return reply.code(404).send({ error: 'Unsupported category' });
      }
      return reply.send(config);
    },
  );

  fastify.post<{
    Params: { category: string };
    Body: { documentId: string; assigneeUserId?: string };
  }>(
    '/:category/assign-workflow',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('category.assign')],
      schema: {
        params: {
          type: 'object',
          required: ['category'],
          properties: {
            category: { type: 'string', minLength: 1 },
          },
        },
        body: {
          type: 'object',
          required: ['documentId'],
          properties: {
            documentId: { type: 'string', minLength: 1 },
            assigneeUserId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const category = request.params.category.toUpperCase() as CategoryCode;
      const config = workflowByCategory[category];
      if (!config) {
        return reply.code(404).send({ error: 'Unsupported category' });
      }

      return reply.code(202).send({
        documentId: request.body.documentId,
        category,
        workflowCode: config.workflowCode,
        assignedRole: config.initialAssigneeRole,
        assigneeUserId: request.body.assigneeUserId ?? null,
      });
    },
  );
};

export default categoryRoutes;
