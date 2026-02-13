# Queue Pilot

[![npm version](https://img.shields.io/npm/v/queue-pilot)](https://www.npmjs.com/package/queue-pilot)
[![license](https://img.shields.io/npm/l/queue-pilot)](LICENSE)

MCP server for message queue development — combines RabbitMQ message inspection with JSON Schema validation.

Designed for integration projects where multiple teams communicate via RabbitMQ: inspect queues, view messages, and validate payloads against agreed-upon schemas — all from your AI assistant.

## Features

- **Message Inspection** — Browse queues, peek at messages without consuming them
- **Schema Validation** — Validate message payloads against JSON Schema definitions
- **Combined Inspection** — `inspect_queue` peeks messages AND validates each against its schema
- **Validated Publishing** — `publish_message` validates against a schema before sending — invalid messages never hit the broker
- **Queue Management** — Create queues, bindings, and purge messages for dev/test workflows
- **Broker Info** — List exchanges and bindings to understand message routing

## Quick Start

### 1. Define your schemas

Create JSON Schema files in a directory:

`schemas/order.created.json`:

```json
{
  "$id": "order.created",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Order Created",
  "description": "Emitted when a new order is placed",
  "version": "1.0.0",
  "type": "object",
  "required": ["orderId", "amount"],
  "properties": {
    "orderId": { "type": "string" },
    "amount": { "type": "number" }
  }
}
```

### 2. Add to your MCP client

Add the following server configuration to your MCP client:

```json
{
  "mcpServers": {
    "queue-pilot": {
      "command": "npx",
      "args": [
        "queue-pilot",
        "--schemas", "./schemas",
        "--rabbitmq-url", "http://localhost:15672",
        "--rabbitmq-user", "guest",
        "--rabbitmq-pass", "guest"
      ]
    }
  }
}
```

<details>
<summary>Where does this config go?</summary>

| Client | Config file |
|--------|------------|
| Claude Code | `.claude/mcp.json` (project) or `~/.claude/mcp.json` (global) |
| Claude Desktop | `claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| VS Code (Copilot) | `.vscode/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

</details>

<details>
<summary>Development (running from source)</summary>

```json
{
  "mcpServers": {
    "queue-pilot": {
      "command": "npx",
      "args": [
        "tsx",
        "src/index.ts",
        "--schemas", "./schemas",
        "--rabbitmq-url", "http://localhost:15672",
        "--rabbitmq-user", "guest",
        "--rabbitmq-pass", "guest"
      ]
    }
  }
}
```

</details>

### 3. Use it

Ask your assistant things like:

- "Which queues are there and how many messages do they have?"
- "Show me the messages in the orders queue"
- "Inspect the registration queue and check if all messages are valid"
- "What schemas are available?"
- "Validate this message against the order.created schema"
- "Publish an order.created event to the events exchange"
- "Create a queue called dead-letters and bind it to the events exchange"
- "Purge all messages from the orders queue"

## MCP Tools

### Read

| Tool | Description |
|------|-------------|
| `list_schemas` | List all loaded message schemas |
| `get_schema` | Get the full definition of a specific schema |
| `validate_message` | Validate a JSON message against a schema |
| `list_queues` | List all RabbitMQ queues with message counts |
| `peek_messages` | View messages in a queue without consuming them |
| `inspect_queue` | Peek messages + validate each against its schema |
| `list_exchanges` | List all RabbitMQ exchanges |
| `list_bindings` | List bindings between exchanges and queues |

### Write

| Tool | Description |
|------|-------------|
| `publish_message` | Publish a message to an exchange with optional schema validation gate |
| `purge_queue` | Remove all messages from a queue (returns count purged) |
| `create_queue` | Create a new queue (idempotent if settings match) |
| `create_binding` | Bind a queue to an exchange with a routing key |

## Schema Format

Schemas follow JSON Schema draft-07 with a few conventions:

- `$id` — Message type identifier (matches the `type` property on RabbitMQ messages)
- `version` — Schema version (custom field, not validated by JSON Schema)
- Standard JSON Schema validation including `required`, `properties`, `format` etc.

Schema matching: when inspecting a queue, the message's `type` property is used to find the corresponding schema by `$id`.

## CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--schemas` | (required) | Path to directory containing JSON Schema files |
| `--rabbitmq-url` | `http://localhost:15672` | RabbitMQ Management API URL |
| `--rabbitmq-user` | `guest` | RabbitMQ username |
| `--rabbitmq-pass` | `guest` | RabbitMQ password |

## Environment Variables

RabbitMQ connection settings can also be configured via environment variables. CLI arguments take priority over environment variables, which take priority over defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `http://localhost:15672` | RabbitMQ Management API URL |
| `RABBITMQ_USER` | `guest` | RabbitMQ username |
| `RABBITMQ_PASS` | `guest` | RabbitMQ password |

This is useful with MCP client `env` blocks to avoid exposing credentials in `ps` output:

```json
{
  "mcpServers": {
    "queue-pilot": {
      "command": "npx",
      "args": ["queue-pilot", "--schemas", "./schemas"],
      "env": {
        "RABBITMQ_URL": "http://localhost:15672",
        "RABBITMQ_USER": "admin",
        "RABBITMQ_PASS": "secret"
      }
    }
  }
}
```

## Development

```bash
npm install
npm test                    # Unit tests
npm run test:coverage       # Coverage report
npm run build               # TypeScript compilation
npm run typecheck           # Type check

# Integration tests (requires RabbitMQ)
docker compose up -d --wait
npm run test:integration
```

## Tech Stack

- TypeScript (strict mode, ESM)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) v1.26.0
- [Ajv](https://ajv.js.org/) for JSON Schema validation
- [Zod](https://zod.dev/) for MCP tool parameter definitions
- [Vitest](https://vitest.dev/) for testing
- RabbitMQ Management HTTP API (no additional broker dependencies)

## License

MIT
