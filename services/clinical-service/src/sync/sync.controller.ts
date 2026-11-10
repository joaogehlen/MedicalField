import { Controller, Get, Query } from '@nestjs/common';
import type { PullResponse } from '@medicalfield/shared';
import { DatabaseService } from '../db/database.service';
import { medicamentoDeLinha, pessoaDeLinha, prontuarioDeLinha } from '../common/mappers';
import { carregarAtendimentos } from '../atendimento/atendimento.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Pull por cursor: devolve tudo o que mudou depois de `cursor` (change_seq), inclusive
   * o que foi inserido direto no banco. O aparelho guarda `proximoCursor`.
   */
  @Get('pull')
  async pull(@Query('cursor') cursorQ?: string): Promise<PullResponse> {
    const cursor = Math.max(0, Number(cursorQ) || 0);
    const desde = (tabela: string) => this.db.query(`SELECT * FROM ${tabela} WHERE change_seq > $1 ORDER BY change_seq`, [cursor]);
    const [medicamentos, pessoas, prontuarios, atendimentos] = await Promise.all(
      ['medicamento', 'pessoa', 'prontuario', 'atendimento'].map(desde),
    );
    const maior = Math.max(cursor, ...[medicamentos, pessoas, prontuarios, atendimentos].flat().map((l) => Number(l.change_seq)));
    return {
      medicamentos: medicamentos.map(medicamentoDeLinha),
      pessoas: pessoas.map(pessoaDeLinha),
      prontuarios: prontuarios.map(prontuarioDeLinha),
      atendimentos: await carregarAtendimentos(this.db, atendimentos.map((a) => a.id)),
      proximoCursor: maior,
    };
  }
}
