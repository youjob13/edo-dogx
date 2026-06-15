package service

import "edo/services/document-service/internal/domain/model"

type TaskAuthorizationPolicy struct{}

func NewTaskAuthorizationPolicy() *TaskAuthorizationPolicy {
	return &TaskAuthorizationPolicy{}
}

func (p *TaskAuthorizationPolicy) CanCreateBoard(actor model.TaskActor) bool {
	return actor.IsOrganizationMember
}

func (p *TaskAuthorizationPolicy) CanReadBoard(actor model.TaskActor) bool {
	return actor.IsOrganizationMember && (actor.HasRole("edms.admin") || actor.IsBoardMember)
}

func (p *TaskAuthorizationPolicy) CanManageBoardMembers(actor model.TaskActor) bool {
	return actor.IsOrganizationMember &&
		(actor.HasRole("edms.admin") ||
			actor.BoardRole == model.TaskBoardRoleOwner ||
			actor.BoardRole == model.TaskBoardRoleManager)
}

func (p *TaskAuthorizationPolicy) CanCreateTask(actor model.TaskActor) bool {
	return p.CanReadBoard(actor)
}

func (p *TaskAuthorizationPolicy) CanAssign(actor model.TaskActor, task model.Task) bool {
	return p.Capabilities(actor, task).CanAssign
}

func (p *TaskAuthorizationPolicy) CanReadTask(actor model.TaskActor, task model.Task) bool {
	isTaskParticipant := task.CreatedByUserID == actor.UserID ||
		task.AssignedUserID == actor.UserID ||
		(task.ApproverUserID != nil && *task.ApproverUserID == actor.UserID)
	return actor.IsOrganizationMember &&
		(actor.HasRole("edms.admin") || actor.IsBoardMember || isTaskParticipant)
}

func (p *TaskAuthorizationPolicy) Capabilities(actor model.TaskActor, task model.Task) model.TaskCapabilities {
	isAdmin := actor.HasRole("edms.admin")
	canManageTasks := isAdmin ||
		actor.BoardRole == model.TaskBoardRoleOwner ||
		actor.BoardRole == model.TaskBoardRoleManager
	isCreator := task.CreatedByUserID == actor.UserID
	isAssignee := task.AssignedUserID == actor.UserID
	isApprover := task.ApproverUserID != nil && *task.ApproverUserID == actor.UserID

	return model.TaskCapabilities{
		CanEdit:         actor.IsOrganizationMember && (canManageTasks || isCreator),
		CanAssign:       actor.IsOrganizationMember && canManageTasks,
		CanMoveToReview: actor.IsOrganizationMember && task.Status == model.TaskStatusPending && (canManageTasks || isAssignee),
		CanApprove: actor.IsOrganizationMember &&
			task.TaskType == model.TaskTypeApproval &&
			task.Status == model.TaskStatusInReview &&
			(isAdmin || (isApprover && actor.HasRole("edms.approver"))),
		CanComment: actor.IsOrganizationMember && (isAdmin || actor.IsBoardMember),
	}
}

func (p *TaskAuthorizationPolicy) CanMoveToPending(actor model.TaskActor, task model.Task) bool {
	return p.Capabilities(actor, task).CanEdit || task.AssignedUserID == actor.UserID
}

func (p *TaskAuthorizationPolicy) CanMutateAttachments(actor model.TaskActor, task model.Task) bool {
	return p.Capabilities(actor, task).CanEdit
}
