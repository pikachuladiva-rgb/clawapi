---
name: setup
description: Automates the setup of ClawAPI for new developers. Use when a user asks to "setup the project", "install", or just runs /setup. It handles environment configuration, database setup, migrations, and starting the server.
---

# ClawAPI Setup

Run setup steps automatically to get the project running. Do not ask the user to run commands manually — run them yourself using the bash tool. Only pause when you need the user to provide a secret value.

## 1. Check Prerequisites

Run `node -v` and `docker-compose -v` to ensure Node.js and Docker are installed.
If Node is missing, instruct the user how to install it.
If Docker is missing, instinct the user how to install it.

## 2. Start Infrastructure

Run `docker-compose up -d`.
Wait 5 seconds, then run `docker-compose ps` to verify `postgres` and `redis` are running.
If they fail to start, diagnose the issue (e.g. port conflicts) and help the user resolve it.

## 3. Configure Environment

Check if `.env` exists.
If not, copy `.env.example` to `.env`.

Ask the user: "Please provide your Anthropic API Key (Starts with sk-ant-...). I need this for the Agent SDK to function."

Once they provide it, use `sed` or bash tools to insert their key into the `.env` file for the `ANTHROPIC_API_KEY` variable.

## 4. Install Dependencies

Run `npm install`.
Ensure it completes successfully.

## 5. Database Migration

Run `npm run db:migrate`.
If it fails due to the database connection, verify the `DATABASE_URL` in `.env` matches the docker-compose setup and wait a few more seconds for Postgres to initialize, then retry.

## 6. Build and Start

Run `npm run build` to compile the TypeScript code.
Then tell the user the setup is complete and they can start the server in development mode by running `npm run dev`.

Provide them with the following next steps:
1. "The server will be available at http://localhost:3100"
2. "You can access the Admin UI at http://localhost:3100/admin.html"
3. "To bootstrap your first organization, run:"
```bash
curl -X POST http://localhost:3100/v1/bootstrap -H "Content-Type: application/json" -d '{"name": "my-org"}'
```
