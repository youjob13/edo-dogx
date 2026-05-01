package model

import (
	"errors"
	"strings"
	"time"
)

type WorkflowStatus string

const (
	WorkflowStatusRunning   WorkflowStatus = "RUNNING"
	WorkflowStatusCompleted WorkflowStatus = "COMPLETED"
)

type WorkflowDefinition struct {
	Code  string
	Steps []string
}

type WorkflowInstance struct {
	ID             string
	DocumentID     string
	CurrentStep    string
	AssignedUserID string
	Status         WorkflowStatus
	UpdatedAt      time.Time
}

func NewWorkflowInstance(id string, documentID string, firstStep string, assigneeID string, now time.Time) (WorkflowInstance, error) {
	if strings.TrimSpace(id) == "" {
		return WorkflowInstance{}, errors.New("workflow id is required")
	}
	if strings.TrimSpace(documentID) == "" {
		return WorkflowInstance{}, errors.New("document id is required")
	}
	if strings.TrimSpace(firstStep) == "" {
		return WorkflowInstance{}, errors.New("first step is required")
	}

	return WorkflowInstance{
		ID:             id,
		DocumentID:     documentID,
		CurrentStep:    firstStep,
		AssignedUserID: assigneeID,
		Status:         WorkflowStatusRunning,
		UpdatedAt:      now,
	}, nil
}

func (w WorkflowInstance) Approve(nextStep string, assigneeID string, now time.Time) WorkflowInstance {
	if strings.TrimSpace(nextStep) == "" {
		w.Status = WorkflowStatusCompleted
	} else {
		w.CurrentStep = strings.TrimSpace(nextStep)
		w.AssignedUserID = strings.TrimSpace(assigneeID)
	}
	w.UpdatedAt = now
	return w
}
