-- Rollback: remove scheduling fields
DROP INDEX IF EXISTS idx_study_sessions_scheduled;

ALTER TABLE study_sessions
DROP COLUMN scheduled_start,
DROP COLUMN scheduled_end,
DROP COLUMN confirmed_at;
