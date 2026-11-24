// tools/axe.mjs — acessibilidade (WCAG 2.1 A e AA) das telas do TECLAR.
//   npm run a11y              todas as telas
//   npm run a11y -- turmas    só as telas cujo caminho contém "turmas"
//
// Para cada tela, uma por vez, num Chrome headless (CHROME=<caminho> troca o
// executável):
//   1. axe-core com as regras wcag2a, wcag2aa, wcag21a e wcag21aa;
//   2. um contraste próprio: o axe desiste sobre o vidro e os gradientes e só
//      marca "incompleto". Aqui a cor do texto (com a opacidade dos
//      ancestrais) é composta sobre a pilha de background-color até o preto
//      do fundo; abaixo de 4,5:1 (3:1 em texto grande) é falha. Elemento com
//      background-image no caminho fica de fora (não dá para calcular);
//   3. o primeiro Tab: quem recebe o foco e se o anel aparece.
//
// Não precisa do back: o próprio script serve o front em localhost:5501 com
// o js/config.js trocado para MOCK: true, e grava a sessão de teste de cada
// tela no sessionStorage. Movimento reduzido ligado, para nada estar no meio
// de uma animação. Antes, compile o front (npm run build).
// Sai com código 1 se houver qualquer falha. Fecha o Chrome no fim.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const CHROME =
  process.env.CHROME ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((c) => existsSync(c));
if (!CHROME) throw new Error('Chrome não encontrado (defina CHROME=<caminho>).');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };

// --- o front, em modo mock -----------------------------------------------------
const servidor = createServer((req, res) => {
  const pedido = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const caminho = normalize(join(RAIZ, pedido === '/' ? '/index.html' : pedido));
  if (!caminho.startsWith(RAIZ) || !existsSync(caminho) || statSync(caminho).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(caminho)] ?? 'application/octet-stream' });
  if (pedido === '/js/config.js') {
    res.end(readFileSync(caminho, 'utf8').replace('MOCK: false', 'MOCK: true').replace(/ATRASO_MOCK: \d+/, 'ATRASO_MOCK: 0'));
    return;
  }
  createReadStream(caminho).pipe(res);
});
await new Promise((r) => servidor.listen(5501, 'localhost', r));
const FRONT = 'http://localhost:5501';

// As contas do mock (js/nucleo/mocks.ts). O token só precisa do prefixo. O
// tutorial fica marcado como visto ('visto', ver sessao.tutorialVisto): senão
// ele cobre Turmas e Caminho, e o que se testa é o tutorial, não a tela.
const SESSOES = {
  prof: { usuario: { id: 'u-2', nome: 'Henrique Lima', email: 'prof@teclar.dev', tipo: 'conta', campanhaAtiva: 'camp-2' }, modo: 'professor' },
  leo: { usuario: { id: 'u-1', nome: 'Leonardo', email: 'leo@teclar.dev', tipo: 'conta', campanhaAtiva: 'camp-1' }, modo: 'solo' },
  aluno: { usuario: { id: 'al-43', nome: 'Ana Pires', tipo: 'aluno', turmas: [{ id: 'turma-2', nome: 'Reforço de digitação' }] }, modo: null },
};
const PAGINAS = [
  ['/index.html'],
  ['/pages/login.html'],
  ['/pages/cadastro.html'],
  ['/pages/modo.html', 'prof'],
  ['/pages/professor/turmas.html', 'prof'],
  ['/pages/professor/turma.html?turma=turma-2&aba=atividades', 'prof'],
  ['/pages/professor/turma.html?turma=turma-2&aba=alunos', 'prof'],
  ['/pages/professor/turma.html?turma=turma-2&aba=relatorio', 'prof'],
  ['/pages/professor/biblioteca.html', 'prof'],
  ['/pages/professor/biblioteca.html?atribuir=turma-2', 'prof'],
  ['/pages/professor/relatorios.html', 'prof'],
  ['/pages/professor/relatorios.html?filtro=arquivadas', 'prof'],
  ['/pages/professor/configuracoes.html', 'prof'],
  ['/pages/solo/caminho.html', 'leo'],
  ['/pages/solo/dashboard.html', 'leo'],
  ['/pages/solo/estatisticas.html', 'leo'],
  ['/pages/solo/configuracoes.html', 'leo'],
  ['/pages/solo/ajuda.html', 'leo'],
  ['/pages/solo/sobre.html', 'leo'],
  ['/pages/treino/treino.html?exercicio=solo-001', 'leo'],
  ['/pages/aluno/sala.html?id=turma-2', 'aluno'],
  ['/pages/aluno/dashboard.html', 'aluno'],
  ['/pages/aluno/historico.html', 'aluno'],
].filter(([pagina]) => !process.argv[2] || pagina.includes(process.argv[2]));

// Roda dentro da página: os textos abaixo do contraste mínimo.
const CONTRASTE = `(() => {
  const rgba = (s) => { const m = s.match(/[\\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return [m[0], m[1], m[2], m[3] ?? 1]; };
  const sobre = (c, f) => [0, 1, 2].map((i) => c[i] * c[3] + f[i] * (1 - c[3]));
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const fora = [];
  const vistos = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (!el.getBoundingClientRect().width || cs.visibility === 'hidden') continue;
    if (el.closest('[aria-hidden=true],[hidden],:disabled,[aria-disabled=true]')) continue;
    const pilha = [];
    let opacidade = 1;
    let gradiente = false;
    for (let a = el; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      opacidade *= Number(s.opacity);
      gradiente ||= s.backgroundImage !== 'none';
      pilha.push(rgba(s.backgroundColor));
    }
    if (gradiente) continue;
    let fundo = [0, 0, 0];
    for (const c of pilha.reverse()) fundo = sobre(c, fundo);
    const texto = rgba(cs.color);
    texto[3] *= opacidade;
    const [claro, escuro] = [lum(sobre(texto, fundo)), lum(fundo)].sort((x, y) => y - x);
    const razao = (claro + 0.05) / (escuro + 0.05);
    const px = parseFloat(cs.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    if (razao >= (grande ? 3 : 4.5)) continue;
    const nome = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
    if (vistos.has(nome + cs.color)) continue;
    vistos.add(nome + cs.color);
    fora.push(nome + ' ' + razao.toFixed(2) + ':1 ' + cs.color + ' "' + el.textContent.trim().slice(0, 30) + '"');
  }
  return fora;
})()`;

const AXE_RODAR = `axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }).then((r) =>
  r.violations.map((v) => ({
    id: v.id,
    impacto: v.impact,
    n: v.nodes.length,
    exemplos: v.nodes.slice(0, 4).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\\n').slice(1, 2).join('').trim().slice(0, 160)),
  })))`;

const PRIMEIRO_TAB = `(() => {
  const e = document.activeElement;
  const s = getComputedStyle(e);
  return e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + ' "' + e.textContent.trim().slice(0, 25) + '" anel ' + s.outlineStyle + ' ' + s.outlineWidth;
})()`;

// --- Chrome headless + CDP ------------------------------------------------------
const perfil = mkdtempSync(join(tmpdir(), 'teclar-axe-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--window-size=1280,800', '--disable-gpu', '--disable-extensions', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let falhas = 0;
try {
  const wsNavegador = await new Promise((ok, falha) => {
    let saida = '';
    chrome.stderr.on('data', (d) => {
      saida += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(saida);
      if (m) ok(m[1]);
    });
    setTimeout(() => falha(new Error('Chrome não abriu o DevTools')), 15000);
  });
  const porta = new URL(wsNavegador).port;
  const alvo = await (await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let proximoId = 0;
  const pendentes = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pendentes.has(msg.id)) {
      pendentes.get(msg.id)(msg);
      pendentes.delete(msg.id);
    }
  });
  const cdp = (method, params = {}) => {
    const id = ++proximoId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, falha) => pendentes.set(id, (m) => (m.error ? falha(new Error(`${method}: ${m.error.message}`)) : ok(m.result))));
  };
  const avaliar = async (expressao) => {
    const r = await cdp('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const navegar = async (url) => {
    await cdp('Page.navigate', { url });
    for (let i = 0; i < 100; i++) {
      await esperar(100);
      if ((await avaliar('document.readyState').catch(() => '')) === 'complete') return;
    }
    throw new Error(`não carregou ${url}`);
  };
  const tab = async () => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  };

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  for (const [pagina, quem] of PAGINAS) {
    // A sessão vai no storage da origem antes de abrir a tela (o guarda lê na carga).
    await navegar(`${FRONT}/pages/login.html`);
    const s = SESSOES[quem];
    const gravar = s
      ? `sessionStorage.setItem('teclar:token', 'mock-${s.usuario.tipo}-${s.usuario.id}-token-a11y');
         sessionStorage.setItem('teclar:usuario', ${JSON.stringify(JSON.stringify(s.usuario))});
         ${s.modo ? `localStorage.setItem('teclar:modo', '${s.modo}');` : ''}
         localStorage.setItem('teclar:tutorial_solo:${s.usuario.id}', 'visto');
         localStorage.setItem('teclar:tutorial_professor:${s.usuario.id}', 'visto');`
      : '';
    await avaliar(`sessionStorage.clear(); localStorage.clear(); ${gravar} true`);
    await navegar(FRONT + pagina);
    await esperar(1500); // a tela busca os dados (mock) e monta

    const onde = await avaliar('location.pathname');
    await avaliar(`${AXE}; true`);
    const violacoes = await avaliar(AXE_RODAR);
    const contraste = await avaliar(CONTRASTE);
    await avaliar('document.activeElement?.blur(); true');
    await tab();
    const primeiroTab = await avaliar(PRIMEIRO_TAB);

    const problemas = violacoes.length + contraste.length;
    falhas += problemas;
    const desvio = onde !== pagina.split('?')[0] ? ` (foi para ${onde})` : '';
    console.log(`\n## ${pagina}${desvio}: ${problemas ? `${problemas} falha(s)` : 'ok'}`);
    for (const v of violacoes) {
      console.log(`- axe ${v.id} [${v.impacto}] x${v.n}`);
      for (const e of v.exemplos) console.log(`    ${e}`);
    }
    for (const c of contraste) console.log(`- contraste ${c}`);
    console.log(`  1º Tab: ${primeiroTab}`);
  }
  ws.close();
} finally {
  chrome.kill();
  servidor.close();
  await esperar(500);
  rmSync(perfil, { recursive: true, force: true, maxRetries: 3 });
}

console.log(`\n${falhas ? `${falhas} falha(s) de acessibilidade.` : `Tudo certo: ${PAGINAS.length} tela(s) sem falha de acessibilidade.`}`);
process.exitCode = falhas ? 1 : 0;
