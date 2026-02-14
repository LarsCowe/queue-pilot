import { z } from "zod";
import type { ToolDefinition } from "../../broker/tool-definition.js";
import type { RabbitMQAdapter } from "./adapter.js";

export function createRabbitMQTools(adapter: RabbitMQAdapter): ToolDefinition[] {
  const getClient = () => adapter.getClient();

  return [
    {
      name: "list_exchanges",
      description: "List all exchanges in a RabbitMQ vhost",
      parameters: {
        vhost: z.string().default("/").describe("RabbitMQ vhost (default: /)"),
      },
      handler: async (args: Record<string, unknown>) => {
        const vhost = (args.vhost as string | undefined) ?? "/";
        const exchanges = await getClient().listExchanges(vhost);
        return {
          exchanges: exchanges.map((e) => ({
            name: e.name,
            type: e.type,
            durable: e.durable,
          })),
        };
      },
    },
    {
      name: "create_exchange",
      description: "Create an exchange in RabbitMQ",
      parameters: {
        exchange: z.string().describe("Exchange name"),
        type: z
          .enum(["direct", "fanout", "topic", "headers"])
          .default("direct")
          .describe("Exchange type (default: direct)"),
        durable: z.boolean().default(false).describe("Survive broker restart (default: false)"),
        auto_delete: z
          .boolean()
          .default(false)
          .describe("Delete when last queue unbinds (default: false)"),
        vhost: z.string().default("/").describe("RabbitMQ vhost (default: /)"),
      },
      handler: async (args: Record<string, unknown>) => {
        const exchange = args.exchange as string;
        const type = (args.type as string | undefined) ?? "direct";
        const durable = (args.durable as boolean | undefined) ?? false;
        const auto_delete = (args.auto_delete as boolean | undefined) ?? false;
        const vhost = (args.vhost as string | undefined) ?? "/";

        await getClient().createExchange(vhost, exchange, { type, durable, auto_delete });

        return { exchange, type, durable, auto_delete, vhost };
      },
    },
    {
      name: "delete_exchange",
      description: "Delete an exchange from RabbitMQ",
      parameters: {
        exchange: z.string().describe("Exchange name"),
        vhost: z.string().default("/").describe("RabbitMQ vhost (default: /)"),
      },
      handler: async (args: Record<string, unknown>) => {
        const exchange = args.exchange as string;
        const vhost = (args.vhost as string | undefined) ?? "/";

        await getClient().deleteExchange(vhost, exchange);

        return { exchange, vhost, deleted: true };
      },
    },
    {
      name: "list_bindings",
      description: "List all bindings in a RabbitMQ vhost",
      parameters: {
        vhost: z.string().default("/").describe("RabbitMQ vhost (default: /)"),
      },
      handler: async (args: Record<string, unknown>) => {
        const vhost = (args.vhost as string | undefined) ?? "/";
        const bindings = await getClient().listBindings(vhost);
        return {
          bindings: bindings.map((b) => ({
            source: b.source,
            destination: b.destination,
            destination_type: b.destination_type,
            routing_key: b.routing_key,
            properties_key: b.properties_key,
          })),
        };
      },
    },
    {
      name: "create_binding",
      description: "Create a binding between an exchange and a queue in RabbitMQ",
      parameters: {
        exchange: z.string().describe("Source exchange name"),
        queue: z.string().describe("Destination queue name"),
        routing_key: z.string().default("").describe("Routing key (default: empty)"),
        vhost: z.string().default("/").describe("RabbitMQ vhost (default: /)"),
      },
      handler: async (args: Record<string, unknown>) => {
        const exchange = args.exchange as string;
        const queue = args.queue as string;
        const routing_key = (args.routing_key as string | undefined) ?? "";
        const vhost = (args.vhost as string | undefined) ?? "/";

        await getClient().createBinding(vhost, exchange, queue, routing_key);

        return { exchange, queue, routing_key, vhost };
      },
    },
    {
      name: "delete_binding",
      description: "Delete a binding between an exchange and a queue in RabbitMQ",
      parameters: {
        exchange: z.string().describe("Source exchange name"),
        queue: z.string().describe("Destination queue name"),
        properties_key: z
          .string()
          .default("~")
          .describe("Binding properties key (default: ~)"),
        vhost: z.string().default("/").describe("RabbitMQ vhost (default: /)"),
      },
      handler: async (args: Record<string, unknown>) => {
        const exchange = args.exchange as string;
        const queue = args.queue as string;
        const properties_key = (args.properties_key as string | undefined) ?? "~";
        const vhost = (args.vhost as string | undefined) ?? "/";

        await getClient().deleteBinding(vhost, exchange, queue, properties_key);

        return { exchange, queue, properties_key, vhost, deleted: true };
      },
    },
  ];
}
