# Queue Pilot

MCP server for message queue development — combines RabbitMQ message inspection with JSON Schema validation.

Designed for integration projects where multiple teams communicate via RabbitMQ: inspect queues, view messages, and validate payloads against agreed-upon schemas — all from within Claude.

## Features

- **Message Inspection** — Browse queues, peek at messages without consuming them
- **Schema Validation** — Validate message payloads against JSON Schema definitions
- **Combined Inspection** — `inspect_queue` peeks messages AND validates each against its schema
- **Broker Info** — List exchanges and bindings to understand message routing

## Quick Start

### 1. Define your schemas

Create JSON Schema files in a directory:

```json
// schemas/order.created.json
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

### 2. Configure in Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "queue-pilot": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/queue-pilot/src/index.ts",
        "--schemas", "./schemas",
        "--rabbitmq-url", "http://localhost:15672",
        "--rabbitmq-user", "guest",
        "--rabbitmq-pass", "guest"
      ]
    }
  }
}
```

### 3. Use with Claude

Ask Claude things like:

- "Which queues are there and how many messages do they have?"
- "Show me the messages in the orders queue"
- "Inspect the registration queue and check if all messages are valid"
- "What schemas are available?"
- "Validate this message against the order.created schema"

## MCP Tools

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

## Development

```bash
npm install
npm test                    # Unit tests (48 tests)
npm run test:coverage       # Coverage report
npm run build               # TypeScript compilation
npm run lint                # Type check

# Integration tests (requires RabbitMQ)
docker compose up -d
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
