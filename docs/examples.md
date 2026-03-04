# Examples

Practical examples for using ClawAPI.

## Basic Usage

### Create Organization and Project

```bash
#!/bin/bash

# 1. Bootstrap organization
ORG_RESPONSE=$(curl -s -X POST http://localhost:3100/v1/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"name": "my-company"}')

API_KEY=$(echo $ORG_RESPONSE | jq -r '.api_key')
echo "API Key: $API_KEY"

# 2. Create project
PROJECT_RESPONSE=$(curl -s -X POST http://localhost:3100/v1/projects \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-support",
    "model": "claude-sonnet-4-6",
    "system_prompt": "You are a helpful customer support agent."
  }')

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.project_id')
echo "Project ID: $PROJECT_ID"

# 3. Create session
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3100/v1/projects/$PROJECT_ID/sessions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.session_id')
echo "Session ID: $SESSION_ID"

# 4. Send message
curl -N -X POST http://localhost:3100/v1/projects/$PROJECT_ID/sessions/$SESSION_ID/messages \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello! How can you help me?"}'
```

## Node.js Client

```javascript
// clawapi-client.js
import fetch from 'node-fetch'

class ClawAPIClient {
  constructor(apiKey, baseUrl = 'http://localhost:3100') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async createProject(name, config = {}) {
    const response = await fetch(`${this.baseUrl}/v1/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, ...config })
    })
    return response.json()
  }

  async createSession(projectId) {
    const response = await fetch(
      `${this.baseUrl}/v1/projects/${projectId}/sessions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    )
    return response.json()
  }

  async sendMessage(projectId, sessionId, content, stream = true) {
    const response = await fetch(
      `${this.baseUrl}/v1/projects/${projectId}/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content, stream })
      }
    )

    if (stream) {
      return this.handleStream(response)
    }
    return response.json()
  }

  async *handleStream(response) {
    const reader = response.body
    let buffer = ''

    for await (const chunk of reader) {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          yield data
        }
      }
    }
  }

  async getUsage(projectId = null, startDate = null, endDate = null) {
    const url = projectId
      ? `${this.baseUrl}/v1/usage/projects/${projectId}`
      : `${this.baseUrl}/v1/usage`

    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await fetch(`${url}?${params}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    })
    return response.json()
  }
}

// Usage
const client = new ClawAPIClient('claw_live_xxx')

const project = await client.createProject('my-project', {
  model: 'claude-sonnet-4-6',
  system_prompt: 'You are a helpful assistant.'
})

const session = await client.createSession(project.project_id)

for await (const event of client.sendMessage(
  project.project_id,
  session.session_id,
  'Hello!'
)) {
  console.log(event)
}
```

## Python Client

```python
# clawapi_client.py
import requests
import json
from typing import Iterator, Dict, Any

class ClawAPIClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:3100"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def create_project(self, name: str, **config) -> Dict[str, Any]:
        response = requests.post(
            f"{self.base_url}/v1/projects",
            headers=self.headers,
            json={"name": name, **config}
        )
        return response.json()

    def create_session(self, project_id: str) -> Dict[str, Any]:
        response = requests.post(
            f"{self.base_url}/v1/projects/{project_id}/sessions",
            headers=self.headers,
            json=
        )
        return response.json()

    def send_message(
        self,
        project_id: str,
        session_id: str,
        content: str,
        stream: bool = True
    ) -> Iterator[Dict[str, Any]]:
        response = requests.post(
            f"{self.base_url}/v1/projects/{project_id}/sessions/{session_id}/messages",
            headers=self.headers,
            json={"content": content, "stream": stream},
            stream=stream
        )

        if stream:
            return self._handle_stream(response)
        return response.json()

    def _handle_stream(self, response) -> Iterator[Dict[str, Any]]:
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    yield json.loads(line[6:])

    def get_usage(
        self,
        project_id: str = None,
        start_date: str = None,
        end_date: str = None
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/usage"
        if project_id:
            url += f"/projects/{project_id}"

        params = {}
        if start_date:
            params['start_date'] = start_date
        if end_date:
            params['end_date'] = end_date

        response = requests.get(url, headers=self.headers, params=params)
        return response.json()

# Usage
client = ClawAPIClient("claw_live_xxx")

project = client.create_project(
    "my-project",
    model="claude-sonnet-4-6",
    system_prompt="You are a helpful assistant."
)

session = client.create_session(project["project_id"])

for event in client.send_message(
    project["project_id"],
    session["session_id"],
    "Hello!"
):
    print(event)
```

## Use Cases

### Customer Support Bot

```javascript
const supportBot = await client.createProject('support-bot', {
  model: 'claude-sonnet-4-6',
  system_prompt: `You are a customer support agent for Acme Corp.

  Guidelines:
  - Be friendly and professional
  - Ask clarifying questions
  - Provide step-by-step solutions
  - Escalate complex issues to human agents

  Common issues:
  - Password resets
  - Billing questions
  - Product troubleshooting`,
  tools_config: ['web_search'],
  rate_limit_config: {
    rpm: 120,
    tpm: 200000
  }
})
```

### Content Generator

```javascript
const contentGen = await client.createProject('content-generator', {
  model: 'claude-sonnet-4-6',
  system_prompt: `You are a professional content writer.

  Style:
  - Clear and engaging
  - SEO-optimized
  - Proper formatting

  Output format:
  - Title
  - Introduction
  - Body sections
  - Conclusion`,
  max_context_tokens: 100000
})
```

### Code Assistant

```javascript
const codeAssistant = await client.createProject('code-assistant', {
  model: 'claude-opus-4-6',
  system_prompt: `You are an expert software engineer.

  Capabilities:
  - Code review
  - Bug fixing
  - Architecture advice
  - Best practices

  Always:
  - Explain your reasoning
  - Provide examples
  - Consider edge cases`,
  rate_limit_config: {
    rpm: 30,
    tpm: 150000
  }
})
```

## Advanced Patterns

### Conversation Context Management

```javascript
// Keep track of conversation context
class ConversationManager {
  constructor(client, projectId) {
    this.client = client
    this.projectId = projectId
    this.sessions = new Map()
  }

  async getOrCreateSession(userId) {
    if (!this.sessions.has(userId)) {
      const session = await this.client.createSession(this.projectId)
      this.sessions.set(userId, session.session_id)
    }
    return this.sessions.get(userId)
  }

  async sendMessage(userId, content) {
    const sessionId = await this.getOrCreateSession(userId)
    return this.client.sendMessage(this.projectId, sessionId, content)
  }

  clearSession(userId) {
    this.sessions.delete(userId)
  }
}
```

### Usage Monitoring

```javascript
// Monitor and alert on usage
async function monitorUsage(client, projectId, budgetUSD) {
  const usage = await client.getUsage(projectId)
  const cost = usage.usage.estimated_cost_usd

  if (cost > budgetUSD * 0.8) {
    console.warn(`Warning: 80% of budget used ($${cost}/$${budgetUSD})`)
  }

  if (cost > budgetUSD) {
    console.error(`Budget exceeded: $${cost}/$${budgetUSD}`)
    // Disable project or alert admin
  }

  return usage
}
```

### Retry Logic

```javascript
// Implement exponential backoff
async function sendMessageWithRetry(client, projectId, sessionId, content, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.sendMessage(projectId, sessionId, content, false)
    } catch (error) {
      if (error.statusCode === 429) {
        const delay = Math.pow(2, i) * 1000
        console.log(`Rate limited, retrying in ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
  throw new Error('Max retries exceeded')
}
```
