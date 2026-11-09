-- Roteiro de testes — passo 9: inserir novos medicamentos direto no banco.
-- Executar:  psql -U mf_clinical -h 127.0.0.1 -d medicalfield -f passo-09-novos-medicamentos.sql
-- O trigger fn_touch_sync preenche change_seq/version: o cliente recebe estes
-- medicamentos no próximo "Receber dados" (passo 11), sem nenhuma chamada à API.

INSERT INTO clinical.medicamento (nome, principio_ativo, apresentacao, unidade, vias_permitidas,
                                  dose_maxima_dose, dose_maxima_diaria, intervalo_minimo_horas, alergenos)
VALUES ('Cetoprofeno', 'Cetoprofeno', 'Frasco-ampola 100 mg', 'mg', '{IV}', 100, 300, 8, '{CETOPROFENO,AINES}'),
       ('Salbutamol', 'Salbutamol', 'Aerossol 100 mcg/jato', 'mcg', '{INALATORIA}', 400, 3200, NULL, '{SALBUTAMOL}');

SELECT nome, change_seq, version FROM clinical.medicamento ORDER BY change_seq DESC LIMIT 2;
