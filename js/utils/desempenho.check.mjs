// Check de semanaDeDias(): os sete quadrados do painel de sequência do
// lobby saem das datas do histórico, sem tabela nenhuma.
//   node js/utils/desempenho.check.mjs
//
// Roda no .js gerado pelo tsc (npm run build), não no .ts.
import assert from 'node:assert/strict';
import { diaDe, semanaDeDias, sequenciaDeDias } from './desempenho.js';
import { emBrasilia, formatarData, formatarDataHora } from './formato.js';

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

{
  // O dia é o do calendário de Brasília (UTC-3), como no back: 22h30 de
  // segunda em Brasília é 01h30Z de terça, e tem de acender a SEGUNDA.
  const semana = semanaDeDias([sessao('2026-09-22T01:30:00Z')], QUARTA);
  assert.deepEqual(semana.map((d) => d.treinou), [true, false, false, false, false, false, false],
    'sessão às 22h30 de Brasília é do mesmo dia em Brasília');
  assert.equal(diaDe('2026-09-22T01:30:00.000Z'), '2026-09-21');
  assert.equal(diaDe('2026-09-22T03:00:00Z'), '2026-09-22', 'meia-noite de Brasília já é o dia novo');
  assert.equal(diaDe('2026-09-22'), '2026-09-22', 'data sem hora não muda de dia');
  assert.equal(diaDe('2026-09-22T01:30:00'), '2026-09-22', 'horário sem fuso fica como veio');
  assert.equal(diaDe('2026-09-22T01:30:00-03:00'), '2026-09-22', 'horário já em -03:00 não muda');
  assert.equal(emBrasilia(emBrasilia('2026-09-22T01:30:00Z')), '2026-09-21T22:30:00', 'converter duas vezes não desconta 6h');
  assert.equal(formatarDataHora('2026-09-22T01:30:00.000Z'), '21/09/2026 22:30', 'a tabela mostra a hora de Brasília');
  assert.equal(formatarData('2026-09-22T01:30:00.000Z'), '21/09/2026');
  assert.equal(formatarData('2026-02-01'), '01/02/2026', 'só a data, como o back manda, fica igual');

  // Sequência: 22h de anteontem e meio-dia de ontem em Brasília são dois
  // dias seguidos; em UTC cairiam os dois em ontem e dariam 1.
  const agora = Date.now();
  const hojeEmBrasilia = new Date(agora - 3 * 3600000).toISOString().slice(0, 10);
  const meiaNoite = Date.parse(`${hojeEmBrasilia}T00:00:00-03:00`);
  const emBrasiliaHa = (dias, hora) => new Date(meiaNoite - dias * 86400000 + hora * 3600000).toISOString();
  assert.equal(sequenciaDeDias([sessao(emBrasiliaHa(2, 22)), sessao(emBrasiliaHa(1, 12))]), 2,
    'sequência no calendário de Brasília');
}

console.log('desempenho.check: ok');
