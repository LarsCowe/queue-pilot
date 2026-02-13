import type {
  RabbitMQConfig,
  QueueInfo,
  QueueMessage,
  ExchangeInfo,
  BindingInfo,
} from "./types.js";

function encodeVhost(vhost: string): string {
  return vhost === "/" ? "%2F" : encodeURIComponent(vhost);
}

export class RabbitMQClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(config: RabbitMQConfig) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.username}:${config.password}`).toString("base64");
  }

  private headers(): Record<string, string> {
    return {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...options?.headers },
    });

    if (!response.ok) {
      throw new Error(
        `RabbitMQ API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async listQueues(vhost: string): Promise<QueueInfo[]> {
    return this.request<QueueInfo[]>(`/api/queues/${encodeVhost(vhost)}`);
  }

  async peekMessages(
    vhost: string,
    queue: string,
    count: number,
  ): Promise<QueueMessage[]> {
    return this.request<QueueMessage[]>(
      `/api/queues/${encodeVhost(vhost)}/${encodeURIComponent(queue)}/get`,
      {
        method: "POST",
        body: JSON.stringify({
          count,
          ackmode: "ack_requeue_true",
          encoding: "auto",
        }),
      },
    );
  }

  async listExchanges(vhost: string): Promise<ExchangeInfo[]> {
    return this.request<ExchangeInfo[]>(
      `/api/exchanges/${encodeVhost(vhost)}`,
    );
  }

  async listBindings(vhost: string): Promise<BindingInfo[]> {
    return this.request<BindingInfo[]>(`/api/bindings/${encodeVhost(vhost)}`);
  }
}
