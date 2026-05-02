package model

type PermissionAssignment struct {
	UserID       string
	Action       string
	Category     string
	Allowed      bool
	DecisionNote string
}

type AuditEvent struct {
	ID          string
	ActorUserID string
	ActionType  string
	TargetID    string
	Outcome     string
	Metadata    map[string]string
	OccurredAt  string
}
