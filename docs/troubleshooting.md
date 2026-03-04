# Troubleshooting

Common issues and solutions for ClawAPI.

## Installation Issues

### npm install fails

**Error:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Docker containers won't start

**Error:**
```
Error: port is already allocated
```

**Solution:**
```bash
# Check what's using the port
lsof -i :5433
lsof -i :6380

# Kill the process or change ports in docker-compose.yml
docker-compose down
# Edit docker-compose.yml to use different ports
docker-compose up -d
```

## Database Issues

### Connection refused

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5433
```

**Solutions:**

1. Check if PostgreSQL is running:
```bash
docker-compose ps
```

2. Check logs:
```bash
docker-compose logs postgres
```

3. Verify connection string:
```bash
echo $DATABASE_URL
# Should be: postgresql://clawapi:clawapi@localhost:5433/clawapi
```

4. Test connection:
```bash
psql $DATABASE_URL
```

### Migration fails

**Error:**
```
Error: relation "orgs" already exists
```

**Solution:**
```bash
# Reset database (⚠️ destroys all data)
docker-compose down -v
docker-compose up -d
npm run db:migrate
```

### Too many connections

**Error:**
```
Error: sorry, too many clients already
```

**Solution:**

1. Check connection pool settings:
```typescript
// src/db/client.ts
const pool = new Pool({
  max: 10  // Reduce if needed
})
```

2. Increase PostgreSQL max connections:
```bash
# Edit postgresql.conf
max_connections = 100
```

## Redis Issues

### Connection timeout

**Error:**
```
Error: Redis connection timeout
```

**Solutions:**

1. Check if Redis is running:
```bash
docker-compose ps redis
```

2. Test connection:
```bash
redis-cli -u $REDIS_URL ping
# Should return: PONG
```

3. Check Redis logs:
```bash
docker-compose logs redis
```

### Memory issues

**Error:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Solution:**
```bash
# Increase Redis memory limit
docker-compose down
# Edit docker-compose.yml:
# command: redis-server --maxmemory 512mb
docker-compose up -d
```

## API Issues

### 401 Unauthorized

**Error:**
```json
{
  "error": "Unauthorized"
}
```

**Solutions:**

1. Check API key format:
```bash
# Should start with claw_live_
echo $API_KEY
```

2. Verify Authorization header:
```bash
curl -H "Authorization: Bearer claw_live_xxx" \
  http://localhost:3100/v1/projects
```

3. Check if org exists:
```sql
SELECT * FROM orgs;
```

### 429 Rate Limit Exceeded

**Error:**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 30
}
```

**Solutions:**

1. Wait for rate limit to reset (60 seconds)

2. Increase project rate limits:
```bash
curl -X PATCH http://localhost:3100/v1/projects/proj_xxx \
  -H "Authorization: Bearer claw_live_xxx" \
  -d '{
    "rate_limit_config": {
      "rpm": 120,
      "tpm": 200000
    }
  }'
```

3. Check Redis for rate limit keys:
```bash
redis-cli
KEYS ratelimit:*
TTL ratelimit:proj_xxx:rpm
```

### 500 Internal Server Error

**Error:**
```json
{
  "error": "Internal server error"
}
```

**Solutions:**

1. Check application logs:
```bash
npm run dev
# or
pm2 logs clawapi
```

2. Check for missing environment variables:
```bash
cat .env
# Verify all required variables are set
```

3. Verify Anthropic API key:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

## Anthropic API Issues

### Invalid API key

**Error:**
```
Error: Invalid API key
```

**Solution:**
```bash
# Verify key format (should start with sk-ant-)
echo $ANTHROPIC_API_KEY

# Test key directly
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-sonnet-4-6", "max_tokens": 10, "messages": [{"role": "user", "content": "test"}]}'
```

### Rate limit from Anthropic

**Error:**
```
Error: rate_limit_error
```

**Solution:**

1. Check your Anthropic dashboard for limits
2. Implement exponential backoff
3. Reduce request frequency
4. Upgrade Anthropic plan

### Context length exceeded

**Error:**
```
Error: prompt is too long
```

**Solutions:**

1. Reduce max_context_tokens:
```json
{
  "max_context_tokens": 100000
}
```

2. Clear old sessions:
```bash
curl -X DELETE http://localhost:3100/v1/projects/proj_xxx/sessions/sess_xxx \
  -H "Authorization: Bearer claw_live_xxx"
```

3. Shorten system prompt

## Streaming Issues

### SSE connection drops

**Problem:** Streaming stops mid-response

**Solutions:**

1. Check nginx timeout settings:
```nginx
proxy_read_timeout 300s;
proxy_buffering off;
```

2. Verify client keeps connection open

3. Check for network issues

### No streaming events received

**Problem:** Client doesn't receive SSE events

**Solutions:**

1. Verify Content-Type header:
```bash
curl -N http://localhost:3100/v1/projects/proj_xxx/sessions/sess_xxx/messages \
  -H "Authorization: Bearer claw_live_xxx" \
  -d '{"content": "test"}'
```

2. Check if streaming is enabled:
```json
{
  "content": "test",
  "stream": true
}
```

3. Use proper SSE client library

## Performance Issues

### Slow response times

**Symptoms:** API responses take >5 seconds

**Solutions:**

1. Check database query performance:
```sql
EXPLAIN ANALYZE SELECT * FROM messages WHERE session_id = 'sess_xxx';
```

2. Add database indexes:
```sql
CREATE INDEX idx_messages_session ON messages(session_id);
```

3. Enable connection pooling

4. Check Redis latency:
```bash
redis-cli --latency
```

5. Monitor system resources:
```bash
top
htop
```

### High memory usage

**Symptoms:** Node.js process uses >1GB RAM

**Solutions:**

1. Restart application:
```bash
pm2 restart clawapi
```

2. Increase memory limit:
```bash
NODE_OPTIONS="--max-old-space-size=2048" npm start
```

3. Check for memory leaks:
```bash
node --inspect dist/index.js
# Use Chrome DevTools to profile
```

### Database connection pool exhausted

**Error:**
```
Error: Connection pool exhausted
```

**Solutions:**

1. Increase pool size:
```typescript
const pool = new Pool({
  max: 20  // Increase from 10
})
```

2. Check for connection leaks:
```sql
SELECT count(*) FROM pg_stat_activity;
```

3. Ensure connections are released:
```typescript
const client = await pool.connect()
try {
  // Use client
} finally {
  client.release()  // Always release
}
```

## Deployment Issues

### PM2 won't start

**Error:**
```
Error: Cannot find module 'dist/index.js'
```

**Solution:**
```bash
# Build first
npm run build

# Verify dist exists
ls -la dist/

# Start with PM2
pm2 start ecosystem.config.js
```

### Environment variables not loaded

**Problem:** App can't find DATABASE_URL

**Solutions:**

1. Check .env file exists:
```bash
ls -la .env
```

2. Load env in PM2:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'clawapi',
    script: './dist/index.js',
    env_file: '.env'  // Add this
  }]
}
```

3. Set variables directly:
```bash
export DATABASE_URL="postgresql://..."
pm2 start dist/index.js
```

### Port already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3100
```

**Solution:**
```bash
# Find process using port
lsof -i :3100

# Kill process
kill -9 <PID>

# Or use different port
PORT=3101 npm start
```

## Debugging Tips

### Enable debug logging

```env
LOG_LEVEL=debug
```

### Check all services

```bash
# API health
curl http://localhost:3100/health

# PostgreSQL
docker-compose exec postgres pg_isready

# Redis
docker-compose exec redis redis-cli ping
```

### View all logs

```bash
# Application
pm2 logs clawapi --lines 100

# Docker services
docker-compose logs --tail=100 -f
```

### Database inspection

```sql
-- Check org
SELECT * FROM orgs;

-- Check projects
SELECT * FROM projects WHERE deleted_at IS NULL;

-- Check recent messages
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;

-- Check usage
SELECT
  project_id,
  COUNT(*) as message_count,
  SUM(tokens_in) as total_input,
  SUM(tokens_out) as total_output
FROM messages
GROUP BY project_id;
```

## Getting Help

If you're still stuck:

1. Check GitHub issues
2. Review application logs
3. Test with minimal example
4. Create detailed bug report with:
   - Error message
   - Steps to reproduce
   - Environment details
   - Relevant logs
