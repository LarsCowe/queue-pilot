# Contributing to Queue Pilot

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Dev Setup

1. **Node.js 22 LTS** — [Download](https://nodejs.org/)
2. **Clone and install:**
   ```bash
   git clone https://github.com/LarsCowe/queue-pilot.git
   cd queue-pilot
   npm install
   ```
3. **RabbitMQ** (for integration tests):
   ```bash
   docker compose up -d --wait
   ```

## Running Tests

```bash
npm test                    # Unit tests
npm run test:coverage       # Coverage report
npm run test:integration    # Integration tests (requires RabbitMQ)
npm run typecheck           # Type check only
npm run build               # Full build
```

## TDD Workflow

Every change follows **RED -> GREEN -> REFACTOR**:

1. **RED** — Write a failing test that captures the expected behavior
2. **GREEN** — Write the minimum code to make it pass
3. **REFACTOR** — Improve the code while keeping tests green

### Test quality rules

- Test behavior, not implementation. Tests should survive refactoring.
- Assert outcomes, not internals. Avoid mocking unless crossing a system boundary (network, DB, filesystem).
- One clear assertion per test. If a test name needs "and", split it.
- Use realistic test data. Avoid `"foo"`, `"bar"`, `"test123"`.

## Code Conventions

- **ESM modules** — All imports/exports use ES module syntax
- **Strict TypeScript** — `strict: true` with `noUncheckedIndexedAccess`
- **Named exports** — No default exports
- **Colocated tests** — `foo.ts` + `foo.test.ts` in the same directory
- **`const` by default** — Use `let` only for mutation, never `var`
- **Native `fetch`** — No HTTP client libraries (no axios)
- **Logs to stderr** — stdout is reserved for MCP JSON-RPC transport

## Adding a New MCP Tool

1. **Create the tool file** in `src/tools/` (e.g., `src/tools/my-tool.ts`)
2. **Write tests first** — `src/tools/my-tool.test.ts`
3. **Implement the tool** — Export a function matching the `ToolDefinition` interface
4. **Register the tool** — Add it to `src/broker/registry.ts`
5. **Update README** — Add to the appropriate tools table

### Tool structure

```typescript
import { z } from "zod";
import { ToolDefinition } from "../broker/tool-definition.js";

export const myTool: ToolDefinition = {
  name: "my_tool",
  description: "What it does",
  inputSchema: { /* Zod schema */ },
  handler: async (params, adapter) => {
    // Implementation
  },
};
```

## Adding a New Broker

Queue Pilot uses the **BrokerAdapter** pattern to support multiple message brokers:

1. **Implement `BrokerAdapter`** — Create `src/brokers/<broker>/adapter.ts` implementing the interface from `src/broker/types.ts`
2. **Implement capability interfaces** — Add any applicable capabilities (`Publishable`, `Purgeable`, etc.)
3. **Add broker-specific tools** — Create `src/brokers/<broker>/tools.ts` for tools unique to your broker
4. **Update the factory** — Register the new broker type in `src/broker/factory.ts`
5. **Add CLI args** — Handle broker-specific flags in `src/index.ts`
6. **Add init support** — Generate MCP client config in the init subcommand

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new tool for X
fix: handle edge case in Y
refactor: extract Z into shared module
test: add coverage for W
docs: update README with new tool
chore: update dependencies
```

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Follow the TDD workflow for all changes
3. Ensure all checks pass:
   ```bash
   npm test
   npm run typecheck
   npm run build
   ```
4. Fill out the PR template — describe what changed and which broker(s) are affected
5. Keep PRs focused — one feature or fix per PR

## Questions?

Open a [discussion](https://github.com/LarsCowe/queue-pilot/issues) or reach out via an issue.
