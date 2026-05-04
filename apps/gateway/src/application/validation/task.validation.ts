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
    if (!payload.boardId || typeof payload.boardId !== 'string' || payload.boardId.trim().length === 0) {
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
    if (!payload.assigneeId || typeof payload.assigneeId !== 'string' || payload.assigneeId.trim().length === 0) {
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
      if (!payload.approverId || typeof payload.approverId !== 'string' || payload.approverId.trim().length === 0) {
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

  /**
   * Validate task status update request
   * - Status must be valid
   * - If decision is provided, task must be in 'in_review' status
   * - Only valid state transitions are allowed
   */
  validateTaskStatusUpdate(
    payload: Record<string, unknown>,
    currentStatus?: string,
  ): TaskValidationResult {
    const errors: ValidationError[] = [];
    const validStatuses = ['pending', 'in_review', 'approved', 'declined'];
    const validDecisions = ['approved', 'declined'];

    // Validate task ID
    if (!payload.taskId || typeof payload.taskId !== 'string' || payload.taskId.trim().length === 0) {
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

    // Validate state transition if current status is known
    if (currentStatus && payload.status && currentStatus !== payload.status) {
      const isValidTransition = this.isValidStateTransition(currentStatus, payload.status as string);
      if (!isValidTransition) {
        errors.push({
          field: 'status',
          message: `Invalid state transition from "${currentStatus}" to "${payload.status}"`,
          code: 'INVALID_STATE_TRANSITION',
        });
      }
    }

    // Validate decision
    if (payload.decision) {
      if (!validDecisions.includes(payload.decision as string)) {
        errors.push({
          field: 'decision',
          message: `Decision must be one of: ${validDecisions.join(', ')}`,
          code: 'INVALID_DECISION',
        });
      }

      // Decision can only be made when task is in review
      if (payload.status && payload.status !== 'in_review') {
        errors.push({
          field: 'decision',
          message: 'Decisions can only be made when task is in "in_review" status',
          code: 'DECISION_REQUIRES_IN_REVIEW_STATUS',
        });
      }
    }

    // If decision is provided, decision comment is optional but recommended
    // No validation error for missing decision comment, just a note

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

  /**
   * Determine if a state transition is valid
   * State machine:
   * - pending -> in_review, approved, declined
   * - in_review -> approved, declined, pending
   * - approved -> (final state, no transitions)
   * - declined -> (final state, no transitions)
   */
  private isValidStateTransition(fromStatus: string, toStatus: string): boolean {
    const validTransitions: Record<string, Set<string>> = {
      pending: new Set(['in_review', 'approved', 'declined']),
      in_review: new Set(['approved', 'declined', 'pending']),
      approved: new Set(),
      declined: new Set(),
    };

    const allowedTransitions = validTransitions[fromStatus];
    return allowedTransitions ? allowedTransitions.has(toStatus) : false;
  }
}
