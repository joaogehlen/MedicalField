-- Dados de demonstração (aplicados quando o catálogo está vazio e SEED_DEMO=true).
-- Profissionais com ids fixos criados pelo identity-service: 7a1f…0002 Dra. Ana Souza, 7a1f…0003 Enf. Bruno Lima.

INSERT INTO medicamento (id, nome, apresentacao, unidade, vias_permitidas, dose_maxima, alergenos) VALUES
 ('5e3d0000-0000-4000-8000-000000000001', 'Dipirona', 'Ampola 500 mg/mL · 2 mL', 'mg', '{IV,IM}', 1000, '{METAMIZOL,PIRAZOLONAS}'),
 ('5e3d0000-0000-4000-8000-000000000002', 'Adrenalina', 'Ampola 1 mg/mL', 'mg', '{IV,IM,IO}', 1, '{}'),
 ('5e3d0000-0000-4000-8000-000000000003', 'Morfina', 'Ampola 10 mg/mL', 'mg', '{IV,IM,SC}', 10, '{OPIOIDES}'),
 ('5e3d0000-0000-4000-8000-000000000004', 'Ondansetrona', 'Ampola 2 mg/mL · 4 mL', 'mg', '{IV,IM}', 8, '{}'),
 ('5e3d0000-0000-4000-8000-000000000005', 'Soro fisiológico 0,9%', 'Frasco 500 mL', 'mL', '{IV,IO}', 2000, '{}'),
 ('5e3d0000-0000-4000-8000-000000000006', 'AAS', 'Comprimido 100 mg', 'mg', '{VO}', 300, '{SALICILATOS,ACIDO ACETILSALICILICO}'),
 ('5e3d0000-0000-4000-8000-000000000007', 'Dinitrato de isossorbida', 'Comprimido sublingual 5 mg', 'mg', '{SL}', 5, '{NITRATOS}'),
 ('5e3d0000-0000-4000-8000-000000000008', 'Glicose 50%', 'Ampola 10 mL', 'mL', '{IV}', 50, '{}');

INSERT INTO pessoa (id, nome, cpf, data_nascimento, sexo, telefone, email, contato_nome, contato_email,
                    atualizado_em_cliente, registrado_por, dispositivo_id) VALUES
 ('2d4f0000-0000-4000-8000-000000000001', 'João Pedro da Silva', '12345678909', '1980-05-10', 'M', '(51) 99999-0101',
  'joao.silva@exemplo.com.br', 'Maria da Silva', 'maria.silva@exemplo.com.br',
  '2026-11-02T13:40:00Z', '7a1f0000-0000-4000-8000-000000000002', 'seed'),
 ('2d4f0000-0000-4000-8000-000000000002', 'Helena Martins Costa', '98765432100', '1957-09-23', 'F', '(51) 99777-0202',
  NULL, 'Rafael Costa', 'rafael.costa@exemplo.com.br',
  '2026-11-05T08:12:00Z', '7a1f0000-0000-4000-8000-000000000003', 'seed');

INSERT INTO prontuario (id, pessoa_id, tipo_sanguineo, alergias, comorbidades, observacoes,
                        atualizado_em_cliente, registrado_por, dispositivo_id) VALUES
 ('1a6b0000-0000-4000-8000-000000000001', '2d4f0000-0000-4000-8000-000000000001', 'O+', '{Dipirona}', '{"Hipertensão arterial"}', NULL,
  '2026-11-02T13:41:00Z', '7a1f0000-0000-4000-8000-000000000002', 'seed'),
 ('1a6b0000-0000-4000-8000-000000000002', '2d4f0000-0000-4000-8000-000000000002', 'A-', '{}', '{"Diabetes tipo 2","Insuficiência cardíaca"}',
  'Marcapasso desde 2019', '2026-11-05T08:13:00Z', '7a1f0000-0000-4000-8000-000000000003', 'seed');

INSERT INTO atendimento (id, pessoa_id, prontuario_id, data_hora, local, queixa_principal, observacoes,
                         triagem_protocolo, triagem_classificacao, glasgow_ocular, glasgow_verbal, glasgow_motora, glasgow_total,
                         pa_sistolica, pa_diastolica, fc, fr, spo2, temperatura, glicemia, profissional_nome,
                         atualizado_em_cliente, registrado_por, dispositivo_id) VALUES
 ('0f9c0000-0000-4000-8000-000000000001', '2d4f0000-0000-4000-8000-000000000001', '1a6b0000-0000-4000-8000-000000000001',
  '2026-11-02T13:35:00Z', 'BR-386, km 350 — Lajeado', 'Colisão moto × carro',
  'Consciente, dor intensa em membro inferior direito. Imobilizado e removido ao hospital.',
  'START', 'AMARELO', 4, 4, 6, 14, 130, 85, 102, 20, 96, 36.4, 110, 'Dra. Ana Souza · CRM 12345/RS',
  '2026-11-02T14:10:00Z', '7a1f0000-0000-4000-8000-000000000002', 'seed'),
 ('0f9c0000-0000-4000-8000-000000000002', '2d4f0000-0000-4000-8000-000000000002', '1a6b0000-0000-4000-8000-000000000002',
  '2026-11-05T08:05:00Z', 'Rua Júlio de Castilhos, 1200 — Estrela', 'Dor torácica há 40 minutos',
  'Dor em aperto irradiando para o braço esquerdo, sudorese.',
  'MANCHESTER', 'LARANJA', 4, 5, 6, 15, 158, 96, 108, 22, 93, 36.1, 214, 'Enf. Bruno Lima · COREN 54321/RS',
  '2026-11-05T08:50:00Z', '7a1f0000-0000-4000-8000-000000000003', 'seed');

INSERT INTO medicamento_administrado (id, atendimento_id, medicamento_id, dose, via, horario) VALUES
 ('7d3f0000-0000-4000-8000-000000000001', '0f9c0000-0000-4000-8000-000000000001', '5e3d0000-0000-4000-8000-000000000003', 4, 'IV', '2026-11-02T13:45:00Z'),
 ('7d3f0000-0000-4000-8000-000000000002', '0f9c0000-0000-4000-8000-000000000002', '5e3d0000-0000-4000-8000-000000000006', 300, 'VO', '2026-11-05T08:12:00Z');
