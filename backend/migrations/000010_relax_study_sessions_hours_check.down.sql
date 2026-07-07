ALTER TABLE study_sessions DROP CONSTRAINT study_sessions_hours_check;
ALTER TABLE study_sessions ADD CONSTRAINT study_sessions_hours_check CHECK (hours > 0 AND hours <= 24);
