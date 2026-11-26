// Check de ponta a ponta do FIM de uma lição do Solo
// (pages/treino/treino.html), num Chrome headless de verdade, com teclas de
// verdade (CDP Input.*, que o navegador trata como digitação do usuário):
//   · a lição é UMA atividade: o texto 3 vezes num bloco só, separado por
//     espaço, com um cronômetro só (180 s) e sem "Repetição N de 3" no HUD;
//   · digitado o bloco, não há card de passagem: vai para "Salvando
//     sessão…", grava UMA sessão (POST) e abre o modal de conclusão;
//   · o modal fica de pé: 3 s depois ainda está lá, e um Espaço teclado
//     (quem estava digitando continua batendo no teclado) não aciona
//     "Próxima lição" nem sai da tela.
//
// Como rodar (como o api.back.check.mjs, contra o back de verdade):
//   1. em back/: npm run seed && npm run build && npm run start:prod
//   2. na raiz:  npm run build
//   3. node js/treino/fimDaAtividade.check.mjs
// O próprio check serve os arquivos do front em localhost:5500 (ou usa o
// Live Server que já estiver nela) e abre o Chrome (CHROME=<caminho> troca
// o executável). Grava uma sessão Solo do leo.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '../..');
const API = 'http://localhost:3000/api';
const LICAO = 'solo-001'; // 59 caracteres × 3, num bloco de 179
const MS_POR_TECLA = 60; // ~200 PPM: abaixo do teto de plausibilidade do back (250)
const CHROME =
  process.env.CHROME ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
    .find((caminho) => existsSync(caminho));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let verificacoes = 0;
function confere(nome, condicao) {
  assert.ok(condicao, nome);
  verificacoes++;
  console.log(`ok - ${nome}`);
}

// --- servidor estático do front ------------------------------------------------
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const servidor = createServer((req, res) => {
  const caminho = normalize(join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!caminho.startsWith(RAIZ) || !existsSync(caminho) || statSync(caminho).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(caminho)] ?? 'application/octet-stream' });
  createReadStream(caminho).pipe(res);
});
// Porta 5500: a única que o CORS do back aceita localmente (a do Live
// Server). Já ocupada, o front que está nela é usado.
await new Promise((r) => {
  servidor.once('error', r);
  servidor.listen(5500, 'localhost', r);
});
const FRONT = 'http://localhost:5500';

// --- Chrome headless + CDP ----------------------------------------------------
assert.ok(CHROME, 'Chrome não encontrado (defina CHROME=<caminho>)');
const perfil = mkdtempSync(join(tmpdir(), 'teclar-check-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--window-size=1280,800', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
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
function cdp(method, params = {}) {
  const id = ++proximoId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((ok, falha) =>
    pendentes.set(id, (msg) => (msg.error ? falha(new Error(`${method}: ${msg.error.message}`)) : ok(msg.result)))
  );
}
async function avaliar(expressao) {
  const r = await cdp('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
}
async function navegar(url) {
  await cdp('Page.navigate', { url });
  for (let i = 0; i < 100; i++) {
    await esperar(100);
    if ((await avaliar('document.readyState').catch(() => '')) === 'complete') return;
  }
  throw new Error(`não carregou ${url}`);
}
async function aguardar(descricao, expressao, limiteMs = 15000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (await avaliar(expressao).catch(() => false)) return;
    await esperar(100);
  }
  throw new Error(`esperou demais: ${descricao}`);
}
const tecla = (key, code, vk, text) =>
  cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, text }).then(() =>
    cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk })
  );

const ESTADO = `(() => {
  const d = document.querySelector('[role=dialog]');
  return { passagem: !!document.getElementById('passagem'), modal: d ? d.innerText : null, focoNaCaixa: !!d && document.activeElement === d, url: location.href };
})()`;

try {
  await cdp('Page.enable');
  await cdp('Runtime.enable');

  // Sessão do leo (Solo, camp-1), gravada como o sessao.entrar() grava.
  const login = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'leo@teclar.dev', senha: 'senha123' }) })).json();
  assert.ok(login.token, 'login do leo (o back está no ar e com o seed?)');
  const historico = async () =>
    (await (await fetch(`${API}/solo/historico`, { headers: { Authorization: `Bearer ${login.token}` } })).json()).total;
  const antes = await historico();

  await navegar(`${FRONT}/pages/login.html`);
  await avaliar(`sessionStorage.setItem('teclar:token', ${JSON.stringify(login.token)});
    sessionStorage.setItem('teclar:usuario', ${JSON.stringify(JSON.stringify(login.usuario))}); true`);
  await navegar(`${FRONT}/pages/treino/treino.html?exercicio=${LICAO}`);
  await aguardar('o texto da lição', `document.querySelectorAll('.texto .c').length > 0`);
  const texto = await avaliar(`[...document.querySelectorAll('.texto .c')].map((c) => c.textContent).join('')`);
  const frase = 'asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg';
  confere(`o texto é a frase 3 vezes num bloco (${texto.length} caracteres)`, texto === `${frase} ${frase} ${frase}`);
  confere('o HUD não fala em repetição', !/repeti/i.test(await avaliar(`document.querySelector('.hud').innerText`)));
  confere('um cronômetro só, para o bloco inteiro (3:00)', (await avaliar(`document.getElementById('hud-tempo').innerText`)) === '3:00');

  await avaliar(`document.querySelector('input')?.focus(); true`);
  for (const ch of texto) {
    await cdp('Input.insertText', { text: ch });
    await esperar(MS_POR_TECLA);
  }

  // Fim do bloco: nada de passagem, direto para o modal de conclusão.
  let viuPassagem = false;
  const limite = Date.now() + 15000;
  let estado = await avaliar(ESTADO);
  while (!estado.modal && Date.now() < limite) {
    viuPassagem ||= estado.passagem;
    await esperar(50);
    estado = await avaliar(ESTADO);
  }
  confere('não há card de passagem', !viuPassagem);
  confere('o modal de conclusão abriu', /conclu/i.test(estado.modal ?? ''));
  confere('a sessão foi gravada (POST /solo/sessoes)', (await historico()) === antes + 1);
  const gravada = await (await fetch(`${API}/solo/historico`, { headers: { Authorization: `Bearer ${login.token}` } })).json();
  const ultima = [...gravada.itens].sort((a, b) => b.data.localeCompare(a.data))[0];
  confere(`a sessão gravada tem o bloco inteiro (acertos=${ultima.acertos}, erros=${ultima.erros})`, ultima.acertos === texto.length && ultima.erros === 0);
  await aguardar('os botões do modal', `/Voltar às atividades/.test(document.querySelector('[role=dialog]')?.innerText ?? '')`);
  confere('o foco está na caixa do modal, não num botão', (await avaliar(ESTADO)).focoNaCaixa);

  await esperar(3000);
  estado = await avaliar(ESTADO);
  confere('3 s depois o modal continua aberto', !!estado.modal);

  const url = estado.url;
  await tecla(' ', 'Space', 32, ' ');
  await tecla('Enter', 'Enter', 13, '\r');
  await esperar(1500);
  estado = await avaliar(ESTADO);
  confere('Espaço e Enter teclados não saem do modal', !!estado.modal && estado.url === url);

  console.log(`\nTudo certo: ${verificacoes} verificações no fim da atividade.`);
} finally {
  ws.close();
  chrome.kill();
  servidor.close();
  await esperar(500);
  rmSync(perfil, { recursive: true, force: true });
}
