# Queue Pilot

MCP server for message queue development — combines RabbitMQ and Kafka message inspection with JSON Schema validation.

## Stack
- TypeScript (strict), ESM modules
- MCP SDK v1.26.0 (@modelcontextprotocol/sdk)
- Zod (tool parameter definitions)
- Ajv + ajv-formats (JSON Schema validation)
- Vitest (testing)
- Node 22 LTS, native fetch
- @confluentinc/kafka-javascript (optional peer dep for Kafka)

## Architecture
- `src/index.ts` — Entry point, CLI arg parsing, stdio transport
- `src/server.ts` — McpServer instance, registers all tools
- `src/broker/types.ts` — BrokerAdapter interface + capability interfaces
- `src/broker/factory.ts` — Creates adapter + broker-specific tools from config
- `src/broker/registry.ts` — Registers all tools on McpServer
- `src/broker/tool-definition.ts` — ToolDefinition interface
- `src/rabbitmq/client.ts` — HTTP client for RabbitMQ Management API (port 15672)
- `src/kafka/client.ts` — Kafka client wrapping @confluentinc/kafka-javascript
- `src/kafka/types.ts` — Kafka-specific configuration and response types
- `src/brokers/rabbitmq/adapter.ts` — RabbitMQ adapter (BrokerAdapter + all capabilities)
- `src/brokers/rabbitmq/tools.ts` — RabbitMQ-specific tools (exchanges, bindings)
- `src/brokers/kafka/adapter.ts` — Kafka adapter (BrokerAdapter + Overview + Consumer)
- `src/brokers/kafka/tools.ts` — Kafka-specific tools (consumer groups, partitions, offsets)
- `src/schemas/loader.ts` — Loads JSON Schema files from a directory
- `src/schemas/validator.ts` — Validates JSON payloads against loaded schemas (Ajv)
- `src/tools/*.ts` — Individual MCP tool implementations (universal, broker-agnostic)

## Conventions
- All logs to stderr (stdout is MCP JSON-RPC transport)
- Tests colocated: `foo.ts` + `foo.test.ts`
- TDD: test first, then code
- Named exports, no default exports
- fetch for HTTP calls (no axios)
- Vhost "/" is encoded as "%2F" in RabbitMQ API URLs
- Kafka module loaded via dynamic import() — fails gracefully when not installed

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
