import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SchemaValidator } from "../schemas/validator.js";
import type { BrokerAdapter } from "./types.js";
import { hasOverview, hasConsumers, hasConnections } from "./types.js";
import type { ToolDefinition } from "./tool-definition.js";
import { listSchemas } from "../tools/list-schemas.js";
import { getSchema } from "../tools/get-schema.js";
import { validateMessage } from "../tools/validate-message.js";
import { listQueues } from "../tools/list-queues.js";
import { getQueue } from "../tools/get-queue.js";
import { createQueue } from "../tools/create-queue.js";
import { deleteQueue } from "../tools/delete-queue.js";
import { purgeQueue } from "../tools/purge-queue.js";
import { peekMessages } from "../tools/peek-messages.js";
import { inspectQueue } from "../tools/inspect-queue.js";
import { publishMessage } from "../tools/publish-message.js";
import { checkHealth } from "../tools/check-health.js";
import { getOverview } from "../tools/get-overview.js";
import { listConsumers } from "../tools/list-consumers.js";
import { listConnections } from "../tools/list-connections.js";

const jsonResponse = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

export function registerSchemaTools(server: McpServer, validator: SchemaValidator): void {
  server.tool("list_schemas", "List all loaded message schemas", {}, async () => {
    return jsonResponse(listSchemas(validator));
  });

  server.tool(
    "get_schema",
    "Get the full definition of a specific schema",
    { name: z.string().describe("Schema name (e.g. 'order.created')") },
    async ({ name }) => jsonResponse(getSchema(validator, name)),
  );

  server.tool(
    "validate_message",
    "Validate a JSON message against a schema",
    {
      schemaName: z.string().describe("Schema name to validate against"),
      message: z.string().describe("JSON message payload to validate"),
    },
    async ({ schemaName, message }) => jsonResponse(validateMessage(validator, schemaName, message)),
  );
}

export function registerUniversalTools(
  server: McpServer,
  adapter: BrokerAdapter,
  validator: SchemaValidator,
): void {
  server.tool(
    "list_queues",
    "List all queues with message counts",
    {
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ vhost }) => jsonResponse(await listQueues(adapter, vhost)),
  );

  server.tool(
    "get_queue",
    "Get detailed information about a specific queue",
    {
      queue: z.string().describe("Queue name"),
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ queue, vhost }) => jsonResponse(await getQueue(adapter, vhost, queue)),
  );

  server.tool(
    "create_queue",
    "Create a new queue. Idempotent if settings match; errors if the queue exists with different settings.",
    {
      queue: z.string().describe("Queue name"),
      durable: z.boolean().default(false).describe("Survive broker restart (default: false)"),
      auto_delete: z.boolean().default(false).describe("Delete when last consumer disconnects (default: false)"),
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ queue, durable, auto_delete, vhost }) =>
      jsonResponse(await createQueue(adapter, { queue, durable, auto_delete, vhost })),
  );

  server.tool(
    "delete_queue",
    "Delete a queue.",
    {
      queue: z.string().describe("Queue name"),
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ queue, vhost }) => jsonResponse(await deleteQueue(adapter, { queue, vhost })),
  );

  server.tool(
    "purge_queue",
    "Remove all messages from a queue. Returns the number of messages purged.",
    {
      queue: z.string().describe("Queue name"),
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ queue, vhost }) => jsonResponse(await purgeQueue(adapter, vhost, queue)),
  );

  server.tool(
    "peek_messages",
    "View messages in a queue without consuming them",
    {
      queue: z.string().describe("Queue name"),
      count: z.number().int().min(1).max(50).default(5).describe("Number of messages to peek (default 5, max 50)"),
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ queue, count, vhost }) => jsonResponse(await peekMessages(adapter, vhost, queue, count)),
  );

  server.tool(
    "inspect_queue",
    "View messages in a queue and validate each against its schema",
    {
      queue: z.string().describe("Queue name"),
      count: z.number().int().min(1).max(50).default(5).describe("Number of messages to inspect (default 5, max 50)"),
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ queue, count, vhost }) => jsonResponse(await inspectQueue(adapter, validator, vhost, queue, count)),
  );

  server.tool(
    "publish_message",
    "Publish a message to an exchange. Optionally validates against a schema before publishing — if validation fails, the message is NOT sent.",
    {
      exchange: z.string().describe("Exchange name ('amq.default' for direct-to-queue)"),
      routing_key: z.string().describe("Routing key"),
      payload: z.string().describe("JSON message payload"),
      message_type: z.string().optional().describe("Message type (e.g. 'order.created'), used for schema lookup"),
      headers: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe("Optional message headers"),
      validate: z.boolean().default(true).describe("Validate before publishing (default: true)"),
      vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
    },
    async ({ exchange, routing_key, payload, message_type, headers, validate, vhost }) =>
      jsonResponse(await publishMessage(adapter, validator, { exchange, routing_key, payload, message_type, headers, validate, vhost })),
  );

  server.tool(
    "check_health",
    "Check broker health status. Returns ok or failed with reason.",
    {},
    async () => jsonResponse(await checkHealth(adapter)),
  );
}

export function registerCapabilityTools(server: McpServer, adapter: BrokerAdapter): void {
  if (hasOverview(adapter)) {
    const overviewAdapter = adapter;
    server.tool(
      "get_overview",
      "Get cluster overview: version info, message rates, queue totals, and object counts.",
      {},
      async () => jsonResponse(await getOverview(overviewAdapter)),
    );
  }

  if (hasConsumers(adapter)) {
    const consumerAdapter = adapter;
    server.tool(
      "list_consumers",
      "List all consumers connected to queues in a scope.",
      {
        vhost: z.string().default("/").describe("Virtual host / scope (default: '/')"),
      },
      async ({ vhost }) => jsonResponse(await listConsumers(consumerAdapter, vhost)),
    );
  }

  if (hasConnections(adapter)) {
    const connectionAdapter = adapter;
    server.tool(
      "list_connections",
      "List all client connections to the broker.",
      {},
      async () => jsonResponse(await listConnections(connectionAdapter)),
    );
  }
}

export function registerBrokerTools(server: McpServer, tools: ToolDefinition[]): void {
  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.parameters,
      async (args: Record<string, unknown>) => jsonResponse(await tool.handler(args)),
    );
  }
}
