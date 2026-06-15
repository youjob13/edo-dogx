import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  TaskOrchestrationServiceClient,
  GrpcClientError,
} from '../../outbound/grpc/task.client.js';
import { TaskService, type UpdateTaskStatusRequest } from '../../../application/task.service.js';
import { TaskValidationService } from '../../../application/validation/task.validation.js';
import { NotificationServiceClient } from '../../outbound/grpc/notification.client.js';
import { notificationSseHub } from './notifications.sse-hub.js';
import type { AuthSession } from '../../../domain/auth.js';
import type { UserProfile, CreateTaskRequest } from '@edo/types';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';

const grpcClient = new TaskOrchestrationServiceClient();
const taskService = new TaskService(grpcClient);
const validationService = new TaskValidationService();
const notificationClient = new NotificationServiceClient();

function buildUserProfile(authData: AuthSession): UserProfile {
  return {
    userId: authData.userId,
    userName: authData.email,
    fullName: authData.fullName || authData.email,
    email: authData.email,
    department: authData.department || '',
    roles: authData.roles || [],
  };
}

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

  if (error.code === 9) {
    return reply.code(409).send({ error: error.message || 'operation conflict' });
  }

  return reply.code(500).send({ error: error.message || 'internal server error' });
}

const routes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/tasks - Create a new task
  fastify.post(
    '/tasks',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.create')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const body = request.body as CreateTaskRequest & { documentIds?: string[] };

        // Validate task creation request
        const validationResult = validationService.validateTaskCreation(
          body as unknown as Record<string, unknown>,
        );
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

        const task = await taskService.createTask(taskRequest, buildUserProfile(authData));
        if (task.assigneeId) {
          try {
          const created = (await notificationClient.createNotification({
            actor_user_id: authData.userId,
            recipient_user_id: task.assigneeId,
            organization_id: 'org-main',
            event_type: 'task.assigned',
            title: 'Назначена задача',
            body: `Вам назначена задача: ${task.title}`,
            entity_type: 'TASK',
            entity_id: task.id,
          })) as { item?: Record<string, unknown> };
          notificationSseHub.publish(task.assigneeId, {
            type: 'notification',
            payload: {
              notificationId: String(created.item?.['id'] ?? ''),
              title: String(created.item?.['title'] ?? 'Назначена задача'),
              body: String(created.item?.['body'] ?? `Вам назначена задача: ${task.title}`),
              entityType: 'TASK',
              entityId: task.id,
            },
          });
        } catch (error) {
          request.log.warn({ error }, 'failed to create task assignment notification');
        }
      }

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
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.status')],
    },
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
        const validationResult = validationService.validateTaskStatusUpdate(
          validationPayload as Record<string, unknown>,
        );
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

        const task = await taskService.updateTaskStatus(updateRequest, buildUserProfile(authData));
        const recipient =
          task.status === 'approved' || task.status === 'declined'
            ? task.creatorId || task.assigneeId
            : task.approverId || task.assigneeId;
        if (recipient) {
          try {
            const created = (await notificationClient.createNotification({
              actor_user_id: authData.userId,
              recipient_user_id: recipient,
              organization_id: 'org-main',
              event_type: `task.${task.status}`,
              title: 'Обновлен статус задачи',
              body: `Задача «${task.title}» перешла в статус ${task.status}`,
              entity_type: 'TASK',
              entity_id: task.id,
            })) as { item?: Record<string, unknown> };
            notificationSseHub.publish(recipient, {
              type: 'notification',
              payload: {
                notificationId: String(created.item?.['id'] ?? ''),
                title: String(created.item?.['title'] ?? 'Обновлен статус задачи'),
                body: String(created.item?.['body'] ?? ''),
                entityType: 'TASK',
                entityId: task.id,
              },
            });
          } catch (error) {
            request.log.warn({ error }, 'failed to create task status notification');
          }
        }

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

  // PATCH /api/tasks/:taskId/assignee - Assign or reassign a task
  fastify.patch<{ Params: { taskId: string }; Body: { assigneeId?: string } }>(
    '/tasks/:taskId/assignee',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.assign')],
    },
    async (
      request: FastifyRequest<{
        Params: { taskId: string };
        Body: { assigneeId?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const assigneeId = request.body?.assigneeId?.trim();
        if (!assigneeId) {
          return reply.code(400).send({ error: 'assigneeId is required' });
        }

        const task = await taskService.updateTaskAssignee(
          {
            taskId: request.params.taskId,
            assigneeId,
          },
          buildUserProfile(authData),
        );

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
  fastify.get<{ Params: { taskId: string }; Querystring: { boardId?: string } }>(
    '/tasks/:taskId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{ Params: { taskId: string }; Querystring: { boardId?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const details = await taskService.getTaskDetails(request.params.taskId, buildUserProfile(authData));

        return reply.send({
          board: {
            id: request.query.boardId ?? '',
            organizationId: '',
            name: '',
            description: '',
            membersCount: details.members.length,
            tasksCount: 0,
          },
          task: details.task,
          members: details.members,
          currentUserId: details.currentUserId,
          canEdit: details.canEdit,
          canAssign: details.canAssign,
          canMoveToReview: details.canMoveToReview,
          canApprove: details.canApprove,
          canComment: details.canComment,
        });
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
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{
        Querystring: { assigneeId?: string; status?: string; taskType?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const tasks = await taskService.listTasks(
          {
            assigneeId: request.query.assigneeId,
            status: request.query.status,
            taskType: request.query.taskType,
          },
          buildUserProfile(authData),
        );

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
  fastify.get<{ Querystring: { boardId?: string; search?: string; limit?: number } }>(
    '/tasks/available-approvers',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{
        Querystring: { boardId?: string; search?: string; limit?: number };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const boardId = request.query.boardId ?? '';
        if (!boardId) {
          return reply.code(400).send({ error: 'boardId is required' });
        }

        const search = request.query.search ?? '';
        const limit = Math.min(request.query.limit ?? 50, 200);
        const approvers = await taskService.getAvailableApprovers(
          boardId,
          buildUserProfile(authData),
          search,
          limit,
        );
        return reply.send({ approvers });
      } catch (error) {
        if (error instanceof GrpcClientError) {
          return mapGrpcError(reply, error);
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(500).send({ error: message });
      }
    },
  );

  // GET /api/tasks/available-documents - Get list of available documents for attachment
  fastify.get<{
    Querystring: { boardId?: string; category?: string; search?: string; limit?: number };
  }>(
    '/tasks/available-documents',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{
        Querystring: { boardId?: string; category?: string; search?: string; limit?: number };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const boardId = request.query.boardId ?? '';
        if (!boardId) {
          return reply.code(400).send({ error: 'boardId is required' });
        }

        const category = request.query.category ?? '';
        const search = request.query.search ?? '';
        const limit = Math.min(request.query.limit ?? 50, 200);

        const documents = await taskService.getAvailableDocuments(
          boardId,
          buildUserProfile(authData),
          category,
          search,
          limit,
        );

        return reply.send({ documents, limit, offset: 0 });
      } catch (error) {
        if (error instanceof GrpcClientError) {
          return mapGrpcError(reply, error);
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(500).send({ error: message });
      }
    },
  );
};

export default routes;
