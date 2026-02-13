import { createRequire } from "module";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseArgs } from "./index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("parseArgs", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {
        throw new Error("process.exit");
      }) as unknown as (code?: number) => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints help text and exits 0 for --help", () => {
    expect(() => parseArgs(["--help"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(0);

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Queue Pilot");
    expect(output).toContain("--schemas");
    expect(output).toContain("--rabbitmq-url");
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

  it("ignores unknown flags", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--unknown", "value"]);
    expect(result.schemas).toBe("/tmp/schemas");
    expect(result.rabbitmqUrl).toBe("http://localhost:15672");
  });
});
