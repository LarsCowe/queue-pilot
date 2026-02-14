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

export interface KafkaBrokerConfig {
  broker: "kafka";
  brokers: string[];
  clientId?: string;
  sasl?: {
    mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
    username: string;
    password: string;
  };
  ssl?: boolean;
}

export type BrokerConfig = RabbitMQBrokerConfig | KafkaBrokerConfig;

export interface AdapterResult {
  adapter: BrokerAdapter;
  tools: ToolDefinition[];
}

export async function createAdapter(config: BrokerConfig): Promise<AdapterResult> {
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
    case "kafka": {
      const { KafkaClient } = await import("../kafka/client.js");
      const { KafkaAdapter } = await import("../brokers/kafka/adapter.js");
      const { createKafkaTools } = await import("../brokers/kafka/tools.js");

      const client = new KafkaClient({
        brokers: config.brokers,
        clientId: config.clientId,
        sasl: config.sasl,
        ssl: config.ssl,
      });
      const adapter = new KafkaAdapter(client);
      const tools = createKafkaTools(adapter);
      return { adapter, tools };
    }
    default: {
      throw new Error(`Unsupported broker: ${(config as { broker: string }).broker}`);
    }
  }
}
