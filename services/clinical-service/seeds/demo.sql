-- Dados de demonstração (aplicados só quando o catálogo está vazio e SEED_DEMO=true).
-- Os profissionais referenciados são os criados pelo identity-service com ids fixos:
--   7a1f…0002 Dra. Ana Souza (CRM) · 7a1f…0003 Enf. Bruno Lima (COREN) · 7a1f…0004 Carla Mendes (socorrista)

INSERT INTO medicamento (id, nome, principio_ativo, apresentacao, unidade, vias_permitidas, dose_maxima_dose,
                         dose_maxima_diaria, intervalo_minimo_horas, controlado, contraindicacoes, alergenos) VALUES
 ('5e3d0000-0000-4000-8000-000000000001', 'Dipirona Sódica', 'Metamizol', 'Ampola 500 mg/mL · 2 mL', 'mg', '{IV,IM}', 1000, 4000, 6, false,
  '{"Alergia a pirazolonas","Discrasia sanguínea"}', '{DIPIRONA,METAMIZOL,PIRAZOLONAS}'),
 ('5e3d0000-0000-4000-8000-000000000002', 'Adrenalina', 'Epinefrina', 'Ampola 1 mg/mL · 1 mL', 'mg', '{IV,IM,IO}', 1, NULL, NULL, false,
  '{}', '{}'),
 ('5e3d0000-0000-4000-8000-000000000003', 'Morfina', 'Sulfato de morfina', 'Ampola 10 mg/mL · 1 mL', 'mg', '{IV,IM,SC}', 10, 60, 4, true,
  '{"Depressão respiratória","Hipotensão grave"}', '{MORFINA,OPIOIDES}'),
 ('5e3d0000-0000-4000-8000-000000000004', 'Midazolam', 'Midazolam', 'Ampola 5 mg/mL · 3 mL', 'mg', '{IV,IM,NASAL}', 10, 40, NULL, true,
  '{"Insuficiência respiratória grave"}', '{MIDAZOLAM,BENZODIAZEPINICOS}'),
 ('5e3d0000-0000-4000-8000-000000000005', 'Ondansetrona', 'Ondansetrona', 'Ampola 2 mg/mL · 4 mL', 'mg', '{IV,IM}', 8, 24, 8, false,
  '{"Síndrome do QT longo"}', '{ONDANSETRONA}'),
 ('5e3d0000-0000-4000-8000-000000000006', 'Soro Fisiológico 0,9%', 'Cloreto de sódio', 'Frasco 500 mL', 'mL', '{IV,IO}', 2000, 6000, NULL, false,
  '{}', '{}'),
 ('5e3d0000-0000-4000-8000-000000000007', 'AAS', 'Ácido acetilsalicílico', 'Comprimido 100 mg', 'mg', '{VO}', 300, 300, NULL, false,
  '{"Sangramento ativo","Úlcera péptica"}', '{AAS,"ACIDO ACETILSALICILICO",SALICILATOS}'),
 ('5e3d0000-0000-4000-8000-000000000008', 'Dinitrato de Isossorbida', 'Dinitrato de isossorbida', 'Comprimido sublingual 5 mg', 'mg', '{SL}', 5, 15, NULL, false,
  '{"Hipotensão","Uso de sildenafila nas últimas 24 h"}', '{NITRATOS}'),
 ('5e3d0000-0000-4000-8000-000000000009', 'Glicose 50%', 'Glicose', 'Ampola 50% · 10 mL', 'mL', '{IV}', 50, 100, NULL, false,
  '{}', '{}'),
 ('5e3d0000-0000-4000-8000-00000000000a', 'Diazepam', 'Diazepam', 'Ampola 5 mg/mL · 2 mL', 'mg', '{IV,RETAL}', 10, 30, NULL, true,
  '{"Insuficiência respiratória grave"}', '{DIAZEPAM,BENZODIAZEPINICOS}');

INSERT INTO hospital (id, nome, cidade, telefone) VALUES
 ('4b0e0000-0000-4000-8000-000000000001', 'Hospital Bruno Born', 'Lajeado', '(51) 3714-7500'),
 ('4b0e0000-0000-4000-8000-000000000002', 'Hospital Estrela', 'Estrela', '(51) 3720-6100'),
 ('4b0e0000-0000-4000-8000-000000000003', 'Hospital Ouro Branco', 'Teutônia', '(51) 3762-1300');

INSERT INTO viatura (id, prefixo, tipo, base) VALUES
 ('3c1a0000-0000-4000-8000-000000000001', 'USA 01', 'USA', 'Base Lajeado'),
 ('3c1a0000-0000-4000-8000-000000000002', 'USB 03', 'USB', 'Base Estrela');

INSERT INTO pessoa (id, nome, identificada, cpf, data_nascimento, sexo, telefone, email, contato_nome, contato_parentesco,
                    contato_telefone, contato_email, atualizado_em_cliente, registrado_por, sincronizado_por, dispositivo_id) VALUES
 ('2d4f0000-0000-4000-8000-000000000001', 'João Pedro da Silva', true, '12345678909', '1980-05-10', 'M', '(51) 99999-0101',
  'joao.silva@exemplo.com.br', 'Maria da Silva', 'Esposa', '(51) 98888-0101', 'maria.silva@exemplo.com.br',
  '2026-11-02T13:40:00Z', '7a1f0000-0000-4000-8000-000000000002', '7a1f0000-0000-4000-8000-000000000002', 'seed'),
 ('2d4f0000-0000-4000-8000-000000000002', 'Helena Martins Costa', true, '98765432100', '1957-09-23', 'F', '(51) 99777-0202',
  NULL, 'Rafael Costa', 'Filho', '(51) 98666-0202', 'rafael.costa@exemplo.com.br',
  '2026-11-05T08:12:00Z', '7a1f0000-0000-4000-8000-000000000003', '7a1f0000-0000-4000-8000-000000000003', 'seed');

INSERT INTO prontuario (id, pessoa_id, tipo_sanguineo, alergias, comorbidades, medicamentos_uso_continuo, observacoes,
                        atualizado_em_cliente, registrado_por, sincronizado_por, dispositivo_id) VALUES
 ('1a6b0000-0000-4000-8000-000000000001', '2d4f0000-0000-4000-8000-000000000001', 'O+', '{Dipirona}', '{"Hipertensão arterial"}',
  '{"Losartana 50 mg"}', NULL, '2026-11-02T13:41:00Z', '7a1f0000-0000-4000-8000-000000000002', '7a1f0000-0000-4000-8000-000000000002', 'seed'),
 ('1a6b0000-0000-4000-8000-000000000002', '2d4f0000-0000-4000-8000-000000000002', 'A-', '{}', '{"Diabetes tipo 2","Insuficiência cardíaca"}',
  '{"Metformina 850 mg","Furosemida 40 mg"}', 'Marcapasso desde 2019', '2026-11-05T08:13:00Z', '7a1f0000-0000-4000-8000-000000000003',
  '7a1f0000-0000-4000-8000-000000000003', 'seed');

INSERT INTO atendimento (id, pessoa_id, prontuario_id, viatura_id, hospital_destino_id, status, iniciado_em, finalizado_em,
                         local_descricao, latitude, longitude, queixa_principal, descricao, triagem_protocolo, triagem_classificacao,
                         glasgow_ocular, glasgow_verbal, glasgow_motora, glasgow_total, procedimentos,
                         atualizado_em_cliente, registrado_por, sincronizado_por, sincronizado_em, dispositivo_id) VALUES
 ('0f9c0000-0000-4000-8000-000000000001', '2d4f0000-0000-4000-8000-000000000001', '1a6b0000-0000-4000-8000-000000000001',
  '3c1a0000-0000-4000-8000-000000000001', '4b0e0000-0000-4000-8000-000000000001', 'FINALIZADO',
  '2026-11-02T13:35:00Z', '2026-11-02T14:10:00Z', 'BR-386, km 350 — Lajeado', -29.4485, -51.9617,
  'Colisão moto × carro', 'Vítima consciente, dor intensa em membro inferior direito, deformidade em tíbia. Sem perda de consciência relatada.',
  'START', 'AMARELO', 4, 4, 6, 14, '{"Imobilização de MID","Acesso venoso periférico","Colar cervical"}',
  '2026-11-02T14:10:00Z', '7a1f0000-0000-4000-8000-000000000002', '7a1f0000-0000-4000-8000-000000000002', '2026-11-02T14:10:30Z', 'seed'),
 ('0f9c0000-0000-4000-8000-000000000002', '2d4f0000-0000-4000-8000-000000000002', '1a6b0000-0000-4000-8000-000000000002',
  '3c1a0000-0000-4000-8000-000000000002', '4b0e0000-0000-4000-8000-000000000002', 'FINALIZADO',
  '2026-11-05T08:05:00Z', '2026-11-05T08:50:00Z', 'Rua Júlio de Castilhos, 1200 — Estrela', -29.5025, -51.9650,
  'Dor torácica há 40 minutos', 'Dor em aperto, irradiando para membro superior esquerdo, sudorese. ECG não disponível na USB.',
  'MANCHESTER', 'LARANJA', 4, 5, 6, 15, '{"Oxigenoterapia por cateter nasal","Monitorização"}',
  '2026-11-05T08:50:00Z', '7a1f0000-0000-4000-8000-000000000003', '7a1f0000-0000-4000-8000-000000000003', '2026-11-05T08:51:10Z', 'seed');

INSERT INTO sinal_vital (id, atendimento_id, aferido_em, pa_sistolica, pa_diastolica, fc, fr, spo2, temperatura, glicemia, dor) VALUES
 ('6c2e0000-0000-4000-8000-000000000001', '0f9c0000-0000-4000-8000-000000000001', '2026-11-02T13:38:00Z', 130, 85, 102, 20, 96, 36.4, 110, 8),
 ('6c2e0000-0000-4000-8000-000000000002', '0f9c0000-0000-4000-8000-000000000001', '2026-11-02T13:58:00Z', 124, 80, 94, 18, 97, 36.5, NULL, 5),
 ('6c2e0000-0000-4000-8000-000000000003', '0f9c0000-0000-4000-8000-000000000002', '2026-11-05T08:09:00Z', 158, 96, 108, 22, 93, 36.1, 214, 7);

INSERT INTO administracao_medicamento (id, atendimento_id, medicamento_id, dose, unidade, via, administrado_em, administrado_por, observacao) VALUES
 ('7d3f0000-0000-4000-8000-000000000001', '0f9c0000-0000-4000-8000-000000000001', '5e3d0000-0000-4000-8000-000000000003', 4, 'mg', 'IV',
  '2026-11-02T13:45:00Z', '7a1f0000-0000-4000-8000-000000000002', 'Analgesia; paciente alérgico a dipirona'),
 ('7d3f0000-0000-4000-8000-000000000002', '0f9c0000-0000-4000-8000-000000000002', '5e3d0000-0000-4000-8000-000000000007', 300, 'mg', 'VO',
  '2026-11-05T08:12:00Z', '7a1f0000-0000-4000-8000-000000000003', 'Mastigado'),
 ('7d3f0000-0000-4000-8000-000000000003', '0f9c0000-0000-4000-8000-000000000002', '5e3d0000-0000-4000-8000-000000000008', 5, 'mg', 'SL',
  '2026-11-05T08:15:00Z', '7a1f0000-0000-4000-8000-000000000003', NULL);
