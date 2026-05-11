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

	if len(board.Members) > 0 {
		const memberQuery = `
			INSERT INTO task_board_members (board_id, user_id, full_name, department, email)
			VALUES ($1, $2, $3, $4, $5)
		`

		for _, member := range board.Members {
			if member.UserID == "" {
				continue
			}
			if _, err := tx.ExecContext(ctx, memberQuery, board.ID, member.UserID, member.FullName, member.Department, member.Email); err != nil {
				return model.TaskBoardSummary{}, fmt.Errorf("failed to create task board member: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return model.TaskBoardSummary{}, fmt.Errorf("failed to commit task board: %w", err)
	}

	return model.TaskBoardSummary{
		ID:             board.ID,
		OrganizationID: board.OrganizationID,
		Name:           board.Name,
		Description:    board.Description,
		MembersCount:   len(board.Members),
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

	const membersQuery = `
		SELECT user_id, full_name, department, email
		FROM task_board_members
		WHERE board_id = $1
		ORDER BY full_name ASC
	`
	memberRows, err := r.db.QueryContext(ctx, membersQuery, boardID)
	if err != nil {
		return model.TaskBoardDetails{}, fmt.Errorf("failed to load task board members: %w", err)
	}
	defer memberRows.Close()

	for memberRows.Next() {
		var member model.TaskBoardMember
		if err := memberRows.Scan(&member.UserID, &member.FullName, &member.Department, &member.Email); err != nil {
			return model.TaskBoardDetails{}, fmt.Errorf("failed to scan task board member: %w", err)
		}
		board.Members = append(board.Members, member)
	}
	if err := memberRows.Err(); err != nil {
		return model.TaskBoardDetails{}, fmt.Errorf("error iterating task board members: %w", err)
	}

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

func (r *TaskRepository) CreateTask(ctx context.Context, task model.Task) (model.Task, error) {
	return r.CreateTaskWithAttachments(ctx, task, task.CreatedByUserID, nil)
}

func (r *TaskRepository) CreateTaskWithAttachments(ctx context.Context, task model.Task, actorUserID string, documentIDs []string) (model.Task, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.Task{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

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

func (r *TaskRepository) UpdateTaskStatus(ctx context.Context, taskID string, newStatus model.TaskStatus, updatedByUserID string, updatedByUserName string) error {
	const query = `
		UPDATE tasks
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`

	result, err := r.db.ExecContext(ctx, query, strings.ToUpper(string(newStatus)), taskID)
	if err != nil {
		return fmt.Errorf("failed to update task status: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return model.ErrTaskNotFound
	}

	_ = updatedByUserID
	_ = updatedByUserName
	return nil
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
	const query = `
		SELECT id, task_id, document_id::text, title, category, status, created_at
		FROM task_attachments
		WHERE task_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, taskID)
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
	countQuery := `SELECT COUNT(*) FROM task_boards`
	countArgs := []interface{}{}

	if filter.OrganizationID != nil {
		countQuery += " WHERE organization_id = $1"
		countArgs = append(countArgs, *filter.OrganizationID)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
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
	`

	args := []interface{}{}
	argCount := 0
	if filter.OrganizationID != nil {
		argCount++
		query += fmt.Sprintf(" WHERE b.organization_id = $%d", argCount)
		args = append(args, *filter.OrganizationID)
	}

	query += `
		GROUP BY b.id, b.organization_id, b.name, b.description
		ORDER BY b.created_at DESC
	`

	if filter.Limit != nil {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, *filter.Limit)
	}
	if filter.Offset != nil {
		argCount++
		query += fmt.Sprintf(" OFFSET $%d", argCount)
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
		SELECT user_id, full_name, department, email
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
		if err := rows.Scan(&member.UserID, &member.FullName, &member.Department, &member.Email); err != nil {
			return nil, 0, fmt.Errorf("failed to scan organization member: %w", err)
		}
		members = append(members, member)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating organization members: %w", err)
	}

	return members, total, nil
}

func (r *TaskRepository) AddTaskBoardMember(ctx context.Context, boardID string, userID string) (model.TaskBoardMember, error) {
	const boardQuery = `SELECT organization_id FROM task_boards WHERE id = $1`
	var organizationID string
	if err := r.db.QueryRowContext(ctx, boardQuery, boardID).Scan(&organizationID); err != nil {
		if err == sql.ErrNoRows {
			return model.TaskBoardMember{}, model.ErrTaskBoardNotFound
		}
		return model.TaskBoardMember{}, fmt.Errorf("failed to get task board organization: %w", err)
	}

	const memberQuery = `
		SELECT user_id, full_name, department, email
		FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`
	var member model.TaskBoardMember
	if err := r.db.QueryRowContext(ctx, memberQuery, organizationID, userID).Scan(
		&member.UserID,
		&member.FullName,
		&member.Department,
		&member.Email,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.TaskBoardMember{}, model.ErrTaskMemberNotFound
		}
		return model.TaskBoardMember{}, fmt.Errorf("failed to get organization member: %w", err)
	}

	const insertQuery = `
		INSERT INTO task_board_members (board_id, user_id, full_name, department, email)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (board_id, user_id)
		DO UPDATE SET full_name = EXCLUDED.full_name, department = EXCLUDED.department, email = EXCLUDED.email
	`
	if _, err := r.db.ExecContext(ctx, insertQuery, boardID, member.UserID, member.FullName, member.Department, member.Email); err != nil {
		return model.TaskBoardMember{}, fmt.Errorf("failed to add board member: %w", err)
	}

	return member, nil
}

func (r *TaskRepository) CreateOrganizationMember(ctx context.Context, organizationID string, member model.TaskBoardMember) (bool, error) {
	const query = `
		INSERT INTO organization_members (organization_id, user_id, full_name, department, email)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (organization_id, user_id) DO NOTHING
	`

	result, err := r.db.ExecContext(ctx, query, organizationID, member.UserID, member.FullName, member.Department, member.Email)
	if err != nil {
		return false, fmt.Errorf("failed to create organization member: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to check organization member insert result: %w", err)
	}

	return rowsAffected > 0, nil
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
