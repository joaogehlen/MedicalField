import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { camposDoErro } from '@medicalfield/shared';
import { ApiError } from './errors';
import type { MfRequest } from './request';

const CODIGOS: Record<number, [string, string]> = {
  400: ['REQUISICAO_INVALIDA', 'Requisição inválida'],
  401: ['NAO_AUTENTICADO', 'Não autenticado'],
  403: ['SEM_PERMISSAO', 'Sem permissão'],
  404: ['NAO_ENCONTRADO', 'Não encontrado'],
  413: ['REQUISICAO_GRANDE', 'Requisição muito grande'],
};

/** Converte qualquer erro em RFC 7807 (Problem Details). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly log = new Logger('ProblemFilter');

  catch(err: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<MfRequest>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let codigo = 'ERRO_INTERNO';
    let titulo = 'Erro interno';
    let detalhe = 'Falha inesperada. Informe o requestId ao suporte.';
    let extras: Record<string, unknown> = {};

    if (err instanceof ApiError) {
      ({ status, codigo, titulo, extras } = err);
      detalhe = err.message;
    } else if (err instanceof ZodError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      codigo = 'VALIDACAO';
      titulo = 'Dados inválidos';
      detalhe = err.issues[0]?.message ?? 'Verifique os campos informados.';
      extras = { campos: camposDoErro(err) };
    } else if (err instanceof HttpException) {
      status = err.getStatus();
      [codigo, titulo] = CODIGOS[status] ?? ['ERRO', 'Erro'];
      const r = err.getResponse();
      detalhe = typeof r === 'string' ? r : ((r as { message?: string }).message ?? titulo);
      if (status === 404) detalhe = 'Rota inexistente.';
    } else {
      this.log.error(`Erro inesperado em ${req.method} ${req.originalUrl}`, (err as Error)?.stack);
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://medicalfield/erros/${codigo.toLowerCase().replace(/_/g, '-')}`,
        title: titulo,
        status,
        detail: detalhe,
        codigo,
        requestId: req.requestId,
        ...extras,
      });
  }
}
