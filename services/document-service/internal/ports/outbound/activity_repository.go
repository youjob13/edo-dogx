package outbound

import (
	"context"

	"edo/services/document-service/internal/domain/model"
)

type ActivitySubject struct {
	SubjectType string
	SubjectID   string
}

type RecordActivityInput struct {
	Event    model.ActivityEvent
	Subjects []ActivitySubject
}

type ListActivityEventsInput struct {
	ActorUserID    string
	OrganizationID string
	Limit          int
	Offset         int
	Query          string
}

type ActivityRepository interface {
	RecordEvent(ctx context.Context, input RecordActivityInput) error
	ListEvents(ctx context.Context, input ListActivityEventsInput) ([]model.ActivityEvent, int, error)
	CleanupExpiredEvents(ctx context.Context, retentionDays int) (int64, error)
}
