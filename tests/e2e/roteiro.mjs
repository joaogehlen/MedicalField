/**
 * Roteiro de testes do trabalho (17 passos), executado no navegador: o portal e o
 * cliente rodam lado a lado, como na apresentação.
 *
 *   cd tests/e2e && npm install && npx playwright install chromium   (uma vez)
 *   node roteiro.mjs
 *
 * Variáveis: MF_URL (padrão http://localhost:8080), CHROMIUM_PATH (opcional),
 * MF_SENHA (senha dos profissionais de demonstração, padrão "medicalfield").
 * Pressupõe o banco recém-zerado (infra/scripts/reset-db.sh + start-all.sh).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL_BASE = process.env.MF_URL ?? 'http://localhost:8080';
const SENHA = process.env.MF_SENHA ?? 'medicalfield';
const CAPTURAS = join(RAIZ, '.runtime', 'roteiro');
mkdirSync(CAPTURAS, { recursive: true });

const resultados = [];
async function passo(n, titulo, fn) {
  const inicio = Date.now();
  try {
    const obs = await fn();
    resultados.push({ n, titulo, ok: true, obs });
    console.log(`✔ ${String(n).padStart(2)} ${titulo}${obs ? ` — ${obs}` : ''} (${Date.now() - inicio} ms)`);
  } catch (e) {
    resultados.push({ n, titulo, ok: false, obs: e.message });
    console.log(`✘ ${String(n).padStart(2)} ${titulo} — ${e.message.split('\n')[0]}`);
    throw e;
  }
}
const esperar = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const env = (arq) =>
  Object.fromEntries(
    readFileSync(join(RAIZ, '.runtime', 'env', arq), 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
  );

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--disable-background-networking', '--disable-component-update'],
});
const contexto = (vp) => browser.newContext({ viewport: vp, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true });
const portal = await (await contexto({ width: 1440, height: 900 })).newPage();
const cliente = await (await contexto({ width: 430, height: 932 })).newPage();
const foto = (p, nome) => p.screenshot({ path: join(CAPTURAS, `${nome}.png`), fullPage: true });
const irPortal = async (aba) => {
  await portal.click(`.barra-nav a:has-text("${aba}")`);
  await portal.waitForLoadState('networkidle');
};
const irCliente = (t) => cliente.locator('a:visible', { hasText: t }).first().click();
const linhasTabela = () => portal.locator('.tabela tbody tr').count();
const textoTabela = () => portal.locator('.tabela tbody').innerText();
const NOVA_VITIMA = 'Carlos Eduardo Ramos';

let atendimentosAntes = 0;
let medicamentosAntes = 0;

try {
  await passo(1, 'Portal: autenticar', async () => {
    await portal.goto(`${URL_BASE}/portal/`);
    await portal.fill('#numero', '0001');
    await portal.fill('#senha', SENHA);
    await portal.click('button[type=submit]');
    await portal.waitForSelector('.barra-nav');
    await foto(portal, '01-portal-login');
    return 'Central de Regulação (ADMIN)';
  });

  await passo(2, 'Portal: listar cadastros', async () => {
    await irPortal('Cadastros');
    await portal.waitForSelector('.tabela tbody tr');
    medicamentosAntes = await linhasTabela();
    await foto(portal, '02-portal-cadastros');
    return `${medicamentosAntes} medicamentos`;
  });

  await passo(3, 'Portal: listar prontuários', async () => {
    await irPortal('Prontuários');
    await portal.waitForSelector('.tabela tbody tr');
    await foto(portal, '03-portal-prontuarios');
    return `${await linhasTabela()} prontuários`;
  });

  await passo(4, 'Portal: listar atendimentos', async () => {
    await irPortal('Atendimentos');
    await portal.waitForSelector('.tabela tbody tr');
    atendimentosAntes = await linhasTabela();
    await foto(portal, '04-portal-atendimentos');
    return `${atendimentosAntes} atendimentos`;
  });

  await passo(5, 'Cliente: autenticar', async () => {
    await cliente.goto(`${URL_BASE}/app/`);
    await cliente.waitForURL(/entrar/);
    await cliente.fill('#numero', '12345');
    await cliente.fill('#senha', SENHA);
    await cliente.click('button[type=submit]');
    await cliente.waitForSelector('.casca .chave-rede');
    await foto(cliente, '05-cliente-login');
    return 'Dra. Ana Souza (CRM 12345/RS)';
  });

  await passo(6, 'Cliente: sincronizar dados a partir do portal (receber)', async () => {
    await irCliente('Sincronização');
    await cliente.click('text=Receber dados da central');
    await cliente.waitForSelector('text=recebido agora');
    const meds = await cliente.locator('.numero-grande').nth(1).innerText();
    esperar(Number(meds) === medicamentosAntes, `esperava ${medicamentosAntes} medicamentos, recebeu ${meds}`);
    await foto(cliente, '06-cliente-recebido');
    return `${meds} medicamentos no aparelho`;
  });

  async function preencherAtendimento(d) {
    await cliente.waitForSelector('#queixa');
    await cliente.fill('#local', d.local);
    await cliente.fill('#queixa', d.queixa);
    if (d.protocolo) await cliente.locator('label.segmento', { hasText: d.protocolo }).click();
    await cliente.locator('.escolha-triagem label', { hasText: d.cor }).click();
    const gs = cliente.locator('fieldset.glasgow');
    for (let i = 0; i < 3; i++) await gs.nth(i).locator('label', { hasText: d.glasgow[i] }).first().click();
    await cliente.fill('#v-paSistolica', d.pa[0]);
    await cliente.fill('#v-paDiastolica', d.pa[1]);
    await cliente.fill('#v-fc', d.fc);
    await cliente.fill('#v-spo2', d.spo2);
    await cliente.click('text=Registrar aferição');
  }
  async function administrar(rotulo, dose, via) {
    await cliente.selectOption('#m-med', { label: rotulo });
    await cliente.fill('#m-dose', dose);
    if (via) await cliente.selectOption('#m-via', via);
  }

  await passo(7, 'Cliente: online — registrar um atendimento', async () => {
    await irCliente('Pacientes');
    await cliente.locator('.ocorrencia', { hasText: 'João Pedro' }).click();
    await cliente.click('text=Novo atendimento');
    await preencherAtendimento({ local: 'RS-130, km 72 — Lajeado', queixa: 'Dor lombar após queda da própria altura', cor: 'Verde', glasgow: ['Espontânea', 'Orientado', 'Obedece'], pa: ['138', '88'], fc: '88', spo2: '98' });
    await administrar('Ondansetrona — Ampola 2 mg/mL · 4 mL', '4', 'IV');
    await cliente.click('text=Registrar administração');
    await cliente.click('text=Finalizar atendimento');
    await cliente.waitForSelector('.selo-ok', { timeout: 15000 });
    await foto(cliente, '07-cliente-online');
    return 'enviado na hora (selo "Na central")';
  });

  await passo(8, 'Portal: listar atendimentos — visualizar o registrado', async () => {
    await irPortal('Atendimentos');
    await portal.click('text=Atualizar');
    await portal.waitForFunction((n) => document.querySelectorAll('.tabela tbody tr').length > n, atendimentosAntes);
    esperar((await textoTabela()).includes('Dor lombar'), 'atendimento do passo 7 não apareceu');
    await portal.locator('.tabela tbody tr', { hasText: 'Dor lombar' }).click();
    await portal.waitForSelector('text=Medicamentos administrados');
    await foto(portal, '08-portal-atendimento-online');
    await irPortal('Atendimentos');
    await portal.waitForSelector('.tabela tbody tr');
    return `${await linhasTabela()} atendimentos`;
  });

  await passo(9, 'Portal: inserir novos medicamentos via banco de dados', async () => {
    const url = env('clinical.env').DATABASE_URL;
    const saida = execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(RAIZ, 'infra/db/roteiro/passo-09-novos-medicamentos.sql')], { encoding: 'utf8' });
    esperar(saida.includes('Cetoprofeno'), 'script SQL não retornou os medicamentos');
    return 'Cetoprofeno e Salbutamol inseridos com psql (trigger preencheu change_seq)';
  });

  await passo(10, 'Portal: listar atendimentos (e cadastros com os novos medicamentos)', async () => {
    await irPortal('Cadastros');
    await portal.waitForSelector('text=Cetoprofeno');
    await foto(portal, '10-portal-cadastros-novos');
    await irPortal('Atendimentos');
    await portal.waitForSelector('.tabela tbody tr');
    await foto(portal, '10-portal-atendimentos');
    return `${await linhasTabela()} atendimentos; ${medicamentosAntes + 2} medicamentos`;
  });

  await passo(11, 'Cliente: sincronizar dados a partir do portal (receber)', async () => {
    await irCliente('Sincronização');
    await cliente.click('text=Receber dados da central');
    await cliente.waitForFunction((n) => document.querySelectorAll('.numero-grande')[1]?.textContent === String(n), medicamentosAntes + 2);
    await foto(cliente, '11-cliente-recebido-novos');
    return `${medicamentosAntes + 2} medicamentos no aparelho (só o delta veio, pelo cursor)`;
  });

  await passo(12, 'Cliente: offline — criar pessoa, prontuário e atendimento', async () => {
    await cliente.locator('.casca .chave-rede').click();
    await cliente.waitForSelector('.app[data-online="false"]');
    await irCliente('Ocorrências');
    await cliente.click('text=Nova ocorrência');
    await cliente.fill('#nome', NOVA_VITIMA);
    await cliente.fill('#cpf', '390.533.447-05');
    await cliente.fill('#nasc', '1991-03-14');
    await cliente.locator('label.segmento', { hasText: 'Masculino' }).click();
    await cliente.fill('#cnome', 'Ana Ramos');
    await cliente.fill('#cpar', 'Irmã');
    await cliente.fill('#ctel', '(51) 99555-0303');
    await cliente.fill('#cemail', 'ana.ramos@exemplo.com.br');
    await foto(cliente, '12a-cliente-offline-vitima');
    await cliente.click('text=Continuar para o prontuário');
    await cliente.locator('.sugestoes button', { hasText: 'Dipirona' }).click();
    await cliente.locator('label.segmento', { hasText: /^B\+$/ }).click();
    await cliente.click('text=Continuar para o atendimento');
    await preencherAtendimento({ local: 'BR-386, km 343 — Estrela', queixa: 'Queda de moto, trauma em membro superior direito', protocolo: 'Manchester', cor: 'Laranja', glasgow: ['Espontânea', 'Orientado', 'Obedece'], pa: ['142', '90'], fc: '112', spo2: '95' });
    await administrar('Dipirona Sódica — Ampola 500 mg/mL · 2 mL', '1000', 'IV');
    await cliente.waitForSelector('text=alergia registrada');
    esperar(await cliente.locator('text=Registrar administração').isDisabled(), 'dipirona deveria estar bloqueada');
    await cliente.locator('#s-medicamentos').evaluate((e) => e.closest('section').scrollIntoView());
    await cliente.screenshot({ path: join(CAPTURAS, '12b-cliente-alerta-alergia.png') });
    await administrar('Cetoprofeno — Frasco-ampola 100 mg', '100', 'IV');
    await cliente.waitForSelector('text=alergia registrada', { state: 'detached' });
    await cliente.click('text=Registrar administração');
    await cliente.click('text=Finalizar atendimento');
    await cliente.waitForSelector('.selo-pendente');
    await irCliente('Ocorrências');
    const pend = await cliente.locator('.pendentes').getAttribute('aria-label');
    esperar(pend.startsWith('3 pendentes'), `esperava 3 pendentes: ${pend}`);
    await foto(cliente, '12c-cliente-offline-pendentes');
    return '3 operações na Outbox; alerta de alergia bloqueou dipirona sem rede';
  });

  await passo(13, 'Portal: prontuários e atendimentos — cadastro novo NÃO aparece', async () => {
    await irPortal('Prontuários');
    await portal.click('text=Atualizar');
    await portal.waitForLoadState('networkidle');
    esperar(!(await textoTabela()).includes(NOVA_VITIMA), 'prontuário offline apareceu antes da sincronização');
    await foto(portal, '13-portal-prontuarios-sem-novo');
    await irPortal('Atendimentos');
    await portal.click('text=Atualizar');
    await portal.waitForLoadState('networkidle');
    esperar(!(await textoTabela()).includes(NOVA_VITIMA), 'atendimento offline apareceu antes da sincronização');
    return 'nada do passo 12 na central';
  });

  await passo(14, 'Cliente: online — sincronizar para o portal', async () => {
    await cliente.locator('.casca .chave-rede').click();
    await cliente.waitForFunction(() => document.querySelector('.pendentes')?.getAttribute('aria-label')?.startsWith('Tudo na central'), null, { timeout: 20000 });
    await foto(cliente, '14-cliente-sincronizado');
    return 'Outbox drenada automaticamente ao religar (Observer)';
  });

  await passo(15, 'Portal: prontuários e atendimentos — cadastro novo aparece', async () => {
    await irPortal('Prontuários');
    await portal.click('text=Atualizar');
    await portal.waitForSelector(`text=${NOVA_VITIMA}`);
    await foto(portal, '15a-portal-prontuarios-com-novo');
    await irPortal('Atendimentos');
    await portal.click('text=Atualizar');
    await portal.waitForSelector(`text=${NOVA_VITIMA}`);
    await foto(portal, '15b-portal-atendimentos-com-novo');
    return 'com o selo "Registrado offline"';
  });

  await passo(16, 'Demonstrar a geração da Ficha de Atendimento', async () => {
    await portal.locator('.tabela tbody tr', { hasText: NOVA_VITIMA }).click();
    await portal.waitForSelector('text=Gerar ficha (PDF)');
    const [resp] = await Promise.all([
      portal.waitForResponse((r) => r.url().includes('/api/ficha/') && r.url().endsWith('/pdf')),
      portal.click('text=Gerar ficha (PDF)'),
    ]);
    esperar(resp.status() === 200 && resp.headers()['content-type'] === 'application/pdf', `PDF falhou: ${resp.status()}`);
    const sha = resp.headers()['x-documento-sha256'];
    await portal.waitForSelector('text=Última emissão');
    await foto(portal, '16-portal-ficha');
    return `PDF ${resp.headers()['content-length']} bytes, SHA-256 ${sha.slice(0, 12)}…`;
  });

  await passo(17, 'Demonstrar o e-mail enviado com a ficha em anexo', async () => {
    await portal.click('text=Enviar ficha');
    await portal.waitForSelector('.envios li[data-status="ENVIADO"]');
    await foto(portal, '17-portal-email-enviado');
    const doc = env('document.env');
    if (doc.SMTP_HOST) return `entregue ao SMTP ${doc.SMTP_HOST}`;
    const pasta = doc.MAIL_OUTBOX_DIR;
    const eml = readdirSync(pasta).filter((f) => f.endsWith('.eml')).map((f) => join(pasta, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    const conteudo = readFileSync(eml, 'utf8');
    esperar(conteudo.includes('ana.ramos@exemplo.com.br') && conteudo.includes('application/pdf'), 'e-mail sem destinatário ou anexo');
    return `e-mail para ana.ramos@exemplo.com.br com PDF anexo (${eml.split('/').pop()})`;
  });
} finally {
  await browser.close();
  const ok = resultados.filter((r) => r.ok).length;
  console.log(`\n${ok}/17 passos aprovados. Capturas em ${CAPTURAS}`);
  process.exitCode = ok === 17 ? 0 : 1;
}
