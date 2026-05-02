-- EDO database initialisation
-- Runs once when the Postgres container starts for the first time.

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- document-service: 001_document_create_edit
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    category VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    owner_user_id TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number BIGINT NOT NULL,
    title VARCHAR(300) NOT NULL,
    category VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    changed_by_user_id TEXT NOT NULL,
    change_summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_versions_doc_version UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);

-- ============================================================
-- document-service: 002_editor_profiles_and_exports
-- ============================================================
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS content_document_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE document_versions
    ADD COLUMN IF NOT EXISTS content_document_json JSONB NOT NULL DEFAULT '{}'::jsonb;

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

CREATE INDEX IF NOT EXISTS idx_editor_control_profiles_context
    ON editor_control_profiles(context_type, context_key);

CREATE INDEX IF NOT EXISTS idx_export_requests_document_id
    ON export_requests(document_id);

CREATE INDEX IF NOT EXISTS idx_export_requests_status
    ON export_requests(status);

CREATE INDEX IF NOT EXISTS idx_export_artifacts_export_request_id
    ON export_artifacts(export_request_id);
