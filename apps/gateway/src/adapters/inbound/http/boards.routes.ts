import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  TaskOrchestrationServiceClient,
  GrpcClientError,
} from '../../outbound/grpc/task.client.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';
import type { AuthSession } from '../../../domain/auth.js';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import {
  asNumber,
  asString,
  mapBoardMember,
  mapBoardSummary,
  mapKanbanTask,
  mapTaskComment,
  mapTaskAttachment,
} from './task-http.mappers.js';

const grpcClient = new TaskOrchestrationServiceClient();
const documentClient = new DocumentServiceClient();

function mapGrpcError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof GrpcClientError)) {
    return reply.code(503).send({ error: 'service-unavailable' });
  }

  if (error.code === 5) {
    return reply.code(404).send({ error: 'board not found' });
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
  // POST /api/boards - Create a task board for an organization
  fastify.post('/boards', {
    preHandler: [fastify.authenticate, edmsRbacGuard('tasks.create')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authData = request.session?.auth as AuthSession | undefined;
      if (!authData) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as {
        organizationId?: string;
        organization_id?: string;
        name?: string;
        description?: string;
      };

      const organizationId = body.organizationId || body.organization_id;

      if (!organizationId || !body.name) {
        return reply.code(400).send({ error: 'organizationId and name are required' });
      }

      const board = await grpcClient.createTaskBoard({
        actor_user_id: authData.userId,
        organization_id: organizationId,
        name: body.name,
        description: body.description || '',
      });

      const rawBoard = (board as Record<string, unknown>)['board'] as
        | Record<string, unknown>
        | undefined;
      return reply.code(201).send({
        board: mapBoardSummary(rawBoard ?? (board as Record<string, unknown>)),
      });
    } catch (error) {
      if (error instanceof GrpcClientError) {
        return mapGrpcError(reply, error);
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(400).send({ error: message });
    }
  });

  // GET /api/boards/:boardId - Get board details including tasks and available approvers/documents
  fastify.get<{ Params: { boardId: string } }>(
    '/boards/:boardId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (request: FastifyRequest<{ Params: { boardId: string } }>, reply: FastifyReply) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Get task board from gRPC service
        const board = await grpcClient.getTaskBoard({
          actor_user_id: authData.userId,
          board_id: request.params.boardId,
        });

        // Get available documents for attachment
        let availableDocuments: Array<Record<string, unknown>> = [];
        try {
          const docsResponse = await documentClient.searchDocuments({
            actor_user_id: authData.userId ?? 'gateway-user',
            query: '',
            status: 'published', // Only published documents can be attached
            category: undefined,
            limit: 50,
            offset: 0,
          });

          // Map response to expected format
          if (Array.isArray(docsResponse)) {
            availableDocuments = docsResponse.map((doc: Record<string, unknown>) => ({
              id: String(doc.id || ''),
              title: String(doc.title || ''),
              category: String(doc.category || ''),
              status: String(doc.status || 'PUBLISHED'),
              updatedAt: doc.updatedAt
                ? new Date(String(doc.updatedAt)).toISOString()
                : new Date().toISOString(),
              sizeKb: Number(doc.sizeKb || 0),
              version: Number(doc.version || 1),
            }));
          } else if (docsResponse && typeof docsResponse === 'object') {
            const docs = (docsResponse as Record<string, unknown>).documents;
            if (Array.isArray(docs)) {
              availableDocuments = docs.map((doc: Record<string, unknown>) => ({
                id: String(doc.id || ''),
                title: String(doc.title || ''),
                category: String(doc.category || ''),
                status: String(doc.status || 'PUBLISHED'),
                updatedAt: doc.updatedAt
                  ? new Date(String(doc.updatedAt)).toISOString()
                  : new Date().toISOString(),
                sizeKb: Number(doc.sizeKb || 0),
                version: Number(doc.version || 1),
              }));
            }
          }
        } catch (error) {
          // Log error but don't fail the request - available documents is optional
          request.log.warn({ error }, 'failed to fetch available documents');
        }

        // Get available approvers (for now, return board members who can approve)
        // In a real system, this would query from a directory service
        const boardPayload = ((board as Record<string, unknown>)['board'] || board) as Record<
          string,
          unknown
        >;
        const members = Array.isArray(boardPayload['members'])
          ? (boardPayload['members'] as Array<Record<string, unknown>>).map(mapBoardMember)
          : [];
        const membersById = new Map(
          members.map((member) => [
            member.id,
            { fullName: member.fullName, department: member.department },
          ]),
        );
        const rawTasks = Array.isArray(boardPayload['tasks'])
          ? (boardPayload['tasks'] as Array<Record<string, unknown>>)
          : [];
        const capabilityEntries = await Promise.all(
          rawTasks.map(async (task) => {
            const taskId = asString(task['id']);
            if (!taskId) {
              return [taskId, null] as const;
            }

            try {
              const details = (await grpcClient.getTaskDetails({
                actor_user_id: authData.userId,
                task_id: taskId,
              })) as Record<string, unknown>;

              return [
                taskId,
                {
                  canEdit: Boolean(details['can_edit'] ?? details['canEdit']),
                  canAssign: Boolean(details['can_assign'] ?? details['canAssign']),
                  canMoveToReview: Boolean(
                    details['can_move_to_review'] ?? details['canMoveToReview'],
                  ),
                  canApprove: Boolean(details['can_approve'] ?? details['canApprove']),
                  canComment: Boolean(details['can_comment'] ?? details['canComment']),
                },
              ] as const;
            } catch (error) {
              request.log.warn({ error, taskId }, 'failed to fetch task capabilities for board');
              return [taskId, null] as const;
            }
          }),
        );
        const capabilitiesByTaskId = new Map(capabilityEntries);
        const commentsByTaskId = new Map<string, Array<Record<string, unknown>>>();

        try {
          const activities = (await documentClient.listActivityEvents({
            actor_user_id: authData.userId,
            organization_id: asString(boardPayload['organization_id']),
            limit: 500,
            offset: 0,
            query: '',
          })) as Record<string, unknown>;

          const activityItems = Array.isArray(activities['items'])
            ? (activities['items'] as Array<Record<string, unknown>>)
            : [];

          for (const item of activityItems) {
            const taskId = pickTaskId(item);
            if (!taskId) {
              continue;
            }

            const current = commentsByTaskId.get(taskId) ?? [];
            commentsByTaskId.set(taskId, [...current, mapTaskComment(item)]);
          }
        } catch (error) {
          request.log.warn({ error }, 'failed to fetch task activity history for board');
        }

        const tasks = rawTasks.map((task) =>
          mapKanbanTask(task, membersById, {
            capabilities: capabilitiesByTaskId.get(asString(task['id'])) ?? undefined,
            comments: commentsByTaskId.get(asString(task['id'])) ?? [],
          }),
        );
        const availableApprovers = Array.isArray(boardPayload['available_approvers'])
          ? (boardPayload['available_approvers'] as Array<Record<string, unknown>>).map(
              mapBoardMember,
            )
          : [];

        return reply.send({
          id: asString(boardPayload['id']),
          organizationId: asString(boardPayload['organization_id']),
          name: asString(boardPayload['name']),
          description: asString(boardPayload['description']),
          allowedGrouping: Array.isArray(boardPayload['allowed_grouping'])
            ? (boardPayload['allowed_grouping'] as Array<unknown>).map((item) => asString(item))
            : ['assignee', 'department', 'group'],
          members,
          tasks,
          availableApprovers,
          availableDocuments: availableDocuments.map(mapTaskAttachment),
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

  // GET /api/organizations/:organizationId/members - List organization members available for board assignment
  fastify.get<{
    Params: { organizationId: string };
    Querystring: { limit?: number; offset?: number };
  }>(
    '/organizations/:organizationId/members',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Querystring: { limit?: number; offset?: number };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const limit = Math.min(request.query.limit ?? 100, 200);
        const offset = request.query.offset ?? 0;

        const response = (await grpcClient.listOrganizationMembers({
          actor_user_id: authData.userId,
          organization_id: request.params.organizationId,
          limit,
          offset,
        })) as Record<string, unknown>;

        const items = Array.isArray(response['items'])
          ? (response['items'] as Array<Record<string, unknown>>).map(mapBoardMember)
          : [];

        return reply.send({
          items,
          total: asNumber(response['total']),
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

  // POST /api/boards/:boardId/members - Add organization member to board
  fastify.post<{
    Params: { boardId: string };
    Body: { userId?: string; role?: 'OWNER' | 'MANAGER' | 'MEMBER' };
  }>(
    '/boards/:boardId/members',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.assign')],
    },
    async (
      request: FastifyRequest<{
        Params: { boardId: string };
        Body: { userId?: string; role?: 'OWNER' | 'MANAGER' | 'MEMBER' };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const userId = request.body?.userId;
        if (!userId) {
          return reply.code(400).send({ error: 'userId is required' });
        }

        const response = (await grpcClient.addTaskBoardMember({
          actor_user_id: authData.userId,
          board_id: request.params.boardId,
          user_id: userId,
          role: request.body.role ?? 'MEMBER',
        })) as Record<string, unknown>;
        const memberPayload =
          (response['member'] as Record<string, unknown> | undefined) ?? response;

        return reply.code(201).send({
          member: mapBoardMember(memberPayload),
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

  // GET /api/boards - List all boards for organization
  fastify.get<{ Querystring: { organizationId?: string; limit?: number; offset?: number } }>(
    '/boards',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('tasks.read')],
    },
    async (
      request: FastifyRequest<{
        Querystring: { organizationId?: string; limit?: number; offset?: number };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const organizationId = request.query.organizationId || '';
        const limit = Math.min(request.query.limit ?? 50, 100);
        const offset = request.query.offset ?? 0;

        // Query task board list from gRPC service
        const boards = (await grpcClient.listTaskBoards({
          actor_user_id: authData.userId,
          organization_id: organizationId,
          limit,
          offset,
        })) as Record<string, unknown>;

        const rawBoards = Array.isArray(boards['boards'])
          ? (boards['boards'] as Array<Record<string, unknown>>)
          : [];
        return reply.send({
          boards: rawBoards.map(mapBoardSummary),
          total: asNumber(boards['total']),
          page: asNumber(boards['page']),
          pageSize: asNumber(boards['page_size']),
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
};

export default routes;

function pickTaskId(item: Record<string, unknown>): string {
  const taskId = item['task_id'] ?? item['taskId'] ?? item['entity_id'] ?? item['entityId'];
  return typeof taskId === 'string' ? taskId : '';
}
