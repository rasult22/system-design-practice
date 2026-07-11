import { Controller, Post, Get, Body } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsProducer } from './events.producer';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsProducer: EventsProducer,
    private readonly eventsService: EventsService
  ) {}

  @Post()
  async track(@Body() body: { type: string; payload: Record<string, any>; userId?: string }) {
    await this.eventsProducer.send(body.type, body.payload, body.userId);
    return {status: 'queued'}
  }
  
  @Get('count')
  async count() {
    const total = await this.eventsService.count();
    return { total };
  }
}
