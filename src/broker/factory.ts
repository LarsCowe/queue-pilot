import { RabbitMQClient } from "../rabbitmq/client.js";
import { RabbitMQAdapter } from "../brokers/rabbitmq/adapter.js";
import { createRabbitMQTools } from "../brokers/rabbitmq/tools.js";
import type { BrokerAdapter } from "./types.js";
import type { ToolDefinition } from "./tool-definition.js";

export interface RabbitMQBrokerConfig {
  broker: "rabbitmq";
  url: string;
  username: string;
  password: string;
}

export type BrokerConfig = RabbitMQBrokerConfig;

export interface AdapterResult {
  adapter: BrokerAdapter;
  tools: ToolDefinition[];
}

export function createAdapter(config: BrokerConfig): AdapterResult {
  switch (config.broker) {
    case "rabbitmq": {
      const client = new RabbitMQClient({
        url: config.url,
        username: config.username,
        password: config.password,
      });
      const adapter = new RabbitMQAdapter(client);
      const tools = createRabbitMQTools(adapter);
      return { adapter, tools };
    }
    default: {
      throw new Error(`Unsupported broker: ${(config as { broker: string }).broker}`);
    }
  }
}
