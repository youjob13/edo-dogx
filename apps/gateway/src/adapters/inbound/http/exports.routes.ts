import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import {
  DocumentServiceClient,
  GrpcClientError,
} from '../../outbound/grpc/document.client.js';

const documentClient = new DocumentServiceClient();

function mapGrpcError(reply: { code: (statusCode: number) => { send: (payload: { error: string; [key: string]: unknown }) => unknown } }, error: unknown) {
  if (!(error instanceof GrpcClientError)) {
    return reply.code(503).send({ error: 'document-service unavailable' });
  }

  if (error.code === 5) {
    return reply.code(404).send({ error: 'export request not found' });
  }

  if (error.code === 10 || error.code === 9) {
    return reply.code(409).send({ error: 'document version conflict' });
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

  return reply.code(503).send({ error: 'document-service unavailable' });
}

const exportsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{
    Params: { documentId: string };
    Body: { format: 'PDF' | 'DOCX'; sourceVersion: number };
  }>(
    '/:documentId/exports',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.export')],
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
          required: ['format', 'sourceVersion'],
          properties: {
            format: { type: 'string', enum: ['PDF', 'DOCX'] },
            sourceVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const { format, sourceVersion } = request.body;

      try {
        const response = await documentClient.createExportRequest({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          format,
          source_version: sourceVersion,
        });
        return reply.code(202).send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service create export request failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{
    Params: { documentId: string; exportRequestId: string };
  }>(
    '/:documentId/exports/:exportRequestId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.export')],
      schema: {
        params: {
          type: 'object',
          required: ['documentId', 'exportRequestId'],
          properties: {
            documentId: { type: 'string', minLength: 1 },
            exportRequestId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId, exportRequestId } = request.params;

      try {
        const response = await documentClient.getExportRequest({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          export_request_id: exportRequestId,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service get export request failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{
    Params: { documentId: string; exportRequestId: string };
  }>(
    '/:documentId/exports/:exportRequestId/download',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.export')],
      schema: {
        params: {
          type: 'object',
          required: ['documentId', 'exportRequestId'],
          properties: {
            documentId: { type: 'string', minLength: 1 },
            exportRequestId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId, exportRequestId } = request.params;

      try {
        const response = await documentClient.downloadExportArtifact({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          export_request_id: exportRequestId,
        }) as { data?: string; file_name?: string; mime_type?: string };

        if (!response?.data) {
          return reply.code(409).send({ error: 'export artifact is not ready' });
        }

        const buffer = Buffer.from(response.data, 'base64');
        reply
          .header('Content-Type', response.mime_type || 'application/octet-stream')
          .header('Content-Disposition', `attachment; filename="${response.file_name || 'export.bin'}"`)
          .send(buffer);
      } catch (error) {
        request.log.error({ error }, 'document-service download export artifact failed');
        return mapGrpcError(reply, error);
      }
    },
  );
};

export default exportsRoutes;
