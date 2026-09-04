import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database.service.js';

@Injectable()
export class AdminRepository {
  constructor(private readonly database: DatabaseService) {}
  query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    return this.database.query<T>(text, values);
  }
}
