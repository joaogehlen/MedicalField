-- O trigger de sincronização usa a sequência change_seq_global sem o nome do schema.
-- Fixar o search_path faz ele funcionar mesmo quando o INSERT vem de outro usuário
-- (ex.: o passo 9 do roteiro, rodado como "postgres" no psql).
ALTER FUNCTION fn_touch_sync() SET search_path = clinical, public;
