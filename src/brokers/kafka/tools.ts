import { z } from "zod";
import type { ToolDefinition } from "../../broker/tool-definition.js";
import type { KafkaAdapter } from "./adapter.js";

export function createKafkaTools(adapter: KafkaAdapter): ToolDefinition[] {
  const getClient = () => adapter.getClient();

  return [
    {
      name: "list_consumer_groups",
      description: "List all Kafka consumer groups with their state",
      parameters: {},
      handler: async () => {
        const groups = await getClient().listConsumerGroups();
        return { consumer_groups: groups };
      },
    },
    {
      name: "describe_consumer_group",
      description:
        "Show members, partition assignments, and state of a Kafka consumer group",
      parameters: {
        group_id: z.string().describe("Consumer group ID"),
      },
      handler: async (args: Record<string, unknown>) => {
        const groupId = args.group_id as string;
        return getClient().describeConsumerGroup(groupId);
      },
    },
    {
      name: "list_partitions",
      description:
        "Show partition details for a Kafka topic (leader, replicas, ISR)",
      parameters: {
        topic: z.string().describe("Topic name"),
      },
      handler: async (args: Record<string, unknown>) => {
        const topicName = args.topic as string;
        const topic = await getClient().describeTopic(topicName);
        return { topic: topic.name, partitions: topic.partitions };
      },
    },
    {
      name: "get_offsets",
      description: "Show earliest/latest offsets per partition for a Kafka topic",
      parameters: {
        topic: z.string().describe("Topic name"),
      },
      handler: async (args: Record<string, unknown>) => {
        const topicName = args.topic as string;
        const offsets = await getClient().fetchTopicOffsets(topicName);
        return { topic: topicName, offsets };
      },
    },
  ];
}
