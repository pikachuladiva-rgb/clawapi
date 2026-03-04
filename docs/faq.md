# Frequently Asked Questions

Common questions about ClawAPI.

## General

### What is ClawAPI?

ClawAPI is a multi-tenant platform that wraps the Anthropic Claude API, allowing multiple organizations and projects to share infrastructure while maintaining isolation. Each project gets its own system prompt, tools, rate limits, and usage tracking.

### Why use ClawAPI instead of calling Anthropic directly?

- **Multi-tenancy** - Manage multiple projects with one deployment
- **Cost tracking** - Per-project usage and billing
- **Rate limiting** - Prevent abuse and control costs
- **Session management** - Persistent conversation contexts
- **Centralized governance** - Organization-level controls

### What Claude models are supported?

- Claude Opus 4.6 (most capable)
- Claude Sonnet 4.6 (recommended)
- Claude Haiku 4.5 (fastest, most economical)

## Setup & Installation

### What are the system requirements?

- Node.js 18 or higher
- PostgreSQL 14 or higher
- Redis 6 or higher
- 2GB RAM minimum
- Anthropic API key

### Can I use managed database services?

Yes! ClawAPI works with:
- AWS RDS (PostgreSQL)
- DigitalOcean Managed Databases
- Supabase
- Neon
- Any PostgreSQL-compatible service

### Do I need Docker?

Docker is recommended for local development but not required for production. You can install PostgreSQL and Redis directly on your system.

## Authentication & Security

### How are API keys stored?

API keys are hashed with bcrypt (cost factor 10) before storage. The plain-text key is only shown once during creation.

### Can I rotate API keys?

Currently, you need to create a new organization to get a new API key. Key rotation features are planned for future releases.

### Is HTTPS required?

Yes, for production deployments. Use a reverse proxy (nginx/caddy) with SSL certificates.

### How is multi-tenancy enforced?

- Database queries filter by org_id
- Foreign key constraints prevent cross-org access
- API keys are scoped to organizations
- Projects can't access other org's data

## Usage & Billing

### How is usage tracked?

Every message records:
- Input tokens (your message + context)
- Output tokens (Claude's response)
- Timestamp
- Project and session IDs

### How do I calculate costs?

```
Cost = (input_tokens / 1,000,000 × input_price) +
       (output_tokens / 1,000,000 × output_price)
```

Check current Anthropic pricing at https://www.anthropic.com/pricing

### Can I set spending limits?

ClawAPI tracks usage but doesn't enforce spending limits automatically. You can:
- Monitor usage via `/v1/usage` endpoint
- Implement custom alerts
- Use rate limits to control volume

### What counts toward token usage?

- User messages
- System prompts (sent with every message)
- Conversation history (within context window)
- Claude's responses
- Tool calls and results

## Rate Limiting

### How does rate limiting work?

Token bucket algorithm with two limits:
- **RPM** - Requests per minute
- **TPM** - Tokens per minute

Both must be satisfied for a request to proceed.

### What happens when I hit rate limits?

You receive a 429 error with `retry_after` seconds. Wait and retry.

### Can I disable rate limits?

Set `rpm` and `tpm` to `null` in project config, but this is not recommended for production.

### Are rate limits per project or organization?

Per project. Each project has independent rate limits.

## Projects & Sessions

### What's the difference between a project and a session?

- **Project** - Configuration container (model, system prompt, tools)
- **Session** - Conversation instance with message history

One project can have many sessions.

### How long do sessions last?

Sessions persist until explicitly deleted. Messages are stored indefinitely by default.

### Can I share sessions between projects?

No, sessions are scoped to projects.

### How many messages can a session have?

Unlimited, but only recent messages within `max_context_tokens` are sent to Claude.

## Context Management

### What is the context window?

The amount of text (in tokens) that Claude can process in one request, including your message, system prompt, and conversation history.

### What happens when context is full?

ClawAPI uses a sliding window strategy:
1. Keeps system prompt
2. Keeps most recent messages
3. Drops oldest messages

### How do I optimize context usage?

- Keep system prompts concise
- Set appropriate `max_context_tokens`
- Create new sessions for new topics
- Avoid very long messages

### Can I customize context strategy?

Currently only `sliding_window` is implemented. Future versions may support summarization and other strategies.

## Tools & Features

### What tools are available?

Currently:
- Web search (via Anthropic's built-in tool)

More tools can be added to the registry.

### How do I enable web search?

```json
{
  "tools_config": ["web_search"]
}
```

### Can I add custom tools?

Yes, by extending the tool registry in `src/tools/registry.ts`. See the development guide for details.

### Does web search cost extra?

Web search uses additional tokens for the search results, which count toward your Anthropic usage.

## Streaming

### What is SSE streaming?

Server-Sent Events - a standard for real-time server-to-client updates. Claude's response streams back as it's generated.

### Can I disable streaming?

Yes, set `"stream": false` in the message request to get a complete JSON response.

### Why use streaming?

- Better user experience (see responses in real-time)
- Lower memory usage
- Faster time-to-first-token

### How do I handle streaming in my client?

See the [Examples](./examples.md) for Node.js and Python streaming clients.

## Performance

### How many requests can ClawAPI handle?

Depends on your infrastructure:
- Database connection pool size
- Redis capacity
- Server resources
- Anthropic API rate limits

With proper scaling, hundreds of requests per second.

### Can I run multiple instances?

Yes! ClawAPI is stateless and can scale horizontally. Use Redis for distributed rate limiting.

### What's the typical response time?

- API overhead: <50ms
- Claude response: 1-10 seconds (depends on complexity)
- Streaming starts in <1 second

### How do I optimize performance?

- Use connection pooling
- Enable Redis caching
- Use appropriate Claude models
- Implement response caching for repeated queries

## Deployment

### What deployment options are available?

- PM2 (recommended for VPS)
- Docker
- Kubernetes
- Cloud platforms (AWS, GCP, Azure)

### Do I need a reverse proxy?

Yes, for production. Use nginx or caddy for:
- HTTPS termination
- Load balancing
- Security headers

### How do I handle database migrations?

Run `npm run db:migrate` before starting the application. Migrations are idempotent.

### Can I use serverless?

Not currently optimized for serverless due to persistent connections to PostgreSQL and Redis.

## Troubleshooting

### API returns 500 errors

Check:
- Application logs
- Database connection
- Redis connection
- Anthropic API key validity

### Messages aren't streaming

Verify:
- Client supports SSE
- No proxy buffering
- `stream: true` in request

### High memory usage

- Restart application
- Check for connection leaks
- Increase Node.js memory limit

### Database connection pool exhausted

- Increase pool size
- Check for unreleased connections
- Monitor active connections

## Development

### How do I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Where do I report bugs?

Open an issue on GitHub with:
- Clear description
- Steps to reproduce
- Environment details
- Relevant logs

### Can I use ClawAPI commercially?

Yes, ClawAPI is MIT licensed. You can use it for commercial purposes.

### Is there a hosted version?

Not currently. ClawAPI is self-hosted only.

## Pricing & Costs

### How much does ClawAPI cost?

ClawAPI itself is free (MIT license). You pay for:
- Anthropic API usage
- Infrastructure (database, Redis, hosting)

### What's a typical monthly cost?

Depends on usage. Example:
- 10,000 messages/month
- 100 tokens in, 150 tokens out per message
- Claude Sonnet 4.6

```
Monthly tokens:
  Input: 10,000 × 100 = 1M
  Output: 10,000 × 150 = 1.5M

Monthly cost:
  Input: 1M / 1M × $3 = $3
  Output: 1.5M / 1M × $15 = $22.50
  Total: ~$25.50
```

Plus infrastructure costs (~$20-50/month for small deployments).

### How can I reduce costs?

- Use Haiku for simple tasks
- Optimize system prompts
- Implement response caching
- Set appropriate rate limits
- Monitor usage regularly
