-- Roteiro de testes — passo 9: inserir novos medicamentos direto no banco.
-- O trigger fn_touch_sync preenche change_seq: o cliente recebe estes medicamentos
-- no próximo "Receber dados" (passo 11), sem nenhuma chamada à API.

INSERT INTO clinical.medicamento (nome, apresentacao, unidade, vias_permitidas, dose_maxima, alergenos)
VALUES ('Cetoprofeno', 'Frasco-ampola 100 mg', 'mg', '{IV}', 100, '{AINES}'),
       ('Salbutamol', 'Aerossol 100 mcg/jato', 'mcg', '{INALATORIA}', 400, '{}');

SELECT nome, change_seq FROM clinical.medicamento ORDER BY change_seq DESC LIMIT 2;
