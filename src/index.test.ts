import { createRequire } from "module";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseArgs } from "./index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("parseArgs", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {
        throw new Error("process.exit");
      }) as unknown as (code?: number) => never);

    savedEnv.RABBITMQ_URL = process.env.RABBITMQ_URL;
    savedEnv.RABBITMQ_USER = process.env.RABBITMQ_USER;
    savedEnv.RABBITMQ_PASS = process.env.RABBITMQ_PASS;
    delete process.env.RABBITMQ_URL;
    delete process.env.RABBITMQ_USER;
    delete process.env.RABBITMQ_PASS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedEnv.RABBITMQ_URL !== undefined) {
      process.env.RABBITMQ_URL = savedEnv.RABBITMQ_URL;
    } else {
      delete process.env.RABBITMQ_URL;
    }
    if (savedEnv.RABBITMQ_USER !== undefined) {
      process.env.RABBITMQ_USER = savedEnv.RABBITMQ_USER;
    } else {
      delete process.env.RABBITMQ_USER;
    }
    if (savedEnv.RABBITMQ_PASS !== undefined) {
      process.env.RABBITMQ_PASS = savedEnv.RABBITMQ_PASS;
    } else {
      delete process.env.RABBITMQ_PASS;
    }
  });

  it("prints help text and exits 0 for --help", () => {
    expect(() => parseArgs(["--help"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(0);

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Queue Pilot");
    expect(output).toContain("--schemas");
    expect(output).toContain("--rabbitmq-url");
  });

  it("documents environment variables in help text", () => {
    expect(() => parseArgs(["--help"])).toThrow("process.exit");

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("RABBITMQ_URL");
    expect(output).toContain("RABBITMQ_USER");
    expect(output).toContain("RABBITMQ_PASS");
  });

  it("prints version and exits 0 for --version", () => {
    expect(() => parseArgs(["--version"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(0);

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain(pkg.version);
  });

  it("returns parsed config for valid arguments", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas"]);

    expect(result).toEqual({
      schemas: "/tmp/schemas",
      rabbitmqUrl: "http://localhost:15672",
      rabbitmqUser: "guest",
      rabbitmqPass: "guest",
    });
  });

  it("exits 1 when --schemas is missing", () => {
    expect(() => parseArgs([])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("overrides rabbitmq-url when provided", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--rabbitmq-url", "http://rabbit:15672"]);
    expect(result.rabbitmqUrl).toBe("http://rabbit:15672");
  });

  it("overrides rabbitmq-user when provided", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--rabbitmq-user", "admin"]);
    expect(result.rabbitmqUser).toBe("admin");
  });

  it("overrides rabbitmq-pass when provided", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--rabbitmq-pass", "secret"]);
    expect(result.rabbitmqPass).toBe("secret");
  });

  it("uses RABBITMQ_URL env var when CLI arg is absent", () => {
    vi.restoreAllMocks();
    process.env.RABBITMQ_URL = "http://env-rabbit:15672";
    const result = parseArgs(["--schemas", "/tmp/schemas"]);
    expect(result.rabbitmqUrl).toBe("http://env-rabbit:15672");
  });

  it("uses RABBITMQ_USER env var when CLI arg is absent", () => {
    vi.restoreAllMocks();
    process.env.RABBITMQ_USER = "env-user";
    const result = parseArgs(["--schemas", "/tmp/schemas"]);
    expect(result.rabbitmqUser).toBe("env-user");
  });

  it("uses RABBITMQ_PASS env var when CLI arg is absent", () => {
    vi.restoreAllMocks();
    process.env.RABBITMQ_PASS = "env-secret";
    const result = parseArgs(["--schemas", "/tmp/schemas"]);
    expect(result.rabbitmqPass).toBe("env-secret");
  });

  it("CLI args take priority over env vars", () => {
    vi.restoreAllMocks();
    process.env.RABBITMQ_URL = "http://env-rabbit:15672";
    process.env.RABBITMQ_USER = "env-user";
    process.env.RABBITMQ_PASS = "env-secret";
    const result = parseArgs([
      "--schemas", "/tmp/schemas",
      "--rabbitmq-url", "http://cli-rabbit:15672",
      "--rabbitmq-user", "cli-user",
      "--rabbitmq-pass", "cli-secret",
    ]);
    expect(result.rabbitmqUrl).toBe("http://cli-rabbit:15672");
    expect(result.rabbitmqUser).toBe("cli-user");
    expect(result.rabbitmqPass).toBe("cli-secret");
  });

  it("ignores unknown flags", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--unknown", "value"]);
    expect(result.schemas).toBe("/tmp/schemas");
    expect(result.rabbitmqUrl).toBe("http://localhost:15672");
  });
});
