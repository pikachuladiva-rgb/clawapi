# Architecture

ClawAPI is designed as a multi-tenant platform that provides isolated Claude AI instances for multiple projects while sharing infrastructure.

## System Overview

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│         ClawAPI Server              │
│  ┌──────────────────────────────┐  │
│  │   Hono HTTP Framework        │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │   Auth Middleware            │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │   Rate Limiter (Redis)       │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │   Claude Agent SDK           │  │
│  └──────────────────────────────┘  │
└───────┬─────────────────┬───────────┘
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│  PostgreSQL  │   │    Redis     │
│  (Data)      │   │  (Sessions)  │
└──────────────┘   └──────────────┘
        │
        ▼
┌──────────────────────────────────┐
│      Anthropic API               │
│  (Claude Models)                 │
└──────────────────────────────────┘
```

## Core Components

### 1. HTTP Server (Hono)

- Lightweight, fast web framework
- Handles routing, middleware, and SSE streaming
- Built on Node.js with TypeScript

**Location:** `src/index.ts`

### 2. Authentication Layer

- API key-based authentication
- JWT tokens for session management
- Organization-level access control

**Location:** `src/auth/`

Key features:
- API keys prefixed with `claw_live_` or `claw_test_`
- Secure key generation with high entropy
- Middleware validates keys on every request

### 3. Database Layer (PostgreSQL)

Stores:
- Organizations and API keys
- Projects and configurations
- Sessions and message history
- Usage metrics and billing data

**Location:** `src/db/`

Schema:
```sql
orgs
├── org_id (PK)
├── name
├── api_key_hash
└── created_at

projects
├── project_id (PK)
├── org_id (FK)
├── name
├── model
├── system_prompt
├── tools_config
├── rate_limit_config
└── deleted_at (soft delete)

sessions
├── session_id (PK)
├── project_id (FK)
└── created_at

messages
├── message_id (PK)
├── session_id (FK)
├── role (user/assistant)
├── content
├── tokens_in
├── tokens_out
└── created_at
```

### 4. Cache Layer (Redis)

Used for:
- Rate limiting (token bucket algorithm)
- Session state caching
- Temporary data storage

**Location:** Redis client initialized in `src/db/client.ts`

### 5. Claude Integration

Uses `@anthropic-ai/claude-agent-sdk` for:
- Message streaming
- Tool execution (web search)
- Context window management
- Token counting

**Location:** `src/claude/`, `src/providers/anthropic.ts`

### 6. Rate Limiter

Implements token bucket algorithm:
- Requests per minute (RPM)
- Tokens per minute (TPM)
- Per-project limits
- Redis-backed for distributed systems

**Location:** Rate limiting logic in message handler

### 7. Tool Registry

Extensible tool system:
- Web search (built-in)
- Custom tools can be added
- Tool results tracked in messages

**Location:** `src/tools/registry.ts`

## Data Flow

### Message Processing Flow

```
1. Client sends message
   ↓
2. Auth middleware validates API key
   ↓
3. Rate limiter checks limits
   ↓
4. Load project config from DB
   ↓
5. Load session history from DB
   ↓
6. Apply context window strategy
   ↓
7. Call Anthropic API with Claude Agent SDK
   ↓
8. Stream response via SSE
   ↓
9. Execute tools if requested
   ↓
10. Save message + usage to DB
    ↓
11. Update usage metrics
```

### Context Window Management

ClawAPI implements a sliding window strategy:

1. Load all messages for session
2. Calculate total tokens
3. If exceeds `max_context_tokens`:
   - Keep system prompt
   - Keep most recent messages
   - Drop oldest messages
4. Send to Claude API

**Default limit:** 180,000 tokens (leaves room for response)

## Multi-Tenancy

### Isolation Levels

1. **Organization Level**
   - Separate API keys
   - Independent billing
   - Isolated projects

2. **Project Level**
   - Custom system prompts
   - Individual rate limits
   - Separate tool configs
   - Per-project API keys (optional)

3. **Session Level**
   - Isolated conversation contexts
   - Independent message histories

### Security Boundaries

- API keys are hashed (bcrypt) before storage
- Projects can't access other org's data
- Soft deletes prevent data loss
- Rate limits prevent abuse

## Scalability

### Horizontal Scaling

ClawAPI is designed to scale horizontally:

- **Stateless API servers** - No in-memory state
- **Redis for coordination** - Distributed rate limiting
- **PostgreSQL for persistence** - Can use read replicas
- **Load balancer ready** - Standard HTTP/SSE

### Performance Considerations

- Connection pooling for PostgreSQL
- Redis pipelining for rate limits
- Streaming responses reduce memory
- Efficient token counting

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 18+ | JavaScript execution |
| Language | TypeScript | Type safety |
| Web Framework | Hono | HTTP routing |
| Database | PostgreSQL | Persistent storage |
| Cache | Redis | Rate limiting, sessions |
| AI SDK | Anthropic Claude SDK | Claude API integration |
| Agent Framework | Claude Agent SDK | Tool execution, streaming |
| Validation | Zod | Schema validation |
| Logging | Pino | Structured logging |
| Process Manager | PM2 | Production deployment |

## Design Principles

1. **Multi-tenancy first** - Isolation at every layer
2. **API-driven** - Everything accessible via REST
3. **Streaming by default** - Real-time responses
4. **Cost transparency** - Track every token
5. **Extensible** - Easy to add tools and features
6. **Production-ready** - Rate limits, logging, monitoring
