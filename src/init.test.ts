import path from "path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseInitArgs,
  buildConfig,
  formatConfig,
  getConfigHint,
  handleInit,
} from "./init.js";

describe("parseInitArgs", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(
        (() => {
          throw new Error("process.exit");
        }) as unknown as (code?: number) => never,
      );
    savedEnv.RABBITMQ_URL = process.env.RABBITMQ_URL;
    savedEnv.RABBITMQ_USER = process.env.RABBITMQ_USER;
    savedEnv.RABBITMQ_PASS = process.env.RABBITMQ_PASS;
    delete process.env.RABBITMQ_URL;
    delete process.env.RABBITMQ_USER;
    delete process.env.RABBITMQ_PASS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(savedEnv)) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("parses --schemas with default values", () => {
    vi.restoreAllMocks();
    const absPath = path.resolve("/tmp/schemas");
    const result = parseInitArgs(["--schemas", absPath]);
    expect(result.schemas).toBe(absPath);
    expect(result.client).toBe("generic");
    expect(result.broker).toBe("rabbitmq");
    expect(result.rabbitmqUrl).toBe("http://localhost:15672");
    expect(result.rabbitmqUser).toBe("guest");
    expect(result.rabbitmqPass).toBe("guest");
  });

  it("resolves relative --schemas path to absolute", () => {
    vi.restoreAllMocks();
    const result = parseInitArgs(["--schemas", "./my-schemas"]);
    expect(path.isAbsolute(result.schemas)).toBe(true);
    expect(result.schemas).toBe(path.resolve(process.cwd(), "./my-schemas"));
  });

  it("keeps absolute --schemas path unchanged", () => {
    vi.restoreAllMocks();
    const absPath = path.resolve("/tmp/schemas");
    const result = parseInitArgs(["--schemas", absPath]);
    expect(result.schemas).toBe(absPath);
  });

  it("parses --client flag", () => {
    vi.restoreAllMocks();
    const absPath = path.resolve("/tmp/schemas");
    const result = parseInitArgs([
      "--schemas",
      absPath,
      "--client",
      "claude-code",
    ]);
    expect(result.client).toBe("claude-code");
  });

  it("exits 1 for unsupported client", () => {
    const absPath = path.resolve("/tmp/schemas");
    expect(() =>
      parseInitArgs(["--schemas", absPath, "--client", "emacs"]),
    ).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --schemas is missing", () => {
    expect(() => parseInitArgs([])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("uses RABBITMQ_URL env var as fallback", () => {
    vi.restoreAllMocks();
    process.env.RABBITMQ_URL = "http://env-rabbit:15672";
    const absPath = path.resolve("/tmp/schemas");
    const result = parseInitArgs(["--schemas", absPath]);
    expect(result.rabbitmqUrl).toBe("http://env-rabbit:15672");
  });

  it("CLI --rabbitmq-url takes priority over env var", () => {
    vi.restoreAllMocks();
    process.env.RABBITMQ_URL = "http://env-rabbit:15672";
    const absPath = path.resolve("/tmp/schemas");
    const result = parseInitArgs([
      "--schemas",
      absPath,
      "--rabbitmq-url",
      "http://cli-rabbit:15672",
    ]);
    expect(result.rabbitmqUrl).toBe("http://cli-rabbit:15672");
  });

  it("parses --broker flag", () => {
    vi.restoreAllMocks();
    const absPath = path.resolve("/tmp/schemas");
    const result = parseInitArgs(["--schemas", absPath, "--broker", "rabbitmq"]);
    expect(result.broker).toBe("rabbitmq");
  });

  it("prints help and exits 0 for --help", () => {
    expect(() => parseInitArgs(["--help"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(0);
    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("--schemas");
    expect(output).toContain("--client");
    expect(output).toContain("--broker");
  });
});

describe("buildConfig", () => {
  it("returns npx command with schema path", () => {
    const config = buildConfig({
      schemas: "/home/user/schemas",
      client: "generic",
      broker: "rabbitmq",
      rabbitmqUrl: "http://localhost:15672",
      rabbitmqUser: "guest",
      rabbitmqPass: "guest",
    });
    expect(config.command).toBe("npx");
    expect(config.args).toContain("-y");
    expect(config.args).toContain("queue-pilot");
    expect(config.args).toContain("--schemas");
    expect(config.args).toContain("/home/user/schemas");
  });

  it("omits env when all values are defaults", () => {
    const config = buildConfig({
      schemas: "/schemas",
      client: "generic",
      broker: "rabbitmq",
      rabbitmqUrl: "http://localhost:15672",
      rabbitmqUser: "guest",
      rabbitmqPass: "guest",
    });
    expect(config.env).toBeUndefined();
  });

  it("includes env entries for non-default RabbitMQ settings", () => {
    const config = buildConfig({
      schemas: "/schemas",
      client: "generic",
      broker: "rabbitmq",
      rabbitmqUrl: "http://production:15672",
      rabbitmqUser: "admin",
      rabbitmqPass: "secret",
    });
    expect(config.env).toBeDefined();
    expect(config.env!.RABBITMQ_URL).toBe("http://production:15672");
    expect(config.env!.RABBITMQ_USER).toBe("admin");
    expect(config.env!.RABBITMQ_PASS).toBe("secret");
  });

  it("only includes non-default env entries", () => {
    const config = buildConfig({
      schemas: "/schemas",
      client: "generic",
      broker: "rabbitmq",
      rabbitmqUrl: "http://localhost:15672",
      rabbitmqUser: "admin",
      rabbitmqPass: "guest",
    });
    expect(config.env).toBeDefined();
    expect(config.env!.RABBITMQ_USER).toBe("admin");
    expect(config.env!.RABBITMQ_URL).toBeUndefined();
    expect(config.env!.RABBITMQ_PASS).toBeUndefined();
  });
});

describe("formatConfig", () => {
  const baseConfig = {
    command: "npx" as const,
    args: ["-y", "queue-pilot", "--schemas", "/home/user/schemas"],
  };

  it("formats generic output as mcpServers JSON", () => {
    const output = formatConfig(baseConfig, "generic");
    const parsed = JSON.parse(output);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers["queue-pilot"].command).toBe("npx");
  });

  it("formats claude-desktop output as mcpServers JSON", () => {
    const output = formatConfig(baseConfig, "claude-desktop");
    const parsed = JSON.parse(output);
    expect(parsed.mcpServers).toBeDefined();
  });

  it("formats cursor output as mcpServers JSON", () => {
    const output = formatConfig(baseConfig, "cursor");
    const parsed = JSON.parse(output);
    expect(parsed.mcpServers).toBeDefined();
  });

  it("formats windsurf output as mcpServers JSON", () => {
    const output = formatConfig(baseConfig, "windsurf");
    const parsed = JSON.parse(output);
    expect(parsed.mcpServers).toBeDefined();
  });

  it("formats claude-code output as claude mcp add command", () => {
    const output = formatConfig(baseConfig, "claude-code");
    expect(output).toContain("claude mcp add");
    expect(output).toContain("queue-pilot");
    expect(output).toContain("--schemas");
  });

  it("includes --env flags in claude-code format for non-default settings", () => {
    const config = {
      ...baseConfig,
      env: { RABBITMQ_USER: "admin", RABBITMQ_PASS: "secret" },
    };
    const output = formatConfig(config, "claude-code");
    expect(output).toContain("--env");
    expect(output).toContain("RABBITMQ_USER=admin");
    expect(output).toContain("RABBITMQ_PASS=secret");
  });

  it("formats vscode output with servers key instead of mcpServers", () => {
    const output = formatConfig(baseConfig, "vscode");
    const parsed = JSON.parse(output);
    expect(parsed.servers).toBeDefined();
    expect(parsed.mcpServers).toBeUndefined();
  });

  it("includes env in JSON configs for non-default settings", () => {
    const config = {
      ...baseConfig,
      env: { RABBITMQ_USER: "admin" },
    };
    const output = formatConfig(config, "generic");
    const parsed = JSON.parse(output);
    expect(parsed.mcpServers["queue-pilot"].env).toBeDefined();
    expect(parsed.mcpServers["queue-pilot"].env.RABBITMQ_USER).toBe("admin");
  });
});

describe("getConfigHint", () => {
  it("returns run command hint for claude-code", () => {
    expect(getConfigHint("claude-code")).toContain("Run");
  });

  it("returns .vscode/mcp.json hint for vscode", () => {
    expect(getConfigHint("vscode")).toContain(".vscode/mcp.json");
  });

  it("returns .cursor/mcp.json hint for cursor", () => {
    expect(getConfigHint("cursor")).toContain(".cursor/mcp.json");
  });

  it("returns claude_desktop_config.json hint for claude-desktop", () => {
    expect(getConfigHint("claude-desktop")).toContain(
      "claude_desktop_config.json",
    );
  });

  it("returns windsurf config path hint for windsurf", () => {
    expect(getConfigHint("windsurf")).toContain("windsurf");
  });

  it("returns generic MCP client hint for generic", () => {
    expect(getConfigHint("generic")).toContain("MCP client");
  });
});

describe("handleInit", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes config to stdout and hint to stderr", () => {
    const absPath = path.resolve("/tmp/schemas");
    handleInit(["--schemas", absPath]);
    const stdout = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const stderr = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(stdout).toContain("queue-pilot");
    expect(stderr.length).toBeGreaterThan(0);
  });

  it("outputs claude mcp add command for claude-code client", () => {
    const absPath = path.resolve("/tmp/schemas");
    handleInit(["--schemas", absPath, "--client", "claude-code"]);
    const stdout = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(stdout).toContain("claude mcp add");
  });
});
