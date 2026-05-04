import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { TaskOrchestrationServiceClient, GrpcClientError } from '../../outbound/grpc/task.client.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';
import type { AuthSession } from '../../../domain/auth.js';

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
          boardId: request.params.boardId,
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
        const availableApprovers =
          (board as Record<string, unknown>)?.members ||
          (board as Record<string, unknown>)?.boardMembers ||
          [];

        // Ensure response includes all required fields
        const response = {
          ...(board as Record<string, unknown>),
          availableApprovers,
          availableDocuments,
        };

        return reply.send(response);
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
        const boards = await grpcClient.listTaskBoards({
          organizationId,
          limit,
          offset,
        });

        return reply.send(boards);
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
