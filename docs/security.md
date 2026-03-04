# Security

Security best practices and guidelines for ClawAPI.

## Authentication

### API Key Security

**Generation:**
- 32 bytes of cryptographically secure random data
- Base64 encoded for transmission
- Bcrypt hashed before database storage
- Never logged or exposed after creation

**Storage:**
```typescript
// Keys are hashed with bcrypt (cost factor 10)
const hash = await bcrypt.hash(apiKey, 10)
```

**Best Practices:**
- Store keys in environment variables or secret managers
- Never commit keys to version control
- Rotate keys periodically
- Use separate keys for dev/staging/prod
- Revoke compromised keys immediately

### API Key Prefixes

Keys are prefixed for easy identification:
- `claw_live_` - Production keys
- `claw_test_` - Test mode keys (future)

### Authorization

All requests (except `/health` and `/v1/bootstrap`) require:

```http
Authorization: Bearer claw_live_xxxxx
```

**Validation:**
1. Extract key from Authorization header
2. Hash and compare with database
3. Load organization context
4. Verify resource access

## Multi-Tenancy Isolation

### Organization Level

- Each org has unique API key
- Projects scoped to organization
- No cross-org data access
- Separate billing and usage tracking

### Project Level

- Projects isolated within organization
- Custom API keys per project (optional)
- Independent rate limits
- Separate system prompts and tools

### Database Isolation

```sql
-- All queries include org_id filter
SELECT * FROM projects
WHERE org_id = $1 AND project_id = $2;

-- Foreign key constraints enforce boundaries
ALTER TABLE projects
ADD CONSTRAINT fk_org
FOREIGN KEY (org_id) REFERENCES orgs(org_id);
```

## Rate Limiting

### Purpose

Prevents:
- API abuse
- Cost overruns
- Resource exhaustion
- DDoS attacks

### Implementation

Token bucket algorithm with Redis:

```typescript
// Check RPM limit
const rpm_key = `ratelimit:${project_id}:rpm`
const rpm_count = await redis.incr(rpm_key)
if (rpm_count === 1) {
  await redis.expire(rpm_key, 60)
}
if (rpm_count > rpm_limit) {
  throw new RateLimitError()
}

// Check TPM limit
const tpm_key = `ratelimit:${project_id}:tpm`
const tpm_count = await redis.incrby(tpm_key, estimated_tokens)
if (tpm_count === estimated_tokens) {
  await redis.expire(tpm_key, 60)
}
if (tpm_count > tpm_limit) {
  throw new RateLimitError()
}
```

### Configuration

Set per-project limits:

```json
{
  "rate_limit_config": {
    "rpm": 60,
    "tpm": 100000
  }
}
```

## Input Validation

### Request Validation

All inputs validated with Zod schemas:

```typescript
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  model: z.enum(['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5']),
  system_prompt: z.string().max(10000).optional(),
  tools_config: z.array(z.string()).optional()
})
```

### SQL Injection Prevention

Using parameterized queries:

```typescript
// Safe - parameterized
const result = await pool.query(
  'SELECT * FROM projects WHERE project_id = $1',
  [projectId]
)

// NEVER do this - vulnerable to SQL injection
const result = await pool.query(
  `SELECT * FROM projects WHERE project_id = '${projectId}'`
)
```

## Secrets Management

### Environment Variables

**Development:**
```bash
# .env file (never commit)
ANTHROPIC_API_KEY=sk-ant-xxx
JWT_SECRET=xxx
```

**Production:**
Use secret management services:
- AWS Secrets Manager
- HashiCorp Vault
- Doppler
- 1Password

### Database Credentials

**Connection strings:**
```env
# Include credentials in URL
DATABASE_URL=postgresql://user:pass@host:5432/db

# Or use separate variables
DB_HOST=localhost
DB_USER=clawapi
DB_PASSWORD=secure-password
DB_NAME=clawapi
```

**Best practices:**
- Use strong passwords (20+ characters)
- Rotate credentials regularly
- Limit database user permissions
- Use SSL/TLS for connections

## Network Security

### HTTPS Only

**Nginx configuration:**
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}

# HTTPS only
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Strong SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### Firewall Rules

```bash
# Allow SSH, HTTP, HTTPS only
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Block direct access to app port
sudo ufw deny 3100/tcp
```

### Database Access

```bash
# Restrict PostgreSQL to localhost
# In postgresql.conf:
listen_addresses = 'localhost'

# Or specific IPs
listen_addresses = '127.0.0.1,10.0.1.5'
```

## Logging Security

### What to Log

**Do log:**
- Authentication attempts
- API requests (without sensitive data)
- Rate limit violations
- Errors and exceptions
- System events

**Never log:**
- API keys
- Passwords
- User messages (PII)
- Full request bodies with sensitive data

### Secure Logging

```typescript
// Good - sanitized logging
logger.info({
  event: 'message_sent',
  project_id: projectId,
  session_id: sessionId,
  tokens: tokenCount
})

// Bad - exposes sensitive data
logger.info({
  event: 'message_sent',
  api_key: apiKey,  // NEVER LOG THIS
  message_content: content  // May contain PII
})
```

## Data Protection

### Soft Deletes

Projects are soft-deleted, not permanently removed:

```sql
UPDATE projects
SET deleted_at = NOW()
WHERE project_id = $1;
```

**Benefits:**
- Accidental deletion recovery
- Audit trail preservation
- Compliance requirements

### Data Retention

**Messages:**
- Stored indefinitely by default
- Can implement retention policies
- Consider GDPR/privacy requirements

**Usage data:**
- Keep for billing purposes
- Aggregate for analytics
- Archive old data

## Compliance

### GDPR Considerations

If handling EU user data:
- Implement data deletion endpoints
- Provide data export functionality
- Document data processing
- Obtain user consent

### Data Processing Agreement

When using Anthropic API:
- Review Anthropic's DPA
- Understand data handling
- Configure data retention
- Document compliance

## Security Headers

Add security headers in nginx:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

## Vulnerability Management

### Dependency Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Update dependencies
npm update
```

### Security Scanning

**Tools:**
- Snyk
- Dependabot
- npm audit
- OWASP Dependency-Check

## Incident Response

### If API Key Compromised

1. Immediately revoke the key
2. Generate new key
3. Update all clients
4. Review access logs
5. Check for unauthorized usage

### If Database Compromised

1. Rotate all credentials
2. Review access logs
3. Notify affected users
4. Implement additional security
5. Document incident

## Security Checklist

- [ ] Use HTTPS only
- [ ] Strong JWT_SECRET (32+ chars)
- [ ] API keys hashed in database
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Parameterized SQL queries
- [ ] Firewall configured
- [ ] Database access restricted
- [ ] Secrets in environment variables
- [ ] Security headers configured
- [ ] Regular dependency updates
- [ ] Logging sanitized
- [ ] Backup strategy implemented
- [ ] Incident response plan documented
