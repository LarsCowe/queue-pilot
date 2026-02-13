# Queue Pilot

MCP server for message queue development — combines RabbitMQ message inspection with JSON Schema validation.

## Stack
- TypeScript (strict), ESM modules
- MCP SDK v1.26.0 (@modelcontextprotocol/sdk)
- Zod (tool parameter definitions)
- Ajv + ajv-formats (JSON Schema validation)
- Vitest (testing)
- Node 22 LTS, native fetch

## Architecture
- `src/index.ts` — Entry point, CLI arg parsing, stdio transport
- `src/server.ts` — McpServer instance, registers all tools
- `src/rabbitmq/client.ts` — HTTP client for RabbitMQ Management API (port 15672)
- `src/schemas/loader.ts` — Loads JSON Schema files from a directory
- `src/schemas/validator.ts` — Validates JSON payloads against loaded schemas (Ajv)
- `src/tools/*.ts` — Individual MCP tool implementations

## Conventions
- All logs to stderr (stdout is MCP JSON-RPC transport)
- Tests colocated: `foo.ts` + `foo.test.ts`
- TDD: test first, then code
- Named exports, no default exports
- fetch for HTTP calls (no axios)
- Vhost "/" is encoded as "%2F" in API URLs

## Commands
- `npm test` — Unit tests
- `npm run test:coverage` — Coverage report
- `npm run build` — TypeScript compilation to dist/
- `npm run dev` — Development mode with tsx

## RabbitMQ API Endpoints
- GET /api/queues/{vhost} — List queues
- POST /api/queues/{vhost}/{queue}/get — Peek messages (ackmode: ack_requeue_true)
- GET /api/exchanges/{vhost} — List exchanges
- GET /api/bindings/{vhost} — List bindings
