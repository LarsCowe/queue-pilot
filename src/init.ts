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
  rabbitmqUrl: string;
  rabbitmqUser: string;
  rabbitmqPass: string;
}

export interface McpConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

const INIT_HELP_TEXT = `queue-pilot init — Generate MCP client configuration

Usage: queue-pilot init --schemas <directory> [options]

Options:
  --schemas <dir>        Directory containing JSON Schema files (required)
  --client <name>        MCP client format (default: generic)
                         Supported: ${SUPPORTED_CLIENTS.join(", ")}
  --rabbitmq-url <url>   RabbitMQ Management API URL (default: http://localhost:15672)
  --rabbitmq-user <user> RabbitMQ username (default: guest)
  --rabbitmq-pass <pass> RabbitMQ password (default: guest)
  --help                 Show this help message

Environment variables (used as fallback when CLI args are not provided):
  RABBITMQ_URL              RabbitMQ Management API URL
  RABBITMQ_USER             RabbitMQ username
  RABBITMQ_PASS             RabbitMQ password
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
    rabbitmqUrl:
      args.rabbitmqUrl ??
      process.env.RABBITMQ_URL ??
      "http://localhost:15672",
    rabbitmqUser:
      args.rabbitmqUser ?? process.env.RABBITMQ_USER ?? "guest",
    rabbitmqPass:
      args.rabbitmqPass ?? process.env.RABBITMQ_PASS ?? "guest",
  };
}

export function buildConfig(args: InitArgs): McpConfig {
  const config: McpConfig = {
    command: "npx",
    args: ["-y", "queue-pilot", "--schemas", args.schemas],
  };

  const env: Record<string, string> = {};
  if (args.rabbitmqUrl !== "http://localhost:15672") {
    env.RABBITMQ_URL = args.rabbitmqUrl;
  }
  if (args.rabbitmqUser !== "guest") {
    env.RABBITMQ_USER = args.rabbitmqUser;
  }
  if (args.rabbitmqPass !== "guest") {
    env.RABBITMQ_PASS = args.rabbitmqPass;
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
