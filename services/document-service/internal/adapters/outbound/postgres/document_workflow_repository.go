package postgres

import (
	"context"
	"database/sql"
	"strings"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"
)

type DocumentWorkflowRepository struct {
	db *sql.DB
}

func NewDocumentWorkflowRepository(db *sql.DB) *DocumentWorkflowRepository {
	return &DocumentWorkflowRepository{db: db}
}

func (r *DocumentWorkflowRepository) Transition(ctx context.Context, input outbound.WorkflowTransitionInput) (outbound.WorkflowTransitionResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}
	defer tx.Rollback()

	document, err := lockWorkflowDocument(ctx, tx, input.DocumentID)
	if err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}
	allowed, err := actorCanAccessOrganizationTx(ctx, tx, document.OrganizationID, input.ActorUserID)
	if err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}
	if !allowed && document.OwnerUser != input.ActorUserID {
		return outbound.WorkflowTransitionResult{}, model.ErrDocumentAccessDenied
	}
	if input.ExpectedVersion > 0 && document.Version != input.ExpectedVersion {
		return outbound.WorkflowTransitionResult{}, model.NewVersionConflictError(input.ExpectedVersion, document.Version)
	}
	if !workflowStatusAllowed(input.AllowedFrom, document.Status) {
		return outbound.WorkflowTransitionResult{}, model.NewInvalidDocumentStatusTransitionError(document.Status, input.TargetStatus)
	}

	workflow, found, err := lockDocumentWorkflow(ctx, tx, input.DocumentID)
	if err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}
	if !found && (!input.AllowCreate || document.Status != model.DocumentStatusDraft) {
		return outbound.WorkflowTransitionResult{}, model.ErrWorkflowNotFound
	}

	previousStatus := document.Status
	eventType := input.EventType
	if eventType == "SUBMITTED" && previousStatus == model.DocumentStatusChangesRequested {
		eventType = "RESUBMITTED"
	}
	if !found {
		workflow, err = createDocumentWorkflow(ctx, tx, input, document.OrganizationID, document.Version)
	} else {
		workflow, err = updateDocumentWorkflow(ctx, tx, workflow.ID, input, document.Version)
	}
	if err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}

	if err := tx.QueryRowContext(
		ctx,
		`UPDATE documents SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING updated_at`,
		document.ID,
		string(input.TargetStatus),
	).Scan(&document.UpdatedAt); err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}
	document.Status = input.TargetStatus

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO document_workflow_events (
			workflow_id, document_id, actor_user_id, event_type,
			previous_status, new_status, document_version, comment
		) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, NULLIF($8, ''))`,
		workflow.ID,
		document.ID,
		input.ActorUserID,
		eventType,
		string(previousStatus),
		string(input.TargetStatus),
		document.Version,
		strings.TrimSpace(input.Comment),
	); err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}

	if err := tx.Commit(); err != nil {
		return outbound.WorkflowTransitionResult{}, err
	}

	return outbound.WorkflowTransitionResult{Document: document, Workflow: workflow}, nil
}

func lockWorkflowDocument(ctx context.Context, tx *sql.Tx, documentID string) (model.Document, error) {
	var document model.Document
	err := tx.QueryRowContext(ctx, `
		SELECT id, title, category, organization_id, status, owner_user_id,
		       COALESCE(owner_user_name, owner_user_id),
		       current_version_number, created_at, updated_at
		FROM documents
		WHERE id = $1
		FOR UPDATE`,
		documentID,
	).Scan(
		&document.ID,
		&document.Title,
		&document.Category,
		&document.OrganizationID,
		&document.Status,
		&document.OwnerUser,
		&document.OwnerUserName,
		&document.Version,
		&document.CreatedAt,
		&document.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return model.Document{}, model.ErrDocumentNotFound
	}
	return document, err
}

func lockDocumentWorkflow(ctx context.Context, tx *sql.Tx, documentID string) (model.WorkflowInstance, bool, error) {
	var workflow model.WorkflowInstance
	var decisionComment sql.NullString
	var decidedAt sql.NullTime
	err := tx.QueryRowContext(ctx, `
		SELECT id::text, document_id::text, organization_id, submitted_version,
		       status, submitted_by_user_id, approver_user_id, decision_comment,
		       submitted_at, decided_at, updated_at
		FROM document_workflows
		WHERE document_id = $1
		FOR UPDATE`,
		documentID,
	).Scan(
		&workflow.ID,
		&workflow.DocumentID,
		&workflow.OrganizationID,
		&workflow.SubmittedVersion,
		&workflow.Status,
		&workflow.SubmittedByUserID,
		&workflow.ApproverUserID,
		&decisionComment,
		&workflow.SubmittedAt,
		&decidedAt,
		&workflow.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return model.WorkflowInstance{}, false, nil
	}
	if err != nil {
		return model.WorkflowInstance{}, false, err
	}
	if decisionComment.Valid {
		workflow.DecisionComment = decisionComment.String
	}
	if decidedAt.Valid {
		workflow.DecidedAt = &decidedAt.Time
	}
	return workflow, true, nil
}

func createDocumentWorkflow(ctx context.Context, tx *sql.Tx, input outbound.WorkflowTransitionInput, organizationID string, documentVersion int64) (model.WorkflowInstance, error) {
	var workflow model.WorkflowInstance
	err := tx.QueryRowContext(ctx, `
		INSERT INTO document_workflows (
			document_id, organization_id, submitted_version, status,
			submitted_by_user_id, approver_user_id
		) VALUES ($1::uuid, $2, $3, $4, $5, $6)
		RETURNING id::text, document_id::text, organization_id, submitted_version,
		          status, submitted_by_user_id, approver_user_id,
		          submitted_at, updated_at`,
		input.DocumentID,
		organizationID,
		documentVersion,
		string(input.TargetStatus),
		input.ActorUserID,
		strings.TrimSpace(input.ApproverUserID),
	).Scan(
		&workflow.ID,
		&workflow.DocumentID,
		&workflow.OrganizationID,
		&workflow.SubmittedVersion,
		&workflow.Status,
		&workflow.SubmittedByUserID,
		&workflow.ApproverUserID,
		&workflow.SubmittedAt,
		&workflow.UpdatedAt,
	)
	return workflow, err
}

func updateDocumentWorkflow(ctx context.Context, tx *sql.Tx, workflowID string, input outbound.WorkflowTransitionInput, documentVersion int64) (model.WorkflowInstance, error) {
	var workflow model.WorkflowInstance
	var decisionComment sql.NullString
	var decidedAt sql.NullTime

	isSubmission := input.TargetStatus == model.DocumentStatusInReview
	isDecision := input.TargetStatus == model.DocumentStatusApproved || input.TargetStatus == model.DocumentStatusChangesRequested
	err := tx.QueryRowContext(ctx, `
		UPDATE document_workflows
		SET submitted_version = CASE WHEN $3 THEN $4 ELSE submitted_version END,
		    status = $5,
		    submitted_by_user_id = CASE WHEN $3 THEN $6 ELSE submitted_by_user_id END,
		    approver_user_id = CASE
		        WHEN $3 THEN NULLIF($7, '')
		        ELSE approver_user_id
		    END,
		    decision_comment = CASE
		        WHEN $3 THEN NULL
		        WHEN $8 THEN NULLIF($9, '')
		        ELSE decision_comment
		    END,
		    submitted_at = CASE WHEN $3 THEN NOW() ELSE submitted_at END,
		    decided_at = CASE
		        WHEN $3 THEN NULL
		        WHEN $8 THEN NOW()
		        ELSE decided_at
		    END,
		    updated_at = NOW()
		WHERE id = $1::uuid AND document_id = $2::uuid
		RETURNING id::text, document_id::text, organization_id, submitted_version,
		          status, submitted_by_user_id, approver_user_id, decision_comment,
		          submitted_at, decided_at, updated_at`,
		workflowID,
		input.DocumentID,
		isSubmission,
		documentVersion,
		string(input.TargetStatus),
		input.ActorUserID,
		strings.TrimSpace(input.ApproverUserID),
		isDecision,
		strings.TrimSpace(input.Comment),
	).Scan(
		&workflow.ID,
		&workflow.DocumentID,
		&workflow.OrganizationID,
		&workflow.SubmittedVersion,
		&workflow.Status,
		&workflow.SubmittedByUserID,
		&workflow.ApproverUserID,
		&decisionComment,
		&workflow.SubmittedAt,
		&decidedAt,
		&workflow.UpdatedAt,
	)
	if decisionComment.Valid {
		workflow.DecisionComment = decisionComment.String
	}
	if decidedAt.Valid {
		workflow.DecidedAt = &decidedAt.Time
	}
	return workflow, err
}

func (r *DocumentWorkflowRepository) GetByDocumentID(ctx context.Context, documentID string, actorUserID string) (model.WorkflowInstance, error) {
	workflow, ownerUserID, err := r.loadWorkflowWithAccess(ctx, documentID)
	if err != nil {
		return model.WorkflowInstance{}, err
	}
	allowed, err := actorCanAccessOrganization(ctx, r.db, workflow.OrganizationID, actorUserID)
	if err != nil {
		return model.WorkflowInstance{}, err
	}
	if !allowed && ownerUserID != actorUserID {
		return model.WorkflowInstance{}, model.ErrDocumentAccessDenied
	}
	
	// Resolve submitted by user name if empty
	if strings.TrimSpace(workflow.SubmittedByUserName) == "" || workflow.SubmittedByUserName == workflow.SubmittedByUserID {
		if resolved := resolveNameByUserID(ctx, r.db, workflow.OrganizationID, workflow.SubmittedByUserID); resolved != "" {
			workflow.SubmittedByUserName = resolved
		}
	}
	
	// Resolve approver user name if empty
	if strings.TrimSpace(workflow.ApproverUserName) == "" || workflow.ApproverUserName == workflow.ApproverUserID {
		if resolved := resolveNameByUserID(ctx, r.db, workflow.OrganizationID, workflow.ApproverUserID); resolved != "" {
			workflow.ApproverUserName = resolved
		}
	}
	
	return workflow, nil
}

func (r *DocumentWorkflowRepository) ListEvents(ctx context.Context, documentID string, actorUserID string, limit int, offset int) ([]model.WorkflowEvent, int64, error) {
	workflow, ownerUserID, err := r.loadWorkflowWithAccess(ctx, documentID)
	if err != nil {
		return nil, 0, err
	}
	allowed, err := actorCanAccessOrganization(ctx, r.db, workflow.OrganizationID, actorUserID)
	if err != nil {
		return nil, 0, err
	}
	if !allowed && ownerUserID != actorUserID {
		return nil, 0, model.ErrDocumentAccessDenied
	}
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM document_workflow_events
		WHERE document_id = $1::uuid`,
		documentID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id::text, workflow_id::text, document_id::text, actor_user_id, event_type,
		       previous_status, new_status, document_version, COALESCE(comment, ''), occurred_at
		FROM document_workflow_events
		WHERE document_id = $1::uuid
		ORDER BY occurred_at DESC
		LIMIT $2 OFFSET $3`,
		documentID,
		limit,
		offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]model.WorkflowEvent, 0, limit)
	for rows.Next() {
		var item model.WorkflowEvent
		if err := rows.Scan(
			&item.ID,
			&item.WorkflowID,
			&item.DocumentID,
			&item.ActorUserID,
			&item.EventType,
			&item.PreviousStatus,
			&item.NewStatus,
			&item.DocumentVersion,
			&item.Comment,
			&item.OccurredAt,
		); err != nil {
			return nil, 0, err
		}
		
		// Resolve actor user name if empty (use workflow's organization ID)
		if strings.TrimSpace(item.ActorUserName) == "" || item.ActorUserName == item.ActorUserID {
			if resolved := resolveNameByUserID(ctx, r.db, workflow.OrganizationID, item.ActorUserID); resolved != "" {
				item.ActorUserName = resolved
			}
		}
		
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *DocumentWorkflowRepository) loadWorkflowWithAccess(ctx context.Context, documentID string) (model.WorkflowInstance, string, error) {
	var workflow model.WorkflowInstance
	var ownerUserID string
	var decisionComment sql.NullString
	var decidedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, `
		SELECT dw.id::text, dw.document_id::text, dw.organization_id, dw.submitted_version,
		       dw.status, dw.submitted_by_user_id, dw.approver_user_id, dw.decision_comment,
		       dw.submitted_at, dw.decided_at, dw.updated_at, d.owner_user_id
		FROM document_workflows dw
		INNER JOIN documents d ON d.id = dw.document_id
		WHERE dw.document_id = $1::uuid`,
		documentID,
	).Scan(
		&workflow.ID,
		&workflow.DocumentID,
		&workflow.OrganizationID,
		&workflow.SubmittedVersion,
		&workflow.Status,
		&workflow.SubmittedByUserID,
		&workflow.ApproverUserID,
		&decisionComment,
		&workflow.SubmittedAt,
		&decidedAt,
		&workflow.UpdatedAt,
		&ownerUserID,
	)
	if err == sql.ErrNoRows {
		return model.WorkflowInstance{}, "", model.ErrWorkflowNotFound
	}
	if err != nil {
		return model.WorkflowInstance{}, "", err
	}
	if decisionComment.Valid {
		workflow.DecisionComment = decisionComment.String
	}
	if decidedAt.Valid {
		workflow.DecidedAt = &decidedAt.Time
	}
	return workflow, ownerUserID, nil
}

func actorCanAccessOrganization(ctx context.Context, db *sql.DB, organizationID string, actorUserID string) (bool, error) {
	if strings.TrimSpace(actorUserID) == "" || strings.TrimSpace(organizationID) == "" {
		return false, nil
	}
	var exists bool
	err := db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM organization_members
			WHERE organization_id = $1 AND user_id = $2
		)
	`, organizationID, actorUserID).Scan(&exists)
	return exists, err
}

func workflowStatusAllowed(statuses []model.DocumentStatus, status model.DocumentStatus) bool {
	for _, allowed := range statuses {
		if allowed == status {
			return true
		}
	}
	return false
}

var _ outbound.DocumentWorkflowRepository = (*DocumentWorkflowRepository)(nil)
