# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Definido pela equipe: cliente PWA em React + TypeScript + Dexie (IndexedDB); portal em React + TypeScript; backend com clinical-service (TypeScript/NestJS), identity-service (Java/Spring Boot) e document-service (Python/FastAPI) atrás de Nginx, na VM da Univates.

## Users
- **Socorrista, médico ou enfermeiro do atendimento pré-hospitalar** (SAMU, ambulância de rodovia, equipes de desastre). Registra a ocorrência no local, muitas vezes sem sinal, de luvas, sob estresse, com o paciente na frente. Usa tablet ou celular na ambulância.
- **Central de regulação / administração.** No escritório, acompanha os atendimentos que chegam, consulta prontuários e cadastros de apoio e audita acessos.

## Product Purpose
Registrar a ficha de atendimento de emergência (sinais vitais, Glasgow, triagem START/Manchester, medicamentos administrados) no momento em que acontece, mesmo sem internet, e entregá-la íntegra ao hospital e à central quando a conexão volta. Sucesso: nenhum dado perdido, nenhum erro de medicação que a regra de segurança poderia ter evitado, e a ficha em PDF disponível para paciente ou familiar.

## Positioning
Offline-first de verdade: o dispositivo é a fonte primária do registro; a nuvem consolida. Regras de segurança clínica rodam no próprio dispositivo, sem rede.

## Operating Context
Trabalho final da disciplina Arquiteturas de Software (Univates, 2026/B). A apresentação segue um roteiro de 17 passos com o simulador de conectividade (chave Online/Offline) e o portal lado a lado.

## Capabilities and Constraints
- Chave "Simular conectividade" obrigatória no cliente.
- Portal administrativo é somente leitura; cadastros entram direto no banco.
- Todas as rotas autenticadas (CRM, COREN ou ID de socorrista), com log de acesso.
- Ficha em PDF e envio por e-mail com anexo.

## Brand Commitments
Nome: MedicalField. Sem logotipo prévio. Idioma: português do Brasil, vocabulário do APH (ocorrência, ficha, triagem, regulação, viatura).

## Evidence on Hand
Nenhum dado real de pacientes. Todos os pacientes, CPFs, telefones e e-mails do sistema são fictícios (dados de demonstração). Hospitais da região do Vale do Taquari aparecem apenas como cadastro de apoio de exemplo.

## Product Principles
1. O registro nunca espera a rede.
2. Segurança do paciente antes de conveniência: alerta clínico interrompe, justificativa fica registrada.
3. Estado sempre visível: o profissional sabe o que está só no aparelho e o que já chegou à central.
4. Linguagem de quem está na ocorrência, não de sistema.

## Accessibility & Inclusion
Uso sob estresse, com luvas, sob sol ou na cabine escura: alvos de toque ≥ 48 px no cliente, contraste AA no mínimo, cor nunca é o único portador de significado (a triagem sempre traz o nome da cor).
