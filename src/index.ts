#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSchemas } from "./schemas/loader.js";
import { createServer } from "./server.js";

interface CliArgs {
  schemas: string;
  rabbitmqUrl: string;
  rabbitmqUser: string;
  rabbitmqPass: string;
}

function parseArgs(argv: string[]): CliArgs {
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

main().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
