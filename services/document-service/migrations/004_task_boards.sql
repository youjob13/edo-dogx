CREATE TABLE IF NOT EXISTS task_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
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

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES task_boards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_task_boards_organization_id ON task_boards(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_board_members_board_id ON task_board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id);
