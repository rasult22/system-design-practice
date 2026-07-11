import { Controller } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event } from "./event.entity";

@Controller()
export class EventsConsumer {
  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
  ){}

  @EventPattern('event_tracked')
  async handle(data: { type: string, payload: Record<string, any>, userId?: string }) {
    const event = this.repo.create(data);
    await this.repo.save(event);
   }
}
