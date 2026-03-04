# Getting Started

Set up and run ClawAPI in under 10 minutes.

## Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose (for PostgreSQL and Redis)
- **Claude CLI** — Required for Agent SDK. Install: `npm install -g @anthropic-ai/claude-code`
- **Anthropic API Key** — Get one at [console.anthropic.com](https://console.anthropic.com)

## Installation

### Option 1: Claude Code (Easiest)

If you have Claude Code installed, it can automate the entire setup process:

```bash
git clone https://github.com/yourusername/clawapi.git
cd clawapi
claude /setup
```

The script will automatically start Docker, configure your `.env`, run migrations, and install packages.

### Option 2: Manual Setup

#### 1. Clone and Install

```bash
git clone https://github.com/yourusername/clawapi.git
cd clawapi
npm install
```

#### 2. Start Infrastructure

```bash
docker-compose up -d

# Verify containers are running
docker-compose ps
```

This starts:
- **PostgreSQL 16** on port `5433`
- **Redis 7** on port `6380`

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Required variables:

```env
PORT=3100
NODE_ENV=development
DATABASE_URL=postgresql://clawapi:clawapi@localhost:5433/clawapi
REDIS_URL=redis://localhost:6380
JWT_SECRET=change-me-in-production
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> **Note:** `ANTHROPIC_API_KEY` is required for the Agent SDK to work (web search, web fetch).

### 4. Run Database Migration

```bash
npm run db:migrate
```

### 5. Start the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build
pm2 start dist/index.js --name clawapi
```

The API runs at `http://localhost:3100`
The Admin UI is at `http://localhost:3100/admin.html`

---

## First Steps

### 1. Bootstrap Your Organization

Create your first organization (only works when no orgs exist):

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
  "api_key": "claw_live_xyz789..."
}
```

**⚠️ Save the `api_key` — it's only shown once!**

### 2. Create a Project

```bash
curl -X POST http://localhost:3100/v1/projects \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "model": "claude-sonnet-4-6",
    "system_prompt": "You are a helpful assistant."
  }'
```

### 3. Create a Session

```bash
curl -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 4. Send a Message

```bash
# Default: Agent SDK + SSE streaming
curl -N -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello! What can you help me with?"}'
```

The response streams back via Server-Sent Events (SSE):

```
event: message_start
data: {"role":"assistant"}

event: content_delta
data: {"type":"text","text":"Hello! I can help you with..."}

event: message_end
data: {"stop_reason":"end_turn"}
```

### 5. Open the Admin UI

Go to `http://localhost:3100/admin.html` and log in with your API key.

From the admin UI you can:
- Create/edit/delete projects with per-project settings
- Toggle Agent SDK and streaming on/off per project
- Set rate limits (RPM/TPM)
- Manage sessions
- Test in the built-in Playground

---

## Health Check

```bash
curl http://localhost:3100/health
```

---

## Next Steps

- [API Reference](./api-reference.md) — All endpoints with request/response examples
- [Configuration](./configuration.md) — Project settings, Agent SDK vs Legacy mode
- [Quick Reference](./quick-reference.md) — Cheat sheet for common operations
- [Deployment](./deployment.md) — Production setup with PM2 or Docker

---

## Common Issues

**Database connection fails:**
```bash
docker-compose ps
docker-compose logs postgres
```

**Redis connection fails:**
```bash
docker-compose ps
docker-compose logs redis
```

**Agent SDK errors (web search not working):**
```bash
# Check Claude CLI is installed
claude --version

# Check ANTHROPIC_API_KEY is set in .env
grep ANTHROPIC_API_KEY .env
```

**Reset everything:**
```bash
docker-compose down -v
docker-compose up -d
npm run db:migrate
```
