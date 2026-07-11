import { Injectable, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

@Injectable()
export class EventsProducer {
  constructor(
    @Inject('EVENTS_QUEUE') 
    private readonly client: ClientProxy
  ) {}

  async send(type: string, payload: Record<string, any>, userId?: string) {
    await this.client.emit('event_tracked', { type, payload, userId });
  }
}