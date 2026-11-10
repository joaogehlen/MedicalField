import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { DatabaseService } from '../db/database.service';
import type { MfRequest } from './request';

interface Entrada {
  dataHora: Date;
  ipCliente: string | null;
  profissionalId: string | null;
  metodo: string;
  rota: string;
  statusCode: number;
  tempoMs: number;
}

/**
 * Middleware de log de acesso (LGPD): data/hora, IP do cliente, profissional
 * autenticado, método, rota, status e tempo de processamento. A requisição só
 * enfileira; a gravação no banco é feita em lote.
 */
@Injectable()
export class AccessLogService implements OnModuleDestroy {
  private readonly log = new Logger('access-log');
  private fila: Entrada[] = [];
  private readonly timer = setInterval(() => void this.persistir(), 500);

  constructor(private readonly db: DatabaseService) {}

  readonly middleware = (req: MfRequest, res: Response, next: NextFunction) => {
    const inicio = process.hrtime.bigint();
    const dataHora = new Date();
    res.on('finish', () => {
      const xff = req.header('x-forwarded-for');
      const e: Entrada = {
        dataHora,
        ipCliente: (xff ? xff.split(',')[0].trim() : req.socket.remoteAddress) ?? null,
        profissionalId: req.usuario?.id ?? null,
        metodo: req.method,
        rota: req.route?.path ?? req.path,
        statusCode: res.statusCode,
        tempoMs: Math.round(Number(process.hrtime.bigint() - inicio) / 10_000) / 100,
      };
      this.log.log(JSON.stringify(e));
      if (this.fila.length < 10_000) this.fila.push(e);
    });
    next();
  };

  private async persistir() {
    if (this.fila.length === 0) return;
    const lote = this.fila.splice(0, 500);
    const valores: unknown[] = [];
    const linhas = lote.map((e, i) => {
      valores.push(e.dataHora, e.ipCliente, e.profissionalId, e.metodo, e.rota.slice(0, 200), e.statusCode, e.tempoMs);
      const b = i * 7;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
    });
    try {
      await this.db.query(
        `INSERT INTO access_log (data_hora, ip_cliente, profissional_id, metodo, rota, status_code, tempo_ms) VALUES ${linhas.join(',')}`,
        valores,
      );
    } catch (err) {
      this.log.error(`Falha ao gravar log de acesso: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.persistir();
  }
}
