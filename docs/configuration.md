# Configuration

Complete guide to configuring ClawAPI.

## Environment Variables

### Required

```env
PORT=3100
NODE_ENV=development
DATABASE_URL=postgresql://clawapi:clawapi@localhost:5433/clawapi
REDIS_URL=redis://localhost:6380
JWT_SECRET=change-me-in-production
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> **`ANTHROPIC_API_KEY`** is required for the Agent SDK (web search, web fetch). Without it, Agent SDK calls will fail.

### Ports

| Service | Default Port | Configurable Via |
|---------|-------------|-----------------|
| ClawAPI | 3100 | `PORT` |
| PostgreSQL | 5433 | `docker-compose.yml` |
| Redis | 6380 | `docker-compose.yml` |

---

## Project Settings

Each project has its own configuration. Settings can be managed via the Admin UI (`/admin.html`) or the API (`PATCH /v1/projects/:id`).

### Message Processing Mode

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `use_agent_sdk` | boolean | `true` | **On:** Uses Agent SDK (real web search, web fetch, file tools). **Off:** Uses Legacy Messages API (faster, accurate token tracking) |
| `default_stream` | boolean | `true` | **On:** SSE streaming responses. **Off:** Single JSON response |

**Agent SDK vs Legacy API:**

| | Agent SDK | Legacy API |
|---|---|---|
| Web search | ✅ Real browsing | ⚠️ Direct Anthropic only |
| Other tools | WebFetch, Read, Glob, Grep | None |
| Token tracking | ❌ Returns 0 | ✅ Accurate |
| Speed | Slower | Faster |
| Custom API endpoint | ❌ Uses .env key | ✅ Uses project base_url |

Both settings can be overridden per-request:
```json
{"content": "Hello", "agent_sdk": false, "stream": false}
```

### Model Selection

```json
{"model": "claude-sonnet-4-6"}
```

Available models:
- `claude-opus-4-6` — Most capable, highest cost
- `claude-sonnet-4-6` — Balanced (recommended, default)
- `claude-haiku-4-5` — Fast and economical

### System Prompt

```json
{"system_prompt": "You are a helpful customer support assistant."}
```

Tips:
- Be specific about tone and behavior
- Include domain constraints
- Keep under 1000 tokens for efficiency

### Tools

```json
{"tools_config": ["web_search"]}
```

Available tools:
- `web_search` — Web search (Agent SDK uses WebSearch tool natively; Legacy uses Anthropic's `web_search_20250305`)

Disable all tools:
```json
{"tools_config": []}
```

### Rate Limiting

```json
{
  "rate_limit_config": {
    "rpm": 60,
    "tpm": 100000
  }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `rpm` | 60 | Max requests per minute |
| `tpm` | 100000 | Max tokens per minute |

### Context Window

```json
{
  "max_context_tokens": 180000,
  "context_strategy": "sliding_window"
}
```

Claude models have 200K context windows. The recommended max is 180,000 to leave room for system prompt + response + safety margin.

### Custom API Endpoint (Legacy Only)

```json
{
  "base_url": "https://your-proxy.com",
  "api_key": "sk-ant-project-specific-key"
}
```

These are only used when `use_agent_sdk` is `false`. Agent SDK always reads from `.env`.

---

## Complete Project Example

```json
{
  "name": "customer-support-bot",
  "model": "claude-sonnet-4-6",
  "system_prompt": "You are a friendly support agent for Acme Corp.",
  "use_agent_sdk": true,
  "default_stream": true,
  "tools_config": ["web_search"],
  "rate_limit_config": {"rpm": 120, "tpm": 200000},
  "max_context_tokens": 150000,
  "context_strategy": "sliding_window"
}
```

---

## Database

### Connection

Configured via `DATABASE_URL`. Uses PostgreSQL 16 with connection pooling.

### Migrations

```bash
npm run db:migrate
```

Schema is defined in `src/db/schema.sql`. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`).

### Key Tables

- `organizations` — Multi-tenant orgs with API keys
- `projects` — AI projects with settings
- `sessions` — Conversation sessions
- `messages` — Chat messages with token counts
- `usage` — Aggregated usage stats

---

## Redis

Used for rate limiting (RPM sliding window). Configured via `REDIS_URL`.

Rate limit keys auto-expire after 120 seconds.

---

## Logging

ClawAPI uses Pino for structured JSON logging:

```json
{
  "level": "info",
  "time": 1709486229726,
  "msg": "Agent SDK complete",
  "duration": 3200,
  "resultLength": 156
}
```
