# Surface: MedicalField Cliente (apps/client)

Scope: aplicação do socorrista (web responsiva). Mode: **Operate**. Build path: code-led, Bootstrap 5.3 + `packages/design/theme.css`.

Audience/job: registrar pessoa, prontuário e atendimento no local da ocorrência, online ou offline, e sincronizar com a central.
Important states: online, offline, sincronizando, pendente/na central/recusado por registro, medicamento bloqueado pela regra clínica, vazio.
Constraints: luvas e estresse (alvos grandes), luz variável (contraste alto), telas de 390 px a tablet.

## Direction contract

THESIS: Ficha de atendimento clara e clínica — tema claro, cartões brancos, azul hospitalar — com a rede tratada como estado sempre visível, não como erro.

OWN-WORLD: Atendimento pré-hospitalar real: fotos de ambulâncias do SAMU no login e no topo; cores de triagem reservadas ao significado e sempre com o nome escrito; alergias em faixa vermelha.

STORY: O socorrista entra, recebe os dados da central, registra a vítima em três etapas e percebe na hora quando está offline (faixa amarela e preta); ao religar, os pendentes viram “Na central” sozinhos.

FIRST VIEWPORT: Barra branca com a marca, o menu (Atendimentos, Pacientes, Sincronizar), o contador de pendentes e a chave Online/Offline. Abaixo, o banner com foto e as ações “Receber dados” e “Nova ocorrência”, seguido da lista de atendimentos.

FORM: Assinatura: faixa refletiva amarela e preta (traseira da viatura) sob a barra quando offline.

FINISH: revisado por capturas em 1366 px e 390 px (Playwright) e documentado em DESIGN.md.
