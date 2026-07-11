import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
  ) {}

  async create(type: string, payload: Record<string, any>, userId?: string): Promise<Event> {
    const event = this.repo.create({ type, payload, userId });
    return this.repo.save(event);
  }

  async count(): Promise<number> {
    return this.repo.count();
  }
}
