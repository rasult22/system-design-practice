import { Injectable, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

@Injectable()
export class EventsProducer {
  constructor(
    @Inject('EVENTS_QUEUE')
    private readonly client: ClientProxy,
    @Inject('CLICKHOUSE_QUEUE')
    private readonly chClient: ClientProxy,
  ) {}

  async sendToClickHouse(type: string, payload: Record<string, any>, userId?: string) {
    await this.chClient.emit('event_tracked_ch', { type, payload, userId });
  }

  async sendToPostgres(type: string, payload: Record<string, any>, userId?: string) {
    await this.client.emit('event_tracked', { type, payload, userId });
  }
}