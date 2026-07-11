import { Controller } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event } from "./event.entity";

@Controller()
export class EventsConsumer {
  private buffer: Partial<Event>[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 500;

  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
  ){}

  @EventPattern('event_tracked')
  async handle(data: { type: string, payload: Record<string, any>, userId?: string }) {
    this.buffer.push(data);

    if (this.buffer.length >= this.BATCH_SIZE) {
      await this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => {
        this.flush();
      }, this.FLUSH_INTERVAL);
    }
   }

   async flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const batch = this.buffer.splice(0, this.BATCH_SIZE);

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    await this.repo.insert(batch);
   }
}
