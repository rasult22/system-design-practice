import { Injectable, OnModuleInit } from "@nestjs/common";
import { createClient, ClickHouseClient } from "@clickhouse/client";

@Injectable()
export class ClickHouseService implements OnModuleInit {
  private client: ClickHouseClient;

  async onModuleInit() {
    this.client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: 'default',
      password: ''
    })

    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS events (
          id UUID DEFAULT generateUUIDv4(),
          type String,
          payload String,
          userId String,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY createdAt 
      `
    })
  }

  async insert(type: string, payload: Record<string, any>, userId?: string){
    this.client.insert({
      table: 'events',
      values: [{ type, payload: JSON.stringify(payload), userId: userId || '' }],
      format: 'JSONEachRow'
    })
  }

  async insertBatch(events: { type: string, payload: Record<string, any>, userId?: string }[]) {
    await this.client.insert({
      table: 'events',
      values: events.map(e => ({
        type: e.type,
        payload: JSON.stringify(e.payload),
        userId: e.userId || ''
      })),
      format: 'JSONEachRow'
    })
  }

  async count(): Promise<number> {
    const result = await this.client.query({
      query: 'SELECT count() as total FROM events',
      format: 'JSONEachRow'
    })
    const rows = await result.json<{ total: string}>();
    return parseInt(rows[0].total);
  }
}