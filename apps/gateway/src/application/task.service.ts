import type { UserProfile } from '@edo/types';
import type { TaskOrchestrationServiceClient } from '../adapters/outbound/grpc/task.client.js';
import { CreateTaskRequest, TaskResponse } from '@edo/types';

export interface UpdateTaskStatusRequest {
  readonly taskId: string;
  readonly status: 'pending' | 'in_review' | 'approved' | 'declined';
  readonly decision?: 'approved' | 'declined';
  readonly decisionComment?: string;
}

export interface UpdateTaskAssigneeRequest {
  readonly taskId: string;
  readonly assigneeId: string;
}

export interface AvailableApproverId {
  readonly userId: string;
  readonly userName: string;
}

export interface AvailableDocumentId {
  readonly documentId: string;
  readonly title: string;
  readonly category: string;
}

const personalTasksAssigneeMarker = '__mine__';

export interface TaskDetailsView {
  readonly board?: {
    readonly id: string;
    readonly organizationId: string;
    readonly name: string;
    readonly description: string;
    readonly membersCount: number;
    readonly tasksCount: number;
  };
  readonly task: TaskResponse;
  readonly members: Array<{
    readonly id: string;
    readonly fullName: string;
    readonly department: string;
    readonly email: string;
  }>;
  readonly currentUserId: string;
  readonly canEdit: boolean;
  readonly canAssign: boolean;
  readonly canMoveToReview: boolean;
  readonly canApprove: boolean;
  readonly canComment: boolean;
}

export class TaskService {
  constructor(private readonly grpcClient: TaskOrchestrationServiceClient) {}

  async createTask(request: CreateTaskRequest, currentUser: UserProfile): Promise<TaskResponse> {
    if (!request.title || request.title.trim().length === 0) {
      throw new Error('Task title is required');
    }

    if (!request.assigneeId || request.assigneeId.trim().length === 0) {
      throw new Error('Task must be assigned to someone');
    }

    if (!request.taskType) {
      throw new Error('Task type is required');
    }

    const attachmentIds = request.attachmentIds ?? [];
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const attachmentId of attachmentIds) {
      if (!uuidPattern.test(attachmentId)) {
        throw new Error(`Invalid attachment document ID: ${attachmentId}`);
      }
    }

    const response = await this.grpcClient.createTask({
      actor_user_id: currentUser.userId,
      board_id: request.boardId,
      title: request.title,
      description: request.description || '',
      assignee_user_id: request.assigneeId,
      approver_user_id: request.approverId || '',
      task_type: request.taskType,
      attachment_document_ids: attachmentIds,
      due_date: request.dueDate?.toISOString() || '',
    });

    return this.mapGrpcResponseToTask(response);
  }

  async updateTaskStatus(
    request: UpdateTaskStatusRequest,
    currentUser: UserProfile,
  ): Promise<TaskResponse> {
    if (!request.taskId || request.taskId.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    if (!request.status) {
      throw new Error('Task status is required');
    }

    const response = await this.grpcClient.updateTaskStatus({
      task_id: request.taskId,
      status: request.status,
      decision: request.decision || '',
      decision_comment: request.decisionComment || '',
      actor_user_id: currentUser.userId,
    });

    return this.mapGrpcResponseToTask(response);
  }

  async updateTaskAssignee(
    request: UpdateTaskAssigneeRequest,
    currentUser: UserProfile,
  ): Promise<TaskResponse> {
    if (!request.taskId.trim()) {
      throw new Error('Task ID is required');
    }
    if (!request.assigneeId.trim()) {
      throw new Error('Assignee ID is required');
    }

    const response = await this.grpcClient.updateTaskAssignee({
      actor_user_id: currentUser.userId,
      task_id: request.taskId,
      assignee_user_id: request.assigneeId,
    });

    return this.mapGrpcResponseToTask(response);
  }

  async getTask(taskId: string): Promise<TaskResponse> {
    if (!taskId || taskId.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    const response = await this.grpcClient.getTaskDetails({ task_id: taskId });
    return this.mapGrpcResponseToTask(response);
  }

  async getTaskDetails(taskId: string, currentUser: UserProfile): Promise<TaskDetailsView> {
    if (!taskId || taskId.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    const response = (await this.grpcClient.getTaskDetails({
      task_id: taskId,
      actor_user_id: currentUser.userId,
    })) as Record<string, unknown>;

    const task = this.mapGrpcResponseToTask(response);
    const membersPayload = Array.isArray(response.members)
      ? (response.members as Array<Record<string, unknown>>)
      : [];
    const members = membersPayload.map((member) => ({
      id: String(member.id || ''),
      fullName: String(member.full_name || member.fullName || ''),
      department: String(member.department || ''),
      email: String(member.email || ''),
    }));

    return {
      board:
        response.board && typeof response.board === 'object'
          ? {
              id: String((response.board as Record<string, unknown>).id || ''),
              organizationId: String(
                (response.board as Record<string, unknown>).organization_id ||
                  (response.board as Record<string, unknown>).organizationId ||
                  '',
              ),
              name: String((response.board as Record<string, unknown>).name || ''),
              description: String((response.board as Record<string, unknown>).description || ''),
              membersCount: Number(
                (response.board as Record<string, unknown>).members_count ||
                  (response.board as Record<string, unknown>).membersCount ||
                  0,
              ),
              tasksCount: Number(
                (response.board as Record<string, unknown>).tasks_count ||
                  (response.board as Record<string, unknown>).tasksCount ||
                  0,
              ),
            }
          : undefined,
      task,
      members,
      currentUserId: currentUser.userId,
      canEdit: Boolean(response.can_edit ?? response.canEdit),
      canAssign: Boolean(response.can_assign ?? response.canAssign),
      canMoveToReview: Boolean(response.can_move_to_review ?? response.canMoveToReview),
      canApprove: Boolean(response.can_approve ?? response.canApprove),
      canComment: Boolean(response.can_comment ?? response.canComment),
    };
  }

  async addTaskAttachments(
    taskId: string,
    boardId: string,
    documentIds: string[],
    currentUser: UserProfile,
  ): Promise<TaskResponse> {
    if (!taskId.trim()) {
      throw new Error('Task ID is required');
    }
    if (!boardId.trim()) {
      throw new Error('Board ID is required');
    }

    const normalizedIds = [...new Set(documentIds.map((id) => id.trim()).filter((id) => id.length > 0))];
    if (normalizedIds.length === 0) {
      throw new Error('At least one document ID is required');
    }

    const availableDocuments = await this.getAvailableDocuments(boardId, currentUser, '', '', 200);
    const documentsById = new Map(availableDocuments.map((item) => [item.documentId, item]));
    const attachments = normalizedIds.map((documentId) => {
      const document = documentsById.get(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} is not available for attachment`);
      }

      return {
        document_id: document.documentId,
        title: document.title,
        category: document.category,
      };
    });

    await this.grpcClient.addTaskAttachments({
      actor_user_id: currentUser.userId,
      task_id: taskId,
      attachments,
    });

    const response = await this.grpcClient.getTaskDetails({
      actor_user_id: currentUser.userId,
      task_id: taskId,
    });

    return this.mapGrpcResponseToTask(response);
  }

  async removeTaskAttachment(
    taskId: string,
    documentId: string,
    currentUser: UserProfile,
  ): Promise<TaskResponse> {
    if (!taskId.trim()) {
      throw new Error('Task ID is required');
    }
    if (!documentId.trim()) {
      throw new Error('Document ID is required');
    }

    const response = await this.grpcClient.removeTaskAttachment({
      actor_user_id: currentUser.userId,
      task_id: taskId,
      document_id: documentId,
    });

    return this.mapGrpcResponseToTask(response);
  }

  async listTasks(
    filters: {
      readonly assigneeId?: string;
      readonly status?: string;
      readonly taskType?: string;
      readonly scope?: 'mine';
    },
    currentUser: UserProfile,
  ): Promise<TaskResponse[]> {
    const statuses = (filters?.status || '')
      .split(',')
      .map((status) => status.trim())
      .filter((status) => status.length > 0);
    const normalizedStatuses = statuses.length > 0 ? statuses : [''];
    const tasksById = new Map<string, TaskResponse>();

    for (const status of normalizedStatuses) {
      const response = (await this.grpcClient.listTasks({
        actor_user_id: currentUser.userId,
        assignee_user_id: filters?.scope === 'mine' ? personalTasksAssigneeMarker : filters?.assigneeId || '',
        status,
        task_type: filters?.taskType || '',
        limit: 200,
      })) as { tasks?: unknown[] };

      if (!Array.isArray(response.tasks)) {
        continue;
      }

      for (const task of response.tasks) {
        const mappedTask = this.mapGrpcResponseToTask(task);
        if (mappedTask.id) {
          tasksById.set(mappedTask.id, mappedTask);
        }
      }
    }

    return [...tasksById.values()];
  }

  async getAvailableApprovers(
    boardId: string,
    currentUser: UserProfile,
    search = '',
    limit = 50,
  ): Promise<AvailableApproverId[]> {
    if (!boardId.trim()) {
      throw new Error('Board ID is required');
    }

    const response = (await this.grpcClient.getAvailableApprovers({
      actor_user_id: currentUser.userId,
      board_id: boardId,
      search,
      limit,
    })) as { items?: Array<Record<string, unknown>> };

    const items = Array.isArray(response.items) ? response.items : [];
    return items.map((item) => ({
      userId: String(item.id || ''),
      userName: String(item.full_name || ''),
    }));
  }

  async getAvailableDocuments(
    boardId: string,
    currentUser?: UserProfile,
    category = '',
    search = '',
    limit = 50,
  ): Promise<AvailableDocumentId[]> {
    if (!boardId.trim()) {
      throw new Error('Board ID is required');
    }

    const response = (await this.grpcClient.getAvailableDocuments({
      actor_user_id: currentUser?.userId || '',
      board_id: boardId,
      category,
      status: 'published',
      search,
      limit,
    })) as { items?: Array<Record<string, unknown>> };

    const items = Array.isArray(response.items) ? response.items : [];
    return items.map((item) => ({
      documentId: String(item.id || ''),
      title: String(item.title || ''),
      category: String(item.category || ''),
    }));
  }

  private mapGrpcResponseToTask(grpcResponse: unknown): TaskResponse {
    const envelope = grpcResponse as Record<string, unknown>;
    const response = (envelope.task as Record<string, unknown> | undefined) ?? envelope;

    return {
      id: String(response.id || ''),
      boardId: response.boardId
        ? String(response.boardId)
        : response.board_id
          ? String(response.board_id)
          : undefined,
      title: String(response.title || ''),
      description: response.description ? String(response.description) : undefined,
      status: (response.status || 'pending') as 'pending' | 'in_review' | 'approved' | 'declined',
      taskType: (response.taskType || response.task_type || 'general') as 'approval' | 'general',
      creatorId: String(response.creatorId || response.creator_user_id || ''),
      creatorName: String(response.creatorName || response.creator_user_name || ''),
      assigneeId: String(response.assigneeId || response.assignee_user_id || ''),
      assigneeName: String(response.assigneeName || response.assignee_user_name || ''),
      approverId: response.approverId
        ? String(response.approverId)
        : response.approver_user_id
          ? String(response.approver_user_id)
          : undefined,
      approverName: response.approverName
        ? String(response.approverName)
        : response.approver_user_name
          ? String(response.approver_user_name)
          : undefined,
      decision: response.decision
        ? (String(response.decision) as 'approved' | 'declined')
        : undefined,
      decisionComment: response.decisionComment
        ? String(response.decisionComment)
        : response.decision_comment
          ? String(response.decision_comment)
          : undefined,
      dueDate: response.dueDate
        ? new Date(String(response.dueDate))
        : response.due_date
          ? new Date(String(response.due_date))
          : undefined,
      attachments: Array.isArray(response.attachments)
        ? response.attachments.map((item) => {
            const attachment = item as Record<string, unknown>;
            return {
              documentId: String(
                attachment.documentId ?? attachment.document_id ?? attachment.id ?? '',
              ),
              title: String(attachment.title ?? ''),
              category: String(attachment.category ?? ''),
              status: String(attachment.status ?? 'DRAFT'),
            };
          })
        : [],
      attachmentIds: Array.isArray(response.attachmentIds)
        ? response.attachmentIds.map((id) => String(id))
        : Array.isArray(response.attachment_document_ids)
          ? response.attachment_document_ids.map((id) => String(id))
          : Array.isArray(response.attachments)
            ? response.attachments
                .map((item) => {
                  const attachment = item as Record<string, unknown>;
                  return attachment.document_id ? String(attachment.document_id) : '';
                })
                .filter((id) => id.length > 0)
            : [],
      createdAt: response.createdAt
        ? new Date(String(response.createdAt))
        : response.created_at
          ? new Date(String(response.created_at))
          : new Date(),
      updatedAt: response.updatedAt
        ? new Date(String(response.updatedAt))
        : response.updated_at
          ? new Date(String(response.updated_at))
          : new Date(),
    };
  }
}
