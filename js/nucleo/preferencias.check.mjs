// Confere js/nucleo/preferencias-cedo.js (o script do <head>) sem navegador:
// classes no <html>, valores estranhos no padrão, a migração das duas
// escolhas antigas do Solo e o storage bloqueado. Rodar depois do build:
//   node js/nucleo/preferencias.check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const classes = new Set();
const loja = new Map();
const contexto = {
  window: {},
  document: { documentElement: { classList: { toggle: (c, ligar) => (ligar ? classes.add(c) : classes.delete(c)) } } },
  localStorage: { getItem: (k) => (loja.has(k) ? loja.get(k) : null), setItem: (k, v) => loja.set(k, String(v)) },
};
const codigo = readFileSync(new URL('./preferencias-cedo.js', import.meta.url), 'utf8');

loja.set('teclar:movimento_reduzido', 'sim');
vm.runInNewContext(codigo, contexto);
const prefs = contexto.window.teclarPreferencias;
assert.ok(classes.has('movimento-reduzido'), 'quem pediu menos movimento no formato antigo continua com ele');
assert.equal(prefs.ler().tecladoGuia, true, 'sem a escolha antiga, o teclado guia aparece');

prefs.definir('texto', 'muito-grande');
prefs.definir('dicas', false);
prefs.definir('transicoes', false);
assert.ok(classes.has('texto-muito-grande') && !classes.has('texto-grande'), 'um tamanho por vez');
assert.ok(classes.has('sem-dicas') && classes.has('sem-transicoes'), 'dicas e transições desligadas viram classe');
assert.equal(JSON.parse(loja.get('teclar-preferencias')).texto, 'muito-grande', 'gravado na chave nova');

loja.set('teclar-preferencias', '{"texto":"enorme","altoContraste":"sim","sonsDoTreino":false}');
const lido = prefs.ler();
assert.equal(lido.texto, 'normal', 'tamanho desconhecido cai no normal');
assert.equal(lido.altoContraste, false, 'valor que não é booleano cai no padrão');
assert.equal(lido.sonsDoTreino, false, 'o que tem o tipo certo é aproveitado');

loja.set('teclar-preferencias', '{quebrado');
assert.equal(prefs.ler().texto, 'normal', 'JSON quebrado: o padrão');

contexto.localStorage.getItem = () => {
  throw new Error('bloqueado');
};
contexto.localStorage.setItem = contexto.localStorage.getItem;
prefs.definir('altoContraste', true);
assert.ok(classes.has('alto-contraste'), 'sem storage, a escolha vale ao menos nesta página');

console.log('ok - preferências do aparelho');
