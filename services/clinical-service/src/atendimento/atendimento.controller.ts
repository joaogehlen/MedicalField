import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { atendimentoSchema } from '@medicalfield/shared';
import { responder } from '../common/http';
import { validar } from '../common/zod';
import { chaveIdempotencia } from '../sync/sync-support';
import { AtendimentoService } from './atendimento.service';

@Controller('atendimento')
export class AtendimentoController {
  constructor(private readonly atendimentos: AtendimentoService) {}

  /** Todos os atendimentos (portal), paginado; ?busca= paciente, queixa ou local. */
  @Get()
  listar(@Query('busca') busca?: string, @Query('pagina') pagina = '1', @Query('tamanho') tamanho = '50') {
    return this.atendimentos.listar(busca, Math.max(1, Number(pagina) || 1), Math.min(200, Number(tamanho) || 50));
  }

  /** Atendimento completo, com paciente, prontuário e medicamentos. */
  @Get('detalhe/:id')
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.atendimentos.detalhe(id);
  }

  /** Rota da proposta: todos os atendimentos de uma pessoa ({id} = id da pessoa). */
  @Get(':id')
  daPessoa(@Param('id', ParseUUIDPipe) pessoaId: string) {
    return this.atendimentos.daPessoa(pessoaId);
  }

  @Post()
  async cadastrar(@Body() body: unknown, @Headers() headers: Record<string, string>, @Res({ passthrough: true }) res: Response) {
    return responder(res, await this.atendimentos.upsert(validar(atendimentoSchema, body), chaveIdempotencia(headers)));
  }
}
