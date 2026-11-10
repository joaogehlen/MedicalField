import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { prontuarioSchema } from '@medicalfield/shared';
import { responder } from '../common/http';
import { validar } from '../common/zod';
import { chaveIdempotencia } from '../sync/sync-support';
import { ProntuarioService } from './prontuario.service';

@Controller('prontuario')
export class ProntuarioController {
  constructor(private readonly prontuarios: ProntuarioService) {}

  /** Todos os prontuários de todas as pessoas (paginado; ?busca= nome ou CPF). */
  @Get()
  listar(@Query('busca') busca?: string, @Query('pagina') pagina = '1', @Query('tamanho') tamanho = '50') {
    return this.prontuarios.listar(busca, Math.max(1, Number(pagina) || 1), Math.min(200, Number(tamanho) || 50));
  }

  /** Prontuário de uma pessoa, com os atendimentos. */
  @Get(':id')
  obter(@Param('id', ParseUUIDPipe) id: string) {
    return this.prontuarios.obter(id);
  }

  @Post()
  async cadastrar(@Body() body: unknown, @Headers() headers: Record<string, string>, @Res({ passthrough: true }) res: Response) {
    return responder(res, await this.prontuarios.upsert(validar(prontuarioSchema, body), chaveIdempotencia(headers)));
  }
}
