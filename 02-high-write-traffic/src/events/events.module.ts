import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventsConsumer } from './events.consumer';
import { EventsProducer } from './events.producer';
import { ClickHouseService } from './clickhouse.service';
import { ClickHouseConsumer } from './clickhouse.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    ClientsModule.register([
      {
        name: 'EVENTS_QUEUE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'events_queue',
          queueOptions: {
            durable: true,
          }
        }
      },
      {
        name: 'CLICKHOUSE_QUEUE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'events_clickhouse_queue',
          queueOptions: { durable: true },
        },
      },
    ])
  ],
  controllers: [EventsController, EventsConsumer, ClickHouseConsumer],
  providers: [EventsService, EventsProducer, ClickHouseService],
})
export class EventsModule {}
