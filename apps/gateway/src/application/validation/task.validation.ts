/**
 * Task Validation Service
 *
 * Implements validation logic for task creation and updates, enforcing business rules
 * like mandatory assignment and valid state transitions.
 */

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}

export interface TaskValidationResult {
  readonly isValid: boolean;
  readonly errors: ValidationError[];
}

export class TaskValidationService {
  /**
   * Validate task creation request
   * - Title must be provided and non-empty
   * - Assignee is mandatory (cannot be null or empty)
   * - Task type must be provided
   */
  validateTaskCreation(payload: Record<string, unknown>): TaskValidationResult {
    const errors: ValidationError[] = [];

    // Validate title
    if (
      !payload.boardId ||
      typeof payload.boardId !== 'string' ||
      payload.boardId.trim().length === 0
    ) {
      errors.push({
        field: 'boardId',
        message: 'Task must be created within a board (boardId is required)',
        code: 'BOARD_ID_REQUIRED',
      });
    }

    // Validate title
    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      errors.push({
        field: 'title',
        message: 'Task title is required and must be a non-empty string',
        code: 'TITLE_REQUIRED',
      });
    }

    // Validate assignee (MANDATORY)
    if (
      !payload.assigneeId ||
      typeof payload.assigneeId !== 'string' ||
      payload.assigneeId.trim().length === 0
    ) {
      errors.push({
        field: 'assigneeId',
        message: 'Task must be assigned to someone (assigneeId is required)',
        code: 'ASSIGNEE_REQUIRED',
      });
    }

    // Validate task type
    if (!payload.taskType || !['approval', 'general'].includes(payload.taskType as string)) {
      errors.push({
        field: 'taskType',
        message: 'Task type must be either "approval" or "general"',
        code: 'INVALID_TASK_TYPE',
      });
    }

    // For approval tasks, validate approver is provided
    if (payload.taskType === 'approval') {
      if (
        !payload.approverId ||
        typeof payload.approverId !== 'string' ||
        payload.approverId.trim().length === 0
      ) {
        errors.push({
          field: 'approverId',
          message: 'Approval tasks must have an assigned approver',
          code: 'APPROVER_REQUIRED_FOR_APPROVAL_TASK',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateTaskStatusUpdate(payload: Record<string, unknown>): TaskValidationResult {
    const errors: ValidationError[] = [];
    const validStatuses = ['pending', 'in_review', 'approved', 'declined'];
    const validDecisions = ['approved', 'declined'];

    // Validate task ID
    if (
      !payload.taskId ||
      typeof payload.taskId !== 'string' ||
      payload.taskId.trim().length === 0
    ) {
      errors.push({
        field: 'taskId',
        message: 'Task ID is required',
        code: 'TASK_ID_REQUIRED',
      });
    }

    // Validate status
    if (!payload.status || !validStatuses.includes(payload.status as string)) {
      errors.push({
        field: 'status',
        message: `Task status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS',
      });
    }

    const status = payload.status as string | undefined;
    const decision = payload.decision as string | undefined;
    const decisionComment =
      typeof payload.decisionComment === 'string' ? payload.decisionComment.trim() : '';

    if (decision && !validDecisions.includes(decision)) {
      errors.push({
        field: 'decision',
        message: `Decision must be one of: ${validDecisions.join(', ')}`,
        code: 'INVALID_DECISION',
      });
    }

    if (status === 'approved' && decision !== 'approved') {
      errors.push({
        field: 'decision',
        message: 'Approved status requires the approved decision',
        code: 'APPROVED_DECISION_REQUIRED',
      });
    }

    if (status === 'declined' && decision !== 'declined') {
      errors.push({
        field: 'decision',
        message: 'Declined status requires the declined decision',
        code: 'DECLINED_DECISION_REQUIRED',
      });
    }

    if (status === 'declined' && !decisionComment) {
      errors.push({
        field: 'decisionComment',
        message: 'Decision comment is required when declining a task',
        code: 'DECLINE_COMMENT_REQUIRED',
      });
    }

    if ((status === 'pending' || status === 'in_review') && (decision || decisionComment)) {
      errors.push({
        field: 'decision',
        message: 'Decision fields are only allowed for approval or decline',
        code: 'DECISION_NOT_ALLOWED',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate workflow rules
   * - Only assigned users can update task assignments
   * - Only approvers can make decisions
   * - Only task creators or approvers can change status
   */
  validateApproverAuthorization(
    userRole: string,
    isTaskApprover: boolean,
    isTaskCreator: boolean,
  ): TaskValidationResult {
    const errors: ValidationError[] = [];

    // Check if user is authorized to make decisions
    if (!isTaskApprover && !isTaskCreator) {
      errors.push({
        field: 'authorization',
        message: 'Only the task approver or creator can make decisions on this task',
        code: 'UNAUTHORIZED_DECISION',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
