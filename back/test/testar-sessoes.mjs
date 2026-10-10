// testar-sessoes.mjs
// Teste de fumaça das duas rotas de /sessoes, feito por HTTP (fetch) contra
// o back rodando, sem navegador. Cobre:
//   POST /sessoes — o aluno sai do token; recordePessoal; os agregados do
//     aluno passam a contar a sessão; os 400 (ids de pessoa no corpo e
//     medidas fora das colunas); 404 para turma que não é a dele, exercício
//     não atribuído e exercício arquivado; 401 para turma arquivada depois
//     do login; 403 para token de conta.
//   GET /sessoes/:id — só o dono lê: aluno lê as dele da Escola, conta lê as
//     do Solo da campanha dele; de outra pessoa é 404.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:sessoes
//
// Cria duas turmas, dois exercícios e três alunos só dele; não grava nada
// nas turmas do seed. Grava no banco (pelo BancoService do dist/) só uma
// sessão do Solo em cada campanha, porque o seed não tem nenhuma e
// POST /solo/sessoes ainda não está implementada. O npm run seed apaga o
// que ele cria.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BancoService } from '../dist/banco/banco.service.js';

const URL = 'http://localhost:3000/api';

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

const banco = new BancoService();
const agora = Date.now();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const leo = await entrar({ email: 'leo@teclar.dev', senha: 'senha123' });

// Preparo: turma A com o exercício 1 atribuído e o 2 não; turma B com o 1.
const texto = 'Um texto qualquer com mais de vinte letras.';
const turmaA = await preparar('POST', '/turmas', { nome: `Teste sessões ${agora} A` }, prof);
const turmaB = await preparar('POST', '/turmas', { nome: `Teste sessões ${agora} B` }, prof);
const ex1 = await preparar('POST', '/exercicios', { titulo: `Teste ${agora} 1`, texto, dificuldade: 'facil', tempoLimiteSegundos: 60 }, prof);
const ex2 = await preparar('POST', '/exercicios', { titulo: `Teste ${agora} 2`, texto, dificuldade: 'facil', tempoLimiteSegundos: 0 }, prof);
await preparar('POST', `/turmas/${turmaA.id}/atribuicoes`, { exercicioIds: [ex1.id] }, prof);
await preparar('POST', `/turmas/${turmaB.id}/atribuicoes`, { exercicioIds: [ex1.id] }, prof);
const importadosA = await preparar('POST', `/turmas/${turmaA.id}/alunos/importar`, { nomes: ['Aluno Um', 'Aluno Dois'] }, prof);
await preparar('POST', `/turmas/${turmaB.id}/alunos/importar`, { nomes: ['Aluno Três'] }, prof);
const [alunoUm] = importadosA.adicionados;
// O primeiro login de cada um grava a senha (primeiro acesso).
const um = await entrar({ codigo: turmaA.codigo, nome: 'Aluno Um', senha: 'um1234' });
const dois = await entrar({ codigo: turmaA.codigo, nome: 'Aluno Dois', senha: 'dois1234' });
const tres = await entrar({ codigo: turmaB.codigo, nome: 'Aluno Três', senha: 'tres1234' });

// Um corpo válido; cada caso de erro muda um pedaço dele.
const SESSAO = {
  exercicio_id: ex1.id,
  turma_id: turmaA.id,
  wpm: 30,
  precisao: 94.5,
  acertos: 141,
  erros: 9,
  tempo_gasto_segundos: 58,
  concluida: true,
};

// ============================================================================
// Sem token (401) e token de conta (403)
// ============================================================================

let r = await chamar('POST', '/sessoes', SESSAO);
confere('POST /sessoes: sem token 401 TOKEN_INVALIDO', ehErro(r, 401, 'TOKEN_INVALIDO'));
r = await chamar('GET', '/sessoes/qualquer');
confere('GET /sessoes/:id: sem token 401 TOKEN_INVALIDO', ehErro(r, 401, 'TOKEN_INVALIDO'));
r = await chamar('POST', '/sessoes', SESSAO, prof);
confere('POST /sessoes: token de conta 403 TIPO_INVALIDO', ehErro(r, 403, 'TIPO_INVALIDO'));

// ============================================================================
// POST /sessoes: 400
// ============================================================================

for (const [caso, mudanca] of [
  ['usuario_id no corpo', { usuario_id: 'al-44' }],
  ['alunoId no corpo', { alunoId: 'al-44' }],
  ['professorId no corpo', { professorId: 'u-2' }],
  ['sem exercicio_id', { exercicio_id: undefined }],
  ['sem turma_id', { turma_id: undefined }],
  ['wpm negativo', { wpm: -1 }],
  ['wpm acima de 999,99', { wpm: 1000 }],
  ['wpm em texto', { wpm: '30' }],
  ['precisão acima de 100', { precisao: 100.5 }],
  ['acertos quebrado', { acertos: 1.5 }],
  ['erros negativo', { erros: -1 }],
  ['tempo em texto', { tempo_gasto_segundos: '58' }],
  ['concluida que não é booleano', { concluida: 'sim' }],
]) {
  r = await chamar('POST', '/sessoes', { ...SESSAO, ...mudanca }, um);
  confere(`registrar: ${caso} 400 (${r.corpo?.mensagem})`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

// ============================================================================
// POST /sessoes: 404
// ============================================================================

for (const [caso, mudanca] of [
  ['turma_id de outra turma (a B, onde ele não está)', { turma_id: turmaB.id }],
  ['turma_id de turma do seed', { turma_id: 'turma-1' }],
  ['exercício da conta mas não atribuído à turma', { exercicio_id: ex2.id }],
  ['exercício de outro professor', { exercicio_id: 'ex-prof-6' }],
  ['exercício que não existe', { exercicio_id: 'nao-existe' }],
]) {
  r = await chamar('POST', '/sessoes', { ...SESSAO, ...mudanca }, um);
  confere(`registrar: ${caso} 404`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
confere('registrar: nenhum erro gravou sessão', (await banco.sessionsprof.count({ where: { AlunoID: alunoUm.id } })) === 0);

// ============================================================================
// POST /sessoes: 200 e recordePessoal
// ============================================================================

r = await chamar('POST', '/sessoes', SESSAO, um);
const primeira = r.corpo;
confere('registrar: 200', r.status === 200);
confere(
  'registrar: a sessão é do aluno do TOKEN, na turma dele',
  primeira.alunoId === alunoUm.id && primeira.turmaId === turmaA.id && primeira.exerciseId === ex1.id,
);
confere(
  'registrar: as medidas gravadas como chegaram',
  primeira.wpm === 30 && primeira.precisao === 94.5 && primeira.acertos === 141 && primeira.erros === 9 &&
    primeira.tempoSegundos === 58 && primeira.concluida === true && !Number.isNaN(Date.parse(primeira.data)),
);
confere('registrar: a primeira sessão no exercício é recorde', primeira.recordePessoal === true);

for (const [wpm, recorde, caso] of [
  [25, false, 'PPM menor que o melhor'],
  [30.5, true, 'PPM maior que o melhor'],
  [30.5, false, 'PPM igual ao melhor'],
]) {
  r = await chamar('POST', '/sessoes', { ...SESSAO, wpm }, um);
  confere(`registrar: ${caso} -> recordePessoal ${recorde}`, r.status === 200 && r.corpo.recordePessoal === recorde);
}
r = await chamar('POST', '/sessoes', { ...SESSAO, wpm: 99, concluida: false }, um);
confere('registrar: sessão em que o tempo estourou também grava', r.status === 200 && r.corpo.concluida === false);

// Os agregados do aluno passam a contar as sessões (média das concluídas).
r = await chamar('GET', `/turmas/${turmaA.id}/alunos`, null, prof);
const linhaDoUm = r.corpo.find((a) => a.id === alunoUm.id);
const mediaEsperada = Math.round((30 + 25 + 30.5 + 30.5) / 4);
confere(
  `registrar: agregados do aluno contam as sessões (5 sessões, média ${mediaEsperada})`,
  linhaDoUm.totalSessoes === 5 && linhaDoUm.wpmMedio === mediaEsperada,
);

// O recorde é de CADA aluno: o primeiro do Dois é recorde dele.
r = await chamar('POST', '/sessoes', { ...SESSAO, wpm: 10 }, dois);
confere('registrar: o recorde é por aluno', r.status === 200 && r.corpo.recordePessoal === true);
const sessaoDoDois = r.corpo;

// ============================================================================
// GET /sessoes/:id
// ============================================================================

r = await chamar('GET', `/sessoes/${primeira.id}`, null, um);
const { recordePessoal, ...semRecorde } = primeira;
confere('obter: o dono lê a sessão, igual à gravada', r.status === 200 && JSON.stringify(r.corpo) === JSON.stringify(semRecorde));
r = await chamar('GET', `/sessoes/${primeira.id}`, null, dois);
confere('obter: sessão de outro aluno 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `/sessoes/${sessaoDoDois.id}`, null, um);
confere('obter: e vice-versa 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `/sessoes/${primeira.id}`, null, prof);
confere('obter: conta não lê sessão da Escola (nem a do aluno dela) 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/sessoes/nao-existe', null, um);
confere('obter: id que não existe 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// Solo: uma sessão na campanha de cada conta (camp-2 é de u-2, camp-1 de
// u-1). Gravada direto no banco, porque o seed não tem sessão do Solo e
// POST /solo/sessoes ainda não está implementada.
const licaoDoSolo = await banco.exerciciossolo.findFirst();
const sessaoDoSolo = (campanhaId) =>
  banco.sessionssolo.create({
    data: { ID: randomUUID(), CampanhaID: campanhaId, ExerciseID: licaoDoSolo.ExerciseID, WPM: 41, Precisao: 92, XPGanho: 73 },
  });
const doProf = await sessaoDoSolo('camp-2');
const doLeo = await sessaoDoSolo('camp-1');
r = await chamar('GET', `/sessoes/${doProf.ID}`, null, prof);
confere(
  'obter: conta lê a sessão do Solo dela, com xpGanho',
  r.status === 200 && r.corpo.id === doProf.ID && typeof r.corpo.xpGanho === 'number' && !('alunoId' in r.corpo),
);
r = await chamar('GET', `/sessoes/${doProf.ID}`, null, leo);
confere('obter: sessão do Solo de outra conta 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `/sessoes/${doLeo.ID}`, null, um);
confere('obter: aluno não lê sessão do Solo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// Exercício arquivado e turma arquivada
// ============================================================================

await preparar('DELETE', `/exercicios/${ex1.id}`, null, prof);
r = await chamar('POST', '/sessoes', SESSAO, um);
confere('arquivado: sessão nova num exercício arquivado 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `/turmas/${turmaA.id}/alunos/${alunoUm.id}/sessoes`, null, prof);
confere('arquivado: as sessões antigas continuam no histórico', r.status === 200 && r.corpo.total === 5);
r = await chamar('GET', `/sessoes/${primeira.id}`, null, um);
confere('arquivado: e o dono ainda relê a sessão antiga', r.status === 200);

// O Três tem token válido, mas a turma dele é arquivada depois do login.
await preparar('PATCH', `/turmas/${turmaB.id}`, { ativa: false }, prof);
r = await chamar('POST', '/sessoes', { ...SESSAO, turma_id: turmaB.id }, tres);
confere('turma arquivada depois do login: 401 TOKEN_INVALIDO', ehErro(r, 401, 'TOKEN_INVALIDO'));

await banco.$disconnect();
console.log(`\nTudo certo. Turmas de teste criadas: ${turmaA.id}, ${turmaB.id}`);
