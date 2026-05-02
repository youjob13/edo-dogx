import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { AuthSession } from '../../../../domain/auth.js';

const actionRoleMap: Record<string, string[]> = {
  'documents.create': ['edms.user', 'edms.admin'],
  'documents.edit': ['edms.user', 'edms.admin'],
  'documents.read': ['edms.user', 'edms.admin'],
  'documents.configure': ['edms.approver', 'edms.admin'],
  'documents.export': ['edms.user', 'edms.admin'],
  'documents.submit': ['edms.user', 'edms.admin'],
  'documents.approve': ['edms.approver', 'edms.admin'],
  'signatures.start': ['edms.user', 'edms.admin'],
  'signatures.read': ['edms.user', 'edms.admin'],
  'signatures.callback': ['edms.approver', 'edms.admin'],
  'category.read': ['edms.user', 'edms.admin'],
  'category.assign': ['edms.approver', 'edms.admin'],
  'search.read': ['edms.user', 'edms.admin'],
  'notifications.read': ['edms.user', 'edms.admin'],
};

function categoryAllowed(roles: string[], category: string | undefined): boolean {
  if (!category) {
    return true;
  }

  const normalized = category.toUpperCase();
  if (normalized === 'HR') {
    return roles.includes('edms.hr') || roles.includes('edms.admin');
  }
  if (normalized === 'FINANCE') {
    return roles.includes('edms.finance') || roles.includes('edms.admin');
  }

  return true;
}

function getCategoryFromRequest(request: FastifyRequest): string | undefined {
  const queryCategory = (request.query as { category?: string } | undefined)?.category;
  if (typeof queryCategory === 'string') {
    return queryCategory;
  }

  const bodyCategory = (request.body as { category?: string } | undefined)?.category;
  if (typeof bodyCategory === 'string') {
    return bodyCategory;
  }

  return undefined;
}

export function edmsRbacGuard(action: string): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authData = request.session.auth as AuthSession | undefined;
    if (!authData) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const allowedRoles = actionRoleMap[action] ?? ['edms.admin'];
    const hasActionRole = authData.roles.some((role) => allowedRoles.includes(role));
    if (!hasActionRole) {
      await reply.code(403).send({ error: 'Forbidden: insufficient role' });
      return;
    }

    const category = getCategoryFromRequest(request);
    if (!categoryAllowed(authData.roles, category)) {
      await reply.code(403).send({ error: 'Forbidden: category scope denied' });
    }
  };
}
