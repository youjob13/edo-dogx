package model

import (
	"errors"
	"strings"
	"time"
)

type NotificationDeliveryStatus string

const (
	NotificationDeliveryStatusPending  NotificationDeliveryStatus = "PENDING"
	NotificationDeliveryStatusSent     NotificationDeliveryStatus = "SENT"
	NotificationDeliveryStatusFailed   NotificationDeliveryStatus = "FAILED"
	NotificationDeliveryStatusRetrying NotificationDeliveryStatus = "RETRYING"
)

type NotificationEvent struct {
	ID              string
	EventType       string
	RecipientUserID string
	DocumentID      string
	Payload         map[string]string
	DeliveryStatus  NotificationDeliveryStatus
	CreatedAt       time.Time
	SentAt          *time.Time
	FailureReason   string
	RetryCount      int
}

func NewNotificationEvent(
	id string,
	eventType string,
	recipientUserID string,
	documentID string,
	payload map[string]string,
	now time.Time,
) (NotificationEvent, error) {
	if strings.TrimSpace(id) == "" {
		return NotificationEvent{}, errors.New("notification id is required")
	}
	if strings.TrimSpace(eventType) == "" {
		return NotificationEvent{}, errors.New("event type is required")
	}
	if strings.TrimSpace(recipientUserID) == "" {
		return NotificationEvent{}, errors.New("recipient user id is required")
	}

	cleanPayload := map[string]string{}
	for k, v := range payload {
		if strings.TrimSpace(k) == "" {
			continue
		}
		cleanPayload[strings.TrimSpace(k)] = strings.TrimSpace(v)
	}

	return NotificationEvent{
		ID:              strings.TrimSpace(id),
		EventType:       strings.TrimSpace(eventType),
		RecipientUserID: strings.TrimSpace(recipientUserID),
		DocumentID:      strings.TrimSpace(documentID),
		Payload:         cleanPayload,
		DeliveryStatus:  NotificationDeliveryStatusPending,
		CreatedAt:       now,
	}, nil
}

func (e NotificationEvent) MarkSent(now time.Time) NotificationEvent {
	e.DeliveryStatus = NotificationDeliveryStatusSent
	e.SentAt = &now
	e.FailureReason = ""
	return e
}

func (e NotificationEvent) MarkFailed(reason string) NotificationEvent {
	e.DeliveryStatus = NotificationDeliveryStatusFailed
	e.FailureReason = strings.TrimSpace(reason)
	return e
}

func (e NotificationEvent) MarkRetrying() NotificationEvent {
	e.DeliveryStatus = NotificationDeliveryStatusRetrying
	e.RetryCount++
	return e
}
