import type { Db } from '../db/database.service';

/** Segue a cadeia de mescla (duplicatas apontam para o registro canônico). */
export async function pessoaCanonica(tx: Db, id: string): Promise<string | null> {
  const r = await tx.one<{ id: string }>(
    `WITH RECURSIVE c AS (SELECT id, mesclada_em FROM pessoa WHERE id = $1
       UNION ALL SELECT p.id, p.mesclada_em FROM pessoa p JOIN c ON p.id = c.mesclada_em)
     SELECT id FROM c WHERE mesclada_em IS NULL LIMIT 1`,
    [id],
  );
  return r?.id ?? null;
}

export async function prontuarioCanonico(tx: Db, id: string): Promise<string | null> {
  const r = await tx.one<{ id: string }>(
    `WITH RECURSIVE c AS (SELECT id, mesclado_em FROM prontuario WHERE id = $1
       UNION ALL SELECT p.id, p.mesclado_em FROM prontuario p JOIN c ON p.id = c.mesclado_em)
     SELECT id FROM c WHERE mesclado_em IS NULL LIMIT 1`,
    [id],
  );
  return r?.id ?? null;
}
