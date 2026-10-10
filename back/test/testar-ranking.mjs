// testar-ranking.mjs
// Teste de fumaça de GET /turmas/:turmaId/ranking, feito por HTTP (fetch)
// contra o back rodando, sem navegador. Cobre:
//   - a pontuação (lições, ritmo, dias seguidos, pontos) com números
//     escolhidos a dedo, e a ordem com desempate por lições;
//   - a ANONIMIZAÇÃO no servidor: do 4º lugar em diante o nome sai null,
//     menos na linha de quem pede — conferido no TEXTO cru da resposta, que
//     é o que aparece na aba de rede do navegador;
//   - lição de exercício arquivado continua contando; aluno desativado sai;
//   - sem token 401, token de conta 403 TIPO_INVALIDO, turma que não é a
//     dele 404 NAO_ENCONTRADO.
//
// As sessões são gravadas direto no banco (pelo BancoService do dist/),
// porque os dias seguidos precisam de sessões em dias passados, e a rota de
// sessão só grava com a data de agora.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:ranking
//
// Cria uma turma, três exercícios e seis alunos só dele. O npm run seed
// apaga o que ele cria.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BancoService } from '../dist/banco/banco.service.js';

const URL = 'http://localhost:3000/api';
const UM_DIA = 24 * 60 * 60 * 1000;

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
function gravarSessao(aluno, exercicio, wpm, concluida, diasAtras) {
  return banco.sessionsprof.create({
    data: {
      ID: randomUUID(),
      AlunoID: aluno.id,
      ExerciseID: exercicio.id,
      ClassID: turma.id,
      WPM: wpm,
      Precisao: 90,
      Concluida: concluida,
      Data_Sessao: new Date(Date.now() - diasAtras * UM_DIA),
    },
  });
}

const banco = new BancoService();
const agora = Date.now();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const anaDoSeed = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// Preparo: a turma, três exercícios atribuídos e seis alunos.
const texto = 'Um texto qualquer com mais de vinte letras.';
const turma = await preparar('POST', '/turmas', { nome: `Teste ranking ${agora}` }, prof);
const exercicios = [];
for (const numero of [1, 2, 3]) {
  exercicios.push(
    await preparar('POST', '/exercicios', { titulo: `Teste ${agora} ${numero}`, texto, dificuldade: 'facil', tempoLimiteSegundos: 0 }, prof),
  );
}
const [ex1, ex2, ex3] = exercicios;
await preparar('POST', `/turmas/${turma.id}/atribuicoes`, { exercicioIds: exercicios.map((ex) => ex.id) }, prof);
const NOMES = ['Rita Alves', 'Sara Brito', 'Tito Cruz', 'Ugo Dias', 'Vera Eça', 'Xavier Faria'];
const importados = await preparar('POST', `/turmas/${turma.id}/alunos/importar`, { nomes: NOMES }, prof);
const [rita, sara, tito, ugo, vera, xavier] = importados.adicionados;

// Os números esperados (pontos = lições*20 + ritmo + dias*5):
//   Rita   3 lições, ritmo 40, 3 dias (hoje, ontem, anteontem) -> 60+40+15 = 115
//   Sara   2 lições, ritmo 50, 2 dias (hoje, ontem)            -> 40+50+10 = 100
//   Xavier 2 lições, ritmo 12, 0 dias (há 10 dias)             -> 40+12    =  52
//   Tito   1 lição,  ritmo 32, 0 dias (há 4 e 5 dias)          -> 20+32    =  52
//   Ugo    0 lições, ritmo null, 1 dia (ontem, não concluída)  ->           5
//   Vera   nenhuma sessão                                     ->           0
// Xavier e Tito empatam em 52: Xavier fica na frente por ter mais lições.
await gravarSessao(rita, ex1, 40, true, 0);
await gravarSessao(rita, ex2, 40, true, 1);
await gravarSessao(rita, ex3, 40, true, 2);
await gravarSessao(sara, ex1, 50, true, 0);
await gravarSessao(sara, ex2, 50, true, 1);
await gravarSessao(xavier, ex1, 12, true, 10);
await gravarSessao(xavier, ex2, 12, true, 10);
await gravarSessao(tito, ex1, 30, true, 5);
await gravarSessao(tito, ex1, 34, true, 4);
await gravarSessao(ugo, ex1, 20, false, 1);

// O primeiro login de cada um grava a senha (primeiro acesso).
const tokens = {};
for (const nome of NOMES) {
  tokens[nome] = await entrar({ codigo: turma.codigo, nome, senha: 'senha1234' });
}
const rota = `/turmas/${turma.id}/ranking`;

// ============================================================================
// 401, 403 e 404
// ============================================================================

let r = await chamar('GET', rota);
confere('sem token 401 TOKEN_INVALIDO', ehErro(r, 401, 'TOKEN_INVALIDO'));
r = await chamar('GET', rota, null, prof);
confere('token de conta (até a do professor da turma) 403 TIPO_INVALIDO', ehErro(r, 403, 'TIPO_INVALIDO'));
r = await chamar('GET', '/turmas/turma-1/ranking', null, tokens['Rita Alves']);
confere('turma que não é a dele 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/turmas/nao-existe/ranking', null, tokens['Rita Alves']);
confere('turma que não existe 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', rota, null, anaDoSeed);
confere('aluno de outra turma pedindo este ranking 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// Pontuação e ordem (vista pela Vera, a última)
// ============================================================================

r = await chamar('GET', rota, null, tokens['Vera Eça']);
const vistoPelaVera = r.corpo;
confere('200 com uma linha por aluno ativo', r.status === 200 && vistoPelaVera.length === 6);
const numeros = vistoPelaVera.map((l) => [l.posicao, l.licoes, l.ritmo, l.diasSeguidos, l.pontos]);
confere(
  'posição, lições, ritmo, dias seguidos e pontos calculados no back',
  JSON.stringify(numeros) ===
    JSON.stringify([
      [1, 3, 40, 3, 115],
      [2, 2, 50, 2, 100],
      [3, 2, 12, 0, 52],
      [4, 1, 32, 0, 52],
      [5, 0, null, 1, 5],
      [6, 0, null, 0, 0],
    ]),
);

// ============================================================================
// Anonimização no servidor
// ============================================================================

confere(
  'Vera vê os nomes do pódio, null do 4º em diante, e o próprio nome',
  JSON.stringify(vistoPelaVera.map((l) => l.nome)) ===
    JSON.stringify(['Rita Alves', 'Sara Brito', 'Xavier Faria', null, null, 'Vera Eça']),
);
confere('Vera: só a linha dela é "voce"', vistoPelaVera.filter((l) => l.voce).length === 1 && vistoPelaVera[5].voce === true);
confere(
  'Vera: o nome do Tito e do Ugo nem aparecem no texto da resposta (aba de rede)',
  !r.texto.includes('Tito') && !r.texto.includes('Ugo') && !r.texto.includes('alunoId'),
);

r = await chamar('GET', rota, null, tokens['Ugo Dias']);
confere(
  'Ugo (5º) vê o próprio nome, e não o do Tito nem o da Vera',
  JSON.stringify(r.corpo.map((l) => l.nome)) === JSON.stringify(['Rita Alves', 'Sara Brito', 'Xavier Faria', null, 'Ugo Dias', null]) &&
    !r.texto.includes('Vera') && !r.texto.includes('Tito'),
);
r = await chamar('GET', rota, null, tokens['Rita Alves']);
confere(
  'Rita (1ª) vê o pódio e mais ninguém',
  JSON.stringify(r.corpo.map((l) => l.nome)) === JSON.stringify(['Rita Alves', 'Sara Brito', 'Xavier Faria', null, null, null]) &&
    r.corpo[0].voce === true,
);

// ============================================================================
// Exercício arquivado e aluno desativado
// ============================================================================

await preparar('DELETE', `/exercicios/${ex3.id}`, null, prof);
r = await chamar('GET', rota, null, tokens['Rita Alves']);
confere('lição de exercício arquivado continua contando (Rita: 3 lições, 115)', r.corpo[0].licoes === 3 && r.corpo[0].pontos === 115);

// Não há rota que desative aluno; o teste desliga a Sara no banco.
await banco.alunos.update({ where: { ID: sara.id }, data: { Ativo: false } });
r = await chamar('GET', rota, null, tokens['Rita Alves']);
confere(
  'aluno desativado sai do ranking (Ativo = TRUE é o do aluno)',
  r.corpo.length === 5 && !r.texto.includes('Sara') && r.corpo[1].nome === 'Xavier Faria' && r.corpo[3].nome === null,
);
await banco.alunos.update({ where: { ID: sara.id }, data: { Ativo: true } });

await banco.$disconnect();
console.log(`\nTudo certo. Turma de teste criada: ${turma.id} (${turma.codigo})`);
