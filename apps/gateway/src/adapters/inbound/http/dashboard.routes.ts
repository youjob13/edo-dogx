import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { edmsRbacGuard } from './middleware/edms-rbac.guard.js';
import { DocumentServiceClient } from '../../outbound/grpc/document.client.js';

const documentClient = new DocumentServiceClient();
const TERA_BYTES = 1_000_000_000_000;
const DEFAULT_TOTAL_STORAGE_TB = 1.5;

type WeeklyVolumeDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface DocumentRecord {
  updated_at?: string;
  content_document_json?: string;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return fallback;
}

function toWeekdayLabel(value: string): WeeklyVolumeDay | null {
  const date = new Date(value);
  const day = date.getUTCDay();
  const map: Array<WeeklyVolumeDay> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return Number.isFinite(day) ? (map[day] ?? null) : null;
}

function computeWeeklyVolume(items: Array<DocumentRecord>): Array<{ day: WeeklyVolumeDay; value: number }> {
  const counts: Record<WeeklyVolumeDay, number> = {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  };

  for (const item of items) {
    if (!item.updated_at) {
      continue;
    }

    const day = toWeekdayLabel(item.updated_at);
    if (!day) {
      continue;
    }
    counts[day] += 1;
  }

  return (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as Array<WeeklyVolumeDay>).map((day) => ({
    day,
    value: counts[day],
  }));
}

function computeStorage(items: Array<DocumentRecord>): { usedTb: number; totalTb: number; usedPercent: number } {
  let usedBytes = 0;

  for (const item of items) {
    const payload = item.content_document_json;
    if (typeof payload !== 'string') {
      continue;
    }

    usedBytes += Buffer.byteLength(payload, 'utf8');
  }

  const totalTbFromEnv = Number(process.env['DASHBOARD_STORAGE_TOTAL_TB'] ?? '');
  const totalTb = Number.isFinite(totalTbFromEnv) && totalTbFromEnv > 0 ? totalTbFromEnv : DEFAULT_TOTAL_STORAGE_TB;
  const usedTb = usedBytes / TERA_BYTES;
  const usedPercent = Math.min(100, Math.max(0, Math.round((usedTb / totalTb) * 100)));

  return {
    usedTb: Number(usedTb.toFixed(4)),
    totalTb,
    usedPercent,
  };
}

async function loadDocumentsForDashboard(
  actorUserId: string,
  category: string | undefined,
): Promise<Array<DocumentRecord>> {
  const pageSize = 100;
  const firstResponse = (await documentClient.searchDocuments({
    actor_user_id: actorUserId,
    query: '',
    category,
    limit: pageSize,
    offset: 0,
  })) as { items?: Array<DocumentRecord>; total?: number };

  const firstItems = Array.isArray(firstResponse.items) ? firstResponse.items : [];
  const total = parsePositiveInt(firstResponse.total, firstItems.length);
  if (firstItems.length >= total) {
    return firstItems;
  }

  const all = [...firstItems];
  let offset = firstItems.length;
  while (offset < total && offset < 1000) {
    const nextResponse = (await documentClient.searchDocuments({
      actor_user_id: actorUserId,
      query: '',
      category,
      limit: pageSize,
      offset,
    })) as { items?: Array<DocumentRecord> };
    const items = Array.isArray(nextResponse.items) ? nextResponse.items : [];
    if (items.length === 0) {
      break;
    }
    all.push(...items);
    offset += items.length;
  }

  return all;
}

const dashboardRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{
    Querystring: {
      category?: string;
    };
  }>(
    '/dashboard/weekly-volume',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
    },
    async (request, reply) => {
      try {
        const items = await loadDocumentsForDashboard(
          request.session.auth?.userId ?? 'gateway-user',
          request.query.category,
        );
        return reply.send(computeWeeklyVolume(items));
      } catch (error) {
        request.log.error({ error }, 'document-service dashboard weekly-volume failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );

  fastify.get<{
    Querystring: {
      category?: string;
    };
  }>(
    '/dashboard/storage',
    {
      preHandler: [fastify.authenticate, edmsRbacGuard('documents.read')],
    },
    async (request, reply) => {
      try {
        const items = await loadDocumentsForDashboard(
          request.session.auth?.userId ?? 'gateway-user',
          request.query.category,
        );
        return reply.send(computeStorage(items));
      } catch (error) {
        request.log.error({ error }, 'document-service dashboard storage failed');
        return reply.code(503).send({ error: 'document-service unavailable' });
      }
    },
  );
};

export default dashboardRoutes;
