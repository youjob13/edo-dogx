import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import {
  DocumentServiceClient,
  GrpcClientError,
} from '../../outbound/grpc/document.client.js';
import { NotificationServiceClient } from '../../outbound/grpc/notification.client.js';
import { notificationSseHub } from './notifications.sse-hub.js';

const documentClient = new DocumentServiceClient();
const notificationClient = new NotificationServiceClient();
const personalDocumentsCategoryMarker = '__mine__';
export const productCategory = 'PRODUCT';
export const mvpMetaKey = 'edoMvp';
export type MvpDocumentType = 'GENERAL' | 'PRODUCT_PASSPORT' | 'CERTIFICATE';

interface DocumentCapabilities {
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canRequestChanges: boolean;
  canArchive: boolean;
};

export interface MvpDocumentMetadata {
  documentType: MvpDocumentType;
  productId?: string;
  productName?: string;
  productModel?: string;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
}

interface DocumentPayloadWithMvp {
  documentType?: MvpDocumentType;
  productId?: string;
  productName?: string;
  productModel?: string;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  contentDocument?: Record<string, unknown>;
}

type SessionAuthView = { userId?: string; fullName?: string; roles?: string[] } | undefined;

function actorIsAdmin(auth: SessionAuthView): boolean {
  return Array.isArray(auth?.roles) && auth.roles.includes('edms.admin');
}

function isEditableDocumentStatus(status: string | undefined): boolean {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED';
}

function pickStringValue(
  payload: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return undefined;
}

function enrichDocumentCapabilities<T extends Record<string, unknown>>(
  payload: T,
  auth: SessionAuthView,
): T & DocumentCapabilities {
  const status = pickStringValue(payload, ['status']) ?? 'DRAFT';
  const ownerUserId = pickStringValue(payload, ['owner_user_id', 'ownerUserId']);
  const isOwner = Boolean(auth?.userId) && ownerUserId === auth?.userId;
  const isAdmin = actorIsAdmin(auth);
  const editable = isEditableDocumentStatus(status) && (isOwner || isAdmin);
  const archivable = status === 'APPROVED' && (isOwner || isAdmin);

  return {
    ...payload,
    canEdit: editable,
    canSubmit: editable,
    canApprove: false,
    canRequestChanges: false,
    canArchive: archivable,
  };
}

function enrichWorkflowCapabilities<T extends Record<string, unknown>>(
  payload: T,
  auth: SessionAuthView,
): T & DocumentCapabilities {
  const status = pickStringValue(payload, ['status']) ?? 'DRAFT';
  const approverUserId = pickStringValue(payload, [
    'approver_user_id',
    'approverUserId',
    'assigned_user_id',
    'assignedUserId',
  ]);
  const submittedByUserId = pickStringValue(payload, ['submitted_by_user_id', 'submittedByUserId']);
  const isAdmin = actorIsAdmin(auth);
  const isSubmitter = Boolean(auth?.userId) && submittedByUserId === auth?.userId;
  const canApprove = status === 'IN_REVIEW' && ((Boolean(auth?.userId) && approverUserId === auth?.userId) || isAdmin);
  const canEdit = isEditableDocumentStatus(status) && (isSubmitter || isAdmin);
  const canArchive = status === 'APPROVED' && (isSubmitter || isAdmin);

  return {
    ...payload,
    canEdit,
    canSubmit: canEdit,
    canApprove,
    canRequestChanges: canApprove,
    canArchive,
  };
}

function enrichOwnerNameWithSession<T extends Record<string, unknown>>(
  payload: T,
  auth: { userId?: string; fullName?: string } | undefined,
): T {
  const userId = auth?.userId;
  const fullName = auth?.fullName?.trim();
  if (!userId || !fullName) {
    return payload;
  }

  const ownerUserId = payload['owner_user_id'];
  const ownerUserName = payload['owner_user_name'];
  if (typeof ownerUserId !== 'string' || ownerUserId !== userId) {
    return payload;
  }

  if (typeof ownerUserName !== 'string' || ownerUserName.trim() === '' || ownerUserName === ownerUserId) {
    return {
      ...payload,
      owner_user_name: fullName,
    };
  }

  return payload;
}

function enrichSearchOwnerNames(
  payload: Record<string, unknown>,
  auth: { userId?: string; fullName?: string } | undefined,
): Record<string, unknown> {
  const items = payload['items'];
  if (!Array.isArray(items)) {
    return payload;
  }

  return {
    ...payload,
    items: items.map((item) =>
      item && typeof item === 'object'
        ? enrichOwnerNameWithSession(item as Record<string, unknown>, auth)
        : item,
    ),
  };
}

function parseContentDocument(payload: Record<string, unknown>): Record<string, unknown> | undefined {
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

export function getMvpMetadataFromContent(contentDocument: Record<string, unknown> | undefined): MvpDocumentMetadata {
  const attrs = contentDocument?.['attrs'];
  const meta =
    attrs && typeof attrs === 'object'
      ? (attrs as Record<string, unknown>)[mvpMetaKey]
      : undefined;
  const value = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
  const rawType = typeof value['documentType'] === 'string' ? value['documentType'] : 'GENERAL';
  const documentType: MvpDocumentType =
    rawType === 'PRODUCT_PASSPORT' || rawType === 'CERTIFICATE' ? rawType : 'GENERAL';

  return {
    documentType,
    productId: typeof value['productId'] === 'string' ? value['productId'] : undefined,
    productName: typeof value['productName'] === 'string' ? value['productName'] : undefined,
    productModel: typeof value['productModel'] === 'string' ? value['productModel'] : undefined,
    certificateNumber:
      typeof value['certificateNumber'] === 'string' ? value['certificateNumber'] : undefined,
    issueDate: typeof value['issueDate'] === 'string' ? value['issueDate'] : undefined,
    expiryDate: typeof value['expiryDate'] === 'string' ? value['expiryDate'] : undefined,
  };
}

export function getCertificateStatus(expiryDate: string | undefined): string | undefined {
  if (!expiryDate) {
    return undefined;
  }
  const expiry = new Date(`${expiryDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(expiry)) {
    return undefined;
  }
  const now = Date.now();
  if (expiry < now) {
    return 'EXPIRED';
  }
  const daysLeft = Math.ceil((expiry - now) / 86_400_000);
  return daysLeft <= 30 ? 'EXPIRING_SOON' : 'VALID';
}

export function mergeMvpMetadata(
  contentDocument: Record<string, unknown> | undefined,
  metadata: MvpDocumentMetadata,
): Record<string, unknown> {
  const base = contentDocument ?? { type: 'doc', content: [{ type: 'paragraph' }] };
  const attrs = base['attrs'] && typeof base['attrs'] === 'object'
    ? { ...(base['attrs'] as Record<string, unknown>) }
    : {};
  return {
    ...base,
    attrs: {
      ...attrs,
      [mvpMetaKey]: metadata,
    },
  };
}

function normalizeMvpDocumentPayload(body: DocumentPayloadWithMvp): { contentDocument?: Record<string, unknown>; error?: string } {
  const documentType = body.documentType ?? getMvpMetadataFromContent(body.contentDocument).documentType;
  const metadata: MvpDocumentMetadata = {
    ...getMvpMetadataFromContent(body.contentDocument),
    documentType,
    productId: body.productId?.trim() || getMvpMetadataFromContent(body.contentDocument).productId,
    productName: body.productName?.trim() || getMvpMetadataFromContent(body.contentDocument).productName,
    productModel: body.productModel?.trim() || getMvpMetadataFromContent(body.contentDocument).productModel,
    certificateNumber:
      body.certificateNumber?.trim() || getMvpMetadataFromContent(body.contentDocument).certificateNumber,
    issueDate: body.issueDate?.trim() || getMvpMetadataFromContent(body.contentDocument).issueDate,
    expiryDate: body.expiryDate?.trim() || getMvpMetadataFromContent(body.contentDocument).expiryDate,
  };

  if ((documentType === 'PRODUCT_PASSPORT' || documentType === 'CERTIFICATE') && !metadata.productId) {
    return { error: 'productId is required for product passports and certificates' };
  }
  if (documentType === 'CERTIFICATE') {
    if (!metadata.certificateNumber) {
      return { error: 'certificateNumber is required for certificates' };
    }
    if (!metadata.issueDate) {
      return { error: 'issueDate is required for certificates' };
    }
    if (!metadata.expiryDate) {
      return { error: 'expiryDate is required for certificates' };
    }
  }

  return { contentDocument: mergeMvpMetadata(body.contentDocument, metadata) };
}

export function enrichMvpMetadata<T extends Record<string, unknown>>(payload: T): T {
  const content = parseContentDocument(payload);
  const metadata = getMvpMetadataFromContent(content);
  const certificateStatus =
    metadata.documentType === 'CERTIFICATE' ? getCertificateStatus(metadata.expiryDate) : undefined;

  return {
    ...payload,
    documentType: metadata.documentType,
    productId: metadata.productId,
    productName: metadata.productName,
    productModel: metadata.productModel,
    certificateNumber: metadata.certificateNumber,
    issueDate: metadata.issueDate,
    expiryDate: metadata.expiryDate,
    certificateStatus,
  };
}

function pickWorkflowUserId(payload: unknown, keys: string[]): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  return pickStringValue(payload as Record<string, unknown>, keys);
}

async function createWorkflowNotification(
  actorUserId: string,
  recipientUserId: string | undefined,
  eventType: string,
  title: string,
  body: string,
  documentId: string,
  fallbackTitle: string,
) {
  if (!recipientUserId) {
    return;
  }

  const created = (await notificationClient.createNotification({
    actor_user_id: actorUserId,
    recipient_user_id: recipientUserId,
    organization_id: 'org-main',
    event_type: eventType,
    title,
    body,
    entity_type: 'DOCUMENT',
    entity_id: documentId,
  })) as { item?: Record<string, unknown> };

  notificationSseHub.publish(recipientUserId, {
    type: 'notification',
    payload: {
      notificationId: String(created.item?.['id'] ?? ''),
      title: String(created.item?.['title'] ?? fallbackTitle),
      body: String(created.item?.['body'] ?? ''),
      entityType: 'DOCUMENT',
      entityId: documentId,
    },
  });
}

function toContentDocumentJSON(contentDocument: Record<string, unknown> | undefined): string | undefined {
  if (contentDocument === undefined) {
    return undefined;
  }

  return JSON.stringify(contentDocument);
}

function mapGrpcError(reply: { code: (statusCode: number) => { send: (payload: { error: string; [key: string]: unknown }) => unknown } }, error: unknown) {
  if (!(error instanceof GrpcClientError)) {
    return reply.code(503).send({ error: 'document-service unavailable' });
  }

  if (error.code === 5) {
    return reply.code(404).send({ error: 'document not found' });
  }

  if (error.code === 10 || error.code === 9) {
    const expectedMatch = /expected=(\d+)/i.exec(error.message);
    const currentMatch = /current=(\d+)/i.exec(error.message);
    return reply.code(409).send({
      error: 'document version conflict',
      code: 'VERSION_CONFLICT',
      expectedVersion: expectedMatch ? Number(expectedMatch[1]) : null,
      currentVersion: currentMatch ? Number(currentMatch[1]) : null,
    });
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

const documentsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{ Body: { title: string; category: string } & DocumentPayloadWithMvp }>(
    '/',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.create')],
      schema: {
        body: {
          type: 'object',
          required: ['title', 'category'],
          properties: {
            title: { type: 'string', minLength: 1 },
            category: { type: 'string', minLength: 1 },
            documentType: { type: 'string' },
            productId: { type: 'string' },
            productName: { type: 'string' },
            productModel: { type: 'string' },
            certificateNumber: { type: 'string' },
            issueDate: { type: 'string' },
            expiryDate: { type: 'string' },
            contentDocument: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { title, category, contentDocument } = request.body;
      if (typeof title !== 'string' || title.trim() === '') {
        return reply.code(400).send({ error: 'title is required' });
      }
      if (typeof category !== 'string' || category.trim() === '') {
        return reply.code(400).send({ error: 'category is required' });
      }

      try {
        const normalized = normalizeMvpDocumentPayload(request.body);
        if (normalized.error) {
          return reply.code(400).send({ error: normalized.error });
        }
        const contentDocumentJSON = toContentDocumentJSON(normalized.contentDocument ?? contentDocument);
        const response = await documentClient.createDraft({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          title: title.trim(),
          category: category.trim(),
          content_document_json: contentDocumentJSON,
        });
        return reply.code(201).send(
          response && typeof response === 'object'
            ? enrichDocumentCapabilities(
                enrichMvpMetadata(enrichOwnerNameWithSession(response as Record<string, unknown>, request.session.auth)),
                request.session.auth,
              )
            : response,
        );
      } catch (error) {
        request.log.error({ error }, 'document-service create draft failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.patch<{
    Params: { documentId: string };
    Body: { title: string; expectedVersion: number } & DocumentPayloadWithMvp;
  }>(
    '/:documentId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.edit')],
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
          required: ['title', 'expectedVersion'],
          properties: {
            title: { type: 'string', minLength: 1 },
            expectedVersion: { type: 'integer', minimum: 1 },
            documentType: { type: 'string' },
            productId: { type: 'string' },
            productName: { type: 'string' },
            productModel: { type: 'string' },
            certificateNumber: { type: 'string' },
            issueDate: { type: 'string' },
            expiryDate: { type: 'string' },
            contentDocument: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const { title, expectedVersion, contentDocument } = request.body;

      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }
      if (typeof title !== 'string' || title.trim() === '') {
        return reply.code(400).send({ error: 'title is required' });
      }
      if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
        return reply.code(400).send({ error: 'expectedVersion must be a positive integer' });
      }

      try {
        const normalized = normalizeMvpDocumentPayload(request.body);
        if (normalized.error) {
          return reply.code(400).send({ error: normalized.error });
        }
        const contentDocumentJSON = toContentDocumentJSON(normalized.contentDocument ?? contentDocument);
        const response = await documentClient.updateDraft({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          title: title.trim(),
          content_document_json: contentDocumentJSON,
          expected_version: expectedVersion,
        });
        return reply.send(
          response && typeof response === 'object'
            ? enrichDocumentCapabilities(
                enrichMvpMetadata(enrichOwnerNameWithSession(response as Record<string, unknown>, request.session.auth)),
                request.session.auth,
              )
            : response,
        );
      } catch (error) {
        request.log.error({ error }, 'document-service update draft failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{ Params: { documentId: string } }>(
    '/:documentId',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
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
        const response = await documentClient.getDocument({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
        });
        return reply.send(
          response && typeof response === 'object'
            ? enrichDocumentCapabilities(
                enrichMvpMetadata(enrichOwnerNameWithSession(response as Record<string, unknown>, request.session.auth)),
                request.session.auth,
              )
            : response,
        );
      } catch (error) {
        request.log.error({ error }, 'document-service get document failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{
    Querystring: {
      q?: string;
      category?: string;
      documentType?: string;
      scope?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            category: { type: 'string' },
            documentType: { type: 'string' },
            scope: { type: 'string', enum: ['mine'] },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = typeof request.query.q === 'string' ? request.query.q : undefined;
      const category =
        typeof request.query.category === 'string' ? request.query.category : undefined;
      const personalOnly = request.query.scope === 'mine';
      const documentType =
        typeof request.query.documentType === 'string' ? request.query.documentType : undefined;
      const grpcCategory = personalOnly
        ? category
          ? `${personalDocumentsCategoryMarker}:${category}`
          : personalDocumentsCategoryMarker
        : category;
      const limit =
        typeof request.query.limit === 'number' && request.query.limit > 0
          ? Math.min(request.query.limit, 100)
          : 20;
      const offset =
        typeof request.query.offset === 'number' && request.query.offset >= 0
          ? request.query.offset
          : 0;

      try {
        const response = await documentClient.searchDocuments({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          query: q,
          category: grpcCategory,
          limit,
          offset,
        });
        if (!response || typeof response !== 'object') {
          return reply.send(response);
        }

        const payload = enrichSearchOwnerNames(response as Record<string, unknown>, request.session.auth);
        const items = Array.isArray(payload['items'])
          ? payload['items']
              .map((item) =>
                item && typeof item === 'object'
                  ? enrichDocumentCapabilities(
                      enrichMvpMetadata(item as Record<string, unknown>),
                      request.session.auth,
                    )
                  : item,
              )
              .filter((item) =>
                documentType && item && typeof item === 'object'
                  ? (item as Record<string, unknown>)['documentType'] === documentType
                  : true,
              )
              .filter((item) =>
                category === productCategory || !item || typeof item !== 'object'
                  ? true
                  : (item as Record<string, unknown>)['category'] !== productCategory,
              )
          : payload['items'];

        return reply.send({
          ...payload,
          items,
        });
      } catch (error) {
        request.log.error({ error }, 'document-service search failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{ Params: { documentId: string }; Querystring: { limit?: number; offset?: number } }>(
    '/:documentId/versions',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
    },
    async (request, reply) => {
      try {
        const response = await documentClient.listDocumentVersions({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: request.params.documentId,
          limit: request.query.limit ?? 20,
          offset: request.query.offset ?? 0,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service list versions failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{ Params: { documentId: string; versionNumber: string } }>(
    '/:documentId/versions/:versionNumber',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
    },
    async (request, reply) => {
      try {
        const response = await documentClient.getDocumentVersion({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: request.params.documentId,
          version_number: Number(request.params.versionNumber),
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service get version failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.post<{ Params: { documentId: string }; Body: { approverUserId: string; expectedVersion: number } }>(
    '/:documentId/workflow/submit',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.submit')],
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
          required: ['approverUserId', 'expectedVersion'],
          properties: {
            approverUserId: { type: 'string', minLength: 1 },
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const { approverUserId, expectedVersion } = request.body;
      const actorUserId = request.session.auth?.userId ?? 'gateway-user';
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }
      if (typeof approverUserId !== 'string' || approverUserId.trim() === '') {
        return reply.code(400).send({ error: 'approverUserId is required' });
      }
      if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
        return reply.code(400).send({ error: 'expectedVersion must be a positive integer' });
      }

      try {
        const response = await documentClient.submitWorkflow({
          actor_user_id: actorUserId,
          document_id: documentId,
          approver_user_id: approverUserId.trim(),
          expected_version: expectedVersion,
        });
        try {
          const recipientUserId =
            pickWorkflowUserId(response, ['approver_user_id', 'approverUserId', 'assigned_user_id', 'assignedUserId']) ??
            approverUserId.trim();
          await createWorkflowNotification(
            actorUserId,
            recipientUserId,
            'document.submitted',
            'Документ отправлен на согласование',
            `Документ ${documentId} отправлен на согласование`,
            documentId,
            'Документ отправлен на согласование',
          );
        } catch (error) {
          request.log.warn({ error }, 'failed to create document submitted notification');
        }
        return reply.code(202).send(
          response && typeof response === 'object'
            ? enrichWorkflowCapabilities(response as Record<string, unknown>, request.session.auth)
            : response,
        );
      } catch (error) {
        request.log.error({ error }, 'document-service submit workflow failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.post<{ Params: { documentId: string }; Body: { expectedVersion: number } }>(
    '/:documentId/workflow/approve',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.approve')],
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
          required: ['expectedVersion'],
          properties: {
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const { expectedVersion } = request.body;
      const actorUserId = request.session.auth?.userId ?? 'gateway-user';
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }
      if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
        return reply.code(400).send({ error: 'expectedVersion must be a positive integer' });
      }

      try {
        const response = await documentClient.approveWorkflow({
          actor_user_id: actorUserId,
          document_id: documentId,
          expected_version: expectedVersion,
        });
        try {
          const recipientUserId = pickWorkflowUserId(response, ['submitted_by_user_id', 'submittedByUserId']);
          await createWorkflowNotification(
            actorUserId,
            recipientUserId,
            'document.approved',
            'Документ согласован',
            `Документ ${documentId} согласован`,
            documentId,
            'Документ согласован',
          );
        } catch (error) {
          request.log.warn({ error }, 'failed to create document approved notification');
        }
        return reply.code(202).send(
          response && typeof response === 'object'
            ? enrichWorkflowCapabilities(response as Record<string, unknown>, request.session.auth)
            : response,
        );
      } catch (error) {
        request.log.error({ error }, 'document-service approve workflow failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.post<{ Params: { documentId: string }; Body: { comment: string; expectedVersion: number } }>(
    '/:documentId/workflow/request-changes',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.approve')],
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
          required: ['comment', 'expectedVersion'],
          properties: {
            comment: { type: 'string', minLength: 1 },
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const { comment, expectedVersion } = request.body;
      const actorUserId = request.session.auth?.userId ?? 'gateway-user';
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }
      if (typeof comment !== 'string' || comment.trim() === '') {
        return reply.code(400).send({ error: 'comment is required' });
      }
      if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
        return reply.code(400).send({ error: 'expectedVersion must be a positive integer' });
      }

      try {
        const response = await documentClient.requestWorkflowChanges({
          actor_user_id: actorUserId,
          document_id: documentId,
          comment: comment.trim(),
          expected_version: expectedVersion,
        });
        try {
          const recipientUserId = pickWorkflowUserId(response, ['submitted_by_user_id', 'submittedByUserId']);
          await createWorkflowNotification(
            actorUserId,
            recipientUserId,
            'document.changes_requested',
            'Нужны изменения по документу',
            `По документу ${documentId} запрошены изменения`,
            documentId,
            'Нужны изменения по документу',
          );
        } catch (error) {
          request.log.warn({ error }, 'failed to create document changes requested notification');
        }
        return reply.code(202).send(
          response && typeof response === 'object'
            ? enrichWorkflowCapabilities(response as Record<string, unknown>, request.session.auth)
            : response,
        );
      } catch (error) {
        request.log.error({ error }, 'document-service request workflow changes failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.post<{ Params: { documentId: string }; Body: { expectedVersion: number } }>(
    '/:documentId/archive',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.archive')],
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
          required: ['expectedVersion'],
          properties: {
            expectedVersion: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const { expectedVersion } = request.body;
      if (typeof documentId !== 'string' || documentId.trim() === '') {
        return reply.code(400).send({ error: 'documentId is required' });
      }
      if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
        return reply.code(400).send({ error: 'expectedVersion must be a positive integer' });
      }

      try {
        const response = await documentClient.archiveDocument({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          expected_version: expectedVersion,
        });
        return reply.code(202).send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service archive document failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{ Params: { documentId: string } }>(
    '/:documentId/workflow',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
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
        const response = await documentClient.getWorkflow({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
        });
        return reply.send(
          response && typeof response === 'object'
            ? enrichWorkflowCapabilities(response as Record<string, unknown>, request.session.auth)
            : response,
        );
      } catch (error) {
        request.log.error({ error }, 'document-service get workflow failed');
        return mapGrpcError(reply, error);
      }
    },
  );

  fastify.get<{ Params: { documentId: string }; Querystring: { limit?: number; offset?: number } }>(
    '/:documentId/workflow/events',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
      schema: {
        params: {
          type: 'object',
          required: ['documentId'],
          properties: {
            documentId: { type: 'string', minLength: 1 },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
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
        const response = await documentClient.listWorkflowEvents({
          actor_user_id: request.session.auth?.userId ?? 'gateway-user',
          document_id: documentId,
          limit: request.query.limit ?? 20,
          offset: request.query.offset ?? 0,
        });
        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'document-service list workflow events failed');
        return mapGrpcError(reply, error);
      }
    },
  );
};

export default documentsRoutes;
