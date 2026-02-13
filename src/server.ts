import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RabbitMQClient } from "./rabbitmq/client.js";
import { SchemaValidator } from "./schemas/validator.js";
import type { SchemaEntry } from "./schemas/types.js";
import { VERSION } from "./version.js";
import { listSchemas } from "./tools/list-schemas.js";
import { getSchema } from "./tools/get-schema.js";
import { validateMessage } from "./tools/validate-message.js";
import { listQueues } from "./tools/list-queues.js";
import { peekMessages } from "./tools/peek-messages.js";
import { inspectQueue } from "./tools/inspect-queue.js";
import { listExchanges } from "./tools/list-exchanges.js";
import { listBindings } from "./tools/list-bindings.js";
import { publishMessage } from "./tools/publish-message.js";
import { purgeQueue } from "./tools/purge-queue.js";
import { createQueue } from "./tools/create-queue.js";
import { createBinding } from "./tools/create-binding.js";
import { createExchange } from "./tools/create-exchange.js";
import { deleteQueue } from "./tools/delete-queue.js";
import { deleteExchange } from "./tools/delete-exchange.js";
import { deleteBinding } from "./tools/delete-binding.js";
import { getOverview } from "./tools/get-overview.js";
import { checkHealth } from "./tools/check-health.js";
import { getQueue } from "./tools/get-queue.js";
import { listConsumers } from "./tools/list-consumers.js";
import { listConnections } from "./tools/list-connections.js";

export interface ServerConfig {
  schemas: SchemaEntry[];
  rabbitmqUrl: string;
  rabbitmqUser: string;
  rabbitmqPass: string;
  version?: string;
}

const jsonResponse = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

export function createServer(config: ServerConfig): McpServer {
  const validator = new SchemaValidator(config.schemas);
  const client = new RabbitMQClient({
    url: config.rabbitmqUrl,
    username: config.rabbitmqUser,
    password: config.rabbitmqPass,
  });

  const server = new McpServer({
    name: "queue-pilot",
    version: config.version ?? VERSION,
  });

  server.tool("list_schemas", "List all loaded message schemas", {}, async () => {
    const result = listSchemas(validator);
    return jsonResponse(result);
  });

  server.tool(
    "get_schema",
    "Get the full definition of a specific schema",
    { name: z.string().describe("Schema name (e.g. 'order.created')") },
    async ({ name }) => {
      const result = getSchema(validator, name);
      return jsonResponse(result);
    },
  );

  server.tool(
    "validate_message",
    "Validate a JSON message against a schema",
    {
      schemaName: z.string().describe("Schema name to validate against"),
      message: z.string().describe("JSON message payload to validate"),
    },
    async ({ schemaName, message }) => {
      const result = validateMessage(validator, schemaName, message);
      return jsonResponse(result);
    },
  );

  server.tool(
    "list_queues",
    "List all RabbitMQ queues with message counts",
    {
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ vhost }) => {
      const result = await listQueues(client, vhost);
      return jsonResponse(result);
    },
  );

  server.tool(
    "peek_messages",
    "View messages in a queue without consuming them",
    {
      queue: z.string().describe("Queue name"),
      count: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(5)
        .describe("Number of messages to peek (default 5, max 50)"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ queue, count, vhost }) => {
      const result = await peekMessages(client, vhost, queue, count);
      return jsonResponse(result);
    },
  );

  server.tool(
    "inspect_queue",
    "View messages in a queue and validate each against its schema",
    {
      queue: z.string().describe("Queue name"),
      count: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(5)
        .describe("Number of messages to inspect (default 5, max 50)"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ queue, count, vhost }) => {
      const result = await inspectQueue(client, validator, vhost, queue, count);
      return jsonResponse(result);
    },
  );

  server.tool(
    "list_exchanges",
    "List all RabbitMQ exchanges",
    {
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ vhost }) => {
      const result = await listExchanges(client, vhost);
      return jsonResponse(result);
    },
  );

  server.tool(
    "list_bindings",
    "List bindings between exchanges and queues",
    {
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ vhost }) => {
      const result = await listBindings(client, vhost);
      return jsonResponse(result);
    },
  );

  server.tool(
    "publish_message",
    "Publish a message to a RabbitMQ exchange. Optionally validates against a schema before publishing — if validation fails, the message is NOT sent.",
    {
      exchange: z
        .string()
        .describe("Exchange name ('amq.default' for direct-to-queue)"),
      routing_key: z.string().describe("Routing key"),
      payload: z.string().describe("JSON message payload"),
      message_type: z
        .string()
        .optional()
        .describe(
          "Message type (e.g. 'order.created'), used for schema lookup",
        ),
      headers: z
        .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional()
        .describe("Optional message headers"),
      validate: z
        .boolean()
        .default(true)
        .describe("Validate before publishing (default: true)"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ exchange, routing_key, payload, message_type, headers, validate, vhost }) => {
      const result = await publishMessage(client, validator, {
        exchange,
        routing_key,
        payload,
        message_type,
        headers,
        validate,
        vhost,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    "purge_queue",
    "Remove all messages from a RabbitMQ queue. Returns the number of messages purged.",
    {
      queue: z.string().describe("Queue name"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ queue, vhost }) => {
      const result = await purgeQueue(client, vhost, queue);
      return jsonResponse(result);
    },
  );

  server.tool(
    "create_queue",
    "Create a new RabbitMQ queue. Idempotent if settings match; errors if the queue exists with different settings.",
    {
      queue: z.string().describe("Queue name"),
      durable: z
        .boolean()
        .default(false)
        .describe("Survive broker restart (default: false)"),
      auto_delete: z
        .boolean()
        .default(false)
        .describe("Delete when last consumer disconnects (default: false)"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ queue, durable, auto_delete, vhost }) => {
      const result = await createQueue(client, {
        queue,
        durable,
        auto_delete,
        vhost,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    "create_binding",
    "Create a binding from an exchange to a queue with a routing key.",
    {
      exchange: z.string().describe("Source exchange name"),
      queue: z.string().describe("Destination queue name"),
      routing_key: z
        .string()
        .default("")
        .describe("Routing key (default: '')"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ exchange, queue, routing_key, vhost }) => {
      const result = await createBinding(client, {
        exchange,
        queue,
        routing_key,
        vhost,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    "create_exchange",
    "Create a new RabbitMQ exchange. Idempotent if settings match.",
    {
      exchange: z.string().describe("Exchange name"),
      type: z
        .enum(["direct", "fanout", "topic", "headers"])
        .default("direct")
        .describe("Exchange type (default: 'direct')"),
      durable: z
        .boolean()
        .default(false)
        .describe("Survive broker restart (default: false)"),
      auto_delete: z
        .boolean()
        .default(false)
        .describe("Delete when last binding is removed (default: false)"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ exchange, type, durable, auto_delete, vhost }) => {
      const result = await createExchange(client, {
        exchange,
        type,
        durable,
        auto_delete,
        vhost,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    "delete_queue",
    "Delete a RabbitMQ queue.",
    {
      queue: z.string().describe("Queue name"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ queue, vhost }) => {
      const result = await deleteQueue(client, { queue, vhost });
      return jsonResponse(result);
    },
  );

  server.tool(
    "delete_exchange",
    "Delete a RabbitMQ exchange.",
    {
      exchange: z.string().describe("Exchange name"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ exchange, vhost }) => {
      const result = await deleteExchange(client, { exchange, vhost });
      return jsonResponse(result);
    },
  );

  server.tool(
    "delete_binding",
    "Delete a binding between an exchange and a queue. Use list_bindings to find the properties_key.",
    {
      exchange: z.string().describe("Source exchange name"),
      queue: z.string().describe("Destination queue name"),
      properties_key: z
        .string()
        .default("~")
        .describe("Binding properties key from list_bindings (default: '~')"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ exchange, queue, properties_key, vhost }) => {
      const result = await deleteBinding(client, {
        exchange,
        queue,
        properties_key,
        vhost,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    "get_overview",
    "Get RabbitMQ cluster overview: version info, message rates, queue totals, and object counts.",
    {},
    async () => {
      const result = await getOverview(client);
      return jsonResponse(result);
    },
  );

  server.tool(
    "check_health",
    "Check RabbitMQ broker health status. Returns ok or failed with reason.",
    {},
    async () => {
      const result = await checkHealth(client);
      return jsonResponse(result);
    },
  );

  server.tool(
    "get_queue",
    "Get detailed information about a specific RabbitMQ queue.",
    {
      queue: z.string().describe("Queue name"),
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ queue, vhost }) => {
      const result = await getQueue(client, vhost, queue);
      return jsonResponse(result);
    },
  );

  server.tool(
    "list_consumers",
    "List all consumers connected to queues in a vhost.",
    {
      vhost: z
        .string()
        .default("/")
        .describe("RabbitMQ vhost (default: '/')"),
    },
    async ({ vhost }) => {
      const result = await listConsumers(client, vhost);
      return jsonResponse(result);
    },
  );

  server.tool(
    "list_connections",
    "List all client connections to the RabbitMQ broker.",
    {},
    async () => {
      const result = await listConnections(client);
      return jsonResponse(result);
    },
  );

  // MCP Resources — expose loaded schemas as readable context
  for (const schema of config.schemas) {
    server.resource(
      schema.name,
      `schema:///${schema.name}`,
      { description: schema.description, mimeType: "application/schema+json" },
      async () => ({
        contents: [
          {
            uri: `schema:///${schema.name}`,
            text: JSON.stringify(schema.schema, null, 2),
            mimeType: "application/schema+json",
          },
        ],
      }),
    );
  }

  // MCP Prompts — predefined workflows
  server.prompt(
    "debug-flow",
    "Trace bindings from exchange to queue, peek messages, validate against schemas",
    {
      exchange: z.string().describe("Source exchange name"),
      queue: z.string().describe("Destination queue name"),
    },
    async ({ exchange, queue }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Debug the message flow from exchange "${exchange}" to queue "${queue}":`,
              "",
              "1. Use list_bindings to find routing configuration between the exchange and queue",
              "2. Use peek_messages to view messages currently in the queue",
              "3. Use validate_message to check each message against its schema",
              "",
              "Report any misrouted messages, schema violations, or missing bindings.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt(
    "health-report",
    "Check broker health, list queues, flag queues with backed-up messages",
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Generate a RabbitMQ health report:",
              "",
              "1. Use check_health to verify broker status",
              "2. Use get_overview for cluster-wide statistics",
              "3. Use list_queues to enumerate all queues",
              "4. Flag any queues where messages_ready > 0 or messages_unacknowledged > 0",
              "",
              "Provide a summary of the broker's health and any queues that need attention.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt(
    "schema-compliance",
    "Peek messages in queues and validate each against its schema",
    {
      queue: z
        .string()
        .optional()
        .describe("Specific queue to check (omit for all queues)"),
    },
    async ({ queue }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: queue
              ? [
                  `Check schema compliance for queue "${queue}":`,
                  "",
                  "1. Use peek_messages to view messages in the queue",
                  "2. For each message with a type property, use validate_message to check it",
                  "3. Report which messages pass and which fail validation",
                ].join("\n")
              : [
                  "Check schema compliance across all queues:",
                  "",
                  "1. Use list_queues to find all queues with messages",
                  "2. For each queue, use peek_messages to view its messages",
                  "3. For each message with a type property, use validate_message to check it",
                  "4. Report compliance status per queue",
                ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
