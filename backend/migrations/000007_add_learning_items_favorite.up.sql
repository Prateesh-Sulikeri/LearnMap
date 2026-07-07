ALTER TABLE learning_items ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_learning_items_user_favorite ON learning_items(user_id, is_favorite);
