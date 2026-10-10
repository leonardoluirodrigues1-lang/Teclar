// testar-atribuicoes.mjs
// Teste de fumaça das três rotas de /turmas/:turmaId/atribuicoes, feito
// por HTTP (fetch) contra o back rodando, sem navegador. Cobre:
//   GET    — a visão do professor: título, dificuldade, data, e
//     concluidoPor / totalAlunos contados no back.
//   POST   — vários de uma vez; repetir não duplica nem muda a data; um id
//     ruim recusa a lista inteira ANTES de gravar; os 400.
//   DELETE — pelo par turma + exercício; as sessões ficam.
//   E, nas três: sem token 401, token de aluno 403 TIPO_INVALIDO, turma ou
//   exercício de outro professor 404 NAO_ENCONTRADO.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:atribuicoes
//
// Só lê as atribuições do seed: atribui e remove numa turma que ele mesmo
// cria, com exercícios que ele mesmo cria. Grava sessões direto no banco
// (pelo BancoService do dist/), porque ainda não há rota de sessão do
// mundo Escola — são elas que fazem o concluidoPor sair de 0. O npm run
// seed apaga tudo o que ele cria.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BancoService } from '../dist/banco/banco.service.js';

const URL = 'http://localhost:3000/api';

// Faz a requisição e devolve status, corpo já lido como JSON e o texto cru
// (o texto é o que prova que o 204 veio vazio).
async function chamar(metodo, rota, corpo, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const opcoes = { method: metodo, headers };
  // GET não pode levar body (o fetch recusa), então só põe quando há corpo.
  if (corpo) {
    opcoes.body = JSON.stringify(corpo);
  }
  const resposta = await fetch(URL + rota, opcoes);
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, texto };
}

// Para no primeiro caso que falhar, com o nome dele.
function confere(nome, condicao) {
  assert.ok(condicao, nome);
  console.log('ok -', nome);
}

function ehErro(resposta, status, codigo) {
  return resposta.status === status && resposta.corpo?.codigo === codigo;
}

async function entrar(credenciais) {
  const r = await chamar('POST', '/auth/login', credenciais);
  assert.equal(r.status, 200, `login de ${JSON.stringify(credenciais)}`);
  return r.corpo.token;
}

// Uma sessão gravada direto no banco.
function gravarSessao(alunoId, exercicioId, turmaId, concluida) {
  return banco.sessionsprof.create({
    data: { ID: randomUUID(), AlunoID: alunoId, ExerciseID: exercicioId, ClassID: turmaId, WPM: 30, Precisao: 90, Concluida: concluida },
  });
}

const banco = new BancoService();
const agora = Date.now();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const aluno = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// Preparo: uma turma e três exercícios do professor u-2.
let r = await chamar('POST', '/turmas', { nome: `Teste atribuições ${agora}` }, prof);
const turma = r.corpo;
const exercicios = [];
for (const [letra, dificuldade] of [['A', 'facil'], ['B', 'medio'], ['C', 'dificil']]) {
  r = await chamar(
    'POST',
    '/exercicios',
    { titulo: `Teste ${agora} ${letra}`, texto: 'Um texto qualquer com mais de vinte letras.', dificuldade, tempoLimiteSegundos: 0 },
    prof,
  );
  assert.equal(r.status, 200, 'preparo: criar exercício');
  exercicios.push(r.corpo);
}
const [exA, exB, exC] = exercicios;
const rota = `/turmas/${turma.id}/atribuicoes`;

// ============================================================================
// Sem token (401) e token de aluno (403)
// ============================================================================

for (const [metodo, caminho, corpo] of [
  ['GET', '/turmas/turma-1/atribuicoes'],
  ['POST', '/turmas/turma-1/atribuicoes', { exercicioIds: ['ex-prof-3'] }],
  ['DELETE', '/turmas/turma-1/atribuicoes/ex-prof-1'],
]) {
  r = await chamar(metodo, caminho, corpo);
  confere(`${metodo} ${caminho}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar(metodo, caminho, corpo, aluno);
  confere(`${metodo} ${caminho}: token de aluno 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}

// ============================================================================
// GET (turma do seed, só leitura)
// ============================================================================

r = await chamar('GET', '/turmas/turma-1/atribuicoes', null, prof);
confere('listar turma-1: 200 com as 8 do seed', r.status === 200 && r.corpo.length === 8);
const primeiraDoSeed = r.corpo[0];
confere(
  'listar turma-1: na ordem de atribuição, com título e data',
  primeiraDoSeed.exercicioId === 'ex-prof-1' && primeiraDoSeed.atribuidoEm === '2026-02-03' && typeof primeiraDoSeed.titulo === 'string',
);
confere('listar turma-1: totalAlunos = alunos ativos (4)', r.corpo.every((a) => a.totalAlunos === 4));
confere('listar turma-1: concluidoPor entre 0 e totalAlunos', r.corpo.every((a) => a.concluidoPor >= 0 && a.concluidoPor <= a.totalAlunos));

r = await chamar('GET', rota, null, prof);
confere('listar: turma nova começa vazia', r.status === 200 && r.corpo.length === 0);

// ============================================================================
// POST
// ============================================================================

r = await chamar('POST', rota, { exercicioIds: [exA.id, exB.id, exA.id] }, prof);
confere('atribuir: 200 com a lista crua, sem repetir o id duplicado', r.status === 200 && r.corpo.length === 2);
confere(
  'atribuir: cada item com exerciseId, data e prazo null',
  r.corpo.every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.atribuidoEm) && a.prazo === null) &&
    r.corpo.map((a) => a.exerciseId).sort().join() === [exA.id, exB.id].sort().join(),
);
const dataDoA = r.corpo.find((a) => a.exerciseId === exA.id).atribuidoEm;

r = await chamar('POST', rota, { exercicioIds: [exA.id] }, prof);
confere('atribuir: repetir não duplica', r.status === 200 && r.corpo.length === 2);
confere('atribuir: repetir não muda a data da primeira vez', r.corpo.find((a) => a.exerciseId === exA.id).atribuidoEm === dataDoA);

// Um id de outro professor no meio: a lista inteira é recusada, e o bom
// também não entra.
r = await chamar('POST', rota, { exercicioIds: [exC.id, 'ex-prof-6'] }, prof);
confere('atribuir: exercício de outro professor 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('POST', rota, { exercicioIds: [exC.id, 'nao-existe'] }, prof);
confere('atribuir: exercício que não existe 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
confere('atribuir: nos 404, nem o id bom foi gravado', (await banco.atribuicoesprof.count({ where: { ClassID: turma.id } })) === 2);

for (const [caso, corpo] of [
  ['lista vazia', { exercicioIds: [] }],
  ['exercicioIds que não é lista', { exercicioIds: exC.id }],
  ['sem exercicioIds', {}],
  ['id que não é texto', { exercicioIds: [123] }],
  ['professorId no corpo', { exercicioIds: [exC.id], professorId: 'u-2' }],
]) {
  r = await chamar('POST', rota, corpo, prof);
  confere(`atribuir: ${caso} 400`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

// ============================================================================
// GET: concluidoPor e totalAlunos
// ============================================================================

r = await chamar('POST', `/turmas/${turma.id}/alunos/importar`, { nomes: ['Lia Rocha', 'Rui Prado'] }, prof);
const [lia, rui] = r.corpo.adicionados;
// Lia conclui o A duas vezes (conta uma); Rui estoura o tempo no A (não conta).
await gravarSessao(lia.id, exA.id, turma.id, true);
await gravarSessao(lia.id, exA.id, turma.id, true);
await gravarSessao(rui.id, exA.id, turma.id, false);

r = await chamar('GET', rota, null, prof);
const itemA = r.corpo.find((a) => a.exercicioId === exA.id);
const itemB = r.corpo.find((a) => a.exercicioId === exB.id);
confere(
  'listar: título e dificuldade do exercício',
  itemA.titulo === exA.titulo && itemA.dificuldade === 'facil' && itemB.dificuldade === 'medio',
);
confere('listar: totalAlunos = 2', r.corpo.every((a) => a.totalAlunos === 2));
confere('listar: concluidoPor conta alunos distintos que concluíram (1)', itemA.concluidoPor === 1);
confere('listar: concluidoPor 0 em quem ninguém fez', itemB.concluidoPor === 0);

// ============================================================================
// DELETE
// ============================================================================

r = await chamar('DELETE', `${rota}/${exA.id}`, null, prof);
confere('remover: 204 sem corpo', r.status === 204 && r.texto === '');
r = await chamar('GET', rota, null, prof);
confere('remover: some da lista', r.corpo.length === 1 && r.corpo[0].exercicioId === exB.id);
confere('remover: as sessões no exercício ficam', (await banco.sessionsprof.count({ where: { ExerciseID: exA.id } })) === 3);
r = await chamar('GET', '/exercicios', null, prof);
confere('remover: o exercício continua na biblioteca', r.corpo.itens.some((ex) => ex.id === exA.id));
r = await chamar('DELETE', `${rota}/${exA.id}`, null, prof);
confere('remover: de novo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('DELETE', `${rota}/${exC.id}`, null, prof);
confere('remover: exercício que nunca foi atribuído 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// Turma de outro professor (turma-5 é de u-1): 404 nas três
// ============================================================================

for (const [metodo, caminho, corpo] of [
  ['GET', '/turmas/turma-5/atribuicoes'],
  ['POST', '/turmas/turma-5/atribuicoes', { exercicioIds: [exC.id] }],
  ['DELETE', '/turmas/turma-5/atribuicoes/ex-prof-6'],
  ['GET', '/turmas/nao-existe/atribuicoes'],
]) {
  r = await chamar(metodo, caminho, corpo, prof);
  confere(`${metodo} ${caminho} (outro dono): 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
confere(
  'a turma-5 continua só com o ex-prof-6',
  (await banco.atribuicoesprof.findMany({ where: { ClassID: 'turma-5' } })).map((a) => a.ExerciseID).join() === 'ex-prof-6',
);

await banco.$disconnect();
console.log(`\nTudo certo. Turma de teste criada: ${turma.id}`);
