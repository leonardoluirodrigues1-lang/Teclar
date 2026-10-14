// ranking.mock.check.mjs
// Check do ranking do MOCK (GET /turmas/:id/ranking em mocks.ts): ele é
// calculado com a conta do back, e não tabelado. Confere a tabela que o
// comentário de COLEGAS_DO_RANKING promete e que uma sessão nova mexe nos
// pontos, como mexeria no back.
// Rodar com:  node js/nucleo/ranking.mock.check.mjs   (depois do npx tsc)
import assert from 'node:assert/strict';

// mocks.js e sessao.js leem o storage e o location ao carregar.
const memoria = new Map();
const storage = {
  getItem: (k) => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};
globalThis.sessionStorage = storage;
globalThis.localStorage = storage;
globalThis.location = { hostname: 'localhost', search: '' };

const { CONFIG } = await import('../config.js');
CONFIG.ATRASO_MOCK = 0;
const { responderMock } = await import('./mocks.js');

// O aluno de teste da turma-2 (al-43) entra pelo código da turma, como na tela.
const { token: tokenDoProf } = await responderMock('POST', '/auth/login', { email: 'prof@teclar.dev', senha: 'senha123' }, null);
const { codigo } = await responderMock('GET', '/turmas/turma-2', undefined, tokenDoProf);
const { token } = await responderMock('POST', '/auth/login', { codigo, nome: 'Ana Pires', senha: 'aluno2026' }, null);

const ranking = await responderMock('GET', '/turmas/turma-2/ranking', undefined, token);
assert.deepEqual(ranking.map((l) => l.pontos), [146, 134, 132, 122, 118, 95, 86, 0], 'pontos e ordem da tabela');
assert.deepEqual(ranking.map((l) => l.nome), ['Bruno Sato', 'Carla Nunes', 'Diego Ramos', null, null, 'Ana Pires', null, null], 'só o pódio e o próprio aluno têm nome');
assert.equal(ranking[5].voce, true, 'a linha dele é a 6ª');
assert.equal(ranking[2].ritmo, 47, 'o 3º tem o maior ritmo e não é o 1º');

// Uma sessão boa num exercício da sala: o ritmo médio dele sobe, e os pontos junto.
await responderMock('POST', '/sessoes', { exercicio_id: 'ex-prof-3', turma_id: 'turma-2', wpm: 100, precisao: 100, acertos: 50, erros: 0, tempo_gasto_segundos: 30, concluida: true }, token);
const depois = await responderMock('GET', '/turmas/turma-2/ranking', undefined, token);
const ele = depois.find((l) => l.voce);
assert.ok(ele.ritmo > 40 && ele.pontos === ele.licoes * 20 + ele.ritmo + ele.diasSeguidos * 5, 'a sessão nova entra na conta');

console.log('ok - ranking do mock calculado como o back');
