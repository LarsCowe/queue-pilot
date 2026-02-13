#!/usr/bin/env node

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSchemas } from "./schemas/loader.js";
import { createServer } from "./server.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

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
`;

export function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--help")) {
    process.stderr.write(HELP_TEXT);
    process.exit(0);
  }

  if (argv.includes("--version")) {
    process.stderr.write(`${pkg.version}\n`);
    process.exit(0);
  }

  const args: Partial<CliArgs> = {};

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--schemas":
        args.schemas = argv[++i];
        break;
      case "--rabbitmq-url":
        args.rabbitmqUrl = argv[++i];
        break;
      case "--rabbitmq-user":
        args.rabbitmqUser = argv[++i];
        break;
      case "--rabbitmq-pass":
        args.rabbitmqPass = argv[++i];
        break;
    }
  }

  if (!args.schemas) {
    process.stderr.write("Error: --schemas <directory> is required\n");
    process.exit(1);
  }

  return {
    schemas: args.schemas,
    rabbitmqUrl: args.rabbitmqUrl ?? "http://localhost:15672",
    rabbitmqUser: args.rabbitmqUser ?? "guest",
    rabbitmqPass: args.rabbitmqPass ?? "guest",
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
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`Queue Pilot running (stdio transport)\n`);
}

const isEntryPoint =
  process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((error: unknown) => {
    process.stderr.write(`Fatal error: ${error}\n`);
    process.exit(1);
  });
}
