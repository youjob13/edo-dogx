package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"
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
			return model.TaskBoardDetails{}, model.ErrTaskNotFound
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
		SELECT id, title, description, status, task_type,
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
		var task model.Task
		var taskType, status string
		var dueDate sql.NullTime
		var approverUserID, approverUserName sql.NullString
		var decision, decisionComment sql.NullString

		if err := taskRows.Scan(
			&task.ID,
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
		); err != nil {
			return model.TaskBoardDetails{}, fmt.Errorf("failed to scan task board task: %w", err)
		}

		task.TaskType = model.TaskType(taskType)
		task.Status = model.TaskStatus(status)

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
			decisionValue := model.TaskDecision(decision.String)
			task.Decision = &decisionValue
		}
		if decisionComment.Valid {
			task.DecisionComment = &decisionComment.String
		}

		board.Tasks = append(board.Tasks, task)
	}
	if err := taskRows.Err(); err != nil {
		return model.TaskBoardDetails{}, fmt.Errorf("error iterating task board tasks: %w", err)
	}

	board.AllowedGrouping = []string{"assignee", "department", "group"}
	return board, nil
}

func (r *TaskRepository) CreateTask(ctx context.Context, task model.Task) (model.Task, error) {
	const query = `
		INSERT INTO tasks (
			board_id, title, description, status, task_type,
			creator_user_id, creator_user_name,
			assignee_user_id, assignee_user_name,
			approver_user_id, approver_user_name,
			due_date
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`

	row := r.db.QueryRowContext(ctx, query,
		task.BoardID,
		task.Title,
		task.Description,
		string(task.Status),
		string(task.TaskType),
		task.CreatedByUserID,
		task.CreatedByUserName,
		task.AssignedUserID,
		task.AssignedUserName,
		task.ApproverUserID,
		task.ApproverUserName,
		task.DueDate,
	)

	if err := row.Scan(&task.ID, &task.CreatedAt, &task.UpdatedAt); err != nil {
		return model.Task{}, fmt.Errorf("failed to create task: %w", err)
	}

	return task, nil
}

func (r *TaskRepository) UpdateTaskStatus(ctx context.Context, taskID string, newStatus model.TaskStatus, updatedByUserID string, updatedByUserName string) error {
	const query = `
		UPDATE tasks
		SET status = $1, updated_by_user_id = $2, updated_by_user_name = $3, updated_at = NOW()
		WHERE id = $4
	`

	result, err := r.db.ExecContext(ctx, query, string(newStatus), updatedByUserID, updatedByUserName, taskID)
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

	return nil
}

func (r *TaskRepository) GetTask(ctx context.Context, taskID string) (model.Task, error) {
	const query = `
		SELECT id, document_id, task_type, title, description, status,
			   assigned_user_id, assigned_user_name, created_by_user_id,
			   created_by_user_name, due_date, priority, metadata_json,
			   created_at, updated_at, updated_by_user_id, updated_by_user_name
		FROM tasks
		WHERE id = $1
	`

	var task model.Task
	var taskType, status string
	var metadataJSON []byte
	var dueDate sql.NullTime
	var updatedByUserID, updatedByUserName sql.NullString

	err := r.db.QueryRowContext(ctx, query, taskID).Scan(
		&task.ID, &task.DocumentID, &taskType, &task.Title, &task.Description, &status,
		&task.AssignedUserID, &task.AssignedUserName, &task.CreatedByUserID,
		&task.CreatedByUserName, &dueDate, &task.Priority, &metadataJSON,
		&task.CreatedAt, &task.UpdatedAt, &updatedByUserID, &updatedByUserName,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return model.Task{}, model.ErrTaskNotFound
		}
		return model.Task{}, fmt.Errorf("failed to get task: %w", err)
	}

	task.TaskType = model.TaskType(taskType)
	task.Status = model.TaskStatus(status)

	if dueDate.Valid {
		task.DueDate = &dueDate.Time
	}

	if updatedByUserID.Valid {
		task.UpdatedByUserID = &updatedByUserID.String
	}
	if updatedByUserName.Valid {
		task.UpdatedByUserName = &updatedByUserName.String
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &task.Metadata); err != nil {
			return model.Task{}, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return task, nil
}

func (r *TaskRepository) ListTasks(ctx context.Context, filter outbound.TaskFilter) ([]model.Task, error) {
	query := `
		SELECT id, document_id, task_type, title, description, status,
			   assigned_user_id, assigned_user_name, created_by_user_id,
			   created_by_user_name, due_date, priority, metadata_json,
			   created_at, updated_at, updated_by_user_id, updated_by_user_name
		FROM tasks
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 0

	if filter.DocumentID != nil {
		argCount++
		query += fmt.Sprintf(" AND document_id = $%d", argCount)
		args = append(args, *filter.DocumentID)
	}

	if filter.AssignedUserID != nil {
		argCount++
		query += fmt.Sprintf(" AND assigned_user_id = $%d", argCount)
		args = append(args, *filter.AssignedUserID)
	}

	if filter.Status != nil {
		argCount++
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, string(*filter.Status))
	}

	if filter.TaskType != nil {
		argCount++
		query += fmt.Sprintf(" AND task_type = $%d", argCount)
		args = append(args, string(*filter.TaskType))
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

	var tasks []model.Task
	for rows.Next() {
		var task model.Task
		var taskType, status string
		var metadataJSON []byte
		var dueDate sql.NullTime
		var updatedByUserID, updatedByUserName sql.NullString

		err := rows.Scan(
			&task.ID, &task.DocumentID, &taskType, &task.Title, &task.Description, &status,
			&task.AssignedUserID, &task.AssignedUserName, &task.CreatedByUserID,
			&task.CreatedByUserName, &dueDate, &task.Priority, &metadataJSON,
			&task.CreatedAt, &task.UpdatedAt, &updatedByUserID, &updatedByUserName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan task: %w", err)
		}

		task.TaskType = model.TaskType(taskType)
		task.Status = model.TaskStatus(status)

		if dueDate.Valid {
			task.DueDate = &dueDate.Time
		}

		if updatedByUserID.Valid {
			task.UpdatedByUserID = &updatedByUserID.String
		}
		if updatedByUserName.Valid {
			task.UpdatedByUserName = &updatedByUserName.String
		}

		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &task.Metadata); err != nil {
				return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

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

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	const query = `
		INSERT INTO task_attachments (task_id, file_name, file_path, file_size, mime_type, uploaded_by_user_id, uploaded_by_user_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	for _, attachment := range attachments {
		_, err = tx.ExecContext(ctx, query,
			taskID, attachment.FileName, attachment.FilePath, attachment.FileSize,
			attachment.MimeType, attachment.UploadedByUserID, attachment.UploadedByUserName,
		)
		if err != nil {
			return fmt.Errorf("failed to insert attachment: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (r *TaskRepository) GetTaskAttachments(ctx context.Context, taskID string) ([]model.TaskAttachment, error) {
	const query = `
		SELECT id, task_id, file_name, file_path, file_size, mime_type,
			   uploaded_by_user_id, uploaded_by_user_name, uploaded_at
		FROM task_attachments
		WHERE task_id = $1
		ORDER BY uploaded_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task attachments: %w", err)
	}
	defer rows.Close()

	var attachments []model.TaskAttachment
	for rows.Next() {
		var attachment model.TaskAttachment
		err := rows.Scan(
			&attachment.ID, &attachment.TaskID, &attachment.FileName, &attachment.FilePath,
			&attachment.FileSize, &attachment.MimeType, &attachment.UploadedByUserID,
			&attachment.UploadedByUserName, &attachment.UploadedAt,
		)
		if err != nil {
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
