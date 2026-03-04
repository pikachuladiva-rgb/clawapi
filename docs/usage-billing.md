# Usage & Billing

Track token usage and manage costs with ClawAPI.

## Understanding Token Usage

### What are Tokens?

Tokens are pieces of text that Claude processes:
- ~4 characters = 1 token
- "Hello world" ≈ 2 tokens
- 1000 tokens ≈ 750 words

### Token Counting

ClawAPI tracks two types:
- **Input tokens** - Your messages + system prompt + history
- **Output tokens** - Claude's responses

## Anthropic Pricing

Current pricing (as of March 2026):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude Opus 4.6 | $15.00 | $75.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |
| Claude Haiku 4.5 | $0.80 | $4.00 |

**Note:** Prices subject to change. Check [Anthropic pricing](https://www.anthropic.com/pricing) for current rates.

## Tracking Usage

### Organization Usage

Get total usage across all projects:

```bash
curl -X GET "http://localhost:3100/v1/usage?start_date=2026-02-01&end_date=2026-03-01" \
  -H "Authorization: Bearer claw_live_xxx"
```

Response:
```json
{
  "org_id": "org_abc123",
  "period": {
    "start": "2026-02-01T00:00:00.000Z",
    "end": "2026-03-01T00:00:00.000Z"
  },
  "usage": {
    "total_tokens_in": 1250000,
    "total_tokens_out": 870000,
    "total_messages": 4500,
    "estimated_cost_usd": 124.50
  },
  "by_project": [
    {
      "project_id": "proj_xyz",
      "project_name": "customer-support",
      "tokens_in": 800000,
      "tokens_out": 600000,
      "messages": 3000,
      "estimated_cost_usd": 81.00
    },
    {
      "project_id": "proj_abc",
      "project_name": "content-generation",
      "tokens_in": 450000,
      "tokens_out": 270000,
      "messages": 1500,
      "estimated_cost_usd": 43.50
    }
  ]
}
```

### Project Usage

Get usage for a specific project:

```bash
curl -X GET "http://localhost:3100/v1/usage/projects/proj_xyz" \
  -H "Authorization: Bearer claw_live_xxx"
```

Response:
```json
{
  "project_id": "proj_xyz",
  "project_name": "customer-support",
  "period": {
    "start": "2026-02-01T00:00:00.000Z",
    "end": "2026-03-01T00:00:00.000Z"
  },
  "usage": {
    "tokens_in": 800000,
    "tokens_out": 600000,
    "messages": 3000,
    "sessions": 450
  },
  "by_model": {
    "claude-sonnet-4-6": {
      "tokens_in": 800000,
      "tokens_out": 600000,
      "messages": 3000,
      "estimated_cost_usd": 81.00
    }
  },
  "daily_breakdown": [
    {
      "date": "2026-02-01",
      "tokens_in": 25000,
      "tokens_out": 18000,
      "messages": 95
    }
  ]
}
```

## Cost Calculation

### Formula

```
Cost = (input_tokens / 1,000,000 × input_price) +
       (output_tokens / 1,000,000 × output_price)
```

### Example

Using Claude Sonnet 4.6:
- Input: 100,000 tokens
- Output: 50,000 tokens

```
Cost = (100,000 / 1,000,000 × $3.00) +
       (50,000 / 1,000,000 × $15.00)
     = $0.30 + $0.75
     = $1.05
```

## Cost Optimization

### 1. Choose the Right Model

**Use Haiku for:**
- Simple queries
- High-volume, low-complexity tasks
- Fast responses needed

**Use Sonnet for:**
- Balanced performance (recommended)
- Most production use cases
- Good quality at reasonable cost

**Use Opus for:**
- Complex reasoning
- Critical accuracy requirements
- Low-volume, high-value tasks

### 2. Optimize System Prompts

**Bad (wasteful):**
```json
{
  "system_prompt": "You are a helpful assistant. You should always be polite and professional. You should provide detailed answers. You should ask clarifying questions when needed. You should be concise but thorough. You should..."
}
```
~50 tokens sent with every message

**Good (efficient):**
```json
{
  "system_prompt": "You are a professional customer support agent. Be concise and helpful."
}
```
~15 tokens sent with every message

### 3. Manage Context Window

**Set appropriate limits:**
```json
{
  "max_context_tokens": 150000
}
```

**Benefits:**
- Prevents runaway costs
- Faster responses
- More predictable billing

### 4. Implement Rate Limits

**Prevent abuse:**
```json
{
  "rate_limit_config": {
    "rpm": 60,
    "tpm": 100000
  }
}
```

**Per-user limits:**
- Track usage by user_id
- Implement quotas
- Alert on high usage

### 5. Cache Responses

For repeated queries:
```typescript
// Pseudo-code
const cacheKey = `response:${hash(message)}`
const cached = await redis.get(cacheKey)
if (cached) return cached

const response = await callClaude(message)
await redis.setex(cacheKey, 3600, response)
return response
```

### 6. Batch Operations

Instead of:
```typescript
// 10 separate API calls
for (const item of items) {
  await sendMessage(item)
}
```

Do:
```typescript
// 1 API call with all items
await sendMessage(items.join('\n'))
```

## Budget Management

### Set Project Budgets

Track spending per project:

```typescript
// Pseudo-code
const monthlyBudget = 100.00 // USD
const currentSpend = await getProjectUsage(projectId)

if (currentSpend.estimated_cost_usd > monthlyBudget) {
  // Disable project or alert admin
  await disableProject(projectId)
  await sendAlert('Budget exceeded')
}
```

### Usage Alerts

Set up alerts for:
- Daily spending thresholds
- Unusual usage patterns
- Rate limit violations
- High token consumption

### Cost Attribution

Tag sessions with metadata:

```json
{
  "metadata": {
    "user_id": "user_123",
    "department": "support",
    "cost_center": "CS-001"
  }
}
```

## Billing Integration

### Export Usage Data

```sql
-- Monthly usage report
SELECT
  DATE_TRUNC('day', created_at) as date,
  project_id,
  SUM(tokens_in) as total_input,
  SUM(tokens_out) as total_output,
  COUNT(*) as message_count
FROM messages
WHERE created_at >= '2026-02-01'
  AND created_at < '2026-03-01'
GROUP BY date, project_id
ORDER BY date, project_id;
```

### CSV Export

```bash
# Export to CSV
psql $DATABASE_URL -c "COPY (
  SELECT * FROM messages
  WHERE created_at >= '2026-02-01'
) TO STDOUT WITH CSV HEADER" > usage_feb_2026.csv
```

## Usage Patterns

### Typical Costs

**Customer Support Bot:**
- 1000 conversations/day
- Avg 10 messages per conversation
- Avg 100 tokens in, 150 tokens out per message
- Model: Claude Sonnet 4.6

```
Daily tokens:
  Input: 1000 × 10 × 100 = 1,000,000
  Output: 1000 × 10 × 150 = 1,500,000

Daily cost:
  Input: 1M / 1M × $3.00 = $3.00
  Output: 1.5M / 1M × $15.00 = $22.50
  Total: $25.50/day

Monthly cost: ~$765
```

**Content Generation:**
- 100 articles/day
- 1 message per article
- Avg 500 tokens in, 2000 tokens out
- Model: Claude Sonnet 4.6

```
Daily tokens:
  Input: 100 × 500 = 50,000
  Output: 100 × 2000 = 200,000

Daily cost:
  Input: 0.05M / 1M × $3.00 = $0.15
  Output: 0.2M / 1M × $15.00 = $3.00
  Total: $3.15/day

Monthly cost: ~$95
```

## Monitoring Dashboard

### Key Metrics

Track these metrics:
- Total tokens per day/week/month
- Cost per project
- Messages per session
- Average tokens per message
- Cost per user (if applicable)

### Sample Query

```sql
-- Daily usage summary
SELECT
  DATE(created_at) as date,
  COUNT(*) as messages,
  SUM(tokens_in) as total_input,
  SUM(tokens_out) as total_output,
  SUM(tokens_in) / 1000000.0 * 3.00 +
  SUM(tokens_out) / 1000000.0 * 15.00 as estimated_cost
FROM messages
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Best Practices

1. **Monitor regularly** - Check usage weekly
2. **Set budgets** - Define spending limits per project
3. **Use appropriate models** - Don't use Opus for simple tasks
4. **Optimize prompts** - Keep system prompts concise
5. **Implement caching** - Cache repeated queries
6. **Rate limit** - Prevent abuse and runaway costs
7. **Track by user** - Attribute costs to end users
8. **Alert on anomalies** - Detect unusual usage patterns
9. **Review monthly** - Analyze and optimize spending
10. **Document costs** - Keep stakeholders informed
