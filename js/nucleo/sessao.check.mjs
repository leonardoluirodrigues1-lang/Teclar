// Check de sessao.usuario(): sessão em formato antigo, incompleta ou
// corrompida é INVÁLIDA — limpa tudo de teclar: e devolve null, sem
// redirecionar. Token e usuário moram no sessionStorage (`loja`); modo e
// o resto no localStorage (`disco`).
// Rodar com:  node js/nucleo/sessao.check.mjs
import assert from 'node:assert/strict';

// Um Storage de mentira em cima de um Map. Object.keys(storage) precisa
// enumerar as chaves, como no navegador.
function storageDe(mapa) {
  const api = {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
  };
  return new Proxy(api, {
    ownKeys: () => [...mapa.keys()],
    getOwnPropertyDescriptor: (alvo, p) =>
      p in alvo ? { enumerable: false, configurable: true, value: alvo[p] }
                : { enumerable: true, configurable: true, value: mapa.get(p) },
  });
}

const loja = new Map();
const disco = new Map();
globalThis.sessionStorage = storageDe(loja);
globalThis.localStorage = storageDe(disco);

function chavesTeclar() {
  return [...loja.keys(), ...disco.keys()].filter((k) => k.startsWith('teclar:'));
}

let n = 0;
async function cenario(nome, gravar, esperado) {
  loja.clear();
  disco.clear();
  gravar();
  // cache frio a cada cenário: sair() zera o cache mas não o esfria
  const { sessao } = await import(`./sessao.js?v=${n++}`);
  assert.deepEqual(sessao.usuario(), esperado, nome);
  if (esperado === null) {
    assert.deepEqual(chavesTeclar(), [],
      `${nome}: sobrou chave teclar: no storage`);
    assert.equal(sessao.logado(), false, `${nome}: logado() deveria ser false`);
  }
}

const ok = { id: 'u1', nome: 'Ana', tipo: 'conta' };

await cenario('sessão válida de conta', () => {
  loja.set('teclar:token', 't');
  loja.set('teclar:usuario', JSON.stringify(ok));
}, ok);

await cenario('formato antigo: tem perfil, não tem tipo', () => {
  loja.set('teclar:token', 't');
  loja.set('teclar:usuario', JSON.stringify({ id: 'u1', perfil: 'professor' }));
  disco.set('teclar:modo', JSON.stringify({ id: 'u1', modo: 'solo' }));
}, null);

await cenario('tem tipo E perfil: perfil não existe mais, inválida', () => {
  loja.set('teclar:token', 't');
  loja.set('teclar:usuario', JSON.stringify({ ...ok, perfil: 'aluno' }));
}, null);

await cenario('sem token', () => {
  loja.set('teclar:usuario', JSON.stringify(ok));
}, null);

await cenario('tipo desconhecido', () => {
  loja.set('teclar:token', 't');
  loja.set('teclar:usuario', JSON.stringify({ id: 'u1', tipo: 'professor' }));
}, null);

await cenario('JSON corrompido', () => {
  loja.set('teclar:token', 't');
  loja.set('teclar:usuario', '{nao é json');
}, null);

await cenario('JSON "null"', () => {
  loja.set('teclar:token', 't');
  loja.set('teclar:usuario', 'null');
}, null);

await cenario('sem nada gravado: não é inválida, é ninguém logado', () => {}, null);

// Sessão do tempo em que ela morava no localStorage: não vale mais, e o
// token esquecido lá é apagado ao carregar.
await cenario('sessão antiga no localStorage não loga e é apagada', () => {
  disco.set('teclar:token', 't');
  disco.set('teclar:usuario', JSON.stringify(ok));
}, null);

// sair() apaga a sessão e deixa o modo: ele é lembrado entre sessões.
{
  loja.clear();
  disco.clear();
  const { sessao } = await import(`./sessao.js?v=${n++}`);
  sessao.entrar({ token: 't', usuario: ok });
  assert.equal(loja.get('teclar:token'), 't', 'entrar() grava o token no sessionStorage');
  assert.equal(disco.has('teclar:token'), false, 'entrar() não grava token no localStorage');
  sessao.definirModo('professor');
  sessao.sair();
  assert.deepEqual([...loja.keys()], [], 'sair() apaga a sessão');
  assert.ok(disco.has('teclar:modo'), 'sair() deixa o modo');
}

console.log('sessao.check: ok');
