-- A pending scheduled session (migration 000009) legitimately has hours = 0
-- until it's confirmed — the original CHECK (hours > 0) from migration 000005
-- predates scheduling and rejects that state. Relax to allow 0.
ALTER TABLE study_sessions DROP CONSTRAINT study_sessions_hours_check;
ALTER TABLE study_sessions ADD CONSTRAINT study_sessions_hours_check CHECK (hours >= 0 AND hours <= 24);
