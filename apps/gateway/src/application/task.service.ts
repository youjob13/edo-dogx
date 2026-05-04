import type { UserProfile } from '@edo/types';
import type { TaskOrchestrationServiceClient } from '../adapters/outbound/grpc/task.client.js';
import type { DocumentServiceClient } from '../adapters/outbound/grpc/document.client.js';
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

export class TaskService {
  constructor(
    private readonly grpcClient: TaskOrchestrationServiceClient,
    private readonly documentClient: DocumentServiceClient,
  ) {}

  async createTask(
    request: CreateTaskRequest,
    currentUser: UserProfile,
  ): Promise<TaskResponse> {
    // Validate mandatory fields
    if (!request.title || request.title.trim().length === 0) {
      throw new Error('Task title is required');
    }

    if (!request.assigneeId || request.assigneeId.trim().length === 0) {
      throw new Error('Task must be assigned to someone');
    }

    if (!request.taskType) {
      throw new Error('Task type is required');
    }

    // Call gRPC service to create task
    const response = await this.grpcClient.createTask({
      actor_user_id: currentUser.userId,
      board_id: request.boardId,
      title: request.title,
      description: request.description || '',
      assignee_user_id: request.assigneeId,
      approver_user_id: request.approverId || '',
      task_type: request.taskType,
      attachment_document_ids: request.attachmentIds || [],
      due_date: request.dueDate?.toISOString() || '',
    });

    return this.mapGrpcResponseToTask(response);
  }

  async updateTaskStatus(
    request: UpdateTaskStatusRequest,
    currentUser: UserProfile,
  ): Promise<TaskResponse> {
    // Validate inputs
    if (!request.taskId || request.taskId.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    if (!request.status) {
      throw new Error('Task status is required');
    }

    // Call gRPC service to update status
    const response = await this.grpcClient.updateTaskStatus({
      taskId: request.taskId,
      status: request.status,
      decision: request.decision || '',
      decisionComment: request.decisionComment || '',
      updatedByUserId: currentUser.userId,
      updatedByUserName: currentUser.userName,
    });

    return this.mapGrpcResponseToTask(response);
  }

  async getTask(taskId: string): Promise<TaskResponse> {
    if (!taskId || taskId.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    const response = await this.grpcClient.getTask({
      taskId,
    });

    return this.mapGrpcResponseToTask(response);
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

    // Assuming response is an array or contains a tasks array
    if (Array.isArray(response)) {
      return response.map((task) => this.mapGrpcResponseToTask(task));
    }

    return [];
  }

  async getAvailableApprovers(): Promise<AvailableApproverId[]> {
    // Query document service for users with approver roles
    // For now, this returns a curated list of users who can approve tasks
    // In a real system, this would query from a directory service or user management
    
    // Return a hardcoded list of approvers (can be extended to query from directory service)
    return [
      { userId: 'approver-001', userName: 'Maria Garcia' },
      { userId: 'approver-002', userName: 'Ahmed Hassan' },
      { userId: 'approver-003', userName: 'Sophie Laurent' },
    ];
  }

  async getAvailableDocuments(
    currentUser?: UserProfile,
    limit = 50,
    offset = 0,
  ): Promise<AvailableDocumentId[]> {
    // Query document service to get available documents for attachment
    try {
      const response = await this.documentClient.searchDocuments({
        actor_user_id: currentUser?.userId ?? 'gateway-user',
        query: '',
        status: 'published', // Only published documents can be attached
        category: undefined,
        limit,
        offset,
      });

      // Map response to AvailableDocumentId format
      if (Array.isArray(response)) {
        return response.map((doc: Record<string, unknown>) => ({
          documentId: String(doc.id || ''),
          title: String(doc.title || ''),
          category: String(doc.category || ''),
        }));
      }

      // Handle paginated response
      if (response && typeof response === 'object') {
        const docs = (response as Record<string, unknown>).documents;
        if (Array.isArray(docs)) {
          return docs.map((doc: Record<string, unknown>) => ({
            documentId: String(doc.id || ''),
            title: String(doc.title || ''),
            category: String(doc.category || ''),
          }));
        }
      }

      return [];
    } catch (error) {
      // If document service query fails, return empty list
      // In production, this should log the error
      console.error('Failed to fetch available documents:', error);
      return [];
    }
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
