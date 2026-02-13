import type {
  RabbitMQConfig,
  QueueInfo,
  QueueMessage,
  ExchangeInfo,
  BindingInfo,
  PublishMessageBody,
  PublishResponse,
  PurgeResponse,
} from "./types.js";

function encodeVhost(vhost: string): string {
  if (!vhost) throw new Error("vhost must not be empty");
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

  private async rawRequest(path: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...options?.headers },
    });

    if (!response.ok) {
      let body = "";
      try { body = await response.text(); } catch { /* response body unreadable */ }
      throw new Error(
        `RabbitMQ API error: ${response.status} ${response.statusText} — ${body}`,
      );
    }

    return response;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await this.rawRequest(path, options);
    return response.json() as Promise<T>;
  }

  private async requestVoid(path: string, options?: RequestInit): Promise<void> {
    await this.rawRequest(path, options);
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

  async purgeQueue(
    vhost: string,
    queue: string,
  ): Promise<PurgeResponse> {
    return this.request<PurgeResponse>(
      `/api/queues/${encodeVhost(vhost)}/${encodeURIComponent(queue)}/contents`,
      { method: "DELETE" },
    );
  }

  async createQueue(
    vhost: string,
    queue: string,
    options: { durable: boolean; auto_delete: boolean },
  ): Promise<void> {
    return this.requestVoid(
      `/api/queues/${encodeVhost(vhost)}/${encodeURIComponent(queue)}`,
      {
        method: "PUT",
        body: JSON.stringify(options),
      },
    );
  }

  async createBinding(
    vhost: string,
    exchange: string,
    queue: string,
    routingKey: string,
  ): Promise<void> {
    return this.requestVoid(
      `/api/bindings/${encodeVhost(vhost)}/e/${encodeURIComponent(exchange)}/q/${encodeURIComponent(queue)}`,
      {
        method: "POST",
        body: JSON.stringify({ routing_key: routingKey }),
      },
    );
  }

  async publishMessage(
    vhost: string,
    exchange: string,
    body: PublishMessageBody,
  ): Promise<PublishResponse> {
    return this.request<PublishResponse>(
      `/api/exchanges/${encodeVhost(vhost)}/${encodeURIComponent(exchange)}/publish`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }
}
