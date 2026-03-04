# Deployment

Production deployment guide for ClawAPI.

## Deployment Options

1. **PM2** - Process manager (recommended for VPS)
2. **Docker** - Containerized deployment
3. **Kubernetes** - Enterprise orchestration
4. **Serverless** - Cloud functions (future)

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ database
- Redis 6+ instance
- Domain with SSL certificate
- Reverse proxy (nginx/caddy)

## PM2 Deployment

### 1. Install PM2

```bash
npm install -g pm2
```

### 2. Build Application

```bash
npm run build
```

### 3. Create PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'clawapi',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3100
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
}
```

### 4. Start Application

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Monitor

```bash
pm2 status
pm2 logs clawapi
pm2 monit
```

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3100

CMD ["node", "dist/index.js"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3100:3100"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://clawapi:password@postgres:5432/clawapi
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_USER=clawapi
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=clawapi
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Deploy

```bash
docker-compose up -d
docker-compose logs -f api
```

## Nginx Reverse Proxy

### 1. Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 2. Configure Site

Create `/etc/nginx/sites-available/clawapi`:

```nginx
upstream clawapi {
    server 127.0.0.1:3100;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://clawapi;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE support
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

### 3. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/clawapi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate

### Using Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## Database Setup

### Managed PostgreSQL

**Recommended providers:**
- AWS RDS
- DigitalOcean Managed Databases
- Supabase
- Neon

**Connection string format:**
```
postgresql://username:password@host:5432/database?sslmode=require
```

### Self-Hosted PostgreSQL

```bash
# Install
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE clawapi;
CREATE USER clawapi WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE clawapi TO clawapi;
```

## Redis Setup

### Managed Redis

**Recommended providers:**
- AWS ElastiCache
- DigitalOcean Managed Redis
- Upstash
- Redis Cloud

### Self-Hosted Redis

```bash
# Install
sudo apt install redis-server

# Configure
sudo nano /etc/redis/redis.conf
# Set: bind 127.0.0.1
# Set: requirepass your-secure-password

# Restart
sudo systemctl restart redis
```

## Environment Variables

Create `.env` in production:

```env
NODE_ENV=production
PORT=3100
DATABASE_URL=postgresql://user:pass@host:5432/clawapi?sslmode=require
REDIS_URL=redis://:password@host:6379
JWT_SECRET=your-secure-32-char-minimum-secret
ANTHROPIC_API_KEY=sk-ant-your-production-key
LOG_LEVEL=warn
```

**Security:**
```bash
chmod 600 .env
```

## Health Checks

### Endpoint

```bash
curl https://api.yourdomain.com/health
```

### Monitoring Script

Create `healthcheck.sh`:

```bash
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://api.yourdomain.com/health)
if [ $RESPONSE -ne 200 ]; then
    echo "Health check failed: $RESPONSE"
    pm2 restart clawapi
fi
```

### Cron Job

```bash
crontab -e
# Add: */5 * * * * /path/to/healthcheck.sh
```

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > /backups/clawapi_$DATE.sql
find /backups -name "clawapi_*.sql" -mtime +7 -delete
```

### Automated Backups

```bash
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

## Scaling

### Horizontal Scaling

Run multiple API instances:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'clawapi',
    script: './dist/index.js',
    instances: 4,  // or 'max'
    exec_mode: 'cluster'
  }]
}
```

### Load Balancing

Use nginx upstream:

```nginx
upstream clawapi {
    least_conn;
    server 127.0.0.1:3100;
    server 127.0.0.1:3101;
    server 127.0.0.1:3102;
    server 127.0.0.1:3103;
}
```

### Database Scaling

- Enable connection pooling
- Use read replicas for queries
- Implement caching layer

## Monitoring

### Application Monitoring

**PM2 Plus:**
```bash
pm2 link <secret> <public>
```

**Custom monitoring:**
- Prometheus + Grafana
- Datadog
- New Relic

### Log Aggregation

**Options:**
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Loki + Grafana
- CloudWatch Logs
- Papertrail

### Alerts

Set up alerts for:
- API downtime
- High error rates
- Rate limit violations
- Database connection issues
- High memory usage

## Security Checklist

- [ ] Use HTTPS only
- [ ] Set secure JWT_SECRET
- [ ] Enable firewall (ufw/iptables)
- [ ] Restrict database access
- [ ] Use environment variables
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Regular security updates
- [ ] Backup database daily
- [ ] Use strong passwords

## Deployment Checklist

- [ ] Build application (`npm run build`)
- [ ] Set production environment variables
- [ ] Run database migrations
- [ ] Configure reverse proxy
- [ ] Set up SSL certificate
- [ ] Start application with PM2
- [ ] Verify health endpoint
- [ ] Test API endpoints
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Document deployment

## Troubleshooting

**Application won't start:**
```bash
pm2 logs clawapi --lines 100
```

**Database connection fails:**
```bash
psql $DATABASE_URL
```

**Redis connection fails:**
```bash
redis-cli -u $REDIS_URL ping
```

**High memory usage:**
```bash
pm2 restart clawapi
```
