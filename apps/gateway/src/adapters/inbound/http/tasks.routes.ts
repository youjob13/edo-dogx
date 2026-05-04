import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { TaskOrchestrationServiceClient, GrpcClientError } from '../../outbound/grpc/task.client.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';
import { TaskService, type UpdateTaskStatusRequest } from '../../../application/task.service.js';
import { TaskValidationService } from '../../../application/validation/task.validation.js';
import type { AuthSession } from '../../../domain/auth.js';
import { CreateTaskRequest } from '@edo/types';

const grpcClient = new TaskOrchestrationServiceClient();
const documentClient = new DocumentServiceClient();
const taskService = new TaskService(grpcClient, documentClient);
const validationService = new TaskValidationService();

function mapGrpcError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof GrpcClientError)) {
    return reply.code(503).send({ error: 'task-service unavailable' });
  }

  if (error.code === 5) {
    return reply.code(404).send({ error: 'task not found' });
  }

  if (error.code === 3) {
    return reply.code(400).send({ error: error.message || 'invalid request' });
  }

  if (error.code === 7) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  if (error.code === 16) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  return reply.code(500).send({ error: error.message || 'internal server error' });
}

const routes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/tasks - Create a new task
  fastify.post('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authData = request.session?.auth as AuthSession | undefined;
      if (!authData) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as CreateTaskRequest & { documentIds?: string[] };

      // Validate task creation request
      const validationResult = validationService.validateTaskCreation(body as unknown as Record<string, unknown>);
      if (!validationResult.isValid) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: validationResult.errors,
        });
      }

      const taskRequest: CreateTaskRequest = {
        boardId: body.boardId,
        title: body.title,
        description: body.description,
        assigneeId: body.assigneeId,
        assigneeName: body.assigneeName,
        approverId: body.approverId,
        approverName: body.approverName,
        taskType: body.taskType,
        dueDate: body.dueDate ? new Date(body.dueDate as unknown as string) : undefined,
        priority: body.priority,
        attachmentIds: body.attachmentIds ?? body.documentIds,
      };

      const task = await taskService.createTask(taskRequest, {
        userId: authData.userId,
        userName: authData.email,
        email: authData.email,
        roles: authData.roles,
      });

      return reply.code(201).send({ task });
    } catch (error) {
      if (error instanceof GrpcClientError) {
        return mapGrpcError(reply, error);
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(400).send({ error: message });
    }
  });

  // PATCH /api/tasks/:taskId/status - Update task status
  fastify.patch<{ Params: { taskId: string } }>(
    '/tasks/:taskId/status',
    async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const body = request.body as UpdateTaskStatusRequest;

        // Prepare validation payload
        const validationPayload = {
          taskId: request.params.taskId,
          status: body.status,
          decision: body.decision,
          decisionComment: body.decisionComment,
        };

        // Validate status update request
        const validationResult = validationService.validateTaskStatusUpdate(validationPayload as Record<string, unknown>);
        if (!validationResult.isValid) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: validationResult.errors,
          });
        }

        const updateRequest: UpdateTaskStatusRequest = {
          taskId: request.params.taskId,
          status: body.status,
          decision: body.decision,
          decisionComment: body.decisionComment,
        };

        const task = await taskService.updateTaskStatus(updateRequest, {
          userId: authData.userId,
          userName: authData.email,
          email: authData.email,
          roles: authData.roles,
        });

        return reply.send({ task });
      } catch (error) {
        if (error instanceof GrpcClientError) {
          return mapGrpcError(reply, error);
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: message });
      }
    },
  );

  // GET /api/tasks/:taskId - Get task details
  fastify.get<{ Params: { taskId: string } }>(
    '/tasks/:taskId',
    async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const task = await taskService.getTask(request.params.taskId);
        return reply.send({ task });
      } catch (error) {
        if (error instanceof GrpcClientError) {
          return mapGrpcError(reply, error);
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: message });
      }
    },
  );

  // GET /api/tasks - List tasks with optional filters
  fastify.get<{ Querystring: { assigneeId?: string; status?: string; taskType?: string } }>(
    '/tasks',
    async (
      request: FastifyRequest<{ Querystring: { assigneeId?: string; status?: string; taskType?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const tasks = await taskService.listTasks({
          assigneeId: request.query.assigneeId,
          status: request.query.status,
          taskType: request.query.taskType,
        });

        return reply.send({ tasks });
      } catch (error) {
        if (error instanceof GrpcClientError) {
          return mapGrpcError(reply, error);
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: message });
      }
    },
  );

  // GET /api/tasks/available-approvers - Get list of available approvers
  fastify.get('/tasks/available-approvers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authData = request.session?.auth as AuthSession | undefined;
      if (!authData) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const approvers = await taskService.getAvailableApprovers();
      return reply.send({ approvers });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  // GET /api/tasks/available-documents - Get list of available documents for attachment
  fastify.get<{ Querystring: { limit?: number; offset?: number } }>(
    '/tasks/available-documents',
    async (request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>, reply: FastifyReply) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const limit = Math.min(request.query.limit ?? 50, 100);
        const offset = request.query.offset ?? 0;

        const documents = await taskService.getAvailableDocuments(
          {
            userId: authData.userId,
            userName: authData.email,
            email: authData.email,
            roles: authData.roles,
          },
          limit,
          offset,
        );

        return reply.send({ documents, limit, offset });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(500).send({ error: message });
      }
    },
  );
};

export default routes;
