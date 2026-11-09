import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import type { DatabaseService } from './database.service';

const RAIZ = join(__dirname, '..', '..');

/**
 * Migrador mínimo: aplica, em ordem, os arquivos de migrations/ ainda não registrados
 * em schema_migrations, cada um na sua transação. Depois aplica seeds/demo.sql se o
 * catálogo estiver vazio e SEED_DEMO=true.
 */
export async function migrar(db: DatabaseService, seedDemo: boolean): Promise<void> {
  const log = new Logger('Migrator');
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    versao VARCHAR(100) PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const aplicadas = new Set((await db.query<{ versao: string }>('SELECT versao FROM schema_migrations')).map((r) => r.versao));
  const dir = join(RAIZ, 'migrations');
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (aplicadas.has(arquivo)) continue;
    const sql = readFileSync(join(dir, arquivo), 'utf8');
    await db.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (versao) VALUES ($1)', [arquivo]);
    });
    log.log(`Migração aplicada: ${arquivo}`);
  }
  if (!seedDemo) return;
  const vazio = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM medicamento');
  if (vazio?.n === 0) {
    await db.transaction((tx) => tx.query(readFileSync(join(RAIZ, 'seeds', 'demo.sql'), 'utf8')));
    log.log('Dados de demonstração inseridos');
  }
}
