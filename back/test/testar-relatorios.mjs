// testar-relatorios.mjs
// Teste de fumaça das quatro rotas de relatório, feito por HTTP (fetch)
// contra o back rodando, sem navegador. Cobre:
//   GET /turmas/:id/relatorio            — as métricas do topo, conta a conta
//   GET /turmas/:id/relatorio/alunos     — uma linha por aluno, com quem nunca treinou
//   GET /turmas/:id/relatorio/exercicios — uma linha por exercício atribuído
//   GET /turmas/:id/alunos/:alunoId/sessoes — mais recente primeiro, com título
//   E, nas quatro: sem token 401, token de aluno 403 TIPO_INVALIDO, turma de
//   outro professor (ou aluno de outra turma) 404 NAO_ENCONTRADO.
//
// Os números esperados saem de sessões com valores e datas escolhidos a
// dedo, gravadas direto no banco (pelo BancoService do dist/): a rota de
// sessão só grava com a data de agora, e a janela de "ativo" (7 dias)
// precisa de sessão antiga. Inclui sessão de exercício ARQUIVADO e de
// exercício TIRADO da turma: as duas continuam contando.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:relatorios
//
// Cria uma turma, quatro exercícios e três alunos só dele; não grava nada
// nas turmas do seed. O npm run seed apaga o que ele cria.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BancoService } from '../dist/banco/banco.service.js';

const URL = 'http://localhost:3000/api';
const UM_DIA = 24 * 60 * 60 * 1000;

// Faz a requisição e devolve status e corpo já lido como JSON.
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
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
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

// Preparo pelas rotas do professor: devolve o corpo, ou para o teste.
async function preparar(metodo, rota, corpo, token) {
  const r = await chamar(metodo, rota, corpo, token);
  assert.ok(r.status === 200 || r.status === 204, `preparo: ${metodo} ${rota} deu ${r.status}`);
  return r.corpo;
}

// Uma sessão gravada direto no banco, `diasAtras` dias antes de agora.
function gravarSessao(aluno, exercicio, wpm, precisao, concluida, diasAtras) {
  return banco.sessionsprof.create({
    data: {
      ID: randomUUID(),
      AlunoID: aluno.id,
      ExerciseID: exercicio.id,
      ClassID: turma.id,
      WPM: wpm,
      Precisao: precisao,
      Acertos: 50,
      Erros: 5,
      Tempo_Gasto_Segundos: 40,
      Concluida: concluida,
      Data_Sessao: new Date(Date.now() - diasAtras * UM_DIA),
    },
  });
}

const banco = new BancoService();
const agora = Date.now();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const aluno = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// Preparo: a turma, quatro exercícios atribuídos e três alunos.
//   ex1 com tempo limite (60 s), ex2 sem limite (0);
//   ex3 vai ser TIRADO da turma; ex4 vai ser ARQUIVADO.
const texto = 'Um texto qualquer com mais de vinte letras.';
const turma = await preparar('POST', '/turmas', { nome: `Teste relatórios ${agora}` }, prof);
const exercicios = [];
for (const [numero, tempo] of [[1, 60], [2, 0], [3, 0], [4, 0]]) {
  exercicios.push(
    await preparar('POST', '/exercicios', { titulo: `Teste ${agora} ${numero}`, texto, dificuldade: 'medio', tempoLimiteSegundos: tempo }, prof),
  );
}
const [ex1, ex2, ex3, ex4] = exercicios;
await preparar('POST', `/turmas/${turma.id}/atribuicoes`, { exercicioIds: exercicios.map((ex) => ex.id) }, prof);
const importados = await preparar('POST', `/turmas/${turma.id}/alunos/importar`, { nomes: ['Ana Teste', 'Beto Teste', 'Caio Teste'] }, prof);
const [ana, beto, caio] = importados.adicionados;

// As sessões (aluno, exercício, PPM, precisão, concluída, dias atrás):
//   Ana:  ex1 40/90 hoje, ex1 50/100 hoje, ex2 10/50 NÃO concluída há 10 dias,
//         ex3 30/80 há 20 dias, ex4 20/70 há 20 dias
//   Beto: ex1 15/60 NÃO concluída há 10 dias (estourou o tempo do ex1)
//   Caio: nenhuma
await gravarSessao(ana, ex1, 40, 90, true, 0);
await gravarSessao(ana, ex1, 50, 100, true, 0);
await gravarSessao(ana, ex2, 10, 50, false, 10);
await gravarSessao(ana, ex3, 30, 80, true, 20);
await gravarSessao(ana, ex4, 20, 70, true, 20);
await gravarSessao(beto, ex1, 15, 60, false, 10);

// Tira o ex3 da turma e arquiva o ex4: as sessões neles continuam contando.
await preparar('DELETE', `/turmas/${turma.id}/atribuicoes/${ex3.id}`, null, prof);
await preparar('DELETE', `/exercicios/${ex4.id}`, null, prof);

const QUATRO_ROTAS = [
  `/turmas/${turma.id}/relatorio`,
  `/turmas/${turma.id}/relatorio/alunos`,
  `/turmas/${turma.id}/relatorio/exercicios`,
  `/turmas/${turma.id}/alunos/${ana.id}/sessoes`,
];

// ============================================================================
// Sem token (401) e token de aluno (403)
// ============================================================================

for (const rota of QUATRO_ROTAS) {
  let r = await chamar('GET', rota);
  confere(`GET ${rota.replace(turma.id, ':id')}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar('GET', rota, null, aluno);
  confere(`GET ${rota.replace(turma.id, ':id')}: token de aluno 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}

// ============================================================================
// GET /turmas/:id/relatorio
// ============================================================================

let r = await chamar('GET', `/turmas/${turma.id}/relatorio`, null, prof);
const topo = r.corpo;
confere('topo: 200', r.status === 200 && topo.turmaId === turma.id);
confere('topo: totalAlunos 3', topo.totalAlunos === 3);
confere('topo: alunosComSessao 2 (Caio nunca treinou)', topo.alunosComSessao === 2);
confere('topo: alunosAtivos 1 (só a Ana treinou nos últimos 7 dias)', topo.alunosAtivos === 1);
// Concluídas da turma: 40, 50, 30, 20 -> 35; precisão 90, 100, 80, 70 -> 85.
confere('topo: wpmMedio = média das SESSÕES concluídas (35)', topo.wpmMedio === 35);
confere('topo: precisaoMedia (85)', topo.precisaoMedia === 85);
confere(
  'topo: exerciciosConcluidos = pares (aluno, exercício) concluídos, com ex3 e ex4 (3)',
  topo.exerciciosConcluidos === 3,
);

// ============================================================================
// GET /turmas/:id/relatorio/alunos
// ============================================================================

r = await chamar('GET', `/turmas/${turma.id}/relatorio/alunos`, null, prof);
confere('por aluno: 200, uma linha por aluno, inclusive quem nunca treinou', r.status === 200 && r.corpo.length === 3);
const linhaAna = r.corpo.find((l) => l.id === ana.id);
const linhaBeto = r.corpo.find((l) => l.id === beto.id);
const linhaCaio = r.corpo.find((l) => l.id === caio.id);
confere(
  'por aluno: Ana com 5 sessões, médias 35 / 85, 3 exercícios concluídos',
  linhaAna.totalSessoes === 5 && linhaAna.wpmMedio === 35 && linhaAna.precisaoMedia === 85 && linhaAna.exerciciosConcluidos === 3,
);
confere('por aluno: exerciciosAtribuidos = os que a turma tem agora (2)', r.corpo.every((l) => l.exerciciosAtribuidos === 2));
confere(
  'por aluno: Beto só com sessão não concluída -> médias null, 0 concluídos',
  linhaBeto.totalSessoes === 1 && linhaBeto.wpmMedio === null && linhaBeto.precisaoMedia === null && linhaBeto.exerciciosConcluidos === 0,
);
confere(
  'por aluno: Caio nunca treinou -> 0 sessões, médias null, sem atividade',
  linhaCaio.totalSessoes === 0 && linhaCaio.wpmMedio === null && linhaCaio.ultimaAtividade === null,
);
const listaDeAlunos = await chamar('GET', `/turmas/${turma.id}/alunos`, null, prof);
const anaNaLista = listaDeAlunos.corpo.find((l) => l.id === ana.id);
confere(
  'por aluno: a linha é a de GET /turmas/:id/alunos mais as duas contagens',
  JSON.stringify({ ...anaNaLista, exerciciosConcluidos: 3, exerciciosAtribuidos: 2 }) === JSON.stringify(linhaAna),
);

// ============================================================================
// GET /turmas/:id/relatorio/exercicios
// ============================================================================

r = await chamar('GET', `/turmas/${turma.id}/relatorio/exercicios`, null, prof);
confere(
  'por exercício: só os atribuídos agora (ex1 e ex2; ex3 saiu e ex4 foi arquivado)',
  r.status === 200 && r.corpo.map((l) => l.exercicioId).sort().join() === [ex1.id, ex2.id].sort().join(),
);
const linhaEx1 = r.corpo.find((l) => l.exercicioId === ex1.id);
const linhaEx2 = r.corpo.find((l) => l.exercicioId === ex2.id);
confere(
  'por exercício: ex1 com título, concluidoPor 1 de 3, médias 45 / 95',
  linhaEx1.titulo === ex1.titulo && linhaEx1.concluidoPor === 1 && linhaEx1.totalAlunos === 3 &&
    linhaEx1.wpmMedio === 45 && linhaEx1.precisaoMedia === 95,
);
confere('por exercício: ex1 tem limite, a sessão não concluída do Beto é estouro (1)', linhaEx1.estouraramTempo === 1);
confere(
  'por exercício: ex2 sem limite -> estouraramTempo 0 mesmo com sessão não concluída; médias null',
  linhaEx2.estouraramTempo === 0 && linhaEx2.concluidoPor === 0 && linhaEx2.wpmMedio === null,
);

// ============================================================================
// GET /turmas/:id/alunos/:alunoId/sessoes
// ============================================================================

r = await chamar('GET', `/turmas/${turma.id}/alunos/${ana.id}/sessoes`, null, prof);
const historico = r.corpo;
confere('sessões do aluno: 200 paginado, pagina 1 com as 5', r.status === 200 && historico.pagina === 1 && historico.total === 5 && historico.itens.length === 5);
const datas = historico.itens.map((s) => s.data);
confere('sessões do aluno: da mais recente para a mais antiga', JSON.stringify(datas) === JSON.stringify([...datas].sort().reverse()));
confere(
  'sessões do aluno: título do JOIN, inclusive do exercício arquivado e do tirado da turma',
  historico.itens.find((s) => s.exerciseId === ex4.id)?.tituloExercicio === ex4.titulo &&
    historico.itens.find((s) => s.exerciseId === ex3.id)?.tituloExercicio === ex3.titulo,
);
r = await chamar('GET', `/turmas/${turma.id}/alunos/${caio.id}/sessoes`, null, prof);
confere('sessões do aluno: quem nunca treinou -> lista vazia', r.status === 200 && r.corpo.total === 0);

// ============================================================================
// 404: turma de outro professor, turma que não existe, aluno de outra turma
// ============================================================================

for (const rota of [
  '/turmas/turma-5/relatorio',
  '/turmas/turma-5/relatorio/alunos',
  '/turmas/turma-5/relatorio/exercicios',
  '/turmas/turma-5/alunos/al-43-t5/sessoes',
  '/turmas/nao-existe/relatorio',
]) {
  r = await chamar('GET', rota, null, prof);
  confere(`GET ${rota} (outro dono): 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
r = await chamar('GET', `/turmas/${turma.id}/alunos/al-44/sessoes`, null, prof);
confere('sessões de aluno de outra turma da mesma conta: 404, e não lista vazia', ehErro(r, 404, 'NAO_ENCONTRADO'));

// A turma do seed responde sem erro (só leitura).
r = await chamar('GET', '/turmas/turma-1/relatorio', null, prof);
confere('turma-1 do seed: topo 200 com 4 alunos', r.status === 200 && r.corpo.totalAlunos === 4);

await banco.$disconnect();
console.log(`\nTudo certo. Turma de teste criada: ${turma.id}`);
