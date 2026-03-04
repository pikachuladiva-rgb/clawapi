CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name TEXT NOT NULL,
    api_key_hash TEXT UNIQUE NOT NULL,
    api_key_prefix TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    org_id UUID NOT NULL REFERENCES organizations (id),
    name TEXT NOT NULL,
    base_url TEXT,
    api_key TEXT,
    model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    system_prompt TEXT DEFAULT '',
    tools_config JSONB DEFAULT '[]',
    rate_limit_config JSONB DEFAULT '{"rpm": 60, "tpm": 100000}',
    max_context_tokens INTEGER DEFAULT 180000,
    workspace_path TEXT,
    active_skills JSONB DEFAULT '[]',
    context_strategy TEXT DEFAULT 'sliding_window',
    use_agent_sdk BOOLEAN DEFAULT true,
    default_stream BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    project_id UUID NOT NULL REFERENCES projects (id),
    user_id TEXT,
    title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    session_id UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT,
    tool_use JSONB,
    tool_result JSONB,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    org_id UUID NOT NULL REFERENCES organizations (id),
    project_id UUID NOT NULL REFERENCES projects (id),
    session_id UUID NOT NULL REFERENCES sessions (id),
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    tool_calls INTEGER DEFAULT 0,
    model TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects (org_id);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions (project_id);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id);

CREATE INDEX IF NOT EXISTS idx_usage_org ON usage_logs (org_id);

CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_logs (project_id);