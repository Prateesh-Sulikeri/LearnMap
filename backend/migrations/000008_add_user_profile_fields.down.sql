DROP INDEX idx_users_username;
ALTER TABLE users DROP COLUMN is_public;
ALTER TABLE users DROP COLUMN social_links;
ALTER TABLE users DROP COLUMN bio;
ALTER TABLE users DROP COLUMN username;
