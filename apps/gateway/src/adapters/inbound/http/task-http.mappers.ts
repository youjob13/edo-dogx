export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
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

export function pickString(source: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return fallback;
}

function pickDateString(source: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
  }
  return fallback;
}

export function mapBoardSummary(board: Record<string, unknown>) {
  return {
    id: asString(board['id']),
    organizationId: asString(board['organization_id']),
    name: asString(board['name']),
    description: asString(board['description']),
    membersCount: asNumber(board['members_count']),
    tasksCount: asNumber(board['tasks_count']),
  };
}

export function mapBoardMember(member: Record<string, unknown>) {
  return {
    id: pickString(member, ['id']),
    fullName: pickString(member, ['full_name', 'fullName']),
    department: pickString(member, ['department']),
    email: pickString(member, ['email']),
    boardRole: pickString(member, ['board_role', 'boardRole'], 'MEMBER'),
    roles: Array.isArray(member['roles']) ? member['roles'].map((role) => String(role)) : [],
  };
}

export function mapTaskAttachment(attachment: Record<string, unknown>) {
  return {
    documentId: pickString(attachment, ['document_id', 'documentId', 'id']),
    title: pickString(attachment, ['title']),
    category: pickString(attachment, ['category']),
    status: pickString(attachment, ['status'], 'DRAFT'),
  };
}

export function mapTaskComment(comment: Record<string, unknown>) {
  return {
    id: pickString(comment, ['id']),
    authorId: pickString(comment, ['author_id', 'authorId', 'actor_user_id', 'actorUserId']),
    authorName: pickString(
      comment,
      ['author_name', 'authorName', 'actor_user_name', 'actorUserName', 'title'],
      'Система',
    ),
    text: pickString(comment, ['text', 'body', 'summary']),
    createdAtLabel: pickDateString(comment, [
      'created_at',
      'createdAt',
      'createdAtLabel',
      'occurred_at',
      'occurredAt',
    ]),
  };
}

export function mapKanbanTask(
  task: Record<string, unknown>,
  membersById: Map<string, { fullName: string; department: string }>,
  options?: {
    comments?: Array<Record<string, unknown>>;
    capabilities?: {
      canEdit: boolean;
      canAssign: boolean;
      canMoveToReview: boolean;
      canApprove: boolean;
      canComment: boolean;
    };
  },
) {
  const assigneeId = pickString(task, ['assignee_user_id', 'assigneeUserId', 'assigneeId']);
  const assignee = membersById.get(assigneeId);
  const rawTaskType = pickString(task, ['task_type', 'taskType'], 'general').toLowerCase();
  const rawStatus = pickString(task, ['status'], 'PENDING').toUpperCase();
  const statusMap: Record<string, 'pending' | 'in_review' | 'approved' | 'declined'> = {
    PENDING: 'pending',
    IN_REVIEW: 'in_review',
    APPROVED: 'approved',
    DECLINED: 'declined',
  };
  const status = statusMap[rawStatus] ?? 'pending';
  const dueDate = pickDateString(task, ['due_date', 'dueDate']);

  return {
    id: pickString(task, ['id']),
    title: pickString(task, ['title']),
    description: pickString(task, ['description']),
    status,
    assigneeId: assigneeId || null,
    assigneeName: pickString(
      task,
      ['assignee_user_name', 'assigneeUserName', 'assigneeName'],
      assignee?.fullName || 'Не назначен',
    ),
    department: assignee?.department || '',
    groupId: assigneeId || 'unassigned',
    groupName: assignee?.fullName || 'Не назначен',
    dueDateLabel: dueDate || 'Без срока',
    dueDate: dueDate || undefined,
    comments: Array.isArray(options?.comments) ? options.comments.map(mapTaskComment) : [],
    creatorId: pickString(task, ['creator_user_id', 'creatorUserId', 'creatorId']),
    creatorName: pickString(task, ['creator_user_name', 'creatorUserName', 'creatorName']),
    attachments: Array.isArray(task['attachments'])
      ? (task['attachments'] as Array<Record<string, unknown>>).map(mapTaskAttachment)
      : [],
    approverId: pickString(task, ['approver_user_id', 'approverUserId', 'approverId']) || undefined,
    approverName:
      pickString(task, ['approver_user_name', 'approverUserName', 'approverName']) || undefined,
    taskType: rawTaskType === 'approval' ? 'approval' : 'general',
    decision:
      pickString(task, ['decision']) === 'approved' || pickString(task, ['decision']) === 'declined'
        ? pickString(task, ['decision'])
        : undefined,
    decisionComment: pickString(task, ['decision_comment', 'decisionComment']) || undefined,
    createdAt: pickDateString(task, ['created_at', 'createdAt']),
    updatedAt: pickDateString(task, ['updated_at', 'updatedAt']),
    capabilities: options?.capabilities,
  };
}
