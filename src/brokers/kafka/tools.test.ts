import { describe, it, expect, vi } from "vitest";
import { createKafkaTools } from "./tools.js";
import type { KafkaAdapter } from "./adapter.js";
import type { KafkaClient } from "../../kafka/client.js";
import type { ToolDefinition } from "../../broker/tool-definition.js";

function mockClient(
  overrides: Partial<Record<keyof KafkaClient, unknown>> = {},
): KafkaClient {
  return {
    listConsumerGroups: vi.fn().mockResolvedValue([]),
    describeConsumerGroup: vi.fn().mockResolvedValue({
      groupId: "order-processor",
      state: "Stable",
      protocol: "range",
      protocolType: "consumer",
      members: [],
    }),
    describeTopic: vi.fn().mockResolvedValue({
      name: "orders",
      partitions: [
        { partitionId: 0, leader: 1, replicas: [1], isr: [1] },
      ],
    }),
    fetchTopicOffsets: vi.fn().mockResolvedValue([
      { partition: 0, offset: "42", high: "42", low: "0" },
    ]),
    ...overrides,
  } as unknown as KafkaClient;
}

function mockAdapter(client: KafkaClient): KafkaAdapter {
  return { getClient: () => client } as unknown as KafkaAdapter;
}

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("createKafkaTools", () => {
  it("returns 4 tool definitions", () => {
    const tools = createKafkaTools(mockAdapter(mockClient()));

    expect(tools).toHaveLength(4);
  });

  it("returns tools with expected names", () => {
    const tools = createKafkaTools(mockAdapter(mockClient()));
    const names = tools.map((t) => t.name);

    expect(names).toContain("list_consumer_groups");
    expect(names).toContain("describe_consumer_group");
    expect(names).toContain("list_partitions");
    expect(names).toContain("get_offsets");
  });

  describe("list_consumer_groups", () => {
    it("calls client.listConsumerGroups and returns result", async () => {
      const client = mockClient({
        listConsumerGroups: vi.fn().mockResolvedValue([
          { groupId: "order-processor", protocolType: "consumer", state: "Stable" },
          { groupId: "analytics", protocolType: "consumer", state: "Empty" },
        ]),
      });
      const tool = findTool(createKafkaTools(mockAdapter(client)), "list_consumer_groups");

      const result = await tool.handler({});

      expect(client.listConsumerGroups).toHaveBeenCalled();
      expect(result).toEqual({
        consumer_groups: [
          { groupId: "order-processor", protocolType: "consumer", state: "Stable" },
          { groupId: "analytics", protocolType: "consumer", state: "Empty" },
        ],
      });
    });
  });

  describe("describe_consumer_group", () => {
    it("calls client.describeConsumerGroup with group_id", async () => {
      const client = mockClient({
        describeConsumerGroup: vi.fn().mockResolvedValue({
          groupId: "order-processor",
          state: "Stable",
          protocol: "range",
          protocolType: "consumer",
          members: [
            {
              memberId: "member-1",
              clientId: "client-1",
              clientHost: "/127.0.0.1",
              assignment: [{ topic: "orders", partitions: [0] }],
            },
          ],
        }),
      });
      const tool = findTool(createKafkaTools(mockAdapter(client)), "describe_consumer_group");

      const result = await tool.handler({ group_id: "order-processor" });

      expect(client.describeConsumerGroup).toHaveBeenCalledWith("order-processor");
      expect(result).toHaveProperty("groupId", "order-processor");
      expect(result).toHaveProperty("state", "Stable");
    });
  });

  describe("list_partitions", () => {
    it("calls client.describeTopic and returns partition details", async () => {
      const client = mockClient({
        describeTopic: vi.fn().mockResolvedValue({
          name: "orders",
          partitions: [
            { partitionId: 0, leader: 1, replicas: [1, 2], isr: [1, 2] },
            { partitionId: 1, leader: 2, replicas: [1, 2], isr: [1] },
          ],
        }),
      });
      const tool = findTool(createKafkaTools(mockAdapter(client)), "list_partitions");

      const result = await tool.handler({ topic: "orders" });

      expect(client.describeTopic).toHaveBeenCalledWith("orders");
      expect(result).toEqual({
        topic: "orders",
        partitions: [
          { partitionId: 0, leader: 1, replicas: [1, 2], isr: [1, 2] },
          { partitionId: 1, leader: 2, replicas: [1, 2], isr: [1] },
        ],
      });
    });
  });

  describe("get_offsets", () => {
    it("calls client.fetchTopicOffsets and returns result", async () => {
      const client = mockClient({
        fetchTopicOffsets: vi.fn().mockResolvedValue([
          { partition: 0, offset: "100", high: "100", low: "0" },
          { partition: 1, offset: "50", high: "50", low: "0" },
        ]),
      });
      const tool = findTool(createKafkaTools(mockAdapter(client)), "get_offsets");

      const result = await tool.handler({ topic: "orders" });

      expect(client.fetchTopicOffsets).toHaveBeenCalledWith("orders");
      expect(result).toEqual({
        topic: "orders",
        offsets: [
          { partition: 0, offset: "100", high: "100", low: "0" },
          { partition: 1, offset: "50", high: "50", low: "0" },
        ],
      });
    });
  });
});
