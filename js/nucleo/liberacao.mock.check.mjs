// liberacao.mock.check.mjs
// Check da regra de liberação no MOCK (mocks.ts): as atividades abrem em
// ordem, para o Solo e para o aluno, como no back.
// Rodar com:  node js/nucleo/liberacao.mock.check.mjs   (depois do npx tsc)
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

const medidas = { wpm: 40, precisao: 95, acertos: 200, erros: 2, tempo_gasto_segundos: 60 };

async function recusa(rota, corpo, token) {
  await assert.rejects(responderMock('POST', rota, corpo, token), (erro) => erro.status === 403 && erro.codigo === 'ATIVIDADE_BLOQUEADA');
}

// Solo: leo concluiu da solo-001 à solo-005.
const { token: leo } = await responderMock('POST', '/auth/login', { email: 'leo@teclar.dev', senha: 'senha123' }, null);
const missoes = await responderMock('GET', '/solo/missoes', undefined, leo);
assert.deepEqual(
  missoes.filter((m) => !m.bloqueada).map((m) => m.exerciseId),
  ['solo-001', 'solo-002', 'solo-003', 'solo-004', 'solo-005', 'solo-006'],
  'as concluídas e a próxima'
);
await recusa('/solo/sessoes', { ...medidas, exercicio_id: 'solo-007', concluida: true }, leo);
await responderMock('POST', '/solo/sessoes', { ...medidas, exercicio_id: 'solo-006', concluida: false }, leo);
await recusa('/solo/sessoes', { ...medidas, exercicio_id: 'solo-007', concluida: true }, leo);
await responderMock('POST', '/solo/sessoes', { ...medidas, exercicio_id: 'solo-006', concluida: true }, leo);
await responderMock('POST', '/solo/sessoes', { ...medidas, exercicio_id: 'solo-007', concluida: true }, leo);
await responderMock('POST', '/solo/sessoes', { ...medidas, exercicio_id: 'solo-001', concluida: true }, leo);

// Aluno: Caio concluiu o ex-prof-1 da turma-1; o próximo é o ex-prof-2.
const { token: caio } = await responderMock('POST', '/auth/login', { codigo: 'K7M2QX', nome: 'Caio Ferreira', senha: 'aluno2026' }, null);
const sala = await responderMock('GET', '/aluno/salas/turma-1', undefined, caio);
assert.deepEqual(sala.lista.filter((ex) => !ex.bloqueada).map((ex) => ex.id), ['ex-prof-1', 'ex-prof-2'], 'o concluído e o próximo');
const noExercicio = (id, concluida) => ({ ...medidas, exercicio_id: id, turma_id: 'turma-1', concluida });
await recusa('/sessoes', noExercicio('ex-prof-7', true), caio);
await responderMock('POST', '/sessoes', noExercicio('ex-prof-2', false), caio);
await recusa('/sessoes', noExercicio('ex-prof-7', true), caio);
await responderMock('POST', '/sessoes', noExercicio('ex-prof-2', true), caio);
await responderMock('POST', '/sessoes', noExercicio('ex-prof-7', true), caio);
await responderMock('POST', '/sessoes', noExercicio('ex-prof-1', true), caio);

console.log('ok - o mock libera as atividades em ordem, como o back');
