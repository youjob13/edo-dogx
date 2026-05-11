CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    category VARCHAR(32) NOT NULL,
    owner_user_id TEXT NOT NULL,
    owner_user_name TEXT,
    version BIGINT NOT NULL DEFAULT 1,
    current_version_number BIGINT NOT NULL DEFAULT 1,
    current_object_key TEXT,
    current_object_version_id TEXT,
    content_document_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number BIGINT NOT NULL,
    title VARCHAR(300) NOT NULL,
    category VARCHAR(32) NOT NULL,
    changed_by_user_id TEXT NOT NULL,
    change_summary TEXT NOT NULL,
    object_key TEXT,
    object_version_id TEXT,
    content_document_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_versions_doc_version UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS editor_control_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type VARCHAR(32) NOT NULL,
    context_key TEXT NOT NULL,
    enabled_controls JSONB NOT NULL DEFAULT '[]'::jsonb,
    disabled_controls JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_user_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_editor_control_profiles_context UNIQUE (context_type, context_key)
);

CREATE TABLE IF NOT EXISTS export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    requested_by_user_id TEXT NOT NULL,
    target_format VARCHAR(16) NOT NULL,
    source_version BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    error_code TEXT,
    error_message TEXT,
    artifact_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_request_id UUID NOT NULL REFERENCES export_requests(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    format VARCHAR(16) NOT NULL,
    storage_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum TEXT NOT NULL,
    payload_base64 TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES task_boards(id) ON DELETE SET NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    task_type VARCHAR(32) NOT NULL DEFAULT 'approval',
    creator_user_id TEXT NOT NULL,
    creator_user_name TEXT NOT NULL,
    assignee_user_id TEXT NOT NULL,
    assignee_user_name TEXT NOT NULL,
    approver_user_id TEXT,
    approver_user_name TEXT,
    decision VARCHAR(32),
    decision_comment TEXT,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_board_members (
    board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
    title VARCHAR(300) NOT NULL,
    category VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

-- INSERT INTO organization_members (organization_id, user_id, full_name, department, email)
-- VALUES
--     ('org-main', 'approver-001', 'Мария Курапова', 'Менеджер', 'maria.kurapova@example.com'),
--     ('org-main', 'approver-002', 'Алексей Долматов', 'Бухгалтер', 'alexey.dolmatov@example.com'),
--     ('org-main', 'approver-003', 'Александр Ваш', 'Рекрутер', 'sashka.vash@example.com')
-- ON CONFLICT (organization_id, user_id)
-- DO UPDATE SET
--     full_name = EXCLUDED.full_name,
--     department = EXCLUDED.department,
--     email = EXCLUDED.email;

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner_name ON documents(owner_user_name);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id_version ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_editor_control_profiles_context ON editor_control_profiles(context_type, context_key);
CREATE INDEX IF NOT EXISTS idx_export_requests_document_id ON export_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_export_requests_status ON export_requests(status);
CREATE INDEX IF NOT EXISTS idx_export_artifacts_export_request_id ON export_artifacts(export_request_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_user_id ON tasks(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_user_id ON tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_approver_user_id ON tasks(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_document_id ON task_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_task_boards_organization_id ON task_boards(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_board_members_board_id ON task_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
