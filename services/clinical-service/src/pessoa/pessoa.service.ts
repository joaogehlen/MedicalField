import { HttpStatus, Injectable } from '@nestjs/common';
import { somenteDigitos, type Page, type Pessoa, type PessoaInput, type UpsertResponse } from '@medicalfield/shared';
import { DatabaseService, type Db } from '../db/database.service';
import { ApiError } from '../common/errors';
import { pessoaDeLinha } from '../common/mappers';
import { FieldMergeStrategy } from '../sync/strategies';
import { houveConflito, SyncSupport, type ContextoEscrita, type RespostaGravada } from '../sync/sync-support';

const CAMPOS: (keyof Pessoa)[] = [
  'nome', 'identificada', 'cpf', 'dataNascimento', 'sexo', 'telefone', 'email', 'contatoNome',
  'contatoParentesco', 'contatoTelefone', 'contatoEmail', 'caracteristicas',
];

@Injectable()
export class PessoaService {
  private readonly merge = new FieldMergeStrategy<Pessoa>(CAMPOS);

  constructor(private readonly db: DatabaseService, private readonly sync: SyncSupport) {}

  async listar(busca: string | undefined, pagina: number, tamanho: number, offset: number): Promise<Page<Pessoa>> {
    const filtro = busca?.trim() ? `%${busca.trim()}%` : null;
    const where = `WHERE mesclada_em IS NULL AND NOT excluido
      AND ($1::text IS NULL OR nome ILIKE $1 OR cpf LIKE regexp_replace($1, '[^0-9%]', '', 'g'))`;
    const total = await this.db.one<{ n: number }>(`SELECT count(*)::int n FROM pessoa ${where}`, [filtro]);
    const linhas = await this.db.query(`SELECT * FROM pessoa ${where} ORDER BY nome LIMIT $2 OFFSET $3`, [filtro, tamanho, offset]);
    return { itens: linhas.map(pessoaDeLinha), pagina, tamanho, total: total?.n ?? 0 };
  }

  async obter(id: string): Promise<Pessoa> {
    const r = await this.db.one('SELECT * FROM pessoa WHERE id = $1', [id]);
    if (!r) throw ApiError.naoEncontrado('Pessoa');
    return pessoaDeLinha(r);
  }

  /** Upsert idempotente com resolução de conflito (FieldMerge) e mescla por CPF duplicado. */
  upsert(input: PessoaInput, ctx: ContextoEscrita) {
    return this.sync.executar(ctx, 'PESSOA', input.id, (tx) => this.gravar(tx, input, ctx));
  }

  private async gravar(tx: Db, input: PessoaInput, ctx: ContextoEscrita): Promise<RespostaGravada> {
    const recebido: Pessoa = { ...input, cpf: somenteDigitos(input.cpf) || null };
    const linha = await tx.one('SELECT * FROM pessoa WHERE id = $1 FOR UPDATE', [input.id]);

    if (!linha) {
      const duplicada = recebido.cpf
        ? await tx.one('SELECT * FROM pessoa WHERE cpf = $1 AND mesclada_em IS NULL FOR UPDATE', [recebido.cpf])
        : null;
      if (duplicada) return this.mesclarDuplicada(tx, pessoaDeLinha(duplicada), recebido, ctx);
      const criada = await this.inserir(tx, recebido, ctx, null);
      return resposta(HttpStatus.CREATED, { resultado: 'CRIADO', registro: criada });
    }

    const servidor = pessoaDeLinha(linha);
    if (!houveConflito(servidor.version!, input.baseVersion)) {
      return resposta(HttpStatus.OK, { resultado: 'ATUALIZADO', registro: await this.atualizar(tx, recebido, ctx) });
    }
    const resolvido = this.merge.resolve(servidor, recebido);
    const salvo = await this.atualizar(tx, resolvido, ctx);
    await this.sync.registrarConflito(tx, ctx, {
      entidade: 'PESSOA', entidadeId: servidor.id, estrategia: this.merge.nome, versaoServidor: servidor.version!,
      versaoBaseCliente: input.baseVersion, valorServidor: servidor, valorRecebido: recebido, valorResultante: salvo,
    });
    return resposta(HttpStatus.OK, { resultado: 'MESCLADO', registro: salvo });
  }

  /**
   * Duas equipes cadastraram a mesma vítima (mesmo CPF) offline: a primeira fica
   * canônica, os dados são mesclados nela e o novo id passa a apontar para ela.
   */
  private async mesclarDuplicada(tx: Db, canonica: Pessoa, recebido: Pessoa, ctx: ContextoEscrita): Promise<RespostaGravada> {
    const resolvido = this.merge.resolve(canonica, { ...recebido, id: canonica.id });
    const salvo = await this.atualizar(tx, resolvido, ctx);
    await this.inserir(tx, recebido, ctx, canonica.id);
    await this.sync.registrarConflito(tx, ctx, {
      entidade: 'PESSOA', entidadeId: canonica.id, estrategia: this.merge.nome, versaoServidor: canonica.version!,
      versaoBaseCliente: null, valorServidor: canonica, valorRecebido: recebido, valorResultante: salvo,
    });
    return resposta(HttpStatus.OK, { resultado: 'MESCLADO_EM', registro: salvo, idCanonico: canonica.id });
  }

  private async inserir(tx: Db, p: Pessoa, ctx: ContextoEscrita, mescladaEm: string | null): Promise<Pessoa> {
    const r = await tx.one(
      `INSERT INTO pessoa (id, nome, identificada, cpf, data_nascimento, sexo, telefone, email, contato_nome,
         contato_parentesco, contato_telefone, contato_email, caracteristicas, mesclada_em, atualizado_em_cliente,
         registrado_por, sincronizado_por, dispositivo_id, criado_offline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [p.id, p.nome, p.identificada, p.cpf, p.dataNascimento, p.sexo, p.telefone, p.email, p.contatoNome,
        p.contatoParentesco, p.contatoTelefone, p.contatoEmail, p.caracteristicas, mescladaEm, p.atualizadoEmCliente,
        p.registradoPor, ctx.profissionalId, p.dispositivoId, p.criadoOffline ?? false],
    ).catch(cpfDuplicado);
    return pessoaDeLinha(r!);
  }

  private async atualizar(tx: Db, p: Pessoa, ctx: ContextoEscrita): Promise<Pessoa> {
    const r = await tx.one(
      `UPDATE pessoa SET nome=$2, identificada=$3, cpf=$4, data_nascimento=$5, sexo=$6, telefone=$7, email=$8,
         contato_nome=$9, contato_parentesco=$10, contato_telefone=$11, contato_email=$12, caracteristicas=$13,
         atualizado_em_cliente=$14, sincronizado_por=$15
       WHERE id=$1 RETURNING *`,
      [p.id, p.nome, p.identificada, p.cpf, p.dataNascimento, p.sexo, p.telefone, p.email, p.contatoNome,
        p.contatoParentesco, p.contatoTelefone, p.contatoEmail, p.caracteristicas, p.atualizadoEmCliente, ctx.profissionalId],
    ).catch(cpfDuplicado);
    return pessoaDeLinha(r!);
  }
}

function resposta(status: number, corpo: UpsertResponse<Pessoa>): RespostaGravada {
  return { status, corpo };
}

function cpfDuplicado(e: { constraint?: string }): never {
  if (e.constraint === 'ux_pessoa_cpf') {
    throw new ApiError(HttpStatus.CONFLICT, 'CPF_DUPLICADO', 'CPF já cadastrado', 'Já existe outra pessoa com este CPF.');
  }
  throw e;
}
