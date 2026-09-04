import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://ai_gateway:ai_gateway@localhost:5432/ai_gateway',
  });

  query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    return this.pool.query<T>(text, values);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
