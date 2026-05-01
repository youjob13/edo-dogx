import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';

interface SignatureDto {
  id: string;
  documentId: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  providerRef: string;
}

const signatureStore = new Map<string, SignatureDto>();
const byDocument = new Map<string, string>();

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

      const id = `sig-${Date.now()}`;
      const dto: SignatureDto = {
        id,
        documentId,
        status: 'PENDING',
        providerRef: 'provider-pending',
      };

      signatureStore.set(id, dto);
      byDocument.set(documentId, id);
      return reply.code(202).send(dto);
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

      const signatureId = byDocument.get(documentId);
      if (!signatureId) {
        return reply.code(404).send({ error: 'No signature request found' });
      }

      const dto = signatureStore.get(signatureId);
      if (!dto) {
        return reply.code(404).send({ error: 'Signature request not found' });
      }

      return reply.send(dto);
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
      const dto = signatureStore.get(signatureRequestId);
      if (!dto) {
        return reply.code(404).send({ error: 'Signature request not found' });
      }

      dto.status = status;
      dto.providerRef = providerRef;
      signatureStore.set(dto.id, dto);
      return reply.code(202).send(dto);
    },
  );
};

export default signaturesRoutes;
