-- Password reset tokens for family members
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for quick token lookup
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);

-- Index for cleanup of expired tokens
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);
