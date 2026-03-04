# ClawAPI

Multi-tenant Claude AI platform that wraps the Anthropic API behind a unified interface with real web search capabilities. Multiple users and projects share a single process, each with isolated system prompts, tools, rate limits, and billing.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server entry point, middleware setup |
| `src/api/` | API route handlers (orgs, projects, sessions, messages) |
| `src/api/messages.ts` | Core message routing logic |
| `src/claude/agent-sdk-handler.ts` | Agent SDK implementation (web search, streaming) |
| `src/claude/messages.ts` | Legacy Messages API implementation |
| `src/db/client.ts` | Database connection pool |
| `src/redis/client.ts` | Cache and rate limiting |
| `public/admin.html` | Web-based admin dashboard |

## Skills

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation: env config, db migration, and server start |

## Development Commands

```bash
npm run dev          # Run with hot reload (dev mode)
npm run build        # Compile TypeScript
npm run db:migrate   # Run database migrations
```

## Testing API Flow

1. **Bootstrap:** `POST /v1/bootstrap` (returns API key)
2. **Project:** `POST /v1/projects` (requires API key)
3. **Session:** `POST /v1/projects/:pid/sessions`
4. **Message:** `POST /v1/projects/:pid/sessions/:sid/messages`
