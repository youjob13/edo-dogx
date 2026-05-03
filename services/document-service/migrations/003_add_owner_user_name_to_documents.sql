ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS owner_user_name TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_owner_name ON documents(owner_user_name);
