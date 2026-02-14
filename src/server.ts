import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SchemaValidator } from "./schemas/validator.js";
import type { SchemaEntry } from "./schemas/types.js";
import type { BrokerAdapter } from "./broker/types.js";
import type { ToolDefinition } from "./broker/tool-definition.js";
import {
  registerSchemaTools,
  registerUniversalTools,
  registerCapabilityTools,
  registerBrokerTools,
} from "./broker/registry.js";
import { VERSION } from "./version.js";

export interface ServerConfig {
  schemas: SchemaEntry[];
  adapter: BrokerAdapter;
  brokerTools?: ToolDefinition[];
  version?: string;
}

export function createServer(config: ServerConfig): McpServer {
  const validator = new SchemaValidator(config.schemas);

  const server = new McpServer({
    name: "queue-pilot",
    version: config.version ?? VERSION,
  });

  registerSchemaTools(server, validator);
  registerUniversalTools(server, config.adapter, validator);
  registerCapabilityTools(server, config.adapter);

  if (config.brokerTools) {
    registerBrokerTools(server, config.brokerTools);
  }

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
              "Generate a broker health report:",
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
