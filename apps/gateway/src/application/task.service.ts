import type { UserProfile } from '@edo/types';
import type { TaskOrchestrationServiceClient } from '../adapters/outbound/grpc/task.client.js';
import { CreateTaskRequest, TaskResponse } from '@edo/types';

export interface UpdateTaskStatusRequest {
  readonly taskId: string;
  readonly status: 'pending' | 'in_review' | 'approved' | 'declined';
  readonly decision?: 'approved' | 'declined';
  readonly decisionComment?: string;
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

export interface TaskDetailsView {
  readonly task: TaskResponse;
  readonly members: Array<{
    readonly id: string;
    readonly fullName: string;
    readonly department: string;
  }>;
  readonly currentUserId: string;
  readonly canManage: boolean;
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

  async updateTaskStatus(request: UpdateTaskStatusRequest, currentUser: UserProfile): Promise<TaskResponse> {
    if (!request.taskId || request.taskId.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    if (!request.status) {
      throw new Error('Task status is required');
    }

    const response = await this.grpcClient.updateTaskStatus({
      task_id: request.taskId,
      status: request.status,
      decision_comment: request.decisionComment || '',
      actor_user_id: currentUser.userId,
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
    const membersPayload = Array.isArray(response.members) ? (response.members as Array<Record<string, unknown>>) : [];
    const members = membersPayload.map((member) => ({
      id: String(member.id || ''),
      fullName: String(member.full_name || member.fullName || ''),
      department: String(member.department || ''),
    }));

    const canEdit = Boolean(response.can_edit ?? response.canEdit);
    const isCreator = task.creatorId === currentUser.userId;
    const isAssignee = task.assigneeId === currentUser.userId;
    const isApprover = task.approverId === currentUser.userId;
    const isBoardMember = members.some((member) => member.id === currentUser.userId);

    return {
      task,
      members,
      currentUserId: currentUser.userId,
      canManage: canEdit || isCreator || isAssignee || isApprover || isBoardMember,
    };
  }

  async listTasks(filters?: {
    readonly assigneeId?: string;
    readonly status?: string;
    readonly taskType?: string;
  }): Promise<TaskResponse[]> {
    const response = await this.grpcClient.listTasks({
      assigneeId: filters?.assigneeId || '',
      status: filters?.status || '',
      taskType: filters?.taskType || '',
    });

    if (Array.isArray(response)) {
      return response.map((task) => this.mapGrpcResponseToTask(task));
    }

    return [];
  }

  async getAvailableApprovers(boardId: string, search = '', limit = 50): Promise<AvailableApproverId[]> {
    if (!boardId.trim()) {
      throw new Error('Board ID is required');
    }

    const response = (await this.grpcClient.getAvailableApprovers({
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
      decision: response.decision ? (String(response.decision) as 'approved' | 'declined') : undefined,
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
      priority: response.priority ? Number(response.priority) : undefined,
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
