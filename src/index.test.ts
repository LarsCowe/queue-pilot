import { createRequire } from "module";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseArgs, buildBrokerConfig } from "./index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("parseArgs", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    "RABBITMQ_URL", "RABBITMQ_USER", "RABBITMQ_PASS",
    "KAFKA_BROKERS", "KAFKA_CLIENT_ID",
    "KAFKA_SASL_MECHANISM", "KAFKA_SASL_USERNAME", "KAFKA_SASL_PASSWORD",
  ];

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {
        throw new Error("process.exit");
      }) as unknown as (code?: number) => never);

    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
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

  it("mentions init subcommand in help text", () => {
    expect(() => parseArgs(["--help"])).toThrow("process.exit");

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("init");
  });

  it("documents environment variables in help text", () => {
    expect(() => parseArgs(["--help"])).toThrow("process.exit");

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("RABBITMQ_URL");
    expect(output).toContain("RABBITMQ_USER");
    expect(output).toContain("RABBITMQ_PASS");
    expect(output).toContain("KAFKA_BROKERS");
    expect(output).toContain("KAFKA_CLIENT_ID");
    expect(output).toContain("KAFKA_SASL_MECHANISM");
  });

  it("documents Kafka CLI options in help text", () => {
    expect(() => parseArgs(["--help"])).toThrow("process.exit");

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("--kafka-brokers");
    expect(output).toContain("--kafka-client-id");
    expect(output).toContain("--kafka-sasl-mechanism");
  });

  it("mentions --broker flag in help text", () => {
    expect(() => parseArgs(["--help"])).toThrow("process.exit");

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("--broker");
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
      broker: "rabbitmq",
      rabbitmqUrl: "http://localhost:15672",
      rabbitmqUser: "guest",
      rabbitmqPass: "guest",
      kafkaBrokers: "localhost:9092",
      kafkaClientId: "queue-pilot",
      kafkaSaslMechanism: "",
      kafkaSaslUsername: "",
      kafkaSaslPassword: "",
    });
  });

  it("defaults broker to rabbitmq", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas"]);
    expect(result.broker).toBe("rabbitmq");
  });

  it("parses --broker flag", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--broker", "kafka"]);
    expect(result.broker).toBe("kafka");
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

  it("parses --kafka-brokers", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--kafka-brokers", "kafka1:9092,kafka2:9092"]);
    expect(result.kafkaBrokers).toBe("kafka1:9092,kafka2:9092");
  });

  it("parses --kafka-client-id", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--kafka-client-id", "my-app"]);
    expect(result.kafkaClientId).toBe("my-app");
  });

  it("parses --kafka-sasl-mechanism", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--kafka-sasl-mechanism", "plain"]);
    expect(result.kafkaSaslMechanism).toBe("plain");
  });

  it("parses --kafka-sasl-username", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--kafka-sasl-username", "admin"]);
    expect(result.kafkaSaslUsername).toBe("admin");
  });

  it("parses --kafka-sasl-password", () => {
    vi.restoreAllMocks();
    const result = parseArgs(["--schemas", "/tmp/schemas", "--kafka-sasl-password", "secret"]);
    expect(result.kafkaSaslPassword).toBe("secret");
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

  it("uses KAFKA_BROKERS env var when CLI arg is absent", () => {
    vi.restoreAllMocks();
    process.env.KAFKA_BROKERS = "kafka-env:9092";
    const result = parseArgs(["--schemas", "/tmp/schemas"]);
    expect(result.kafkaBrokers).toBe("kafka-env:9092");
  });

  it("uses KAFKA_CLIENT_ID env var when CLI arg is absent", () => {
    vi.restoreAllMocks();
    process.env.KAFKA_CLIENT_ID = "env-client";
    const result = parseArgs(["--schemas", "/tmp/schemas"]);
    expect(result.kafkaClientId).toBe("env-client");
  });

  it("CLI args take priority over env vars", () => {
    vi.restoreAllMocks();
    process.env.RABBITMQ_URL = "http://env-rabbit:15672";
    process.env.RABBITMQ_USER = "env-user";
    process.env.RABBITMQ_PASS = "env-secret";
    process.env.KAFKA_BROKERS = "env-kafka:9092";
    const result = parseArgs([
      "--schemas", "/tmp/schemas",
      "--rabbitmq-url", "http://cli-rabbit:15672",
      "--rabbitmq-user", "cli-user",
      "--rabbitmq-pass", "cli-secret",
      "--kafka-brokers", "cli-kafka:9092",
    ]);
    expect(result.rabbitmqUrl).toBe("http://cli-rabbit:15672");
    expect(result.rabbitmqUser).toBe("cli-user");
    expect(result.rabbitmqPass).toBe("cli-secret");
    expect(result.kafkaBrokers).toBe("cli-kafka:9092");
  });

  it("warns on unrecognized flags", () => {
    const result = parseArgs(["--schemas", "/tmp/schemas", "--rabbit-url", "http://example.com"]);
    expect(result.schemas).toBe("/tmp/schemas");
    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("--rabbit-url");
  });

  it("exits 1 when --schemas value is another flag", () => {
    expect(() => parseArgs(["--schemas", "--rabbitmq-url"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --schemas is last argument with no value", () => {
    expect(() => parseArgs(["--schemas"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --rabbitmq-url value is another flag", () => {
    expect(() => parseArgs(["--rabbitmq-url", "--schemas", "/tmp/schemas"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --rabbitmq-url is last argument with no value", () => {
    expect(() => parseArgs(["--schemas", "/tmp/schemas", "--rabbitmq-url"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --rabbitmq-user value is another flag", () => {
    expect(() => parseArgs(["--rabbitmq-user", "--schemas", "/tmp/schemas"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --rabbitmq-user is last argument with no value", () => {
    expect(() => parseArgs(["--schemas", "/tmp/schemas", "--rabbitmq-user"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --rabbitmq-pass value is another flag", () => {
    expect(() => parseArgs(["--rabbitmq-pass", "--schemas", "/tmp/schemas"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --rabbitmq-pass is last argument with no value", () => {
    expect(() => parseArgs(["--schemas", "/tmp/schemas", "--rabbitmq-pass"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("writes error message naming the flag that is missing a value", () => {
    expect(() => parseArgs(["--rabbitmq-url", "--schemas", "/tmp/schemas"])).toThrow("process.exit");
    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("--rabbitmq-url requires a value");
  });

  it("exits 1 when --broker value is another flag", () => {
    expect(() => parseArgs(["--broker", "--schemas", "/tmp/schemas"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --broker is last argument with no value", () => {
    expect(() => parseArgs(["--schemas", "/tmp/schemas", "--broker"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --kafka-brokers value is another flag", () => {
    expect(() => parseArgs(["--kafka-brokers", "--schemas", "/tmp/schemas"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when --kafka-brokers is last argument with no value", () => {
    expect(() => parseArgs(["--schemas", "/tmp/schemas", "--kafka-brokers"])).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("buildBrokerConfig", () => {
  const baseArgs = {
    schemas: "/tmp/schemas",
    broker: "rabbitmq",
    rabbitmqUrl: "http://localhost:15672",
    rabbitmqUser: "guest",
    rabbitmqPass: "guest",
    kafkaBrokers: "localhost:9092",
    kafkaClientId: "queue-pilot",
    kafkaSaslMechanism: "",
    kafkaSaslUsername: "",
    kafkaSaslPassword: "",
  };

  it("builds RabbitMQ config by default", () => {
    const config = buildBrokerConfig(baseArgs);

    expect(config).toEqual({
      broker: "rabbitmq",
      url: "http://localhost:15672",
      username: "guest",
      password: "guest",
    });
  });

  it("builds Kafka config when broker is kafka", () => {
    const config = buildBrokerConfig({
      ...baseArgs,
      broker: "kafka",
      kafkaBrokers: "kafka1:9092,kafka2:9092",
    });

    expect(config).toEqual({
      broker: "kafka",
      brokers: ["kafka1:9092", "kafka2:9092"],
      clientId: "queue-pilot",
    });
  });

  it("includes SASL config when mechanism is set", () => {
    const config = buildBrokerConfig({
      ...baseArgs,
      broker: "kafka",
      kafkaSaslMechanism: "plain",
      kafkaSaslUsername: "admin",
      kafkaSaslPassword: "secret",
    });

    expect(config).toEqual({
      broker: "kafka",
      brokers: ["localhost:9092"],
      clientId: "queue-pilot",
      sasl: {
        mechanism: "plain",
        username: "admin",
        password: "secret",
      },
    });
  });

  it("omits SASL config when mechanism is empty", () => {
    const config = buildBrokerConfig({
      ...baseArgs,
      broker: "kafka",
    });

    expect(config).not.toHaveProperty("sasl");
  });

  it("trims whitespace from comma-separated broker addresses", () => {
    const config = buildBrokerConfig({
      ...baseArgs,
      broker: "kafka",
      kafkaBrokers: "kafka1:9092 , kafka2:9092 , kafka3:9092",
    });

    expect((config as { brokers: string[] }).brokers).toEqual([
      "kafka1:9092",
      "kafka2:9092",
      "kafka3:9092",
    ]);
  });
});
