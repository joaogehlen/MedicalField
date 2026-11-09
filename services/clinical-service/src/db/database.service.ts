import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow, types } from 'pg';
import { config } from '../config';

// NUMERIC → number e BIGINT → number (valores cabem com folga em double).
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)));
// DATE fica como texto AAAA-MM-DD (sem conversão de fuso).
types.setTypeParser(types.builtins.DATE, (v) => v);

/** Executor de consultas: o pool ou o cliente de uma transação em andamento. */
export interface Db {
  query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T | null>;
}

function executor(c: Pool | PoolClient): Db {
  return {
    async query(sql, params) {
      return (await c.query(sql, params as any[])).rows;
    },
    async one(sql, params) {
      return (await c.query(sql, params as any[])).rows[0] ?? null;
    },
  };
}

@Injectable()
export class DatabaseService implements Db, OnModuleDestroy {
  private readonly log = new Logger('Database');
  readonly pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    options: '-c search_path=clinical',
  });
  private readonly db = executor(this.pool);

  query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.db.query<T>(sql, params);
  }

  one<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T | null> {
    return this.db.one<T>(sql, params);
  }

  /** Executa `fn` numa transação; desfaz tudo se lançar erro. */
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await fn(executor(client));
      await client.query('COMMIT');
      return r;
    } catch (e) {
      await client.query('ROLLBACK').catch((err) => this.log.error('Falha no rollback', err));
      throw e;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
