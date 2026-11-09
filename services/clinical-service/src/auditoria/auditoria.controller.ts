import { Controller, Get, Query } from '@nestjs/common';
import type { AccessLog } from '@medicalfield/shared';
import { DatabaseService } from '../db/database.service';
import { Papeis } from '../common/auth';
import { paginacao } from '../common/http';

/** Log de acesso deste serviço (portal → Auditoria). */
@Controller('clinico')
export class AuditoriaController {
  constructor(private readonly db: DatabaseService) {}

  @Get('access-log')
  @Papeis('ADMIN')
  async accessLog(@Query() q: { pagina?: string; tamanho?: string; status?: string }) {
    const p = paginacao(q);
    const status = Number(q.status) || null;
    const total = await this.db.one<{ n: number }>('SELECT count(*)::int n FROM access_log WHERE ($1::int IS NULL OR status_code = $1)', [status]);
    const linhas = await this.db.query(
      'SELECT * FROM access_log WHERE ($1::int IS NULL OR status_code = $1) ORDER BY id DESC LIMIT $2 OFFSET $3',
      [status, p.tamanho, p.offset],
    );
    const itens: AccessLog[] = linhas.map((r) => ({
      id: r.id,
      servico: 'clinical-service',
      dataHora: new Date(r.data_hora).toISOString(),
      requestId: r.request_id,
      ipCliente: r.ip_cliente,
      profissionalId: r.profissional_id,
      metodo: r.metodo,
      rota: r.rota,
      caminho: r.caminho,
      statusCode: r.status_code,
      tempoMs: r.tempo_ms,
      userAgent: r.user_agent,
    }));
    return { itens, pagina: p.pagina, tamanho: p.tamanho, total: total?.n ?? 0 };
  }
}
