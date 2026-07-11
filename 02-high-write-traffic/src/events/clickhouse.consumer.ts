import { Controller } from "@nestjs/common";
import { ClickHouseService } from "./clickhouse.service";
import { EventPattern } from "@nestjs/microservices";

@Controller()
export class ClickHouseConsumer {
  private buffer: { type: string; payload: Record<string, any>; userId?: string }[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 500;
  constructor(
    private readonly chService: ClickHouseService,
  ) {}

  @EventPattern('event_tracked_ch')
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

  private async flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const batch = this.buffer.splice(0, this.BATCH_SIZE);
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    await this.chService.insertBatch(batch)
  }
}