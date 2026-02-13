import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RabbitMQClient } from "./rabbitmq/client.js";
import { SchemaValidator } from "./schemas/validator.js";
import type { SchemaEntry } from "./schemas/types.js";
import { listSchemas } from "./tools/list-schemas.js";
import { getSchema } from "./tools/get-schema.js";
import { validateMessage } from "./tools/validate-message.js";
import { listQueues } from "./tools/list-queues.js";
import { peekMessages } from "./tools/peek-messages.js";
import { inspectQueue } from "./tools/inspect-queue.js";
import { listExchanges } from "./tools/list-exchanges.js";
import { listBindings } from "./tools/list-bindings.js";

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
    version: "0.1.0",
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

  return server;
}
