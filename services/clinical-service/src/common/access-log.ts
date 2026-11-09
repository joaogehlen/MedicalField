import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../db/database.service';
import type { MfRequest } from './request';

interface Entrada {
  dataHora: Date;
  requestId: string;
  ipCliente: string | null;
  profissionalId: string | null;
  metodo: string;
  rota: string;
  caminho: string;
  statusCode: number;
  tempoMs: number;
  userAgent: string | null;
}

const corta = (s: string | null | undefined, max: number) => (s ? s.slice(0, max) : null);

/**
 * Interceptor de auditoria (LGPD). Registra cada requisição HTTP: data/hora, IP do
 * cliente, profissional autenticado, método, rota, status e tempo em ms. A requisição
 * só enfileira; a gravação no banco é em lote. Cada linha também sai no stdout (JSON).
 */
@Injectable()
export class AccessLogService implements OnModuleDestroy {
  private readonly log = new Logger('access-log');
  private fila: Entrada[] = [];
  private readonly timer = setInterval(() => void this.persistir(), 500);

  constructor(private readonly db: DatabaseService) {}

  /** Middleware Express, registrado em main.ts antes de todas as rotas. */
  readonly middleware = (req: MfRequest, res: Response, next: NextFunction) => {
    const inicio = process.hrtime.bigint();
    const dataHora = new Date();
    const recebido = req.header('x-request-id');
    req.requestId = recebido && recebido.length <= 64 ? recebido : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.on('finish', () => {
      const tempoMs = Math.round(Number(process.hrtime.bigint() - inicio) / 10_000) / 100;
      const xff = req.header('x-forwarded-for');
      const padrao = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : null;
      this.registrar({
        dataHora,
        requestId: req.requestId!,
        ipCliente: xff ? xff.split(',')[0].trim() : (req.socket.remoteAddress ?? null),
        profissionalId: req.usuario?.id ?? null,
        metodo: req.method,
        rota: padrao ?? req.path,
        caminho: req.originalUrl.split('?')[0],
        statusCode: res.statusCode,
        tempoMs,
        userAgent: req.header('user-agent') ?? null,
      });
    });
    next();
  };

  private registrar(e: Entrada) {
    this.log.log(
      JSON.stringify({
        servico: 'clinical-service',
        data_hora: e.dataHora.toISOString(),
        request_id: e.requestId,
        ip_cliente: e.ipCliente,
        profissional_id: e.profissionalId,
        metodo: e.metodo,
        rota: e.rota,
        status_code: e.statusCode,
        tempo_ms: e.tempoMs,
      }),
    );
    if (this.fila.length < 10_000) this.fila.push(e);
  }

  private async persistir() {
    if (this.fila.length === 0) return;
    const lote = this.fila.splice(0, 500);
    const valores: unknown[] = [];
    const linhas = lote.map((e, i) => {
      const b = i * 10;
      valores.push(e.dataHora, e.requestId, corta(e.ipCliente, 64), e.profissionalId, e.metodo, corta(e.rota, 200),
        corta(e.caminho, 500), e.statusCode, e.tempoMs, corta(e.userAgent, 300));
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`;
    });
    try {
      await this.db.query(
        `INSERT INTO access_log (data_hora, request_id, ip_cliente, profissional_id, metodo, rota, caminho, status_code, tempo_ms, user_agent)
         VALUES ${linhas.join(',')}`,
        valores,
      );
    } catch (err) {
      this.log.error(`Falha ao persistir ${lote.length} entradas de access log: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.persistir();
  }
}
