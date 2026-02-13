#!/usr/bin/env node

import { resolve } from "path";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSchemas } from "./schemas/loader.js";
import { createServer } from "./server.js";
import { VERSION } from "./version.js";

export interface CliArgs {
  schemas: string;
  rabbitmqUrl: string;
  rabbitmqUser: string;
  rabbitmqPass: string;
}

const HELP_TEXT = `Queue Pilot - MCP server for RabbitMQ message inspection and schema validation

Usage: queue-pilot --schemas <directory> [options]

Options:
  --schemas <dir>        Directory containing JSON Schema files (required)
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
    process.stderr.write("Error: --schemas <directory> is required\n");
    process.exit(1);
  }

  return {
    schemas: args.schemas,
    rabbitmqUrl: args.rabbitmqUrl ?? process.env.RABBITMQ_URL ?? "http://localhost:15672",
    rabbitmqUser: args.rabbitmqUser ?? process.env.RABBITMQ_USER ?? "guest",
    rabbitmqPass: args.rabbitmqPass ?? process.env.RABBITMQ_PASS ?? "guest",
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  process.stderr.write(`Queue Pilot starting...\n`);
  process.stderr.write(`Loading schemas from: ${args.schemas}\n`);

  const schemas = await loadSchemas(args.schemas);
  process.stderr.write(`Loaded ${schemas.length} schema(s)\n`);

  const server = createServer({
    schemas,
    rabbitmqUrl: args.rabbitmqUrl,
    rabbitmqUser: args.rabbitmqUser,
    rabbitmqPass: args.rabbitmqPass,
    version: VERSION,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`Queue Pilot running (stdio transport)\n`);
}

const isEntryPoint =
  resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url));

if (isEntryPoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`Fatal error: ${message}\n`);
    process.exit(1);
  });
}
