CREATE TABLE IF NOT EXISTS organization_members (
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

INSERT INTO organization_members (organization_id, user_id, full_name, department, email)
SELECT
    b.organization_id,
    bm.user_id,
    bm.full_name,
    bm.department,
    bm.email
FROM task_board_members bm
JOIN task_boards b ON b.id = bm.board_id
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, full_name, department, email)
VALUES
    ('org-main', 'approver-001', 'Maria Garcia', 'Legal', 'maria.garcia@example.com'),
    ('org-main', 'approver-002', 'Ahmed Hassan', 'Finance', 'ahmed.hassan@example.com'),
    ('org-main', 'approver-003', 'Sophie Laurent', 'HR', 'sophie.laurent@example.com')
ON CONFLICT (organization_id, user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
