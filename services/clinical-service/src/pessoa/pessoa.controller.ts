import { Body, Controller, Headers, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { pessoaSchema } from '@medicalfield/shared';
import { responder } from '../common/http';
import { validar } from '../common/zod';
import { chaveIdempotencia } from '../sync/sync-support';
import { PessoaService } from './pessoa.service';

@Controller('pessoa')
export class PessoaController {
  constructor(private readonly pessoas: PessoaService) {}

  /** Cadastra nova pessoa (ou atualiza, se o id já existir). */
  @Post()
  async cadastrar(@Body() body: unknown, @Headers() headers: Record<string, string>, @Res({ passthrough: true }) res: Response) {
    return responder(res, await this.pessoas.upsert(validar(pessoaSchema, body), chaveIdempotencia(headers)));
  }
}
