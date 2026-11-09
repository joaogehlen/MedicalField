import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { prontuarioSchema } from '@medicalfield/shared';
import { Usuario } from '../common/auth';
import { paginacao, responder } from '../common/http';
import type { UsuarioToken } from '../common/request';
import { validar } from '../common/zod';
import { lerContexto } from '../sync/sync-support';
import { ProntuarioService } from './prontuario.service';

@Controller('prontuario')
export class ProntuarioController {
  constructor(private readonly prontuarios: ProntuarioService) {}

  /** Todos os prontuários (paginado). Filtros: pessoaId, busca (nome ou CPF). */
  @Get()
  listar(@Query() q: { pessoaId?: string; busca?: string; pagina?: string; tamanho?: string }) {
    const p = paginacao(q);
    return this.prontuarios.listar({ pessoaId: q.pessoaId, busca: q.busca }, p.pagina, p.tamanho, p.offset);
  }

  @Get(':id')
  obter(@Param('id', ParseUUIDPipe) id: string) {
    return this.prontuarios.obter(id);
  }

  @Post()
  async upsert(
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
    @Usuario() usuario: UsuarioToken,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = validar(prontuarioSchema, body);
    const ctx = lerContexto(headers, '/prontuario', usuario.id, input.dispositivoId);
    return responder(res, await this.prontuarios.upsert(input, ctx));
  }
}
