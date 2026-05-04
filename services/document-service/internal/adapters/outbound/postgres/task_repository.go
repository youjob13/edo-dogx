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

func (r *TaskRepository) CreateTask(ctx context.Context, task model.Task) (model.Task, error) {
	metadataJSON, err := json.Marshal(task.Metadata)
	if err != nil {
		return model.Task{}, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	const query = `
		INSERT INTO tasks (
			document_id, task_type, title, description, status,
			assigned_user_id, assigned_user_name, created_by_user_id,
			created_by_user_name, due_date, priority, metadata_json
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`

	row := r.db.QueryRowContext(ctx, query,
		task.DocumentID, string(task.TaskType), task.Title, task.Description,
		string(task.Status), task.AssignedUserID, task.AssignedUserName,
		task.CreatedByUserID, task.CreatedByUserName, task.DueDate,
		task.Priority, metadataJSON,
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
