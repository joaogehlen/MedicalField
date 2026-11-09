import { Controller, Get, Query } from '@nestjs/common';
import type { PullResponse, SyncConflito } from '@medicalfield/shared';
import { DatabaseService } from '../db/database.service';
import { Papeis } from '../common/auth';
import { paginacao } from '../common/http';
import {
  hospitalDeLinha,
  medicamentoDeLinha,
  pessoaDeLinha,
  prontuarioDeLinha,
  viaturaDeLinha,
} from '../common/mappers';
import { carregarCompletos } from '../atendimento/atendimento.service';

const TABELAS = ['medicamento', 'hospital', 'viatura', 'pessoa', 'prontuario', 'atendimento'] as const;

@Controller('sync')
export class SyncController {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Pull por cursor: tudo o que mudou depois de `cursor`, em ordem de change_seq.
   * Pega os `limite` primeiros de cada tabela e corta no limite global — assim o
   * próximo cursor nunca pula mudanças.
   */
  @Get('pull')
  async pull(@Query('cursor') cursorQ?: string, @Query('limite') limiteQ?: string): Promise<PullResponse> {
    const cursor = Math.max(0, Number(cursorQ) || 0);
    const limite = Math.min(1000, Math.max(1, Number(limiteQ) || 500));
    const porTabela = await Promise.all(
      TABELAS.map(async (t) =>
        (await this.db.query(`SELECT * FROM ${t} WHERE change_seq > $1 ORDER BY change_seq LIMIT $2`, [cursor, limite + 1])).map(
          (linha) => ({ t, linha }),
        ),
      ),
    );
    const todas = porTabela.flat().sort((a, b) => a.linha.change_seq - b.linha.change_seq);
    const temMais = todas.length > limite;
    const pagina = todas.slice(0, limite);
    const de = (t: (typeof TABELAS)[number]) => pagina.filter((x) => x.t === t).map((x) => x.linha);

    return {
      medicamentos: de('medicamento').map(medicamentoDeLinha),
      hospitais: de('hospital').map(hospitalDeLinha),
      viaturas: de('viatura').map(viaturaDeLinha),
      pessoas: de('pessoa').map(pessoaDeLinha),
      prontuarios: de('prontuario').map(prontuarioDeLinha),
      atendimentos: await carregarCompletos(this.db, de('atendimento').map((l) => l.id)),
      proximoCursor: pagina.length ? pagina[pagina.length - 1].linha.change_seq : cursor,
      temMais,
    };
  }

  /** Conflitos resolvidos automaticamente (auditoria no portal). */
  @Get('conflito')
  @Papeis('ADMIN')
  async conflitos(@Query() q: { pagina?: string; tamanho?: string }) {
    const p = paginacao(q, 20);
    const total = await this.db.one<{ n: number }>('SELECT count(*)::int n FROM sync_conflito');
    const linhas = await this.db.query('SELECT * FROM sync_conflito ORDER BY resolvido_em DESC LIMIT $1 OFFSET $2', [
      p.tamanho,
      p.offset,
    ]);
    const itens: SyncConflito[] = linhas.map((r) => ({
      id: r.id,
      opId: r.op_id,
      entidade: r.entidade,
      entidadeId: r.entidade_id,
      estrategia: r.estrategia,
      versaoServidor: r.versao_servidor,
      versaoBaseCliente: r.versao_base_cliente,
      valorServidor: r.valor_servidor,
      valorRecebido: r.valor_recebido,
      valorResultante: r.valor_resultante,
      resolvidoEm: new Date(r.resolvido_em).toISOString(),
    }));
    return { itens, pagina: p.pagina, tamanho: p.tamanho, total: total?.n ?? 0 };
  }
}
