# Development

Guide for contributing to and developing ClawAPI.

## Development Setup

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git
- Code editor (VS Code recommended)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/pikachuladiva-rgb/clawapi.git
cd clawapi

# Install dependencies
npm install

# Start infrastructure
docker-compose up -d

# Copy environment file
cp .env.example .env

# Edit .env with your Anthropic API key
nano .env

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

The API will run at `http://localhost:3100` with auto-reload on file changes.

## Project Structure

```
clawapi/
├── src/
│   ├── api/              # API route handlers
│   │   ├── admin.ts      # Admin endpoints
│   │   ├── messages.ts   # Message handling
│   │   ├── projects.ts   # Project CRUD
│   │   ├── sessions.ts   # Session management
│   │   └── usage.ts      # Usage tracking
│   ├── auth/             # Authentication
│   │   ├── keys.ts       # API key generation
│   │   └── middleware.ts # Auth middleware
│   ├── billing/          # Rate limiting & tracking
│   │   ├── limiter.ts    # Rate limiter
│   │   └── tracker.ts    # Usage tracker
│   ├── claude/           # Claude integration
│   │   ├── agent-sdk-handler.ts  # Agent SDK
│   │   ├── api-proxy.ts          # API proxy
│   │   ├── context.ts            # Context management
│   │   ├── env.ts                # Environment
│   │   ├── path-validator.ts     # Path validation
│   │   ├── sdk-handler.ts        # SDK handler
│   │   ├── streaming.ts          # SSE streaming
│   │   └── system-prompt.ts      # System prompts
│   ├── db/               # Database layer
│   │   ├── queries/      # SQL queries
│   │   ├── client.ts     # DB connection
│   │   └── migrate.ts    # Migrations
│   ├── providers/        # External providers
│   │   └── anthropic.ts  # Anthropic API
│   ├── tools/            # Tool registry
│   │   └── registry.ts
│   ├── config.ts         # Configuration
│   ├── index.ts          # Entry point
│   ├── logger.ts         # Logging
│   └── types.ts          # TypeScript types
├── docs/                 # Documentation
├── public/               # Static files
├── dist/                 # Compiled output
├── .env.example          # Environment template
├── docker-compose.yml    # Local infrastructure
├── package.json
└── tsconfig.json
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Edit files in `src/` directory. The dev server will auto-reload.

### 3. Test Changes

```bash
# Run tests
npm test

# Test specific endpoint
curl -X POST http://localhost:3100/v1/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "test-org"}'
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

## Code Style

### TypeScript

```typescript
// Use explicit types
function createProject(data: CreateProjectInput): Promise<Project> {
  // Implementation
}

// Use async/await
async function fetchData() {
  const result = await db.query('SELECT * FROM projects')
  return result.rows
}

// Handle errors properly
try {
  await riskyOperation()
} catch (error) {
  logger.error({ error }, 'Operation failed')
  throw new APIError('Operation failed')
}
```

### Naming Conventions

- **Files**: kebab-case (`api-handler.ts`)
- **Functions**: camelCase (`createProject`)
- **Classes**: PascalCase (`ProjectManager`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_TOKENS`)
- **Types**: PascalCase (`ProjectConfig`)

### Error Handling

```typescript
// Custom error classes
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
  }
}

// Use in handlers
if (!project) {
  throw new APIError('Project not found', 404)
}
```

## Database Development

### Adding Migrations

Edit `src/db/migrate.ts`:

```typescript
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS new_table (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}
```

Run migration:
```bash
npm run db:migrate
```

### Query Development

Add queries in `src/db/queries/`:

```typescript
// src/db/queries/projects.ts
export async function getProject(projectId: string) {
  const result = await pool.query(
    'SELECT * FROM projects WHERE project_id = $1',
    [projectId]
  )
  return result.rows[0]
}
```

## API Development

### Adding New Endpoints

```typescript
// src/api/your-feature.ts
import { Hono } from 'hono'
import { authMiddleware } from '../auth/middleware'

const app = new Hono()

app.post('/endpoint', authMiddleware, async (c) => {
  const body = await c.req.json()

  // Validate input
  // Process request
  // Return response

  return c.json({ success: true })
})

export default app
```

Register in `src/index.ts`:

```typescript
import yourFeature from './api/your-feature'
app.route('/v1/your-feature', yourFeature)
```

## Testing

### Unit Tests

```typescript
// src/api/projects.test.ts
import { describe, it, expect } from 'vitest'
import { createProject } from './projects'

describe('createProject', () => {
  it('should create a project', async () => {
    const project = await createProject({
      name: 'test',
      org_id: 'org_123'
    })

    expect(project.name).toBe('test')
    expect(project.project_id).toBeDefined()
  })
})
```

Run tests:
```bash
npm test
```

### Integration Tests

Test full API flows:

```bash
# Create org
ORG_RESPONSE=$(curl -X POST http://localhost:3100/v1/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "test-org"}')

API_KEY=$(echo $ORG_RESPONSE | jq -r '.api_key')

# Create project
curl -X POST http://localhost:3100/v1/projects \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-project"}'
```

## Debugging

### Logging

```typescript
import logger from './logger'

logger.debug({ data }, 'Debug message')
logger.info({ data }, 'Info message')
logger.warn({ data }, 'Warning message')
logger.error({ error }, 'Error message')
```

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug ClawAPI",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

## Common Tasks

### Reset Database

```bash
docker-compose down -v
docker-compose up -d
npm run db:migrate
```

### View Logs

```bash
# Application logs
npm run dev

# PostgreSQL logs
docker-compose logs postgres

# Redis logs
docker-compose logs redis
```

### Database Console

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U clawapi -d clawapi

# Run queries
SELECT * FROM orgs;
SELECT * FROM projects;
```

### Redis Console

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# View keys
KEYS *

# Get rate limit data
GET ratelimit:proj_xyz:rpm
```

## Performance Profiling

### Node.js Profiler

```bash
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt
```

### Load Testing

```bash
# Install autocannon
npm install -g autocannon

# Run load test
autocannon -c 10 -d 30 http://localhost:3100/health
```

## Contributing Guidelines

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit pull request

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Error handling implemented
- [ ] TypeScript types defined
- [ ] Commit messages are clear

### Commit Message Format

```
type(scope): subject

body

footer
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Example:**
```
feat(api): add project deletion endpoint

Implements soft delete for projects with cascade to sessions.

Closes #123
```

## Tools and Extensions

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript
- REST Client
- Docker
- PostgreSQL

### Useful Commands

```bash
# Format code
npx prettier --write src/

# Lint code
npx eslint src/

# Type check
npx tsc --noEmit

# Build
npm run build

# Clean build
rm -rf dist && npm run build
```
