ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN social_links JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT true;

-- Usernames are always stored lowercase by the application (never mixed
-- case), so a plain unique index is sufficient to prevent "Alice"/"alice"
-- both being claimed.
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
