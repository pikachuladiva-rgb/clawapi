# Testing ClawAPI

How to verify all API endpoints are working correctly.

## Prerequisites

- ClawAPI running (`npm run dev` or via PM2)
- An API key from bootstrapping
- `curl` and `jq` installed

## Quick Smoke Test

```bash
# Check health
curl -s http://localhost:3100/health | jq

# Should return: {"status":"ok","timestamp":"..."}
```

## Full Endpoint Test

Replace `YOUR_API_KEY` with your actual key, and `PROJECT_ID`/`SESSION_ID` with real IDs.

### 1. Bootstrap (or skip if org already exists)

```bash
curl -s -X POST http://localhost:3100/v1/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "test-org"}' | jq
```

### 2. Create Project

```bash
curl -s -X POST http://localhost:3100/v1/projects \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-project",
    "model": "claude-sonnet-4-6",
    "system_prompt": "You are a helpful assistant."
  }' | jq
```

Save the `id` from the response → `PROJECT_ID`.

### 3. List Projects

```bash
curl -s http://localhost:3100/v1/projects \
  -H "Authorization: Bearer YOUR_API_KEY" | jq
```

### 4. Get Project

```bash
curl -s http://localhost:3100/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY" | jq
```

### 5. Update Project

```bash
curl -s -X PATCH http://localhost:3100/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"use_agent_sdk": true, "default_stream": true}' | jq
```

### 6. Create Session

```bash
curl -s -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

Save the `id` from the response → `SESSION_ID`.

### 7. List Sessions

```bash
curl -s http://localhost:3100/v1/projects/PROJECT_ID/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" | jq
```

### 8. Send Message — Agent SDK + Streaming (default)

```bash
curl -N -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Say hello in one word"}'
```

Expected: SSE events (`event: message_start`, `event: content_delta`, `event: message_end`)

### 9. Send Message — Agent SDK + JSON

```bash
curl -s -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Say hi in one word", "stream": false}' | jq
```

Expected: JSON with `"agent_sdk": true`

### 10. Send Message — Legacy + Streaming

```bash
curl -N -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Say hi in one word", "agent_sdk": false}'
```

Expected: SSE events including `event: usage` with real token counts

### 11. Send Message — Legacy + JSON

```bash
curl -s -X POST http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Say hi in one word", "agent_sdk": false, "stream": false}' | jq
```

Expected: JSON with real `tokens_in`/`tokens_out` values

### 12. List Messages

```bash
curl -s http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID/messages \
  -H "Authorization: Bearer YOUR_API_KEY" | jq
```

### 13. Usage Stats

```bash
# Org-level
curl -s http://localhost:3100/v1/usage \
  -H "Authorization: Bearer YOUR_API_KEY" | jq

# Project-level
curl -s http://localhost:3100/v1/usage/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY" | jq
```

### 14. Cleanup

```bash
# Delete session
curl -s -X DELETE http://localhost:3100/v1/projects/PROJECT_ID/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_API_KEY" | jq

# Delete project
curl -s -X DELETE http://localhost:3100/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_API_KEY" | jq
```

## Expected Results Summary

| Test | Expected |
|------|----------|
| Health | `{"status":"ok"}` |
| Create Project | Returns `id` |
| Create Session | Returns `id` |
| Agent SDK + Stream | SSE: `message_start → content_delta → message_end` |
| Agent SDK + JSON | JSON with `"agent_sdk": true`, tokens = 0 |
| Legacy + Stream | SSE: `message_start → content_delta → usage → message_end` |
| Legacy + JSON | JSON with real `tokens_in`/`tokens_out` |
| List Messages | Array of user + assistant messages |
| Usage | Token/message counts |

## Admin UI Test

1. Navigate to `http://localhost:3100/admin.html`
2. Log in with your API key
3. Go to **Projects** → click **Edit** on a project
4. Verify you see: Agent SDK toggle, Streaming toggle, RPM, TPM, Tools checkboxes
5. Toggle Agent SDK off, save, send a message — should use Legacy API
6. Go to **Playground** → select project/session → send a message
