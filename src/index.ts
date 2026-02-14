#!/usr/bin/env node

import { resolve } from "path";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSchemas } from "./schemas/loader.js";
import { createAdapter } from "./broker/factory.js";
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
}

const HELP_TEXT = `Queue Pilot - MCP server for message queue inspection and schema validation

Usage: queue-pilot --schemas <directory> [options]
       queue-pilot init --schemas <directory> [--client <name>]

Commands:
  init                   Generate MCP client configuration (run 'queue-pilot init --help' for details)

Options:
  --schemas <dir>        Directory containing JSON Schema files (required)
  --broker <type>        Broker type (default: rabbitmq)
  --rabbitmq-url <url>   RabbitMQ Management API URL (default: http://localhost:15672)
  --rabbitmq-user <user> RabbitMQ username (default: guest)
  --rabbitmq-pass <pass> RabbitMQ password (default: guest)
  --help                 Show this help message
  --version              Show version number

Environment variables (used as fallback when CLI args are not provided):
  RABBITMQ_URL              RabbitMQ Management API URL
  RABBITMQ_USER             RabbitMQ username
  RABBITMQ_PASS             RabbitMQ password
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

  const { adapter, tools } = createAdapter({
    broker: args.broker as "rabbitmq",
    url: args.rabbitmqUrl,
    username: args.rabbitmqUser,
    password: args.rabbitmqPass,
  });

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
