CREATE TABLE learning_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES learning_items(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    deadline TIMESTAMPTZ,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_learning_items_user_id ON learning_items(user_id);
CREATE INDEX idx_learning_items_user_parent ON learning_items(user_id, parent_id);
CREATE INDEX idx_learning_items_user_status ON learning_items(user_id, status);
CREATE INDEX idx_learning_items_deleted_at ON learning_items(deleted_at);
