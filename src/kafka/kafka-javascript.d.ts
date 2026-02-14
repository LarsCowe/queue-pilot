declare module "@confluentinc/kafka-javascript" {
  export namespace KafkaJS {
    class Kafka {
      constructor(config: Record<string, unknown>);
      admin(): unknown;
      producer(): unknown;
      consumer(config: { groupId: string }): unknown;
    }
  }
}
