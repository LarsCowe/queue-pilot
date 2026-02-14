export interface KafkaConfig {
  brokers: string[];
  clientId?: string;
  sasl?: SaslConfig;
  ssl?: boolean;
}

export interface SaslConfig {
  mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
  username: string;
  password: string;
}

export interface TopicInfo {
  name: string;
  partitions: PartitionInfo[];
}

export interface PartitionInfo {
  partitionId: number;
  leader: number;
  replicas: number[];
  isr: number[];
}

export interface ConsumerGroupInfo {
  groupId: string;
  state: string;
  protocol: string;
  protocolType: string;
  members: ConsumerGroupMember[];
}

export interface ConsumerGroupMember {
  memberId: string;
  clientId: string;
  clientHost: string;
  assignment: TopicPartitionAssignment[];
}

export interface TopicPartitionAssignment {
  topic: string;
  partitions: number[];
}

export interface TopicOffsets {
  topic: string;
  partitions: PartitionOffset[];
}

export interface PartitionOffset {
  partition: number;
  offset: string;
  high: string;
  low: string;
}
