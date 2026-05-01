package model

import (
	"errors"
	"strings"
	"time"
)

type AuditOutcome string

const (
	AuditOutcomeSuccess AuditOutcome = "SUCCESS"
	AuditOutcomeDenied  AuditOutcome = "DENIED"
	AuditOutcomeFailed  AuditOutcome = "FAILED"
)

type AuditEvent struct {
	ID          string
	ActorUserID string
	ActionType  string
	TargetType  string
	TargetID    string
	Outcome     AuditOutcome
	OccurredAt  time.Time
}

func NewAuditEvent(
	id string,
	actorUserID string,
	actionType string,
	targetType string,
	targetID string,
	outcome AuditOutcome,
	now time.Time,
) (AuditEvent, error) {
	if strings.TrimSpace(id) == "" {
		return AuditEvent{}, errors.New("audit event id is required")
	}
	if strings.TrimSpace(actorUserID) == "" {
		return AuditEvent{}, errors.New("actor user id is required")
	}
	if strings.TrimSpace(actionType) == "" {
		return AuditEvent{}, errors.New("action type is required")
	}
	if strings.TrimSpace(targetID) == "" {
		return AuditEvent{}, errors.New("target id is required")
	}

	return AuditEvent{
		ID:          strings.TrimSpace(id),
		ActorUserID: strings.TrimSpace(actorUserID),
		ActionType:  strings.TrimSpace(actionType),
		TargetType:  strings.TrimSpace(targetType),
		TargetID:    strings.TrimSpace(targetID),
		Outcome:     outcome,
		OccurredAt:  now,
	}, nil
}
