import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';
import { NotificationServiceClient } from '../../outbound/grpc/notification.client.js';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import {
  getCertificateStatus,
  enrichMvpMetadata,
  getMvpMetadataFromContent,
  productCategory,
} from './documents.routes.js';

const documentClient = new DocumentServiceClient();
const notificationClient = new NotificationServiceClient();
const sentExpiryNotifications = new Set<string>();

interface ProductBody {
  name: string;
  model: string;
  type: string;
  description?: string;
}

function parseContent(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const raw = payload['content_document_json'] ?? payload['contentDocumentJson'] ?? payload['contentDocument'];
  if (!raw) {
    return undefined;
  }
  if (typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function productContent(body: ProductBody): Record<string, unknown> {
  return {
    type: 'doc',
    attrs: {
      product: {
        name: body.name.trim(),
        model: body.model.trim(),
        type: body.type.trim(),
        description: body.description?.trim() ?? '',
      },
    },
    content: [{ type: 'paragraph' }],
  };
}

function mapProduct(payload: Record<string, unknown>) {
  const content = parseContent(payload);
  const attrs = content?.['attrs'];
  const product =
    attrs && typeof attrs === 'object'
      ? (attrs as Record<string, unknown>)['product']
      : undefined;
  const value = product && typeof product === 'object' ? (product as Record<string, unknown>) : {};

  return {
    id: String(payload['id'] ?? ''),
    name: String(value['name'] ?? payload['title'] ?? ''),
    model: String(value['model'] ?? ''),
    type: String(value['type'] ?? ''),
    description: String(value['description'] ?? ''),
  };
}

function linkedToProduct(payload: Record<string, unknown>, productId: string): boolean {
  const metadata = getMvpMetadataFromContent(parseContent(payload));
  return metadata.productId === productId;
}

async function scanCertificateExpiry(actorUserId: string): Promise<number> {
  const response = (await documentClient.searchDocuments({
    actor_user_id: actorUserId,
    limit: 100,
    offset: 0,
  })) as { items?: Array<Record<string, unknown>> };
  let created = 0;
  for (const item of response.items ?? []) {
    const metadata = getMvpMetadataFromContent(parseContent(item));
    if (metadata.documentType !== 'CERTIFICATE') {
      continue;
    }
    const status = getCertificateStatus(metadata.expiryDate);
    if (status !== 'EXPIRING_SOON' && status !== 'EXPIRED') {
      continue;
    }
    const documentId = String(item['id'] ?? '');
    const recipientUserId = String(item['owner_user_id'] ?? item['ownerUserId'] ?? '');
    const notificationKey = `${documentId}:${status}`;
    if (!documentId || !recipientUserId || sentExpiryNotifications.has(notificationKey)) {
      continue;
    }
    await notificationClient.createNotification({
      actor_user_id: actorUserId,
      recipient_user_id: recipientUserId,
      organization_id: 'org-main',
      event_type: status === 'EXPIRED' ? 'certificate.expired' : 'certificate.expiring_soon',
      title: status === 'EXPIRED' ? 'Сертификат истек' : 'Сертификат скоро истекает',
      body: `Сертификат ${metadata.certificateNumber ?? ''} для ${metadata.productName ?? 'изделия'} ${metadata.productModel ?? ''} действует до ${metadata.expiryDate ?? ''}`,
      entity_type: 'DOCUMENT',
      entity_id: documentId,
    });
    sentExpiryNotifications.add(notificationKey);
    created++;
  }
  return created;
}

const productsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const expiryTimer = setInterval(() => {
    scanCertificateExpiry('gateway-user').catch((error: unknown) => {
      fastify.log.warn({ error }, 'certificate expiry scan failed');
    });
  }, 12 * 60 * 60 * 1000);
  fastify.addHook('onClose', async () => clearInterval(expiryTimer));

  fastify.post(
    '/certificates/expiry-check',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('products.manage')],
    },
    async (request) => {
      const created = await scanCertificateExpiry(request.session.auth?.userId ?? 'gateway-user');
      return { created };
    },
  );

  fastify.post<{ Body: ProductBody }>(
    '/',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('products.manage')],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'model', 'type'],
          properties: {
            name: { type: 'string', minLength: 1 },
            model: { type: 'string', minLength: 1 },
            type: { type: 'string', minLength: 1 },
            description: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      if (!body.name.trim() || !body.model.trim() || !body.type.trim()) {
        return reply.code(400).send({ error: 'name, model and type are required' });
      }

      try {
        const response = await documentClient.createDraft({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          title: body.name.trim(),
          category: productCategory,
          content_document_json: JSON.stringify(productContent(body)),
        });
        return reply.code(201).send(mapProduct(response as Record<string, unknown>));
      } catch (error) {
        request.log.error({ error }, 'product create failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );

  fastify.get<{ Querystring: { q?: string } }>(
    '/',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('products.read')],
    },
    async (request, reply) => {
      try {
        const query = request.query.q?.trim().toLowerCase() ?? '';
        const response = (await documentClient.searchDocuments({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          category: productCategory,
          query,
          limit: 100,
          offset: 0,
        })) as { items?: Array<Record<string, unknown>> };
        const items = (response.items ?? []).map(mapProduct).filter((product) =>
          query
            ? `${product.name} ${product.model} ${product.type}`.toLowerCase().includes(query)
            : true,
        );
        return reply.send({ items });
      } catch (error) {
        request.log.error({ error }, 'product list failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );

  fastify.get<{ Params: { productId: string } }>(
    '/:productId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('products.read')],
    },
    async (request, reply) => {
      try {
        const product = (await documentClient.getDocument({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: request.params.productId,
        })) as Record<string, unknown>;
        const documents = (await documentClient.searchDocuments({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          limit: 100,
          offset: 0,
        })) as { items?: Array<Record<string, unknown>> };
        return reply.send({
          ...mapProduct(product),
          documents: (documents.items ?? [])
            .filter((item) => linkedToProduct(item, request.params.productId))
            .map((item) => enrichMvpMetadata(item)),
        });
      } catch (error) {
        request.log.error({ error }, 'product details failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );
};

export default productsRoutes;
