// Check de percurso.ts: a ordem do percurso e a próxima lição, a regra
// que campanhas.html e o lobby do Solo usam para o botão "Continuar".
//   node js/utils/percurso.check.mjs
//
// Roda no .js gerado pelo tsc (npm run build), não no .ts.
import assert from 'node:assert/strict';
import { ordemDoPercurso, progressoDoPercurso, textoDoBotao } from './percurso.js';

const licao = (ordem, nivel) => ({ exerciseId: `L${ordem}`, ordem, nivel });
const sessao = (ordem, data, concluida = true) => ({ exerciseId: `L${ordem}`, data, concluida, wpm: 40 });

// Nível 1 tem as lições 1, 2 e também a 5; nível 2 tem a 3 e a 4. A
// resposta chega embaralhada.
const LICOES = [licao(4, 2), licao(5, 1), licao(1, 1), licao(3, 2), licao(2, 1)];
const PERCURSO = ordemDoPercurso(LICOES);

{
  assert.deepEqual(PERCURSO.map((l) => l.ordem), [1, 2, 5, 3, 4],
    'agrupado por nível: a 5 vem junto do nível 1, antes da 3');
}

{
  const p = progressoDoPercurso(PERCURSO, []);
  assert.equal(p.proxima.licao.ordem, 1, 'sem sessão, a primeira do percurso');
  assert.equal(textoDoBotao(p), 'Começar');
}

{
  // Fez a 1 e a 2; tentou a 3 sem concluir, por último.
  const sessoes = [sessao(1, '2026-09-01'), sessao(2, '2026-09-02'), sessao(3, '2026-09-03', false)];
  const p = progressoDoPercurso(PERCURSO, sessoes);
  assert.equal(p.proxima.licao.ordem, 5, 'a primeira pendente NA ORDEM DO PERCURSO, não por ordem');
  assert.equal(p.ultimaFeita.ordem, 3, 'a última feita conta mesmo sem concluir');
  assert.equal(textoDoBotao(p), 'Continuar');
}

{
  // Tudo concluído; a mais recente foi a 2.
  const sessoes = [1, 3, 4, 5].map((o) => sessao(o, '2026-09-01')).concat(sessao(2, '2026-09-05'));
  const p = progressoDoPercurso(PERCURSO, sessoes);
  assert.equal(p.proxima.licao.ordem, 2, 'tudo concluído: repetir a última feita');
  assert.equal(textoDoBotao(p), 'Repetir a última');
}

{
  // Sessão de uma lição que não existe mais não vira "a última feita".
  const p = progressoDoPercurso(PERCURSO, [sessao(99, '2026-09-09')]);
  assert.equal(p.ultimaFeita, null);
  assert.equal(textoDoBotao(p), 'Começar');
}

assert.equal(progressoDoPercurso([], []), null, 'sem lição nenhuma, não há próxima');

console.log('percurso.check: ok');
