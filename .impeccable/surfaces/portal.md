# Surface: MedicalField Portal (apps/portal)

Scope: área administrativa da central de regulação. Mode: **Operate**. Build path: code-led.

Audience/job: acompanhar atendimentos recebidos, consultar prontuários e cadastros de apoio, auditar acessos e conflitos; gerar/enviar ficha.
Important states: lista vazia, carregando, erro de rede, registro criado offline (selo), alerta de alergia, filtros sem resultado.
Constraints: desktop, sessões longas, leitura densa.

## Direction contract

THESIS: O quadro da central de regulação: o que chegou, de quem, com qual gravidade — lido em segundos. Recusa o dashboard de métricas com cards e gráficos decorativos.

OWN-WORLD: O mesmo mundo do cliente (farda azul-marinho, papel frio, tinta azul-noite, cores de triagem só com significado, Atkinson Hyperlegible Next + Mono), em densidade de escritório: tabelas de 40 px por linha, 14–15 px de corpo.

STORY: O regulador abre o portal, filtra por gravidade ou período, abre um atendimento e vê a ficha completa — alergias em destaque, sinais vitais em série, medicamentos com horário e profissional — e emite o PDF ou envia ao familiar.

FIRST VIEWPORT: Barra superior azul-marinho com navegação em abas (Atendimentos, Prontuários, Cadastros, Auditoria) e o profissional logado. Conteúdo: filtros em linha sobre a tabela de atendimentos; cada linha começa pela etiqueta de triagem.

FORM: Quadro de regulação / livro de ocorrências. Assinatura compartilhada com o cliente: a etiqueta de triagem com ilhós, e o selo "registrado offline" com a faixa chevron em miniatura. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
