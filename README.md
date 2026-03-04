# ClawAPI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Multi-tenant Claude AI platform with real web search capabilities. Multiple organizations and projects share a single server, each with isolated system prompts, identity, tools, rate limits, and usage tracking.

## Features

- 🧠 **Agent SDK (Default)** - Real web search, web fetch, and tool execution via Claude Agent SDK
- ⚡ **Dual Mode** - Agent SDK (powerful) or Legacy Messages API (faster, accurate token tracking)
- 🔄 **SSE Streaming** - Real-time streamed responses for both Agent SDK and Legacy paths
- 🏢 **Multi-tenancy** - Organizations, projects, sessions with full isolation
- � **Secure** - API key authentication with bcrypt hashing
- 📊 **Usage Tracking** - Token-level billing and analytics (Legacy path)
- 🚦 **Rate Limiting** - Per-project RPM/TPM controls via Redis
- 💾 **Persistent** - PostgreSQL storage with Redis caching
- 🎯 **Context Memory** - Sliding window conversation history
- 🎛️ **Admin UI** - Web dashboard with project settings, session management, and playground

## Prerequisites

- **Node.js** 18+
- **Docker** (for PostgreSQL & Redis)
- **Claude CLI** - Required for Agent SDK. Install: `npm install -g @anthropic-ai/claude-code`
- **Anthropic API Key** - Get one at [console.anthropic.com](https://console.anthropic.com)

## Quick Start

### Option 1: Claude Code (Easiest)
If you have Claude Code installed, it can automatically configure the environment, install dependencies, and start the database:

```bash
git clone https://github.com/yourusername/clawapi.git
cd clawapi
claude /setup
```

### Option 2: Manual Setup

```bash
# 1. Clone and install
git clone https://github.com/yourusername/clawapi.git
cd clawapi
npm install

# 2. Start PostgreSQL & Redis
docker-compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env — set your ANTHROPIC_API_KEY

# 4. Run database migration
npm run db:migrate

# 5. Start the server
npm run dev
```

Server runs at `http://localhost:3100`
Admin UI at `http://localhost:3100/admin.html`

### Production (PM2)

```bash
npm run build
pm2 start dist/index.js --name clawapi
```

## Basic Usage

### 1. Create Organization

```bash
curl -X POST http://localhost:3100/v1/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "my-company"}'
```

**⚠️ Save the `api_key` - it's only shown once!**

### 2. Create Project

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

### 3. Create Session & Send Message

```bash
# Create session
SID=$(curl -s -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" | jq -r '.id')

# Send message (Agent SDK + streaming by default)
curl -N -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions/$SID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!"}'
```

## Agent SDK vs Legacy API

ClawAPI supports two message processing modes, configurable per-project in the admin UI or per-request:

| | Agent SDK (Default) | Legacy Messages API |
|---|---|---|
| **Web search** | ✅ Real browsing via Claude Code | ⚠️ Depends on API endpoint |
| **Tools** | WebSearch, WebFetch, Read, Glob, Grep | Server-side `web_search` only |
| **Streaming** | ✅ SSE | ✅ SSE |
| **Token tracking** | ❌ Not available from SDK | ✅ Accurate counts |
| **Speed** | Slower (subprocess) | Faster (direct API) |
| **Identity** | ✅ Custom identity via system prompt | ✅ Custom identity via system prompt |
| **Memory** | ✅ Conversation history | ✅ Conversation history |

### Per-Request Override

```bash
# Force legacy API
-d '{"content": "Hello!", "agent_sdk": false}'

# Force non-streaming
-d '{"content": "Hello!", "stream": false}'

# Legacy + non-streaming
-d '{"content": "Hello!", "agent_sdk": false, "stream": false}'
```

## Project Settings

Each project can be configured in the admin UI with:

| Setting | Default | Description |
|---------|---------|-------------|
| **Name** | — | Project display name |
| **Model** | `claude-sonnet-4-6` | Claude model to use |
| **System Prompt** | — | Custom system prompt |
| **Agent SDK** | ✅ On | Use Agent SDK or Legacy API |
| **Streaming** | ✅ On | SSE streaming or JSON response |
| **Max Context Tokens** | 180,000 | Conversation history limit |
| **RPM** | 60 | Rate limit (requests/min) |
| **TPM** | 100,000 | Rate limit (tokens/min) |
| **Tools** | Web Search | Enabled tools |
| **Base URL** | — | API endpoint (legacy path only) |
| **API Key** | — | API key (legacy path only) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/v1/bootstrap` | Create first org (no auth) |
| POST | `/v1/admin/orgs` | Create organization |
| GET | `/v1/admin/orgs` | List organizations |
| POST | `/v1/projects` | Create project |
| GET | `/v1/projects` | List projects |
| GET | `/v1/projects/:pid` | Get project details |
| PATCH | `/v1/projects/:pid` | Update project |
| DELETE | `/v1/projects/:pid` | Delete project |
| POST | `/v1/projects/:pid/sessions` | Create session |
| GET | `/v1/projects/:pid/sessions` | List sessions |
| DELETE | `/v1/projects/:pid/sessions/:sid` | Delete session |
| GET | `/v1/projects/:pid/sessions/:sid/messages` | List messages |
| POST | `/v1/projects/:pid/sessions/:sid/messages` | Send message |
| GET | `/v1/usage` | Organization usage |
| GET | `/v1/usage/projects/:pid` | Project usage |

## Technology Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Hono
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **AI:** Anthropic Claude SDK + Claude Agent SDK
- **Process Manager:** PM2

## Use Cases

- **SaaS Applications** - Embed Claude with web search in your product
- **Development Teams** - Share API costs across projects
- **Enterprise** - Centralized AI governance with rate limits
- **Prototyping** - Rapid AI feature development with real tools

## Acknowledgments

This project was inspired by [OpenClaw](https://github.com/openclaw/openclaw) and [NanoClaw](https://github.com/nanoclaw/nanoclaw). Special thanks to their contributors for pioneering multi-tenant AI platform architectures.

Built with [Anthropic's Claude API](https://www.anthropic.com).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
