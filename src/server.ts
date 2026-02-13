import { createRequire } from "module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RabbitMQClient } from "./rabbitmq/client.js";
import { SchemaValidator } from "./schemas/validator.js";
import type { SchemaEntry } from "./schemas/types.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
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

export interface ServerConfig {
  schemas: SchemaEntry[];
  rabbitmqUrl: string;
  rabbitmqUser: string;
  rabbitmqPass: string;
}

export function createServer(config: ServerConfig): McpServer {
  const validator = new SchemaValidator(config.schemas);
  const client = new RabbitMQClient({
    url: config.rabbitmqUrl,
    username: config.rabbitmqUser,
    password: config.rabbitmqPass,
  });

  const server = new McpServer({
    name: "queue-pilot",
    version: pkg.version,
  });

  server.tool("list_schemas", "List all loaded message schemas", {}, async () => {
    const result = listSchemas(validator);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool(
    "get_schema",
    "Get the full definition of a specific schema",
    { name: z.string().describe("Schema name (e.g. 'order.created')") },
    async ({ name }) => {
      const result = getSchema(validator, name);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
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
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
        .record(z.unknown())
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  return server;
}
