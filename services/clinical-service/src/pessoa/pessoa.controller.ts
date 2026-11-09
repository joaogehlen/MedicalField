import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { pessoaSchema } from '@medicalfield/shared';
import { Usuario } from '../common/auth';
import { paginacao, responder } from '../common/http';
import type { UsuarioToken } from '../common/request';
import { validar } from '../common/zod';
import { lerContexto } from '../sync/sync-support';
import { PessoaService } from './pessoa.service';

@Controller('pessoa')
export class PessoaController {
  constructor(private readonly pessoas: PessoaService) {}

  @Get()
  listar(@Query() q: { busca?: string; pagina?: string; tamanho?: string }) {
    const p = paginacao(q);
    return this.pessoas.listar(q.busca, p.pagina, p.tamanho, p.offset);
  }

  @Get(':id')
  obter(@Param('id', ParseUUIDPipe) id: string) {
    return this.pessoas.obter(id);
  }

  /** Cria ou atualiza (upsert idempotente pelo id gerado no dispositivo). */
  @Post()
  async upsert(
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
    @Usuario() usuario: UsuarioToken,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = validar(pessoaSchema, body);
    const ctx = lerContexto(headers, '/pessoa', usuario.id, input.dispositivoId);
    return responder(res, await this.pessoas.upsert(input, ctx));
  }
}
