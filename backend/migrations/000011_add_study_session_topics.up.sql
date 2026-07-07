-- A study session can cover multiple topics (e.g. studying two related
-- subjects in one sitting). study_sessions.learning_item_id is kept as the
-- "primary" topic (first one chosen) for backward compatibility with
-- existing rows and simple queries; this join table holds the full set,
-- including the primary, for every session going forward.
CREATE TABLE study_session_topics (
    study_session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    learning_item_id UUID NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
    PRIMARY KEY (study_session_id, learning_item_id)
);

CREATE INDEX idx_study_session_topics_item ON study_session_topics(learning_item_id);

-- Backfill: every existing session's single topic becomes its one entry here.
INSERT INTO study_session_topics (study_session_id, learning_item_id)
SELECT id, learning_item_id FROM study_sessions;
