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
    return reply.code(404).send({ error: 'editor control profile not found' });
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

const editorControlProfilesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: { contextType: string; contextKey: string } }>(
    '/:contextType/:contextKey',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
      schema: {
        params: {
          type: 'object',
          required: ['contextType', 'contextKey'],
          properties: {
            contextType: { type: 'string', minLength: 1 },
            contextKey: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { contextType, contextKey } = request.params;

      try {
        const response = await documentClient.getEditorControlProfile({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          context_type: contextType,
          context_key: contextKey,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service get editor control profile failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.put<{
    Params: { profileId: string };
    Body: { enabledControls: string[]; disabledControls: string[]; isActive: boolean; contextType?: string; contextKey?: string };
  }>(
    '/:profileId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.configure')],
      schema: {
        params: {
          type: 'object',
          required: ['profileId'],
          properties: {
            profileId: { type: 'string', minLength: 1 },
          },
        },
        body: {
          type: 'object',
          required: ['enabledControls', 'disabledControls', 'isActive'],
          properties: {
            enabledControls: { type: 'array', items: { type: 'string' } },
            disabledControls: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            contextType: { type: 'string' },
            contextKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { profileId } = request.params;
      const body = request.body;

      try {
        const response = await documentClient.updateEditorControlProfile({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          profile_id: profileId,
          context_type: body.contextType,
          context_key: body.contextKey,
          enabled_controls: body.enabledControls,
          disabled_controls: body.disabledControls,
          is_active: body.isActive,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service update editor control profile failed');
        return mapGrpcError(reply, error);
      }
    },
  );
};

export default editorControlProfilesRoutes;
