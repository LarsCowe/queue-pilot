#!/usr/bin/env node

import { resolve } from "path";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSchemas } from "./schemas/loader.js";
import { createAdapter } from "./broker/factory.js";
import type { BrokerConfig } from "./broker/factory.js";
import { createServer } from "./server.js";
import { handleInit } from "./init.js";
import {
  checkNodeVersion,
  checkSchemaCount,
  checkBrokerConnectivity,
} from "./startup.js";
import { VERSION } from "./version.js";

export interface CliArgs {
  schemas: string;
  broker: string;
  rabbitmqUrl: string;
  rabbitmqUser: string;
  rabbitmqPass: string;
  kafkaBrokers: string;
  kafkaClientId: string;
  kafkaSaslMechanism: string;
  kafkaSaslUsername: string;
  kafkaSaslPassword: string;
}

const HELP_TEXT = `Queue Pilot - MCP server for message queue inspection and schema validation

Usage: queue-pilot --schemas <directory> [options]
       queue-pilot init --schemas <directory> [--client <name>]

Commands:
  init                          Generate MCP client configuration (run 'queue-pilot init --help' for details)

Options:
  --schemas <dir>               Directory containing JSON Schema files (required)
  --broker <type>               Broker type: rabbitmq, kafka (default: rabbitmq)
  --help                        Show this help message
  --version                     Show version number

RabbitMQ options:
  --rabbitmq-url <url>          RabbitMQ Management API URL (default: http://localhost:15672)
  --rabbitmq-user <user>        RabbitMQ username (default: guest)
  --rabbitmq-pass <pass>        RabbitMQ password (default: guest)

Kafka options:
  --kafka-brokers <list>        Comma-separated broker addresses (default: localhost:9092)
  --kafka-client-id <id>        Kafka client ID (default: queue-pilot)
  --kafka-sasl-mechanism <mech> SASL mechanism: plain, scram-sha-256, scram-sha-512
  --kafka-sasl-username <user>  SASL username
  --kafka-sasl-password <pass>  SASL password

Environment variables (used as fallback when CLI args are not provided):
  RABBITMQ_URL                  RabbitMQ Management API URL
  RABBITMQ_USER                 RabbitMQ username
  RABBITMQ_PASS                 RabbitMQ password
  KAFKA_BROKERS                 Comma-separated Kafka broker addresses
  KAFKA_CLIENT_ID               Kafka client ID
  KAFKA_SASL_MECHANISM          SASL mechanism
  KAFKA_SASL_USERNAME           SASL username
  KAFKA_SASL_PASSWORD           SASL password
`;

export function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--help")) {
    process.stderr.write(HELP_TEXT);
    process.exit(0);
  }

  if (argv.includes("--version")) {
    process.stderr.write(`${VERSION}\n`);
    process.exit(0);
  }

  const args: Partial<CliArgs> = {};

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--schemas": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --schemas requires a value\n");
          process.exit(1);
        }
        args.schemas = value;
        break;
      }
      case "--broker": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --broker requires a value\n");
          process.exit(1);
        }
        args.broker = value;
        break;
      }
      case "--rabbitmq-url": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --rabbitmq-url requires a value\n");
          process.exit(1);
        }
        args.rabbitmqUrl = value;
        break;
      }
      case "--rabbitmq-user": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --rabbitmq-user requires a value\n");
          process.exit(1);
        }
        args.rabbitmqUser = value;
        break;
      }
      case "--rabbitmq-pass": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --rabbitmq-pass requires a value\n");
          process.exit(1);
        }
        args.rabbitmqPass = value;
        break;
      }
      case "--kafka-brokers": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --kafka-brokers requires a value\n");
          process.exit(1);
        }
        args.kafkaBrokers = value;
        break;
      }
      case "--kafka-client-id": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --kafka-client-id requires a value\n");
          process.exit(1);
        }
        args.kafkaClientId = value;
        break;
      }
      case "--kafka-sasl-mechanism": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --kafka-sasl-mechanism requires a value\n");
          process.exit(1);
        }
        args.kafkaSaslMechanism = value;
        break;
      }
      case "--kafka-sasl-username": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --kafka-sasl-username requires a value\n");
          process.exit(1);
        }
        args.kafkaSaslUsername = value;
        break;
      }
      case "--kafka-sasl-password": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --kafka-sasl-password requires a value\n");
          process.exit(1);
        }
        args.kafkaSaslPassword = value;
        break;
      }
      default: {
        const arg = argv[i];
        if (arg?.startsWith("--")) {
          process.stderr.write(`Warning: unknown argument '${arg}'\n`);
        }
        break;
      }
    }
  }

  if (!args.schemas) {
    process.stderr.write("Error: --schemas <directory> is required\n");
    process.exit(1);
  }

  return {
    schemas: args.schemas,
    broker: args.broker ?? "rabbitmq",
    rabbitmqUrl: args.rabbitmqUrl ?? process.env.RABBITMQ_URL ?? "http://localhost:15672",
    rabbitmqUser: args.rabbitmqUser ?? process.env.RABBITMQ_USER ?? "guest",
    rabbitmqPass: args.rabbitmqPass ?? process.env.RABBITMQ_PASS ?? "guest",
    kafkaBrokers: args.kafkaBrokers ?? process.env.KAFKA_BROKERS ?? "localhost:9092",
    kafkaClientId: args.kafkaClientId ?? process.env.KAFKA_CLIENT_ID ?? "queue-pilot",
    kafkaSaslMechanism: args.kafkaSaslMechanism ?? process.env.KAFKA_SASL_MECHANISM ?? "",
    kafkaSaslUsername: args.kafkaSaslUsername ?? process.env.KAFKA_SASL_USERNAME ?? "",
    kafkaSaslPassword: args.kafkaSaslPassword ?? process.env.KAFKA_SASL_PASSWORD ?? "",
  };
}

export function buildBrokerConfig(args: CliArgs): BrokerConfig {
  if (args.broker === "kafka") {
    const config: BrokerConfig = {
      broker: "kafka",
      brokers: args.kafkaBrokers.split(",").map((b) => b.trim()),
      clientId: args.kafkaClientId,
    };
    if (args.kafkaSaslMechanism) {
      config.sasl = {
        mechanism: args.kafkaSaslMechanism as "plain" | "scram-sha-256" | "scram-sha-512",
        username: args.kafkaSaslUsername,
        password: args.kafkaSaslPassword,
      };
    }
    return config;
  }

  return {
    broker: "rabbitmq",
    url: args.rabbitmqUrl,
    username: args.rabbitmqUser,
    password: args.rabbitmqPass,
  };
}

async function main(): Promise<void> {
  const nodeCheck = checkNodeVersion(process.version);
  if (!nodeCheck.ok) {
    process.stderr.write(
      `Error: Node.js >= ${nodeCheck.required} required (current: ${nodeCheck.current})\n`,
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  process.stderr.write(`Queue Pilot starting...\n`);
  process.stderr.write(`Loading schemas from: ${args.schemas}\n`);

  const schemas = await loadSchemas(args.schemas);
  process.stderr.write(`Loaded ${schemas.length} schema(s)\n`);

  const schemaCheck = checkSchemaCount(schemas.length);
  if (schemaCheck.warning) {
    process.stderr.write(`Warning: ${schemaCheck.warning}\n`);
  }

  const brokerConfig = buildBrokerConfig(args);
  const { adapter, tools } = await createAdapter(brokerConfig);

  const brokerCheck = await checkBrokerConnectivity(() =>
    adapter.checkHealth(),
  );
  if (brokerCheck.reachable) {
    process.stderr.write(`Broker: ${brokerCheck.message}\n`);
  } else {
    process.stderr.write(
      `Warning: Broker not reachable (${brokerCheck.message}) — server will start but queue tools will fail\n`,
    );
  }

  const server = createServer({
    schemas,
    adapter,
    brokerTools: tools,
    version: VERSION,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (): Promise<void> => {
    process.stderr.write("Queue Pilot shutting down...\n");
    try { await server.close(); } catch { /* best-effort */ }
    try { await adapter.disconnect(); } catch { /* best-effort */ }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.stderr.write(`Queue Pilot running (stdio transport)\n`);
}

const isEntryPoint =
  resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url));

if (isEntryPoint) {
  if (process.argv[2] === "init") {
    handleInit(process.argv.slice(3));
  } else {
    main().catch((error: unknown) => {
      const message =
        error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`Fatal error: ${message}\n`);
      process.exit(1);
    });
  }
}
