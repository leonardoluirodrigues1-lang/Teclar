// Check de sessao.usuario(): sessão em formato antigo, incompleta ou
// corrompida é INVÁLIDA — limpa tudo de teclar: e devolve null, sem
// redirecionar. Rodar com:  node js/nucleo/sessao.check.mjs
import assert from 'node:assert/strict';

const loja = new Map();
const api = {
  getItem: (k) => (loja.has(k) ? loja.get(k) : null),
  setItem: (k, v) => loja.set(k, String(v)),
  removeItem: (k) => loja.delete(k),
};
// Object.keys(localStorage) precisa enumerar as chaves, como no navegador.
globalThis.localStorage = new Proxy(api, {
  ownKeys: () => [...loja.keys()],
  getOwnPropertyDescriptor: (alvo, p) =>
    p in alvo ? { enumerable: false, configurable: true, value: alvo[p] }
              : { enumerable: true, configurable: true, value: loja.get(p) },
});

let n = 0;
async function cenario(nome, gravar, esperado) {
  loja.clear();
  gravar();
  // cache frio a cada cenário: sair() zera o cache mas não o esfria
  const { sessao } = await import(`./sessao.js?v=${n++}`);
  assert.deepEqual(sessao.usuario(), esperado, nome);
  if (esperado === null) {
    assert.deepEqual([...loja.keys()].filter((k) => k.startsWith('teclar:')), [],
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
  loja.set('teclar:modo', JSON.stringify({ id: 'u1', modo: 'solo' }));
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

console.log('sessao.check: ok');
