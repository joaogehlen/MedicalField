# Surface: MedicalField Portal (apps/portal)

Scope: área da central de regulação. Mode: **Operate**. Build path: code-led, Bootstrap 5.3 + `packages/design/theme.css`.

Audience/job: acompanhar os atendimentos recebidos, consultar prontuários e cadastros, gerar a ficha em PDF e enviá-la ao familiar.
Important states: carregando, lista vazia, busca sem resultado, registro criado offline (selo), alergia, envio de e-mail ok/falhou.
Constraints: desktop, leitura densa.

## Direction contract

THESIS: O quadro da central: o que chegou, de quem, com qual gravidade — lido em segundos, em tabelas claras. Sem painel de métricas decorativo.

OWN-WORLD: Mesmo tema claro do cliente; login com foto do interior de uma ambulância do SAMU.

STORY: A central entra, vê os atendimentos com a etiqueta de triagem, abre um, gera a ficha e envia ao familiar com o e-mail já preenchido.

FIRST VIEWPORT: Barra com a marca “MedicalField Central” e o menu (Atendimentos, Prontuários, Cadastros); tabela de atendimentos com busca.

FINISH: revisado por capturas em 1366 px e 390 px (Playwright) e documentado em DESIGN.md.
