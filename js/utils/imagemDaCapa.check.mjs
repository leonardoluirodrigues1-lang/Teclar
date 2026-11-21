// Check de imagemDaCapa.ts: o recorte 3:1 e o tamanho final da capa.
//   node js/utils/imagemDaCapa.check.mjs
//
// Roda no .js gerado pelo tsc (npm run build), não no .ts. A conversão em
// WEBP (canvas) só existe no navegador; aqui fica a conta das medidas.
import assert from 'node:assert/strict';
import { CAPA_ALTURA, CAPA_LARGURA, medidasDaCapa } from './imagemDaCapa.js';

const casos = [
  // [foto, recorte esperado, final esperado]
  [[4000, 3000], [4000, 1333], [1200, 400]], // foto de celular deitada: corta em cima e embaixo
  [[3000, 4000], [3000, 1000], [1200, 400]], // em pé: sobra só a faixa do meio
  [[6000, 1000], [3000, 1000], [1200, 400]], // panorâmica: corta dos lados
  [[600, 200], [600, 200], [600, 200]], // pequena: nunca aumenta
  [[1201, 1], [3, 1], [3, 1]], // fio fino: não quebra
];
for (const [[l, a], [rl, ra], [fl, fa]] of casos) {
  const m = medidasDaCapa(l, a);
  assert.deepEqual([m.recorte.largura, m.recorte.altura], [rl, ra], `recorte de ${l}×${a}`);
  assert.deepEqual([m.final.largura, m.final.altura], [fl, fa], `final de ${l}×${a}`);
  assert.ok(m.final.largura <= CAPA_LARGURA && m.final.altura <= CAPA_ALTURA, `${l}×${a} cabe em 1200×400`);
  assert.ok(m.x >= 0 && m.y >= 0 && m.x + m.recorte.largura <= l && m.y + m.recorte.altura <= a, `recorte de ${l}×${a} dentro da foto`);
}
// O recorte fica no meio.
assert.deepEqual([medidasDaCapa(6000, 1000).x, medidasDaCapa(3000, 4000).y], [1500, 1500]);

console.log('imagemDaCapa.check: ok');
