import path from "path";

export type ClientFormat =
  | "generic"
  | "claude-code"
  | "claude-desktop"
  | "cursor"
  | "vscode"
  | "windsurf";

const SUPPORTED_CLIENTS: ClientFormat[] = [
  "generic",
  "claude-code",
  "claude-desktop",
  "cursor",
  "vscode",
  "windsurf",
];

export interface InitArgs {
  schemas: string;
  client: ClientFormat;
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

export interface McpConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

const INIT_HELP_TEXT = `queue-pilot init — Generate MCP client configuration

Usage: queue-pilot init --schemas <directory> [options]

Options:
  --schemas <dir>               Directory containing JSON Schema files (required)
  --client <name>               MCP client format (default: generic)
                                Supported: ${SUPPORTED_CLIENTS.join(", ")}
  --broker <type>               Broker type: rabbitmq, kafka (default: rabbitmq)
  --help                        Show this help message

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

export function parseInitArgs(argv: string[]): InitArgs {
  if (argv.includes("--help")) {
    process.stderr.write(INIT_HELP_TEXT);
    process.exit(0);
  }

  const args: Partial<InitArgs> = {};

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--schemas": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --schemas requires a value\n");
          process.exit(1);
        }
        args.schemas = path.isAbsolute(value)
          ? value
          : path.resolve(process.cwd(), value);
        break;
      }
      case "--client": {
        const value = argv[++i];
        if (!value || value.startsWith("--")) {
          process.stderr.write("Error: --client requires a value\n");
          process.exit(1);
        }
        if (!SUPPORTED_CLIENTS.includes(value as ClientFormat)) {
          process.stderr.write(
            `Error: unsupported client '${value}'. Supported: ${SUPPORTED_CLIENTS.join(", ")}\n`,
          );
          process.exit(1);
        }
        args.client = value as ClientFormat;
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
    }
  }

  if (!args.schemas) {
    process.stderr.write(
      "Error: --schemas <directory> is required\n\nRun 'queue-pilot init --help' for usage information.\n",
    );
    process.exit(1);
  }

  return {
    schemas: args.schemas,
    client: args.client ?? "generic",
    broker: args.broker ?? "rabbitmq",
    rabbitmqUrl:
      args.rabbitmqUrl ??
      process.env.RABBITMQ_URL ??
      "http://localhost:15672",
    rabbitmqUser:
      args.rabbitmqUser ?? process.env.RABBITMQ_USER ?? "guest",
    rabbitmqPass:
      args.rabbitmqPass ?? process.env.RABBITMQ_PASS ?? "guest",
    kafkaBrokers:
      args.kafkaBrokers ?? process.env.KAFKA_BROKERS ?? "localhost:9092",
    kafkaClientId:
      args.kafkaClientId ?? process.env.KAFKA_CLIENT_ID ?? "queue-pilot",
    kafkaSaslMechanism:
      args.kafkaSaslMechanism ?? process.env.KAFKA_SASL_MECHANISM ?? "",
    kafkaSaslUsername:
      args.kafkaSaslUsername ?? process.env.KAFKA_SASL_USERNAME ?? "",
    kafkaSaslPassword:
      args.kafkaSaslPassword ?? process.env.KAFKA_SASL_PASSWORD ?? "",
  };
}

export function buildConfig(args: InitArgs): McpConfig {
  const config: McpConfig = {
    command: "npx",
    args: ["-y", "queue-pilot", "--schemas", args.schemas],
  };

  if (args.broker === "kafka") {
    config.args.push("--broker", "kafka");
  }

  const env: Record<string, string> = {};

  if (args.broker === "kafka") {
    if (args.kafkaBrokers !== "localhost:9092") {
      env.KAFKA_BROKERS = args.kafkaBrokers;
    }
    if (args.kafkaClientId !== "queue-pilot") {
      env.KAFKA_CLIENT_ID = args.kafkaClientId;
    }
    if (args.kafkaSaslMechanism) {
      env.KAFKA_SASL_MECHANISM = args.kafkaSaslMechanism;
    }
    if (args.kafkaSaslUsername) {
      env.KAFKA_SASL_USERNAME = args.kafkaSaslUsername;
    }
    if (args.kafkaSaslPassword) {
      env.KAFKA_SASL_PASSWORD = args.kafkaSaslPassword;
    }
  } else {
    if (args.rabbitmqUrl !== "http://localhost:15672") {
      env.RABBITMQ_URL = args.rabbitmqUrl;
    }
    if (args.rabbitmqUser !== "guest") {
      env.RABBITMQ_USER = args.rabbitmqUser;
    }
    if (args.rabbitmqPass !== "guest") {
      env.RABBITMQ_PASS = args.rabbitmqPass;
    }
  }

  if (Object.keys(env).length > 0) {
    config.env = env;
  }

  return config;
}

export function formatConfig(config: McpConfig, client: ClientFormat): string {
  if (client === "claude-code") {
    const parts = ["claude mcp add --transport stdio"];
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        parts.push(`--env ${key}=${value}`);
      }
    }
    parts.push("queue-pilot");
    parts.push("--");
    parts.push(...config.args);
    return parts.join(" ");
  }

  const serverEntry: Record<string, unknown> = {
    command: config.command,
    args: config.args,
  };
  if (config.env) {
    serverEntry.env = config.env;
  }

  if (client === "vscode") {
    return JSON.stringify(
      { servers: { "queue-pilot": serverEntry } },
      null,
      2,
    );
  }

  return JSON.stringify(
    { mcpServers: { "queue-pilot": serverEntry } },
    null,
    2,
  );
}

export function getConfigHint(client: ClientFormat): string {
  switch (client) {
    case "claude-code":
      return "Run this command to register the MCP server:";
    case "vscode":
      return "Add this to .vscode/mcp.json:";
    case "cursor":
      return "Add this to .cursor/mcp.json:";
    case "claude-desktop":
      return "Add this to claude_desktop_config.json:";
    case "windsurf":
      return "Add this to ~/.codeium/windsurf/mcp_config.json:";
    case "generic":
      return "Add this to your MCP client configuration:";
  }
}

export function handleInit(argv: string[]): void {
  const args = parseInitArgs(argv);
  const config = buildConfig(args);
  const output = formatConfig(config, args.client);
  const hint = getConfigHint(args.client);

  process.stderr.write(`${hint}\n\n`);
  process.stdout.write(`${output}\n`);
}
