import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { SignatureServiceClient } from '../../outbound/grpc/signature.client.js';

const signatureClient = new SignatureServiceClient();

const signaturesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{
    Params: { documentId: string };
    Body: { signers: Array<{ userId: string; dueAt?: string }> };
  }>(
    '/:documentId/signatures',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('signatures.start')],
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
          required: ['signers'],
          properties: {
            signers: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['userId'],
                properties: {
                  userId: { type: 'string', minLength: 1 },
                  dueAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }
      if (!Array.isArray(request.body.signers) || request.body.signers.length === 0) {
        return reply.code(400).send({ error: 'at least one signer is required' });
      }

      try {
        const response = await signatureClient.startSignature({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          signers: request.body.signers.map((signer) => ({
            user_id: signer.userId,
            due_at: signer.dueAt,
          })),
        });
        return reply.code(202).send(response);
      } catch (error) {
        request.log.error({ error }, 'signature-service start signature failed');
        return reply.code(503).send({ error: 'signature-service unavailable' });
      }
    },
  );

  fastify.get<{ Params: { documentId: string } }>(
    '/:documentId/signatures/status',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('signatures.read')],
      schema: {
        params: {
          type: 'object',
          required: ['documentId'],
          properties: {
            documentId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }

      try {
        const response = await signatureClient.getSignatureStatus({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'signature-service get status failed');
        return reply.code(503).send({ error: 'signature-service unavailable' });
      }
    },
  );

  fastify.post<{
    Params: { signatureRequestId: string };
    Body: { status: 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'EXPIRED'; providerRef: string };
  }>(
    '/signatures/:signatureRequestId/callback',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('signatures.callback')],
      schema: {
        params: {
          type: 'object',
          required: ['signatureRequestId'],
          properties: {
            signatureRequestId: { type: 'string', minLength: 1 },
          },
        },
        body: {
          type: 'object',
          required: ['status', 'providerRef'],
          properties: {
            status: { type: 'string' },
            providerRef: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { signatureRequestId } = request.params;
      const { status, providerRef } = request.body;
      try {
        const response = await signatureClient.recordSignatureCallback({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          signature_request_id: signatureRequestId,
          status,
          provider_ref: providerRef,
        });
        return reply.code(202).send(response);
      } catch (error) {
        request.log.error({ error }, 'signature-service callback failed');
        return reply.code(503).send({ error: 'signature-service unavailable' });
      }
    },
  );
};

export default signaturesRoutes;
