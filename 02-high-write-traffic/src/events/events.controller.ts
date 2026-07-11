import { Controller, Post, Get, Body } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsProducer } from './events.producer';
import { ClickHouseService } from './clickhouse.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsProducer: EventsProducer,
    private readonly eventsService: EventsService,
    private readonly clickhouseService: ClickHouseService
  ) {}

  @Post()
  async track(@Body() body: { type: string; payload: Record<string, any>; userId?: string }) {
    await this.eventsProducer.sendToPostgres(body.type, body.payload, body.userId);
    return { status: 'queued' }
  }

  @Post('clickhouse')
  async trackClickhouse(@Body() body: { type: string; payload: Record<string, any>; userId?: string }) {
    await this.eventsProducer.sendToClickHouse(body.type, body.payload, body.userId);
    return { status: 'queued' }
  }
  
  @Get('count')
  async count() {
    const total = await this.eventsService.count();
    return { total };
  }

  @Get('clickhouse/count')
  async clickhouseCount() {
    const total = await this.clickhouseService.count();
    return { total };
  }
}
