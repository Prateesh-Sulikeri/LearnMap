-- Add scheduling fields to study_sessions to support scheduled sessions
-- (future time blocks) with optional completion confirmation.
-- Existing sessions (logged retroactively via "Add Session") have all three NULL
-- and are always shown as complete.
ALTER TABLE study_sessions
ADD COLUMN scheduled_start TIMESTAMPTZ,
ADD COLUMN scheduled_end TIMESTAMPTZ,
ADD COLUMN confirmed_at TIMESTAMPTZ;

-- Compound index for efficient queries on scheduled/pending sessions
CREATE INDEX idx_study_sessions_scheduled ON study_sessions(user_id, scheduled_end, confirmed_at)
WHERE scheduled_end IS NOT NULL;
