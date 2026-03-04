# API Reference

Complete reference for all ClawAPI endpoints.

## Base URL

```
http://localhost:3100
```

## Authentication

All endpoints except `/health` and `/v1/bootstrap` require an API key:

```
Authorization: Bearer YOUR_API_KEY
```

---

## Health

### GET /health

Check API status. No authentication required.

```bash
curl http://localhost:3100/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-03T14:17:09.726Z"
}
```

---

## Organizations

### POST /v1/bootstrap

Create the first organization. Only works when no organizations exist.

```bash
curl -X POST http://localhost:3100/v1/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "my-company"}'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-company",
  "api_key": "claw_abc123..."
}
```

> **⚠️ The `api_key` is only returned once. Store it securely.**

### POST /v1/admin/orgs

Create a new organization.

```bash
curl -X POST http://localhost:3100/v1/admin/orgs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "new-org"}'
```

### GET /v1/admin/orgs

List all organizations.

```bash
curl http://localhost:3100/v1/admin/orgs \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Projects

### POST /v1/projects

Create a new project.

```bash
curl -X POST http://localhost:3100/v1/projects \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "model": "claude-sonnet-4-6",
    "system_prompt": "You are a helpful assistant.",
    "use_agent_sdk": true,
    "default_stream": true,
    "tools_config": ["web_search"],
    "rate_limit_config": {"rpm": 60, "tpm": 100000},
    "max_context_tokens": 180000,
    "context_strategy": "sliding_window"
  }'
```

**Parameters:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | **required** | Project name |
| `model` | string | `claude-sonnet-4-6` | Claude model to use |
| `system_prompt` | string | `""` | System prompt for the AI |
| `use_agent_sdk` | boolean | `true` | Use Agent SDK (web search, web fetch) or Legacy API |
| `default_stream` | boolean | `true` | Stream responses via SSE or return JSON |
| `tools_config` | string[] | `["web_search"]` | Enabled tools |
| `rate_limit_config` | object | `{"rpm":60,"tpm":100000}` | Rate limits |
| `max_context_tokens` | number | `180000` | Max conversation context tokens |
| `context_strategy` | string | `sliding_window` | Context management strategy |
| `base_url` | string | `null` | Custom API endpoint (legacy path only) |
| `api_key` | string | `null` | Custom API key (legacy path only) |

### GET /v1/projects

List all projects.

```bash
curl http://localhost:3100/v1/projects \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### GET /v1/projects/:id

Get project details.

```bash
curl http://localhost:3100/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### PATCH /v1/projects/:id

Update project settings. All fields are optional.

```bash
curl -X PATCH http://localhost:3100/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "use_agent_sdk": false,
    "default_stream": false,
    "model": "claude-haiku-4-5"
  }'
```

### DELETE /v1/projects/:id

Delete a project.

```bash
curl -X DELETE http://localhost:3100/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Sessions

### POST /v1/projects/:pid/sessions

Create a new conversation session.

```bash
curl -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{
  "id": "315024f5-fac1-4ea5-9273-7c1b0fa709fa",
  "project_id": "a59d7985-a219-4026-8c28-e2cb5d13d3df",
  "created_at": "2026-03-04T07:00:00.000Z"
}
```

### GET /v1/projects/:pid/sessions

List sessions for a project.

```bash
curl http://localhost:3100/v1/projects/PROJECT_ID/sessions \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### DELETE /v1/projects/:pid/sessions/:sid

Delete a session and all its messages.

```bash
curl -X DELETE http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Messages

### GET /v1/projects/:pid/sessions/:sid/messages

List all messages in a session.

```bash
curl http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### POST /v1/projects/:pid/sessions/:sid/messages

Send a message and get a response from Claude.

```bash
curl -N -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "What is the weather today?"}'
```

**Request Parameters:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `content` | string | **required** | The user message |
| `agent_sdk` | boolean | project default | Override: use Agent SDK or Legacy API |
| `stream` | boolean | project default | Override: SSE streaming or JSON response |

**Behavior priority:** Per-request values override project defaults.

#### Mode 1: Agent SDK + Streaming (default)

Sends SSE events as the Agent SDK processes the message. Supports web search, web fetch, and other tools.

```bash
curl -N -X POST .../messages \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Search the web for latest AI news"}'
```

Response (SSE):
```
event: message_start
data: {"role":"assistant"}

event: content_delta
data: {"type":"text","text":"Here are the latest AI news..."}

event: message_end
data: {"stop_reason":"end_turn"}
```

#### Mode 2: Agent SDK + No Streaming

```bash
-d '{"content": "Hello", "stream": false}'
```

Response (JSON):
```json
{
  "role": "assistant",
  "content": "Hello! How can I help?",
  "usage": {"tokens_in": 0, "tokens_out": 0},
  "stop_reason": "end_turn",
  "agent_sdk": true
}
```

> Note: Token counts are 0 with Agent SDK — the SDK doesn't expose usage data.

#### Mode 3: Legacy API + Streaming

```bash
-d '{"content": "Hello", "agent_sdk": false}'
```

Response (SSE):
```
event: message_start
data: {"role":"assistant"}

event: content_delta
data: {"type":"text","text":"Hello!"}

event: usage
data: {"tokens_in":37,"tokens_out":3}

event: message_end
data: {"stop_reason":"end_turn"}
```

> Legacy streaming includes `usage` events with accurate token counts.

#### Mode 4: Legacy API + No Streaming

```bash
-d '{"content": "Hello", "agent_sdk": false, "stream": false}'
```

Response (JSON):
```json
{
  "role": "assistant",
  "content": "Hello!",
  "usage": {"tokens_in": 37, "tokens_out": 3},
  "stop_reason": "end_turn"
}
```

---

## Usage

### GET /v1/usage

Get organization-level usage statistics.

```bash
curl http://localhost:3100/v1/usage \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### GET /v1/usage/projects/:pid

Get project-level usage statistics.

```bash
curl http://localhost:3100/v1/usage/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Agent SDK vs Legacy API

| | Agent SDK (default) | Legacy Messages API |
|---|---|---|
| **Web search** | ✅ Real browsing via Claude Code | ⚠️ Only with direct Anthropic API |
| **Other tools** | WebFetch, Read, Glob, Grep | None |
| **Streaming** | ✅ SSE | ✅ SSE |
| **Token tracking** | ❌ Returns 0 | ✅ Accurate counts |
| **Speed** | Slower (subprocess) | Faster (direct API call) |
| **Custom base_url** | ❌ Ignored (uses .env key) | ✅ Uses project's base_url |

---

## Rate Limiting

When rate limits are exceeded:

```
HTTP 429 Too Many Requests
```

```json
{
  "error": "Rate limit exceeded (RPM)"
}
```

---

## Error Responses

All errors return JSON:

```json
{
  "error": "Error message description"
}
```

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad request (missing required fields) |
| 401 | Invalid or missing API key |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Server error |
