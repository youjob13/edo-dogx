export interface CreateTaskRequest {
  readonly title: string;
  readonly description?: string;
  readonly assigneeId: string;
  readonly assigneeName: string;
  readonly approverId?: string;
  readonly approverName?: string;
  readonly taskType: 'approval' | 'general';
  readonly dueDate?: Date;
  readonly priority?: number;
  readonly attachmentIds?: string[];
}

export interface TaskResponse {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: 'pending' | 'in_review' | 'approved' | 'declined';
  readonly taskType: 'approval' | 'general';
  readonly creatorId: string;
  readonly creatorName: string;
  readonly assigneeId: string;
  readonly assigneeName: string;
  readonly approverId?: string;
  readonly approverName?: string;
  readonly decision?: 'approved' | 'declined';
  readonly decisionComment?: string;
  readonly dueDate?: Date;
  readonly priority?: number;
  readonly attachmentIds: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}