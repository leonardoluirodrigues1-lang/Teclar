// Check de semanaDeDias(): os sete quadrados do painel de sequência do
// lobby saem das datas do histórico, sem tabela nenhuma.
//   node js/utils/desempenho.check.mjs
//
// Roda no .js gerado pelo tsc (npm run build), não no .ts.
import assert from 'node:assert/strict';
import { semanaDeDias, sequenciaDeDias } from './desempenho.js';

const sessao = (data) => ({ data, wpm: 40 });

// Quarta-feira, 2026-09-23. A semana dela vai de segunda 21 a domingo 27.
const QUARTA = '2026-09-23';

{
  const semana = semanaDeDias([], QUARTA);
  assert.equal(semana.length, 7, 'sempre sete dias');
  assert.deepEqual(
    semana.map((d) => d.dia),
    ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'],
    'segunda a domingo da semana de hoje'
  );
  assert.deepEqual(semana.map((d) => d.inicial), ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'], 'iniciais do desenho');
  assert.deepEqual(semana.map((d) => d.treinou), [false, false, false, false, false, false, false],
    'sem histórico, nenhum dia aceso');
  assert.deepEqual(semana.map((d) => d.futuro), [false, false, false, true, true, true, true],
    'futuro é só depois de hoje; hoje não é futuro');
}

{
  // Duas sessões no mesmo dia acendem UM quadrado, não dois.
  const semana = semanaDeDias(
    [sessao('2026-09-21T08:00:00Z'), sessao('2026-09-21T22:30:00Z'), sessao('2026-09-23T09:00:00Z')],
    QUARTA
  );
  assert.deepEqual(semana.map((d) => d.treinou), [true, false, true, false, false, false, false],
    'segunda e quarta acesas, e a segunda uma vez só');
}

{
  // Sessão da semana passada não acende quadrado nenhum desta semana.
  const semana = semanaDeDias([sessao('2026-09-20T10:00:00Z')], QUARTA);
  assert.deepEqual(semana.map((d) => d.treinou), Array(7).fill(false),
    'domingo 20 é da semana anterior');
}

{
  // Segunda-feira: a semana começa em hoje, e nada dela é passado.
  const semana = semanaDeDias([sessao('2026-09-21T10:00:00Z')], '2026-09-21');
  assert.equal(semana[0].dia, '2026-09-21', 'na segunda, hoje é o primeiro quadrado');
  assert.equal(semana[0].treinou, true);
  assert.deepEqual(semana.map((d) => d.futuro), [false, true, true, true, true, true, true]);
}

{
  // Domingo: a semana termina em hoje, e nada dela é futuro.
  const semana = semanaDeDias([], '2026-09-27');
  assert.equal(semana[0].dia, '2026-09-21', 'no domingo, a segunda ainda é a desta semana');
  assert.equal(semana[6].dia, '2026-09-27');
  assert.deepEqual(semana.map((d) => d.futuro), Array(7).fill(false));
}

{
  // Vira o mês sem quebrar a aritmética de dia.
  const semana = semanaDeDias([], '2026-10-01'); // quinta
  assert.deepEqual(
    semana.map((d) => d.dia),
    ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    'a semana atravessa a virada de mês'
  );
}

{
  // A frase do painel vem da sequência, que é outra conta: a semana diz
  // QUAIS dias, a sequência diz QUANTOS seguidos. Elas não se confundem —
  // uma sequência antiga não acende quadrado desta semana nem conta.
  assert.equal(sequenciaDeDias([sessao('2020-01-01T10:00:00Z')]), 0,
    'sequência velha já terminou');
  assert.equal(sequenciaDeDias([]), 0, 'sem sessão, sequência 0 -> "Comece hoje."');
}

console.log('desempenho.check: ok');
