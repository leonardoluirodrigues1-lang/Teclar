// testar-aluno.mjs
// Teste de fumaça das cinco rotas do PRÓPRIO aluno (grupo "Aluno"; o
// ranking tem o script dele), feito por HTTP (fetch) contra o back
// rodando, sem navegador. Cobre:
//   GET /aluno/historico — todas as sessões dele, da mais recente para a
//     mais antiga, com o título do exercício e o nome da turma;
//   GET /aluno/resumo — médias só das concluídas, melhores marcas de todas,
//     dias seguidos; zeros e null para quem nunca treinou;
//   GET /aluno/salas e /aluno/salas/:turmaId — a turma dele com o progresso
//     dele, o estado de cada exercício (feito, tempo_esgotado, nao_feito) e
//     nenhum número de colega;
//   GET /turmas/:turmaId/meu-desempenho — médias null abaixo de 3 sessões
//     concluídas; a média da sala sobre as sessões de todos;
//   turma arquivada some das salas (e dá 404), mas o histórico fica;
//   exercício arquivado sai da sala, mas continua no histórico;
//   sem token 401, token de conta 403, turma que não é a dele 404.
//
// As sessões são gravadas direto no banco (pelo BancoService do dist/),
// porque os dias seguidos precisam de sessões em dias passados, e a rota de
// sessão só grava com a data de agora.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:aluno
//
// Cria uma turma, três exercícios e três alunos só dele. O npm run seed
// apaga o que ele cria.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BancoService } from '../dist/banco/banco.service.js';

const URL = 'http://localhost:3000/api';
const UMA_HORA = 60 * 60 * 1000;
const UM_DIA = 24 * UMA_HORA;

// Faz a requisição e devolve status, corpo já lido como JSON e o texto cru.
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

// Para no primeiro caso que falhar, com o nome dele. `recebido`, nos casos
// que comparam vários valores de uma vez, entra na mensagem da falha.
function confere(nome, condicao, recebido) {
  assert.ok(condicao, recebido === undefined ? nome : `${nome}
  veio: ${JSON.stringify(recebido)}`);
  console.log('ok -', nome);
}

// Mesmo conteúdo, sem ligar para a ordem das chaves (no JSON a ordem não
// muda o significado: capaSemente, opcional, entra por último).
function mesmoObjeto(a, b) {
  const ordenado = (objeto) => JSON.stringify(objeto, Object.keys(objeto ?? {}).sort());
  return ordenado(a) === ordenado(b);
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

// `diasAtras` dias antes de hoje, à `hora` (de Brasília) — hoje no
// calendário de Brasília, que é o dos dias seguidos (diaDe, em
// src/sessoes/dias-seguidos.ts). Hora fixa, e não "agora menos N dias": o
// resultado não pode depender da hora em que o teste roda.
function emBrasilia(diasAtras, hora) {
  const hoje = new Date(Date.now() - 3 * UMA_HORA).toISOString().slice(0, 10);
  return new Date(Date.parse(`${hoje}T00:00:00-03:00`) - diasAtras * UM_DIA + hora * UMA_HORA);
}

// Uma sessão gravada direto no banco, na data pedida. Devolve o id e a
// data, para o teste comparar com o que as rotas dizem.
async function gravarSessao(aluno, exercicio, wpm, precisao, concluida, data) {
  const linha = await banco.sessionsprof.create({
    data: {
      ID: randomUUID(),
      AlunoID: aluno.id,
      ExerciseID: exercicio.id,
      ClassID: turma.id,
      WPM: wpm,
      Precisao: precisao,
      Acertos: 50,
      Erros: 2,
      Tempo_Gasto_Segundos: 60,
      Concluida: concluida,
      Data_Sessao: data,
    },
  });
  return { id: linha.ID, data: linha.Data_Sessao.toISOString() };
}

const banco = new BancoService();
const agora = Date.now();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const anaDoSeed = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// Preparo: a turma, três exercícios (o 1º com tempo limite) e três alunos.
const texto = 'Um texto qualquer com mais de vinte letras.';
const turma = await preparar('POST', '/turmas', { nome: `Teste aluno ${agora}`, ano: 2026, semestre: 2 }, prof);
const ex1 = await preparar('POST', '/exercicios', { titulo: `Teste ${agora} 1`, texto, dificuldade: 'medio', tempoLimiteSegundos: 60 }, prof);
const ex2 = await preparar('POST', '/exercicios', { titulo: `Teste ${agora} 2`, texto: texto + ' Mais um pouco.', dificuldade: 'facil', tempoLimiteSegundos: 0 }, prof);
const ex3 = await preparar('POST', '/exercicios', { titulo: `Teste ${agora} 3`, texto, dificuldade: 'dificil', tempoLimiteSegundos: 0 }, prof);
await preparar('POST', `/turmas/${turma.id}/atribuicoes`, { exercicioIds: [ex1.id, ex2.id, ex3.id] }, prof);
// As três atribuições nascem no mesmo segundo; o teste dá a cada uma a sua
// data, para a ordem da sala (a da atribuição) ser conhecida: 1, 2, 3.
for (const [i, exercicio] of [ex1, ex2, ex3].entries()) {
  await banco.atribuicoesprof.update({
    where: { ClassID_ExerciseID: { ClassID: turma.id, ExerciseID: exercicio.id } },
    data: { Data_Atribuicao: new Date(Date.UTC(2026, 1, 3 + i, 12)) },
  });
}
const importados = await preparar('POST', `/turmas/${turma.id}/alunos/importar`, { nomes: ['Lia Souza', 'Rui Lopes', 'Bia Melo'] }, prof);
const [lia, rui, bia] = importados.adicionados;

// As sessões (dias no calendário de Brasília; "hoje" é agora, porque o
// meio-dia de hoje pode ainda não ter chegado):
//   Lia  ex1 concluída 40 PPM 95%  hoje, agora
//        ex1 NÃO concluída 50 / 80  ontem, 12h      (PPM maior, mas não concluída)
//        ex1 concluída 30 / 90      há 2 dias, 12h
//        ex2 NÃO concluída 20 / 70  há 2 dias, 9h   (tempo esgotado; mais antiga)
//   Rui  ex1 concluída 60 / 100     hoje, agora
//        ex2 concluída 50 / 90      há 5 dias, 12h
//        ex2 concluída 40 / 80      há 6 dias, 12h
//   Bia  nenhuma (até o caso das 22h, no fim)
const liaS1 = await gravarSessao(lia, ex1, 40, 95, true, new Date());
const liaS2 = await gravarSessao(lia, ex1, 50, 80, false, emBrasilia(1, 12));
const liaS3 = await gravarSessao(lia, ex1, 30, 90, true, emBrasilia(2, 12));
const liaS4 = await gravarSessao(lia, ex2, 20, 70, false, emBrasilia(2, 9));
await gravarSessao(rui, ex1, 60, 100, true, new Date());
await gravarSessao(rui, ex2, 50, 90, true, emBrasilia(5, 12));
await gravarSessao(rui, ex2, 40, 80, true, emBrasilia(6, 12));

const tokenLia = await entrar({ codigo: turma.codigo, nome: 'Lia Souza', senha: 'senha1234' });
const tokenRui = await entrar({ codigo: turma.codigo, nome: 'Rui Lopes', senha: 'senha1234' });
const tokenBia = await entrar({ codigo: turma.codigo, nome: 'Bia Melo', senha: 'senha1234' });

// ============================================================================
// 401, 403 e 404
// ============================================================================

const ROTAS = ['/aluno/historico', '/aluno/resumo', '/aluno/salas', `/aluno/salas/${turma.id}`, `/turmas/${turma.id}/meu-desempenho`];
for (const rota of ROTAS) {
  let r = await chamar('GET', rota);
  confere(`GET ${rota}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar('GET', rota, null, prof);
  confere(`GET ${rota}: token de conta (até a do professor da turma) 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}
for (const id of ['turma-1', 'nao-existe']) {
  let r = await chamar('GET', `/aluno/salas/${id}`, null, tokenLia);
  confere(`GET /aluno/salas/${id}: turma que não é a dela 404 (não 403)`, ehErro(r, 404, 'NAO_ENCONTRADO'));
  r = await chamar('GET', `/turmas/${id}/meu-desempenho`, null, tokenLia);
  confere(`GET /turmas/${id}/meu-desempenho: turma que não é a dela 404`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
let r = await chamar('GET', `/aluno/salas/${turma.id}`, null, anaDoSeed);
confere('aluno do seed pedindo a sala de teste 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// GET /aluno/historico
// ============================================================================

r = await chamar('GET', '/aluno/historico', null, tokenLia);
confere('histórico da Lia: paginado com as 4 dela, pagina 1', r.status === 200 && r.corpo.total === 4 && r.corpo.pagina === 1);
confere(
  'histórico: da mais recente para a mais antiga',
  JSON.stringify(r.corpo.itens.map((s) => s.id)) === JSON.stringify([liaS1.id, liaS2.id, liaS3.id, liaS4.id]),
);
const primeira = r.corpo.itens[0];
confere(
  'histórico: o aluno é o do token, com turmaId, título do exercício e nome da turma',
  primeira.alunoId === lia.id &&
    primeira.turmaId === turma.id &&
    primeira.tituloExercicio === ex1.titulo &&
    primeira.nomeTurma === turma.nome &&
    primeira.wpm === 40 &&
    primeira.data === liaS1.data,
);
confere('histórico: nenhuma sessão do Rui', !r.corpo.itens.some((s) => s.alunoId !== lia.id));
r = await chamar('GET', '/aluno/historico', null, tokenBia);
confere('histórico de quem nunca treinou: lista vazia, total 0', r.status === 200 && r.corpo.total === 0 && r.corpo.itens.length === 0);

// ============================================================================
// GET /aluno/resumo
// ============================================================================

r = await chamar('GET', '/aluno/resumo', null, tokenLia);
confere(
  'resumo da Lia: 4 sessões, 2 concluídas; médias das concluídas (40 e 30 -> 35; 95 e 90 -> 93); melhores de TODAS (50 PPM da não concluída, 95%); 3 dias seguidos',
  JSON.stringify(r.corpo) ===
    JSON.stringify({
      sessoesTotais: 4,
      sessoesConcluidas: 2,
      wpmMedio: 35,
      precisaoMedia: 93,
      melhorWpm: 50,
      melhorPrecisao: 95,
      diasSeguidos: 3,
    }),
  r.corpo,
);
r = await chamar('GET', '/aluno/resumo', null, tokenBia);
confere(
  'resumo de quem nunca treinou: zeros nas contagens e null nas médias e marcas (nunca 0)',
  JSON.stringify(r.corpo) ===
    JSON.stringify({
      sessoesTotais: 0,
      sessoesConcluidas: 0,
      wpmMedio: null,
      precisaoMedia: null,
      melhorWpm: null,
      melhorPrecisao: null,
      diasSeguidos: 0,
    }),
  r.corpo,
);
r = await chamar('GET', '/aluno/resumo', null, tokenRui);
confere('resumo do Rui: dias seguidos 1 (hoje, e o dia anterior com treino foi há 5)', r.corpo.diasSeguidos === 1, r.corpo);

// ============================================================================
// GET /aluno/salas e /aluno/salas/:turmaId
// ============================================================================

r = await chamar('GET', '/aluno/salas', null, tokenLia);
const salaEsperada = {
  id: turma.id,
  nome: turma.nome,
  professor: 'Henrique Lima',
  capaSemente: turma.capaSemente,
  totalAlunos: 3,
  exerciciosFeitos: 2,
  exerciciosTotal: 3,
};
confere(
  'salas da Lia: uma só, a dela, com o nome do professor e o progresso dela (2 de 3 feitos: concluído ou tempo esgotado)',
  r.status === 200 && r.corpo.length === 1 && mesmoObjeto(r.corpo[0], salaEsperada),
);
r = await chamar('GET', '/aluno/salas', null, tokenBia);
confere('salas da Bia: a mesma sala, com 0 feitos', r.corpo.length === 1 && r.corpo[0].exerciciosFeitos === 0 && r.corpo[0].exerciciosTotal === 3);

r = await chamar('GET', `/aluno/salas/${turma.id}`, null, tokenLia);
const { lista, ...cabecalho } = r.corpo;
confere('sala da Lia: o cabeçalho igual ao item de GET /aluno/salas', r.status === 200 && mesmoObjeto(cabecalho, salaEsperada));
confere('sala: os exercícios na ordem da atribuição', JSON.stringify(lista.map((ex) => ex.id)) === JSON.stringify([ex1.id, ex2.id, ex3.id]));
confere(
  'sala, ex1: feito; a marca é a melhor CONCLUÍDA (40 / 95, e não os 50 da não concluída); caracteres contados no back; sem o texto',
  lista[0].estado === 'feito' &&
    lista[0].melhorWpm === 40 &&
    lista[0].melhorPrecisao === 95 &&
    lista[0].ultimaSessao === liaS1.data &&
    lista[0].caracteres === texto.length &&
    lista[0].tempoLimiteSegundos === 60 &&
    lista[0].dificuldade === 'medio' &&
    lista[0].atribuidoEm === '2026-02-03' &&
    lista[0].prazo === null &&
    !('texto' in lista[0]),
);
confere(
  'sala, ex2: tempo_esgotado, com a marca da vez em que o tempo acabou (20 / 70)',
  lista[1].estado === 'tempo_esgotado' && lista[1].melhorWpm === 20 && lista[1].melhorPrecisao === 70 && lista[1].ultimaSessao === liaS4.data,
);
confere(
  'sala, ex3: nao_feito, com marcas e data null',
  lista[2].estado === 'nao_feito' && lista[2].melhorWpm === null && lista[2].melhorPrecisao === null && lista[2].ultimaSessao === null,
);
confere(
  'sala: nenhum colega no texto da resposta (nem nome, nem id)',
  !r.texto.includes('Rui') && !r.texto.includes('Bia') && !r.texto.includes(rui.id) && !r.texto.includes(bia.id),
);

// ============================================================================
// GET /turmas/:turmaId/meu-desempenho
// ============================================================================

r = await chamar('GET', `/turmas/${turma.id}/meu-desempenho`, null, tokenLia);
confere(
  'meu desempenho, Lia (2 concluídas, abaixo de 3): contagens, 3 dias seguidos, e as DUAS médias null',
  JSON.stringify(r.corpo) === JSON.stringify({ sessoesConcluidas: 2, licoes: 1, diasSeguidos: 3, minhaMedia: null, mediaSala: null }),
  r.corpo,
);
r = await chamar('GET', `/turmas/${turma.id}/meu-desempenho`, null, tokenRui);
confere(
  'meu desempenho, Rui (3 concluídas): a média dele (60, 50, 40 -> 50; 100, 90, 80 -> 90) e a da sala sobre as 5 concluídas de todos (220/5 = 44; 455/5 = 91)',
  JSON.stringify(r.corpo) ===
    JSON.stringify({
      sessoesConcluidas: 3,
      licoes: 2,
      diasSeguidos: 1,
      minhaMedia: { velocidade: 50, precisao: 90 },
      mediaSala: { velocidade: 44, precisao: 91 },
    }),
  r.corpo,
);
r = await chamar('GET', `/turmas/${turma.id}/meu-desempenho`, null, tokenBia);
confere('meu desempenho, Bia: tudo zero e médias null', r.corpo.sessoesConcluidas === 0 && r.corpo.licoes === 0 && r.corpo.minhaMedia === null);

// ============================================================================
// Exercício arquivado: sai da sala, fica no histórico
// ============================================================================

await preparar('DELETE', `/exercicios/${ex2.id}`, null, prof);
r = await chamar('GET', `/aluno/salas/${turma.id}`, null, tokenLia);
confere(
  'exercício arquivado sai da sala (2 exercícios, 1 feito)',
  r.corpo.lista.length === 2 && !r.corpo.lista.some((ex) => ex.id === ex2.id) && r.corpo.exerciciosTotal === 2 && r.corpo.exerciciosFeitos === 1,
);
r = await chamar('GET', '/aluno/historico', null, tokenLia);
const noArquivado = r.corpo.itens.find((s) => s.id === liaS4.id);
confere('exercício arquivado: a sessão continua no histórico, com o título', r.corpo.total === 4 && noArquivado?.tituloExercicio === ex2.titulo);

// ============================================================================
// Turma arquivada: some das salas, o histórico fica
// ============================================================================

await preparar('PATCH', `/turmas/${turma.id}`, { ativa: false }, prof);
r = await chamar('GET', '/aluno/salas', null, tokenLia);
confere('turma arquivada: GET /aluno/salas vem vazio', r.status === 200 && r.corpo.length === 0);
r = await chamar('GET', `/aluno/salas/${turma.id}`, null, tokenLia);
confere('turma arquivada: a sala dá 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `/turmas/${turma.id}/meu-desempenho`, null, tokenLia);
confere('turma arquivada: meu-desempenho dá 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/aluno/historico', null, tokenLia);
confere('turma arquivada: o histórico continua com as 4 sessões', r.status === 200 && r.corpo.total === 4);
await preparar('PATCH', `/turmas/${turma.id}`, { ativa: true }, prof);

// ============================================================================
// Dias seguidos no calendário de Brasília
// ============================================================================

// 22h de anteontem em Brasília já é 01h de ontem em UTC. Contando em UTC, as
// duas sessões da Bia cairiam no mesmo dia (ontem) e dariam 1; no
// calendário de Brasília são anteontem e ontem: 2 dias seguidos.
await gravarSessao(bia, ex1, 30, 90, true, emBrasilia(2, 22));
await gravarSessao(bia, ex1, 30, 90, true, emBrasilia(1, 12));
r = await chamar('GET', '/aluno/resumo', null, tokenBia);
confere('dias seguidos: sessão às 22h de Brasília conta no mesmo dia de Brasília (2, e não 1)', r.corpo.diasSeguidos === 2, r.corpo);

await banco.$disconnect();
console.log(`\nTudo certo. Turma de teste criada: ${turma.id} (${turma.codigo})`);
