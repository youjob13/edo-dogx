import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  TaskOrchestrationServiceClient,
  GrpcClientError,
} from '../../outbound/grpc/task.client.js';
import { TaskService, type UpdateTaskStatusRequest } from '../../../application/task.service.js';
import { TaskValidationService } from '../../../application/validation/task.validation.js';
import { NotificationServiceClient } from '../../outbound/grpc/notification.client.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';
import { notificationSseHub } from './notifications.sse-hub.js';
import type { AuthSession } from '../../../domain/auth.js';
import type { UserProfile, CreateTaskRequest } from '@edo/types';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { mapBoardMember, mapBoardSummary, mapKanbanTask, mapTaskComment } from './task-http.mappers.js';

const grpcClient = new TaskOrchestrationServiceClient();
const taskService = new TaskService(grpcClient);
const validationService = new TaskValidationService();
const notificationClient = new NotificationServiceClient();
const documentClient = new DocumentServiceClient();

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

  fastify.post<{
    Params: { taskId: string };
    Querystring: { boardId?: string };
    Body: { documentIds?: string[] };
  }>(
    '/tasks/:taskId/attachments',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.assign')],
    },
    async (
      request: FastifyRequest<{
        Params: { taskId: string };
        Querystring: { boardId?: string };
        Body: { documentIds?: string[] };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const boardId = request.query.boardId?.trim() ?? '';
        const documentIds = Array.isArray(request.body?.documentIds) ? request.body.documentIds : [];
        const task = await taskService.addTaskAttachments(
          request.params.taskId,
          boardId,
          documentIds,
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

  fastify.post<{
    Params: { taskId: string };
    Querystring: { boardId?: string };
    Body: { text?: string };
  }>(
    '/tasks/:taskId/comments',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{
        Params: { taskId: string };
        Querystring: { boardId?: string };
        Body: { text?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const text = request.body?.text?.trim() ?? '';
        if (!text) {
          return reply.code(400).send({ error: 'text is required' });
        }

        const boardPayload = await resolveBoardSummary(authData, request.query.boardId);
        if (!boardPayload.id || !boardPayload.organizationId) {
          return reply.code(400).send({ error: 'boardId is required' });
        }

        const details = await taskService.getTaskDetails(
          request.params.taskId,
          buildUserProfile(authData),
        );
        if (!details.canComment) {
          return reply.code(403).send({ error: 'forbidden' });
        }

        const recipients = new Set<string>([
          authData.userId,
          details.task.creatorId,
          details.task.assigneeId,
          details.task.approverId ?? '',
        ]);

        await Promise.all(
          [...recipients]
            .map((recipientUserId) => recipientUserId.trim())
            .filter((recipientUserId) => recipientUserId.length > 0)
            .map((recipient_user_id) =>
              notificationClient.createNotification({
                actor_user_id: authData.userId,
                recipient_user_id,
                organization_id: boardPayload.organizationId,
                event_type: 'task.comment',
                title: authData.fullName || authData.email,
                body: text,
                entity_type: 'TASK',
                entity_id: request.params.taskId,
              }),
            ),
        );

        const members = details.members.map((member) =>
          mapBoardMember(member as unknown as Record<string, unknown>),
        );
        const membersById = new Map(
          members.map((member) => [
            member.id,
            { fullName: member.fullName, department: member.department },
          ]),
        );
        const taskComments = await loadTaskComments(
          authData,
          boardPayload.organizationId,
          request.params.taskId,
        );

        return reply.code(201).send({
          task: mapKanbanTask(details.task as unknown as Record<string, unknown>, membersById, {
            comments: taskComments,
            capabilities: {
              canEdit: details.canEdit,
              canAssign: details.canAssign,
              canMoveToReview: details.canMoveToReview,
              canApprove: details.canApprove,
              canComment: details.canComment,
            },
          }),
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

  fastify.delete<{ Params: { taskId: string; documentId: string } }>(
    '/tasks/:taskId/attachments/:documentId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.assign')],
    },
    async (
      request: FastifyRequest<{ Params: { taskId: string; documentId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const task = await taskService.removeTaskAttachment(
          request.params.taskId,
          request.params.documentId,
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

        const details = await taskService.getTaskDetails(
          request.params.taskId,
          buildUserProfile(authData),
        );
        const boardPayload = await resolveBoardSummary(authData, request.query.boardId);
        const taskComments = await loadTaskComments(
          authData,
          boardPayload.organizationId,
          request.params.taskId,
        );
        const members = details.members.map((member) =>
          mapBoardMember(member as unknown as Record<string, unknown>),
        );
        const membersById = new Map(
          members.map((member) => [
            member.id,
            { fullName: member.fullName, department: member.department },
          ]),
        );

        return reply.send({
          board: boardPayload,
          task: mapKanbanTask(details.task as unknown as Record<string, unknown>, membersById, {
            comments: taskComments,
            capabilities: {
              canEdit: details.canEdit,
              canAssign: details.canAssign,
              canMoveToReview: details.canMoveToReview,
              canApprove: details.canApprove,
              canComment: details.canComment,
            },
          }),
          members,
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
  fastify.get<{ Querystring: { assigneeId?: string; status?: string; taskType?: string; scope?: 'mine' } }>(
    '/tasks',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{
        Querystring: { assigneeId?: string; status?: string; taskType?: string; scope?: 'mine' };
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
            scope: request.query.scope,
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

async function resolveBoardSummary(authData: AuthSession, boardId?: string) {
  if (!boardId?.trim()) {
    return {
      id: '',
      organizationId: '',
      name: '',
      description: '',
      membersCount: 0,
      tasksCount: 0,
    };
  }

  const board = await grpcClient.getTaskBoard({
    actor_user_id: authData.userId,
    board_id: boardId,
  });
  const boardPayload = ((board as Record<string, unknown>)['board'] || board) as Record<string, unknown>;

  return mapBoardSummary({
    id: boardPayload['id'],
    organization_id: boardPayload['organization_id'],
    name: boardPayload['name'],
    description: boardPayload['description'],
    members_count: Array.isArray(boardPayload['members']) ? boardPayload['members'].length : 0,
    tasks_count: Array.isArray(boardPayload['tasks']) ? boardPayload['tasks'].length : 0,
  });
}

async function loadTaskComments(authData: AuthSession, organizationId: string, taskId: string) {
  if (!organizationId || !taskId) {
    return [];
  }

  try {
    const [activityResponse, notificationsResponse] = await Promise.all([
      documentClient.listActivityEvents({
        actor_user_id: authData.userId,
        organization_id: organizationId,
        limit: 500,
        offset: 0,
        query: '',
      }),
      notificationClient.listNotifications({
        actor_user_id: authData.userId,
        organization_id: organizationId,
        limit: 500,
        offset: 0,
      }),
    ]);

    const response = activityResponse as Record<string, unknown>;
    const notifications = notificationsResponse as Record<string, unknown>;

    const items = Array.isArray(response['items'])
      ? (response['items'] as Array<Record<string, unknown>>)
      : [];
    const notificationItems = Array.isArray(notifications['items'])
      ? (notifications['items'] as Array<Record<string, unknown>>)
      : [];

    const activityComments = items
      .filter((item) => {
        const currentTaskId =
          item['task_id'] ?? item['taskId'] ?? item['entity_id'] ?? item['entityId'];
        return typeof currentTaskId === 'string' && currentTaskId === taskId;
      })
      .map(mapTaskComment);

    const notificationComments = notificationItems
      .filter((item) => {
        const entityId = item['entity_id'] ?? item['entityId'];
        const eventType = item['event_type'] ?? item['eventType'];
        return (
          typeof entityId === 'string' &&
          entityId === taskId &&
          typeof eventType === 'string' &&
          eventType === 'task.comment'
        );
      })
      .map(mapTaskComment);

    return [...notificationComments, ...activityComments].sort((left, right) => {
      const leftTime = Date.parse(left.createdAtLabel);
      const rightTime = Date.parse(right.createdAtLabel);
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
  } catch {
    return [];
  }
}
