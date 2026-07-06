CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learning_item_id UUID NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
    hours REAL NOT NULL CHECK (hours > 0 AND hours <= 24),
    notes TEXT,
    session_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_user_date ON study_sessions(user_id, session_date);
CREATE INDEX idx_study_sessions_learning_item_id ON study_sessions(learning_item_id);
