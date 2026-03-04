# Quick Reference

Cheat sheet for common ClawAPI operations.

## Setup

**Easiest Setup (via Claude Code):**
```bash
git clone https://github.com/yourusername/clawapi.git && cd clawapi
claude /setup
```

**Manual Setup:**
```bash
git clone https://github.com/yourusername/clawapi.git && cd clawapi
npm install
docker-compose up -d
cp .env.example .env          # Set ANTHROPIC_API_KEY
npm run db:migrate
npm run dev                    # → http://localhost:3100
```

Admin UI: `http://localhost:3100/admin.html`

---

## Authentication

```bash
-H "Authorization: Bearer YOUR_API_KEY"
```

---

## End-to-End Flow

```bash
# 1. Bootstrap org (first time only)
API_KEY=$(curl -s -X POST http://localhost:3100/v1/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "my-org"}' | jq -r '.api_key')

# 2. Create project
PID=$(curl -s -X POST http://localhost:3100/v1/projects \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project", "model": "claude-sonnet-4-6"}' | jq -r '.id')

# 3. Create session
SID=$(curl -s -X POST http://localhost:3100/v1/projects/$PID/sessions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.id')

# 4. Send message (Agent SDK + streaming)
curl -N -X POST http://localhost:3100/v1/projects/$PID/sessions/$SID/messages \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!"}'
```

---

## All 4 Message Modes

```bash
# Mode 1: Agent SDK + Streaming (DEFAULT)
-d '{"content": "Hello"}'

# Mode 2: Agent SDK + JSON
-d '{"content": "Hello", "stream": false}'

# Mode 3: Legacy API + Streaming
-d '{"content": "Hello", "agent_sdk": false}'

# Mode 4: Legacy API + JSON
-d '{"content": "Hello", "agent_sdk": false, "stream": false}'
```

**Agent SDK:** real web search, 0 tokens reported
**Legacy API:** faster, accurate token counts

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth) |
| POST | `/v1/bootstrap` | Create first org (no auth) |
| POST | `/v1/admin/orgs` | Create org |
| GET | `/v1/admin/orgs` | List orgs |
| POST | `/v1/projects` | Create project |
| GET | `/v1/projects` | List projects |
| GET | `/v1/projects/:pid` | Get project |
| PATCH | `/v1/projects/:pid` | Update project |
| DELETE | `/v1/projects/:pid` | Delete project |
| POST | `/v1/projects/:pid/sessions` | Create session |
| GET | `/v1/projects/:pid/sessions` | List sessions |
| DELETE | `/v1/projects/:pid/sessions/:sid` | Delete session |
| GET | `/v1/projects/:pid/sessions/:sid/messages` | List messages |
| POST | `/v1/projects/:pid/sessions/:sid/messages` | Send message |
| GET | `/v1/usage` | Org usage |
| GET | `/v1/usage/projects/:pid` | Project usage |

---

## Project Settings

```json
{
  "name": "my-project",
  "model": "claude-sonnet-4-6",
  "system_prompt": "You are helpful.",
  "use_agent_sdk": true,
  "default_stream": true,
  "tools_config": ["web_search"],
  "rate_limit_config": {"rpm": 60, "tpm": 100000},
  "max_context_tokens": 180000,
  "context_strategy": "sliding_window"
}
```

---

## SSE Event Format

```
event: message_start    → {"role": "assistant"}
event: content_delta    → {"type": "text", "text": "..."}
event: usage            → {"tokens_in": 37, "tokens_out": 3}  (legacy only)
event: message_end      → {"stop_reason": "end_turn"}
event: error            → {"error": "message"}
```

---

## Docker

```bash
docker-compose up -d       # Start PostgreSQL + Redis
docker-compose ps          # Check status
docker-compose logs -f     # View logs
docker-compose down -v     # Reset (destroys data)
```

---

## PM2 (Production)

```bash
npm run build
pm2 start dist/index.js --name clawapi
pm2 logs clawapi
pm2 restart clawapi
```

---

## Troubleshooting

```bash
curl http://localhost:3100/health          # Check API
docker-compose ps                          # Check infra
claude --version                           # Check Claude CLI
grep ANTHROPIC_API_KEY .env                # Check API key
pm2 logs clawapi --lines 50               # View logs
```
