-- STROOM Cloudflare D1 Migration 0003: Internal Bridge Replay Nonces
-- Target: Cloudflare D1 Database ONLY (Strictly isolated from SQLite data/stroom.db)

CREATE TABLE IF NOT EXISTS _internal_bridge_nonces (
  nonce TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bridge_nonces_expires_at ON _internal_bridge_nonces(expires_at);
