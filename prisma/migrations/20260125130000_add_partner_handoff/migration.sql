-- Create partner sessions and clicks tables for members-only partners hub.
CREATE TABLE IF NOT EXISTS tenant_jpvbootcamp.partner_sessions (
  session_id TEXT PRIMARY KEY,
  wp_user_id INTEGER NOT NULL,
  wp_email_hash TEXT NOT NULL,
  wp_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS partner_sessions_wp_user_id_idx
  ON tenant_jpvbootcamp.partner_sessions (wp_user_id);

CREATE INDEX IF NOT EXISTS partner_sessions_expires_at_idx
  ON tenant_jpvbootcamp.partner_sessions (expires_at);

CREATE TABLE IF NOT EXISTS tenant_jpvbootcamp.partner_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id TEXT NOT NULL,
  wp_user_id INTEGER NOT NULL,
  partner_slug TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  ref_path TEXT,
  user_agent_hash TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS partner_clicks_session_id_idx
  ON tenant_jpvbootcamp.partner_clicks (session_id);

CREATE INDEX IF NOT EXISTS partner_clicks_wp_user_id_idx
  ON tenant_jpvbootcamp.partner_clicks (wp_user_id);

CREATE INDEX IF NOT EXISTS partner_clicks_partner_slug_idx
  ON tenant_jpvbootcamp.partner_clicks (partner_slug);

CREATE INDEX IF NOT EXISTS partner_clicks_category_slug_idx
  ON tenant_jpvbootcamp.partner_clicks (category_slug);

CREATE INDEX IF NOT EXISTS partner_clicks_created_at_idx
  ON tenant_jpvbootcamp.partner_clicks (created_at);
