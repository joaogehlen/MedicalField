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
const contexto = (vp) => browser.newContext({ viewport: vp, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const portal = await (await contexto({ width: 1440, height: 900 })).newPage();
const cliente = await (await contexto({ width: 430, height: 932 })).newPage();
const foto = (p, nome) => p.screenshot({ path: join(CAPTURAS, `${nome}.png`), fullPage: true });
/** Abre uma página do portal (recarrega os dados da central). */
const irPortal = async (rota) => {
  await portal.goto(`${URL_BASE}/portal/${rota}`);
  await portal.waitForLoadState('networkidle');
};
const irCliente = (t) => cliente.locator('.navbar-mf a', { hasText: t }).first().click();
const linhasTabela = () => portal.locator('table tbody tr').count();
const textoTabela = () => portal.locator('table tbody').innerText();
const qtdNoAparelho = async (k) => Number(await cliente.locator(`#qtd-${k}`).innerText());
const pendentes = () => cliente.locator('.navbar-mf button.rounded-pill').innerText();
const NOVA_VITIMA = 'Carlos Eduardo Ramos';

let atendimentosAntes = 0;
let medicamentosAntes = 0;

async function escolherMedicamento(nome, dose, via) {
  const valor = await cliente.locator('#med option', { hasText: nome }).first().getAttribute('value');
  await cliente.selectOption('#med', valor);
  await cliente.fill('#dose', dose);
  await cliente.selectOption('#via', via);
  await cliente.locator('button', { hasText: /^Adicionar$/ }).click();
}

async function preencherAtendimento(d) {
  await cliente.waitForSelector('#queixa');
  await cliente.fill('#local', d.local);
  await cliente.fill('#queixa', d.queixa);
  if (d.protocolo) await cliente.locator('button', { hasText: d.protocolo }).click();
  await cliente.click(`label[for=cl-${d.cor}]`);
  await cliente.fill('#v-paSistolica', d.pa[0]);
  await cliente.fill('#v-paDiastolica', d.pa[1]);
  await cliente.fill('#v-fc', d.fc);
  await cliente.fill('#v-spo2', d.spo2);
}

try {
  await passo(1, 'Portal: autenticar', async () => {
    await portal.goto(`${URL_BASE}/portal/`);
    await portal.fill('#numero', '0001');
    await portal.fill('#senha', SENHA);
    await portal.click('button[type=submit]');
    await portal.waitForSelector('.navbar-mf');
    await foto(portal, '01-portal-login');
    return 'Central de Regulação (ADMIN)';
  });

  await passo(2, 'Portal: listar cadastros', async () => {
    await irPortal('cadastros');
    await portal.waitForSelector('table tbody tr');
    medicamentosAntes = await linhasTabela();
    await foto(portal, '02-portal-cadastros');
    return `${medicamentosAntes} medicamentos`;
  });

  await passo(3, 'Portal: listar prontuários', async () => {
    await irPortal('prontuarios');
    await portal.waitForSelector('table tbody tr');
    await foto(portal, '03-portal-prontuarios');
    return `${await linhasTabela()} prontuários`;
  });

  await passo(4, 'Portal: listar atendimentos', async () => {
    await irPortal('atendimentos');
    await portal.waitForSelector('table tbody tr');
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
    await cliente.waitForSelector('.navbar-mf #chave-rede');
    await foto(cliente, '05-cliente-login');
    return 'Dra. Ana Souza (CRM 12345/RS)';
  });

  await passo(6, 'Cliente: sincronizar dados a partir do portal (receber)', async () => {
    await irCliente('Sincronizar');
    await cliente.locator('button', { hasText: /^Receber$/ }).click();
    await cliente.waitForFunction((n) => document.querySelector('#qtd-medicamentos')?.textContent === String(n), medicamentosAntes);
    await foto(cliente, '06-cliente-recebido');
    return `${await qtdNoAparelho('medicamentos')} medicamentos e ${await qtdNoAparelho('pacientes')} pacientes no aparelho`;
  });

  await passo(7, 'Cliente: online — registrar um atendimento', async () => {
    await irCliente('Pacientes');
    await cliente.locator('.list-group-item', { hasText: 'João Pedro' }).click();
    await cliente.click('text=Novo atendimento');
    await preencherAtendimento({ local: 'RS-130, km 72 — Lajeado', queixa: 'Dor lombar após queda da própria altura', cor: 'VERDE', pa: ['138', '88'], fc: '88', spo2: '98' });
    await escolherMedicamento('Ondansetrona', '4', 'IV');
    await cliente.click('text=Salvar atendimento');
    await cliente.waitForSelector('text=Na central', { timeout: 15000 });
    await foto(cliente, '07-cliente-online');
    return 'enviado na hora (selo "Na central")';
  });

  await passo(8, 'Portal: listar atendimentos — visualizar o registrado', async () => {
    await irPortal('atendimentos');
    esperar((await textoTabela()).includes('Dor lombar'), 'atendimento do passo 7 não apareceu');
    await portal.locator('table tbody tr', { hasText: 'Dor lombar' }).click();
    await portal.waitForSelector('text=Medicamentos administrados');
    await foto(portal, '08-portal-atendimento-online');
    await irPortal('atendimentos');
    return `${await linhasTabela()} atendimentos`;
  });

  await passo(9, 'Portal: inserir novos medicamentos via banco de dados', async () => {
    const url = env('clinical.env').DATABASE_URL;
    const saida = execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(RAIZ, 'infra/db/roteiro/passo-09-novos-medicamentos.sql')], { encoding: 'utf8' });
    esperar(saida.includes('Cetoprofeno'), 'script SQL não retornou os medicamentos');
    return 'Cetoprofeno e Salbutamol inseridos com psql (trigger preencheu change_seq)';
  });

  await passo(10, 'Portal: listar atendimentos (e cadastros com os novos medicamentos)', async () => {
    await irPortal('cadastros');
    await portal.waitForSelector('text=Cetoprofeno');
    await foto(portal, '10-portal-cadastros-novos');
    await irPortal('atendimentos');
    await foto(portal, '10-portal-atendimentos');
    return `${await linhasTabela()} atendimentos; ${medicamentosAntes + 2} medicamentos`;
  });

  await passo(11, 'Cliente: sincronizar dados a partir do portal (receber)', async () => {
    await irCliente('Sincronizar');
    await cliente.locator('button', { hasText: /^Receber$/ }).click();
    await cliente.waitForFunction((n) => document.querySelector('#qtd-medicamentos')?.textContent === String(n), medicamentosAntes + 2);
    await foto(cliente, '11-cliente-recebido-novos');
    return `${medicamentosAntes + 2} medicamentos no aparelho (só o delta veio, pelo cursor)`;
  });

  await passo(12, 'Cliente: offline — criar pessoa, prontuário e atendimento', async () => {
    await cliente.locator('.navbar-mf #chave-rede').click();
    await cliente.waitForSelector('.faixa-offline');
    await irCliente('Atendimentos');
    await cliente.click('text=Nova ocorrência');
    await cliente.fill('#nome', NOVA_VITIMA);
    await cliente.fill('#cpf', '390.533.447-05');
    await cliente.fill('#nasc', '1991-03-14');
    await cliente.selectOption('#sexo', 'M');
    await cliente.fill('#cnome', 'Ana Ramos');
    await cliente.fill('#cemail', 'ana.ramos@exemplo.com.br');
    await foto(cliente, '12a-cliente-offline-vitima');
    await cliente.click('button:has-text("Continuar")');
    await cliente.locator('button', { hasText: '+ Dipirona' }).click();
    await cliente.selectOption('#tipo', 'B+');
    await cliente.click('button:has-text("Continuar")');
    await preencherAtendimento({ local: 'BR-386, km 343 — Estrela', queixa: 'Queda de moto, trauma em membro superior direito', protocolo: 'Manchester', cor: 'LARANJA', pa: ['142', '90'], fc: '112', spo2: '95' });
    await escolherMedicamento('Dipirona', '1000', 'IV');
    await cliente.waitForSelector('text=Administração bloqueada');
    await cliente.locator('text=Administração bloqueada').scrollIntoViewIfNeeded();
    await cliente.screenshot({ path: join(CAPTURAS, '12b-cliente-alerta-alergia.png') });
    await escolherMedicamento('Cetoprofeno', '100', 'IV');
    await cliente.waitForSelector('text=Administração bloqueada', { state: 'detached' });
    await cliente.click('text=Salvar atendimento');
    await cliente.waitForSelector('text=Só no aparelho');
    const p = await pendentes();
    esperar(p.includes('3 pendentes'), `esperava 3 pendentes: ${p}`);
    await irCliente('Atendimentos');
    await cliente.waitForSelector('a.card-link-hover');
    await foto(cliente, '12c-cliente-offline-pendentes');
    return '3 operações na Outbox; alerta de alergia bloqueou dipirona sem rede';
  });

  await passo(13, 'Portal: prontuários e atendimentos — cadastro novo NÃO aparece', async () => {
    await irPortal('prontuarios');
    esperar(!(await textoTabela()).includes(NOVA_VITIMA), 'prontuário offline apareceu antes da sincronização');
    await foto(portal, '13-portal-prontuarios-sem-novo');
    await irPortal('atendimentos');
    esperar(!(await textoTabela()).includes(NOVA_VITIMA), 'atendimento offline apareceu antes da sincronização');
    return 'nada do passo 12 na central';
  });

  await passo(14, 'Cliente: online — sincronizar para o portal', async () => {
    await cliente.locator('.navbar-mf #chave-rede').click();
    await cliente.waitForFunction(() => document.querySelector('.navbar-mf button.rounded-pill')?.textContent?.includes('Tudo na central'), null, { timeout: 20000 });
    await foto(cliente, '14-cliente-sincronizado');
    return 'Outbox enviada automaticamente ao religar (Observer)';
  });

  await passo(15, 'Portal: prontuários e atendimentos — cadastro novo aparece', async () => {
    await irPortal('prontuarios');
    await portal.waitForSelector(`text=${NOVA_VITIMA}`);
    await foto(portal, '15a-portal-prontuarios-com-novo');
    await irPortal('atendimentos');
    await portal.waitForSelector(`text=${NOVA_VITIMA}`);
    await foto(portal, '15b-portal-atendimentos-com-novo');
    return 'com o selo "Registrado offline"';
  });

  await passo(16, 'Demonstrar a geração da Ficha de Atendimento', async () => {
    await portal.locator('table tbody tr', { hasText: NOVA_VITIMA }).click();
    await portal.waitForSelector('text=Gerar ficha (PDF)');
    const [resp] = await Promise.all([
      portal.waitForResponse((r) => r.url().includes('/api/ficha/') && r.url().endsWith('/pdf')),
      portal.click('text=Gerar ficha (PDF)'),
    ]);
    esperar(resp.status() === 200 && resp.headers()['content-type'] === 'application/pdf', `PDF falhou: ${resp.status()}`);
    const tamanho = resp.headers()['content-length'] ?? '?';
    await foto(portal, '16-portal-ficha');
    return `PDF de ${tamanho} bytes`;
  });

  await passo(17, 'Demonstrar o e-mail enviado com a ficha em anexo', async () => {
    esperar((await portal.inputValue('#email')) === 'ana.ramos@exemplo.com.br', 'e-mail do contato não veio preenchido');
    await portal.click('button:has-text("Enviar ficha")');
    await portal.waitForSelector('text=Ficha enviada para');
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
