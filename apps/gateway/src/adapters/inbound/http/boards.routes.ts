import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { TaskOrchestrationServiceClient, GrpcClientError } from '../../outbound/grpc/task.client.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';
import type { AuthSession } from '../../../domain/auth.js';

const grpcClient = new TaskOrchestrationServiceClient();
const documentClient = new DocumentServiceClient();

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function mapBoardSummary(board: Record<string, unknown>) {
  return {
    id: asString(board['id']),
    organizationId: asString(board['organization_id']),
    name: asString(board['name']),
    description: asString(board['description']),
    membersCount: asNumber(board['members_count']),
    tasksCount: asNumber(board['tasks_count']),
  };
}

function mapBoardMember(member: Record<string, unknown>) {
  return {
    id: asString(member['id']),
    fullName: asString(member['full_name']),
    department: asString(member['department']),
    email: asString(member['email']),
  };
}

function mapTaskAttachment(attachment: Record<string, unknown>) {
  return {
    documentId: asString(attachment['document_id'] || attachment['id']),
    title: asString(attachment['title']),
    category: asString(attachment['category']),
    status: asString(attachment['status']),
  };
}

function mapTask(task: Record<string, unknown>, membersById: Map<string, { fullName: string; department: string }>) {
  const assigneeId = asString(task['assignee_user_id']);
  const assignee = membersById.get(assigneeId);
  const taskType = asString(task['task_type'], 'general');

  return {
    id: asString(task['id']),
    title: asString(task['title']),
    description: asString(task['description']),
    status: asString(task['status'], 'pending'),
    assigneeId: assigneeId || null,
    assigneeName: asString(task['assignee_user_name'], assignee?.fullName || 'Не назначен'),
    department: assignee?.department || '',
    groupId: assigneeId || 'unassigned',
    groupName: assignee?.fullName || 'Не назначен',
    dueDateLabel: asString(task['due_date'], 'Без срока'),
    comments: [],
    creatorId: asString(task['creator_user_id']),
    creatorName: asString(task['creator_user_name']),
    attachments: Array.isArray(task['attachments'])
      ? (task['attachments'] as Array<Record<string, unknown>>).map(mapTaskAttachment)
      : [],
    approverId: asString(task['approver_user_id']) || undefined,
    approverName: asString(task['approver_user_name']) || undefined,
    taskType: taskType === 'approval' ? 'approval' : 'general',
    decision:
      asString(task['decision']) === 'approved' || asString(task['decision']) === 'declined'
        ? asString(task['decision'])
        : undefined,
    decisionComment: asString(task['decision_comment']) || undefined,
    createdAt: asString(task['created_at']),
    updatedAt: asString(task['updated_at']),
  };
}

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
  fastify.post('/boards', async (request: FastifyRequest, reply: FastifyReply) => {
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

      const rawBoard = (board as Record<string, unknown>)['board'] as Record<string, unknown> | undefined;
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
    async (request: FastifyRequest<{ Params: { boardId: string } }>, reply: FastifyReply) => {
      try {
        const authData = request.session?.auth as AuthSession | undefined;
        if (!authData) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Get task board from gRPC service
        const board = await grpcClient.getTaskBoard({
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
              updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)).toISOString() : new Date().toISOString(),
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
        const boardPayload = ((board as Record<string, unknown>)['board'] ||
          board) as Record<string, unknown>;
        const members = Array.isArray(boardPayload['members'])
          ? (boardPayload['members'] as Array<Record<string, unknown>>).map(mapBoardMember)
          : [];
        const membersById = new Map(
          members.map((member) => [member.id, { fullName: member.fullName, department: member.department }]),
        );
        const tasks = Array.isArray(boardPayload['tasks'])
          ? (boardPayload['tasks'] as Array<Record<string, unknown>>).map((task) => mapTask(task, membersById))
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
          availableApprovers: members,
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
  fastify.get<{ Params: { organizationId: string }; Querystring: { limit?: number; offset?: number } }>(
    '/organizations/:organizationId/members',
    async (
      request: FastifyRequest<{ Params: { organizationId: string }; Querystring: { limit?: number; offset?: number } }>,
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
  fastify.post<{ Params: { boardId: string }; Body: { userId?: string } }>(
    '/boards/:boardId/members',
    async (request: FastifyRequest<{ Params: { boardId: string }; Body: { userId?: string } }>, reply: FastifyReply) => {
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
        })) as Record<string, unknown>;
        const memberPayload = (response['member'] as Record<string, unknown> | undefined) ?? response;

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
    async (
      request: FastifyRequest<{ Querystring: { organizationId?: string; limit?: number; offset?: number } }>,
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
