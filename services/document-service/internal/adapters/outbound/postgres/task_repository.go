package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"

	"github.com/lib/pq"
)

type TaskRepository struct {
	db *sql.DB
}

func NewTaskRepository(db *sql.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) CreateTaskBoard(ctx context.Context, board model.TaskBoard) (model.TaskBoardSummary, error) {
	if board.OrganizationID == "" {
		return model.TaskBoardSummary{}, fmt.Errorf("organization id is required")
	}
	if board.Name == "" {
		return model.TaskBoardSummary{}, fmt.Errorf("board name is required")
	}
	if board.CreatedByUserID == "" {
		return model.TaskBoardSummary{}, fmt.Errorf("board creator user id is required")
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.TaskBoardSummary{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	const boardQuery = `
		INSERT INTO task_boards (organization_id, name, description)
		VALUES ($1, $2, $3)
		RETURNING id
	`

	if err := tx.QueryRowContext(ctx, boardQuery, board.OrganizationID, board.Name, board.Description).Scan(&board.ID); err != nil {
		return model.TaskBoardSummary{}, fmt.Errorf("failed to create task board: %w", err)
	}

	const ownerQuery = `
		INSERT INTO task_board_members (board_id, user_id, full_name, department, email, role)
		SELECT $1, user_id, full_name, department, email, 'OWNER'
		FROM organization_members
		WHERE organization_id = $2 AND user_id = $3
	`
	result, err := tx.ExecContext(ctx, ownerQuery, board.ID, board.OrganizationID, board.CreatedByUserID)
	if err != nil {
		return model.TaskBoardSummary{}, fmt.Errorf("failed to add task board owner: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return model.TaskBoardSummary{}, fmt.Errorf("failed to check task board owner insert: %w", err)
	}
	if rowsAffected == 0 {
		return model.TaskBoardSummary{}, model.ErrTaskMemberNotFound
	}

	if err := tx.Commit(); err != nil {
		return model.TaskBoardSummary{}, fmt.Errorf("failed to commit task board: %w", err)
	}

	return model.TaskBoardSummary{
		ID:             board.ID,
		OrganizationID: board.OrganizationID,
		Name:           board.Name,
		Description:    board.Description,
		MembersCount:   1,
		TasksCount:     0,
	}, nil
}

func (r *TaskRepository) GetTaskBoard(ctx context.Context, boardID string) (model.TaskBoardDetails, error) {
	const boardQuery = `
		SELECT id, organization_id, name, description
		FROM task_boards
		WHERE id = $1
	`

	var board model.TaskBoardDetails
	if err := r.db.QueryRowContext(ctx, boardQuery, boardID).Scan(
		&board.ID,
		&board.OrganizationID,
		&board.Name,
		&board.Description,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.TaskBoardDetails{}, model.ErrTaskBoardNotFound
		}
		return model.TaskBoardDetails{}, fmt.Errorf("failed to get task board: %w", err)
	}

	members, err := r.ListTaskBoardMembers(ctx, boardID)
	if err != nil {
		return model.TaskBoardDetails{}, err
	}
	board.Members = members

	const tasksQuery = `
		SELECT id, board_id, title, description, status, task_type,
		       creator_user_id, creator_user_name,
		       assignee_user_id, assignee_user_name,
		       approver_user_id, approver_user_name,
		       decision, decision_comment, due_date,
		       created_at, updated_at
		FROM tasks
		WHERE board_id = $1
		ORDER BY created_at DESC
	`
	taskRows, err := r.db.QueryContext(ctx, tasksQuery, boardID)
	if err != nil {
		return model.TaskBoardDetails{}, fmt.Errorf("failed to load task board tasks: %w", err)
	}
	defer taskRows.Close()

	for taskRows.Next() {
		task, err := scanTask(taskRows)
		if err != nil {
			return model.TaskBoardDetails{}, err
		}
		attachments, err := r.GetTaskAttachments(ctx, task.ID)
		if err != nil {
			return model.TaskBoardDetails{}, fmt.Errorf("failed to load task attachments: %w", err)
		}
		task.Attachments = attachments
		board.Tasks = append(board.Tasks, task)
	}
	if err := taskRows.Err(); err != nil {
		return model.TaskBoardDetails{}, fmt.Errorf("error iterating task board tasks: %w", err)
	}

	board.AllowedGrouping = []string{"assignee", "department", "group"}
	return board, nil
}

func (r *TaskRepository) ListTaskBoardMembers(ctx context.Context, boardID string) ([]model.TaskBoardMember, error) {
	const query = `
		SELECT om.user_id, om.full_name, om.department, om.email, bm.role, om.roles
		FROM task_board_members bm
		INNER JOIN task_boards b ON b.id = bm.board_id
		INNER JOIN organization_members om
			ON om.organization_id = b.organization_id
			AND om.user_id = bm.user_id
		WHERE bm.board_id = $1
		ORDER BY om.full_name ASC
	`
	rows, err := r.db.QueryContext(ctx, query, boardID)
	if err != nil {
		return nil, fmt.Errorf("failed to load task board members: %w", err)
	}
	defer rows.Close()

	members := make([]model.TaskBoardMember, 0)
	for rows.Next() {
		var member model.TaskBoardMember
		if err := rows.Scan(
			&member.UserID,
			&member.FullName,
			&member.Department,
			&member.Email,
			&member.BoardRole,
			pq.Array(&member.Roles),
		); err != nil {
			return nil, fmt.Errorf("failed to scan task board member: %w", err)
		}
		members = append(members, member)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating task board members: %w", err)
	}

	return members, nil
}

func (r *TaskRepository) CreateTask(ctx context.Context, task model.Task) (model.Task, error) {
	return r.CreateTaskWithAttachments(ctx, task, task.CreatedByUserID, nil)
}

func (r *TaskRepository) CreateTaskWithAttachments(ctx context.Context, task model.Task, actorUserID string, documentIDs []string) (model.Task, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.Task{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	const boardOrganizationQuery = `SELECT organization_id FROM task_boards WHERE id = $1`
	var organizationID string
	if err := tx.QueryRowContext(ctx, boardOrganizationQuery, task.BoardID).Scan(&organizationID); err != nil {
		if err == sql.ErrNoRows {
			return model.Task{}, model.ErrTaskBoardNotFound
		}
		return model.Task{}, fmt.Errorf("failed to get task board organization: %w", err)
	}

	resolveMemberName := func(userID string) (string, error) {
		const query = `
			SELECT full_name
			FROM organization_members
			WHERE organization_id = $1 AND user_id = $2
		`
		var fullName string
		if err := tx.QueryRowContext(ctx, query, organizationID, userID).Scan(&fullName); err != nil {
			if err == sql.ErrNoRows {
				return "", model.ErrTaskMemberNotFound
			}
			return "", fmt.Errorf("failed to resolve organization member: %w", err)
		}
		if strings.TrimSpace(fullName) == "" {
			return userID, nil
		}
		return fullName, nil
	}

	task.CreatedByUserName, err = resolveMemberName(task.CreatedByUserID)
	if err != nil {
		return model.Task{}, err
	}
	task.AssignedUserName, err = resolveMemberName(task.AssignedUserID)
	if err != nil {
		return model.Task{}, err
	}
	if task.ApproverUserID != nil {
		approverName, err := resolveMemberName(*task.ApproverUserID)
		if err != nil {
			return model.Task{}, err
		}
		task.ApproverUserName = &approverName
	}

	const insertTaskQuery = `
		INSERT INTO tasks (
			board_id, title, description, status, task_type,
			creator_user_id, creator_user_name,
			assignee_user_id, assignee_user_name,
			approver_user_id, approver_user_name,
			decision, decision_comment,
			due_date
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at
	`

	if err := tx.QueryRowContext(ctx, insertTaskQuery,
		task.BoardID,
		task.Title,
		task.Description,
		strings.ToUpper(string(task.Status)),
		string(task.TaskType),
		task.CreatedByUserID,
		task.CreatedByUserName,
		task.AssignedUserID,
		task.AssignedUserName,
		task.ApproverUserID,
		task.ApproverUserName,
		task.Decision,
		task.DecisionComment,
		task.DueDate,
	).Scan(&task.ID, &task.CreatedAt, &task.UpdatedAt); err != nil {
		return model.Task{}, fmt.Errorf("failed to create task: %w", err)
	}

	if len(documentIDs) > 0 {
		dedup := make([]string, 0, len(documentIDs))
		seen := make(map[string]struct{}, len(documentIDs))
		for _, rawID := range documentIDs {
			id := strings.TrimSpace(rawID)
			if id == "" {
				continue
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			dedup = append(dedup, id)
		}

		const accessQuery = `
			SELECT id::text, title, category
			FROM documents
			WHERE id = ANY($1::uuid[])
			  AND owner_user_id = $2
		`
		rows, err := tx.QueryContext(ctx, accessQuery, pq.Array(dedup), actorUserID)
		if err != nil {
			return model.Task{}, fmt.Errorf("failed to verify document access: %w", err)
		}

		allowed := make(map[string]model.TaskAttachment, len(dedup))
		for rows.Next() {
			var attachment model.TaskAttachment
			if err := rows.Scan(&attachment.DocumentID, &attachment.Title, &attachment.Category); err != nil {
				rows.Close()
				return model.Task{}, fmt.Errorf("failed to scan accessible document: %w", err)
			}
			attachment.TaskID = task.ID
			attachment.Status = "DRAFT"
			allowed[attachment.DocumentID] = attachment
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return model.Task{}, fmt.Errorf("failed to iterate accessible documents: %w", err)
		}
		rows.Close()

		if len(allowed) != len(dedup) {
			return model.Task{}, model.ErrAttachmentDocumentForbidden
		}

		const insertAttachmentQuery = `
			INSERT INTO task_attachments (task_id, document_id, title, category, status)
			VALUES ($1, $2::uuid, $3, $4, $5)
			ON CONFLICT (task_id, document_id) DO NOTHING
		`
		for _, documentID := range dedup {
			item, ok := allowed[documentID]
			if !ok {
				return model.Task{}, model.ErrAttachmentDocumentForbidden
			}
			if _, err := tx.ExecContext(ctx, insertAttachmentQuery, task.ID, item.DocumentID, item.Title, item.Category, item.Status); err != nil {
				return model.Task{}, fmt.Errorf("failed to insert task attachment: %w", err)
			}
			task.Attachments = append(task.Attachments, item)
		}
	}

	if err := tx.Commit(); err != nil {
		return model.Task{}, fmt.Errorf("failed to commit task creation: %w", err)
	}

	return task, nil
}

func (r *TaskRepository) UpdateTaskStatus(ctx context.Context, taskID string, update model.TaskStatusUpdate) error {
	const query = `
		UPDATE tasks
		SET status = $1,
		    decision = $2,
		    decision_comment = $3,
		    updated_by_user_id = $4,
		    updated_by_user_name = $5,
		    updated_at = NOW()
		WHERE id = $6 AND status = $7
	`

	result, err := r.db.ExecContext(
		ctx,
		query,
		strings.ToUpper(string(update.Status)),
		update.Decision,
		update.DecisionComment,
		update.UpdatedByUserID,
		update.UpdatedByUserName,
		taskID,
		strings.ToUpper(string(update.ExpectedStatus)),
	)
	if err != nil {
		return fmt.Errorf("failed to update task status: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		var exists bool
		if err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)`, taskID).Scan(&exists); err != nil {
			return fmt.Errorf("failed to verify task status update: %w", err)
		}
		if !exists {
			return model.ErrTaskNotFound
		}
		return model.ErrTaskStatusConflict
	}

	return nil
}

func (r *TaskRepository) UpdateTaskAssignee(
	ctx context.Context,
	taskID string,
	actorUserID string,
	assigneeUserID string,
	authorizer model.TaskAssignmentAuthorizer,
) (model.TaskAssignmentResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.TaskAssignmentResult{}, fmt.Errorf("failed to begin task assignment transaction: %w", err)
	}
	defer tx.Rollback()

	const taskQuery = `
		SELECT id, board_id, title, description, status, task_type,
		       creator_user_id, creator_user_name,
		       assignee_user_id, assignee_user_name,
		       approver_user_id, approver_user_name,
		       decision, decision_comment, due_date,
		       created_at, updated_at
		FROM tasks
		WHERE id = $1
		FOR UPDATE
	`
	task, err := scanTask(tx.QueryRowContext(ctx, taskQuery, taskID))
	if err != nil {
		if err == sql.ErrNoRows {
			return model.TaskAssignmentResult{}, model.ErrTaskNotFound
		}
		return model.TaskAssignmentResult{}, fmt.Errorf("failed to lock task for assignment: %w", err)
	}

	actor, err := getBoardActorWithQuery(ctx, tx, task.BoardID, actorUserID)
	if err != nil {
		return model.TaskAssignmentResult{}, err
	}
	if authorizer == nil || !authorizer.CanAssign(actor, task) {
		return model.TaskAssignmentResult{}, model.ErrTaskAssignmentForbidden
	}

	const assigneeQuery = `
		SELECT om.full_name
		FROM task_board_members bm
		INNER JOIN task_boards b ON b.id = bm.board_id
		INNER JOIN organization_members om
			ON om.organization_id = b.organization_id
			AND om.user_id = bm.user_id
		WHERE bm.board_id = $1 AND bm.user_id = $2
	`
	var assigneeName string
	if err := tx.QueryRowContext(ctx, assigneeQuery, task.BoardID, assigneeUserID).Scan(&assigneeName); err != nil {
		if err == sql.ErrNoRows {
			return model.TaskAssignmentResult{}, model.ErrTaskAssigneeNotBoardMember
		}
		return model.TaskAssignmentResult{}, fmt.Errorf("failed to resolve task assignee: %w", err)
	}
	if strings.TrimSpace(assigneeName) == "" {
		assigneeName = assigneeUserID
	}

	const updateQuery = `
		UPDATE tasks
		SET assignee_user_id = $1,
		    assignee_user_name = $2,
		    updated_by_user_id = $3,
		    updated_by_user_name = $4,
		    updated_at = NOW()
		WHERE id = $5
		RETURNING updated_at
	`
	previousAssigneeID := task.AssignedUserID
	if err := tx.QueryRowContext(
		ctx,
		updateQuery,
		assigneeUserID,
		assigneeName,
		actor.UserID,
		actor.FullName,
		task.ID,
	).Scan(&task.UpdatedAt); err != nil {
		return model.TaskAssignmentResult{}, fmt.Errorf("failed to update task assignee: %w", err)
	}

	task.AssignedUserID = assigneeUserID
	task.AssignedUserName = assigneeName
	task.UpdatedByUserID = &actor.UserID
	task.UpdatedByUserName = &actor.FullName
	task.Attachments, err = getTaskAttachmentsWithQuery(ctx, tx, task.ID)
	if err != nil {
		return model.TaskAssignmentResult{}, err
	}

	if err := tx.Commit(); err != nil {
		return model.TaskAssignmentResult{}, fmt.Errorf("failed to commit task assignment: %w", err)
	}

	return model.TaskAssignmentResult{
		Task:               task,
		Actor:              actor,
		PreviousAssigneeID: previousAssigneeID,
	}, nil
}

func (r *TaskRepository) GetTask(ctx context.Context, taskID string) (model.Task, error) {
	const query = `
		SELECT id, board_id, title, description, status, task_type,
		       creator_user_id, creator_user_name,
		       assignee_user_id, assignee_user_name,
		       approver_user_id, approver_user_name,
		       decision, decision_comment, due_date,
		       created_at, updated_at
		FROM tasks
		WHERE id = $1
	`

	row := r.db.QueryRowContext(ctx, query, taskID)
	task, err := scanTask(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return model.Task{}, model.ErrTaskNotFound
		}
		return model.Task{}, err
	}

	attachments, err := r.GetTaskAttachments(ctx, taskID)
	if err != nil {
		return model.Task{}, err
	}
	task.Attachments = attachments

	return task, nil
}

func (r *TaskRepository) ListTasks(ctx context.Context, filter outbound.TaskFilter) ([]model.Task, error) {
	query := `
		SELECT id, board_id, title, description, status, task_type,
		       creator_user_id, creator_user_name,
		       assignee_user_id, assignee_user_name,
		       approver_user_id, approver_user_name,
		       decision, decision_comment, due_date,
		       created_at, updated_at
		FROM tasks
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 0

	if filter.ActorUserID != nil {
		argCount++
		query += fmt.Sprintf(`
			AND EXISTS (
				SELECT 1
				FROM task_boards b
				INNER JOIN organization_members om
					ON om.organization_id = b.organization_id
					AND om.user_id = $%d
				WHERE b.id = tasks.board_id
				  AND (
					'edms.admin' = ANY(om.roles)
					OR EXISTS (
						SELECT 1
						FROM task_board_members bm
						WHERE bm.board_id = tasks.board_id
						  AND bm.user_id = $%d
					)
					OR tasks.creator_user_id = $%d
					OR tasks.assignee_user_id = $%d
					OR tasks.approver_user_id = $%d
				  )
			)
		`, argCount, argCount, argCount, argCount, argCount)
		args = append(args, *filter.ActorUserID)
	}
	if filter.AssignedUserID != nil {
		argCount++
		query += fmt.Sprintf(" AND assignee_user_id = $%d", argCount)
		args = append(args, *filter.AssignedUserID)
	}
	if filter.Status != nil {
		argCount++
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, strings.ToUpper(string(*filter.Status)))
	}
	if filter.TaskType != nil {
		argCount++
		query += fmt.Sprintf(" AND task_type = $%d", argCount)
		args = append(args, string(*filter.TaskType))
	}
	if filter.DocumentID != nil {
		argCount++
		query += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM task_attachments ta WHERE ta.task_id = tasks.id AND ta.document_id = $%d::uuid)", argCount)
		args = append(args, *filter.DocumentID)
	}

	query += " ORDER BY created_at DESC"
	if filter.Limit != nil {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, *filter.Limit)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}
	defer rows.Close()

	tasks := make([]model.Task, 0)
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		attachments, err := r.GetTaskAttachments(ctx, task.ID)
		if err != nil {
			return nil, err
		}
		task.Attachments = attachments
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tasks: %w", err)
	}

	return tasks, nil
}

func (r *TaskRepository) AddTaskAttachments(ctx context.Context, taskID string, attachments []model.TaskAttachment) error {
	if len(attachments) == 0 {
		return nil
	}
	const query = `
		INSERT INTO task_attachments (task_id, document_id, title, category, status)
		VALUES ($1, $2::uuid, $3, $4, $5)
		ON CONFLICT (task_id, document_id) DO NOTHING
	`
	for _, attachment := range attachments {
		if _, err := r.db.ExecContext(ctx, query, taskID, attachment.DocumentID, attachment.Title, attachment.Category, attachment.Status); err != nil {
			return fmt.Errorf("failed to insert attachment: %w", err)
		}
	}
	return nil
}

func (r *TaskRepository) RemoveTaskAttachment(ctx context.Context, taskID string, documentID string) error {
	const query = `DELETE FROM task_attachments WHERE task_id = $1 AND document_id = $2::uuid`
	result, err := r.db.ExecContext(ctx, query, taskID, documentID)
	if err != nil {
		return fmt.Errorf("failed to remove attachment: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}
	if rowsAffected == 0 {
		return model.ErrTaskNotFound
	}
	return nil
}

func (r *TaskRepository) GetTaskAttachments(ctx context.Context, taskID string) ([]model.TaskAttachment, error) {
	return getTaskAttachmentsWithQuery(ctx, r.db, taskID)
}

type queryContextExecutor interface {
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

func getTaskAttachmentsWithQuery(ctx context.Context, executor queryContextExecutor, taskID string) ([]model.TaskAttachment, error) {
	const query = `
		SELECT id, task_id, document_id::text, title, category, status, created_at
		FROM task_attachments
		WHERE task_id = $1
		ORDER BY created_at ASC
	`

	rows, err := executor.QueryContext(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task attachments: %w", err)
	}
	defer rows.Close()

	attachments := make([]model.TaskAttachment, 0)
	for rows.Next() {
		var attachment model.TaskAttachment
		if err := rows.Scan(
			&attachment.ID,
			&attachment.TaskID,
			&attachment.DocumentID,
			&attachment.Title,
			&attachment.Category,
			&attachment.Status,
			&attachment.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan attachment: %w", err)
		}
		attachments = append(attachments, attachment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating attachments: %w", err)
	}

	return attachments, nil
}

func (r *TaskRepository) ListTaskBoards(ctx context.Context, filter outbound.TaskBoardFilter) ([]model.TaskBoardSummary, int, error) {
	whereClauses := make([]string, 0, 2)
	args := []interface{}{}

	if filter.OrganizationID != nil {
		args = append(args, *filter.OrganizationID)
		whereClauses = append(whereClauses, fmt.Sprintf("b.organization_id = $%d", len(args)))
	}
	if filter.ActorUserID != nil {
		args = append(args, *filter.ActorUserID)
		actorArg := len(args)
		whereClauses = append(whereClauses, fmt.Sprintf(`
			EXISTS (
				SELECT 1
				FROM organization_members om
				WHERE om.organization_id = b.organization_id
				  AND om.user_id = $%d
				  AND (
					'edms.admin' = ANY(om.roles)
					OR EXISTS (
						SELECT 1
						FROM task_board_members actor_bm
						WHERE actor_bm.board_id = b.id
						  AND actor_bm.user_id = $%d
					)
				  )
			)
		`, actorArg, actorArg))
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	countQuery := `SELECT COUNT(*) FROM task_boards b` + whereSQL
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count task boards: %w", err)
	}

	query := `
		SELECT
			b.id,
			b.organization_id,
			b.name,
			b.description,
			COUNT(DISTINCT bm.user_id) AS members_count,
			COUNT(DISTINCT t.id) AS tasks_count
		FROM task_boards b
		LEFT JOIN task_board_members bm ON bm.board_id = b.id
		LEFT JOIN tasks t ON t.board_id = b.id
	` + whereSQL

	query += `
		GROUP BY b.id, b.organization_id, b.name, b.description
		ORDER BY b.created_at DESC
	`

	if filter.Limit != nil {
		query += fmt.Sprintf(" LIMIT $%d", len(args)+1)
		args = append(args, *filter.Limit)
	}
	if filter.Offset != nil {
		query += fmt.Sprintf(" OFFSET $%d", len(args)+1)
		args = append(args, *filter.Offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list task boards: %w", err)
	}
	defer rows.Close()

	boards := make([]model.TaskBoardSummary, 0)
	for rows.Next() {
		var board model.TaskBoardSummary
		if err := rows.Scan(
			&board.ID,
			&board.OrganizationID,
			&board.Name,
			&board.Description,
			&board.MembersCount,
			&board.TasksCount,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan task board: %w", err)
		}
		boards = append(boards, board)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating task boards: %w", err)
	}

	return boards, total, nil
}

func (r *TaskRepository) ListOrganizationMembers(ctx context.Context, organizationID string, limit int, offset int) ([]model.TaskBoardMember, int, error) {
	countQuery := `SELECT COUNT(*) FROM organization_members WHERE organization_id = $1`
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, organizationID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count organization members: %w", err)
	}

	query := `
		SELECT user_id, full_name, department, email, roles
		FROM organization_members
		WHERE organization_id = $1
		ORDER BY full_name ASC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.QueryContext(ctx, query, organizationID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list organization members: %w", err)
	}
	defer rows.Close()

	members := make([]model.TaskBoardMember, 0)
	for rows.Next() {
		var member model.TaskBoardMember
		if err := rows.Scan(&member.UserID, &member.FullName, &member.Department, &member.Email, pq.Array(&member.Roles)); err != nil {
			return nil, 0, fmt.Errorf("failed to scan organization member: %w", err)
		}
		members = append(members, member)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating organization members: %w", err)
	}

	return members, total, nil
}

func (r *TaskRepository) AddTaskBoardMember(ctx context.Context, boardID string, userID string, role model.TaskBoardRole) (model.TaskBoardMember, error) {
	const boardQuery = `SELECT organization_id FROM task_boards WHERE id = $1`
	var organizationID string
	if err := r.db.QueryRowContext(ctx, boardQuery, boardID).Scan(&organizationID); err != nil {
		if err == sql.ErrNoRows {
			return model.TaskBoardMember{}, model.ErrTaskBoardNotFound
		}
		return model.TaskBoardMember{}, fmt.Errorf("failed to get task board organization: %w", err)
	}

	const memberQuery = `
		SELECT user_id, full_name, department, email, roles
		FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`
	var member model.TaskBoardMember
	if err := r.db.QueryRowContext(ctx, memberQuery, organizationID, userID).Scan(
		&member.UserID,
		&member.FullName,
		&member.Department,
		&member.Email,
		pq.Array(&member.Roles),
	); err != nil {
		if err == sql.ErrNoRows {
			return model.TaskBoardMember{}, model.ErrTaskMemberNotFound
		}
		return model.TaskBoardMember{}, fmt.Errorf("failed to get organization member: %w", err)
	}

	const insertQuery = `
		INSERT INTO task_board_members (board_id, user_id, full_name, department, email, role)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (board_id, user_id)
		DO UPDATE SET full_name = EXCLUDED.full_name, department = EXCLUDED.department, email = EXCLUDED.email, role = EXCLUDED.role
	`
	if role == "" {
		role = model.TaskBoardRoleMember
	}
	if _, err := r.db.ExecContext(ctx, insertQuery, boardID, member.UserID, member.FullName, member.Department, member.Email, role); err != nil {
		return model.TaskBoardMember{}, fmt.Errorf("failed to add board member: %w", err)
	}
	member.BoardRole = role

	return member, nil
}

func (r *TaskRepository) CreateOrganizationMember(ctx context.Context, organizationID string, member model.TaskBoardMember) (bool, error) {
	const query = `
		INSERT INTO organization_members (organization_id, user_id, full_name, department, email, roles)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (organization_id, user_id)
		DO UPDATE SET
			full_name = EXCLUDED.full_name,
			department = EXCLUDED.department,
			email = EXCLUDED.email,
			roles = EXCLUDED.roles,
			updated_at = NOW()
		RETURNING (xmax = 0)
	`

	var created bool
	if err := r.db.QueryRowContext(ctx, query, organizationID, member.UserID, member.FullName, member.Department, member.Email, pq.Array(member.Roles)).Scan(&created); err != nil {
		return false, fmt.Errorf("failed to create organization member: %w", err)
	}

	return created, nil
}

func (r *TaskRepository) GetOrganizationActor(ctx context.Context, organizationID string, userID string) (model.TaskActor, error) {
	const query = `
		SELECT full_name, roles
		FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`

	actor := model.TaskActor{
		UserID:         userID,
		OrganizationID: organizationID,
	}
	if err := r.db.QueryRowContext(ctx, query, organizationID, userID).Scan(
		&actor.FullName,
		pq.Array(&actor.Roles),
	); err != nil {
		if err == sql.ErrNoRows {
			return actor, nil
		}
		return model.TaskActor{}, fmt.Errorf("failed to get organization actor: %w", err)
	}
	actor.IsOrganizationMember = true
	return actor, nil
}

func (r *TaskRepository) GetBoardActor(ctx context.Context, boardID string, userID string) (model.TaskActor, error) {
	return getBoardActorWithQuery(ctx, r.db, boardID, userID)
}

func getBoardActorWithQuery(ctx context.Context, executor queryContextExecutor, boardID string, userID string) (model.TaskActor, error) {
	const query = `
		SELECT
			b.organization_id,
			COALESCE(om.user_id, ''),
			COALESCE(om.full_name, ''),
			COALESCE(om.roles, '{}'::text[]),
			COALESCE(bm.role, '')
		FROM task_boards b
		LEFT JOIN organization_members om
			ON om.organization_id = b.organization_id
			AND om.user_id = $2
		LEFT JOIN task_board_members bm
			ON bm.board_id = b.id
			AND bm.user_id = $2
		WHERE b.id = $1
	`

	actor := model.TaskActor{UserID: userID}
	var organizationMemberID string
	var boardRole string
	if err := executor.QueryRowContext(ctx, query, boardID, userID).Scan(
		&actor.OrganizationID,
		&organizationMemberID,
		&actor.FullName,
		pq.Array(&actor.Roles),
		&boardRole,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.TaskActor{}, model.ErrTaskBoardNotFound
		}
		return model.TaskActor{}, fmt.Errorf("failed to get board actor: %w", err)
	}

	actor.IsOrganizationMember = organizationMemberID != ""
	if boardRole != "" {
		actor.BoardRole = model.TaskBoardRole(boardRole)
		actor.IsBoardMember = true
	}
	return actor, nil
}

func (r *TaskRepository) GetAvailableApprovers(ctx context.Context, boardID string, search string, limit int) ([]model.TaskBoardMember, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	where := `WHERE bm.board_id = $1`
	where += ` AND ('edms.approver' = ANY(om.roles) OR 'edms.admin' = ANY(om.roles))`
	args := []interface{}{boardID}
	if strings.TrimSpace(search) != "" {
		where += ` AND (om.full_name ILIKE $2 OR om.email ILIKE $2 OR om.department ILIKE $2 OR om.user_id ILIKE $2)`
		args = append(args, "%"+strings.TrimSpace(search)+"%")
	}

	countQuery := `
		SELECT COUNT(*)
		FROM task_board_members bm
		INNER JOIN task_boards b ON b.id = bm.board_id
		INNER JOIN organization_members om
			ON om.organization_id = b.organization_id
			AND om.user_id = bm.user_id
	` + where
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count available approvers: %w", err)
	}

	query := `
		SELECT om.user_id, om.full_name, om.department, om.email, bm.role, om.roles
		FROM task_board_members bm
		INNER JOIN task_boards b ON b.id = bm.board_id
		INNER JOIN organization_members om
			ON om.organization_id = b.organization_id
			AND om.user_id = bm.user_id
	` + where + `
		ORDER BY om.full_name ASC
		LIMIT $` + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list available approvers: %w", err)
	}
	defer rows.Close()

	items := make([]model.TaskBoardMember, 0)
	for rows.Next() {
		var member model.TaskBoardMember
		if err := rows.Scan(
			&member.UserID,
			&member.FullName,
			&member.Department,
			&member.Email,
			&member.BoardRole,
			pq.Array(&member.Roles),
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan available approver: %w", err)
		}
		items = append(items, member)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating available approvers: %w", err)
	}

	return items, total, nil
}

func (r *TaskRepository) GetAvailableDocuments(ctx context.Context, boardID string, category string, search string, limit int) ([]model.AvailableTaskDocument, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	where := `
		WHERE om.organization_id = (
			SELECT organization_id
			FROM task_boards
			WHERE id = $1
		)
	`
	args := []interface{}{boardID}

	if strings.TrimSpace(category) != "" {
		where += fmt.Sprintf(" AND d.category = $%d", len(args)+1)
		args = append(args, strings.ToUpper(strings.TrimSpace(category)))
	}

	if strings.TrimSpace(search) != "" {
		where += fmt.Sprintf(" AND (d.title ILIKE $%d OR d.owner_user_id ILIKE $%d)", len(args)+1, len(args)+1)
		args = append(args, "%"+strings.TrimSpace(search)+"%")
	}

	countQuery := `
		SELECT COUNT(DISTINCT d.id)
		FROM documents d
		INNER JOIN organization_members om ON om.user_id = d.owner_user_id
	` + where
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count available documents: %w", err)
	}

	query := `
		SELECT d.id::text, d.title, d.category, d.updated_at, d.version
		FROM documents d
		INNER JOIN organization_members om ON om.user_id = d.owner_user_id
	` + where + `
		ORDER BY d.updated_at DESC
		LIMIT $` + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list available documents: %w", err)
	}
	defer rows.Close()

	items := make([]model.AvailableTaskDocument, 0)
	for rows.Next() {
		var item model.AvailableTaskDocument
		if err := rows.Scan(&item.DocumentID, &item.Title, &item.Category, &item.UpdatedAt, &item.Version); err != nil {
			return nil, 0, fmt.Errorf("failed to scan available document: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating available documents: %w", err)
	}

	return items, total, nil
}

type taskRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanTask(scanner taskRowScanner) (model.Task, error) {
	var task model.Task
	var status string
	var taskType string
	var dueDate sql.NullTime
	var approverUserID sql.NullString
	var approverUserName sql.NullString
	var decision sql.NullString
	var decisionComment sql.NullString

	err := scanner.Scan(
		&task.ID,
		&task.BoardID,
		&task.Title,
		&task.Description,
		&status,
		&taskType,
		&task.CreatedByUserID,
		&task.CreatedByUserName,
		&task.AssignedUserID,
		&task.AssignedUserName,
		&approverUserID,
		&approverUserName,
		&decision,
		&decisionComment,
		&dueDate,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return model.Task{}, err
	}

	task.Status = parseTaskStatus(status)
	task.TaskType = model.TaskType(taskType)
	if dueDate.Valid {
		task.DueDate = &dueDate.Time
	}
	if approverUserID.Valid {
		task.ApproverUserID = &approverUserID.String
	}
	if approverUserName.Valid {
		task.ApproverUserName = &approverUserName.String
	}
	if decision.Valid {
		decisionValue := model.TaskDecision(strings.ToLower(decision.String))
		task.Decision = &decisionValue
	}
	if decisionComment.Valid {
		task.DecisionComment = &decisionComment.String
	}

	return task, nil
}

func parseTaskStatus(raw string) model.TaskStatus {
	switch strings.ToUpper(raw) {
	case "IN_REVIEW":
		return model.TaskStatusInReview
	case "APPROVED":
		return model.TaskStatusApproved
	case "DECLINED":
		return model.TaskStatusDeclined
	default:
		return model.TaskStatusPending
	}
}
