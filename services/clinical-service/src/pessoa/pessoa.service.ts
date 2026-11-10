import { HttpStatus, Injectable } from '@nestjs/common';
import { somenteDigitos, type Pessoa, type PessoaInput } from '@medicalfield/shared';
import type { Db } from '../db/database.service';
import { ApiError } from '../common/errors';
import { pessoaDeLinha } from '../common/mappers';
import { LastWriteWinsStrategy } from '../sync/strategies';
import { houveConflito, SyncSupport, type RespostaGravada } from '../sync/sync-support';

@Injectable()
export class PessoaService {
  private readonly estrategia = new LastWriteWinsStrategy<Pessoa>();

  constructor(private readonly sync: SyncSupport) {}

  /** Cadastra ou atualiza (upsert idempotente pelo id gerado no aparelho). */
  upsert(input: PessoaInput, opId: string | null) {
    return this.sync.executar(opId, (tx) => this.gravar(tx, input));
  }

  private async gravar(tx: Db, input: PessoaInput): Promise<RespostaGravada> {
    const recebido: Pessoa = { ...input, cpf: somenteDigitos(input.cpf) || null };
    const linha = await tx.one('SELECT * FROM pessoa WHERE id = $1 FOR UPDATE', [input.id]);
    if (!linha) {
      const r = await tx
        .one(
          `INSERT INTO pessoa (id, nome, cpf, data_nascimento, sexo, telefone, email, contato_nome, contato_email,
             atualizado_em_cliente, registrado_por, dispositivo_id, criado_offline)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [recebido.id, recebido.nome, recebido.cpf, recebido.dataNascimento, recebido.sexo, recebido.telefone, recebido.email,
            recebido.contatoNome, recebido.contatoEmail, recebido.atualizadoEmCliente, recebido.registradoPor, recebido.dispositivoId,
            recebido.criadoOffline ?? false],
        )
        .catch(cpfDuplicado);
      return { status: HttpStatus.CREATED, corpo: { resultado: 'CRIADO', registro: pessoaDeLinha(r) } };
    }

    const servidor = pessoaDeLinha(linha);
    const conflito = houveConflito(servidor.version!, input.baseVersion);
    const final = conflito ? this.estrategia.resolve(servidor, recebido) : recebido;
    const r = await tx
      .one(
        `UPDATE pessoa SET nome=$2, cpf=$3, data_nascimento=$4, sexo=$5, telefone=$6, email=$7, contato_nome=$8,
           contato_email=$9, atualizado_em_cliente=$10, sincronizado_em=now() WHERE id=$1 RETURNING *`,
        [final.id, final.nome, final.cpf, final.dataNascimento, final.sexo, final.telefone, final.email, final.contatoNome,
          final.contatoEmail, final.atualizadoEmCliente],
      )
      .catch(cpfDuplicado);
    const salvo = pessoaDeLinha(r);
    if (conflito) await this.sync.registrarConflito(tx, 'PESSOA', salvo.id, this.estrategia.nome, servidor, recebido, salvo);
    return { status: HttpStatus.OK, corpo: { resultado: conflito ? 'MESCLADO' : 'ATUALIZADO', registro: salvo } };
  }
}

function cpfDuplicado(e: { constraint?: string }): never {
  if (e.constraint === 'pessoa_cpf_key') {
    throw new ApiError(HttpStatus.CONFLICT, 'CPF_DUPLICADO', 'CPF já cadastrado', 'Já existe outra pessoa com este CPF.');
  }
  throw e;
}
