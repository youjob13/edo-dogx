CREATE TABLE IF NOT EXISTS document_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,
    submitted_version BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    submitted_by_user_id TEXT NOT NULL,
    approver_user_id TEXT NOT NULL DEFAULT '',
    decision_comment TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_workflows_document UNIQUE (document_id)
);

CREATE TABLE IF NOT EXISTS document_workflow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES document_workflows(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    actor_user_id TEXT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    previous_status VARCHAR(32) NOT NULL,
    new_status VARCHAR(32) NOT NULL,
    document_version BIGINT NOT NULL,
    comment TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_workflows_organization
    ON document_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_workflows_approver_status
    ON document_workflows(approver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_document_workflows_status_submitted
    ON document_workflows(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_workflow_events_document
    ON document_workflow_events(document_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_workflow_events_workflow
    ON document_workflow_events(workflow_id, occurred_at ASC);
