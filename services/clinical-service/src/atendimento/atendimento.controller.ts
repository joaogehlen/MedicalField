import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { adendoSchema, atendimentoSchema } from '@medicalfield/shared';
import { Usuario } from '../common/auth';
import { paginacao, responder } from '../common/http';
import type { UsuarioToken } from '../common/request';
import { validar } from '../common/zod';
import { lerContexto } from '../sync/sync-support';
import { AtendimentoService, type FiltrosAtendimento } from './atendimento.service';

@Controller('atendimento')
export class AtendimentoController {
  constructor(private readonly atendimentos: AtendimentoService) {}

  /** Todos os atendimentos (portal), paginado e filtrável. */
  @Get()
  listar(@Query() q: FiltrosAtendimento & { pagina?: string; tamanho?: string }) {
    const p = paginacao(q);
    return this.atendimentos.listar(q, p.pagina, p.tamanho, p.offset);
  }

  /** Atendimento completo, com pessoa, prontuário, sinais vitais e medicamentos. */
  @Get('detalhe/:id')
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.atendimentos.detalhe(id);
  }

  /** Rota da proposta: todos os atendimentos de uma pessoa ({id} = id da pessoa). */
  @Get(':pessoaId')
  porPessoa(@Param('pessoaId', ParseUUIDPipe) pessoaId: string) {
    return this.atendimentos.porPessoa(pessoaId);
  }

  @Post()
  async upsert(
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
    @Usuario() usuario: UsuarioToken,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = validar(atendimentoSchema, body);
    const ctx = lerContexto(headers, '/atendimento', usuario.id, input.dispositivoId);
    return responder(res, await this.atendimentos.upsert(input, ctx, usuario));
  }

  /** Correção de um atendimento finalizado (o registro original é imutável). */
  @Post(':id/adendo')
  @HttpCode(201)
  adendo(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Usuario() usuario: UsuarioToken) {
    return this.atendimentos.adicionarAdendo(id, validar(adendoSchema, body), usuario);
  }
}
