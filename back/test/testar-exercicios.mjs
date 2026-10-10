// testar-exercicios.mjs
// Teste de fumaça das cinco rotas de /exercicios, feito por HTTP (fetch)
// contra o back rodando, sem navegador. Cobre:
//   GET    /exercicios — só os ativos do professor do token, paginado
//     (pagina 1, tudo), com atribuidoA.
//   GET    /exercicios/:id — professor (o dele) e ALUNO (com ?turma= da
//     turma dele e o exercício atribuído a ela; senão 404).
//   POST   /exercicios — 200 na forma da listagem; os 400 da validação
//     (os LIMITES do front) e do professorId no corpo.
//   PATCH  /exercicios/:id — o formulário inteiro.
//   DELETE /exercicios/:id — ARQUIVA: some da biblioteca e de todas as
//     turmas, mas a linha e as sessões ficam (conferido no banco).
//   E: sem token 401, token de aluno 403 TIPO_INVALIDO (menos no
//   GET /exercicios/:id), exercício de outro professor 404.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:exercicios
//
// Não mexe nos exercícios do seed: edita e arquiva só os que cria. Grava
// uma sessão direto no banco (pelo BancoService do dist/), porque ainda
// não há rota de sessão do mundo Escola — é ela que prova que arquivar não
// apaga sessão. Cada execução cria exercícios "Teste <horário>" e duas
// turmas; o npm run seed apaga.
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

const banco = new BancoService();
const agora = Date.now();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const leo = await entrar({ email: 'leo@teclar.dev', senha: 'senha123' });
const aluno = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// Um formulário válido; cada caso de 400 quebra um campo dele.
const FORMULARIO = {
  titulo: `Teste ${agora}`,
  texto: 'Primeira linha do texto,\nsegunda linha do mesmo texto.',
  dificuldade: 'medio',
  tempoLimiteSegundos: 90,
};

// ============================================================================
// Sem token (401) e token de aluno (403)
// ============================================================================

const ROTAS = [
  ['GET', '/exercicios'],
  ['POST', '/exercicios', FORMULARIO],
  ['PATCH', '/exercicios/ex-prof-1', FORMULARIO],
  ['DELETE', '/exercicios/ex-prof-1'],
];
for (const [metodo, rota, corpo] of ROTAS) {
  let r = await chamar(metodo, rota, corpo);
  confere(`${metodo} ${rota}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar(metodo, rota, corpo, aluno);
  confere(`${metodo} ${rota}: token de aluno 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}
let r = await chamar('GET', '/exercicios/ex-prof-1?turma=turma-1');
confere('GET /exercicios/:id: sem token 401 TOKEN_INVALIDO', ehErro(r, 401, 'TOKEN_INVALIDO'));

// ============================================================================
// POST /exercicios
// ============================================================================

r = await chamar('POST', '/exercicios', FORMULARIO, prof);
confere('criar: 200', r.status === 200);
const criado = r.corpo;
confere(
  'criar: na forma da listagem, professorId do token, atribuidoA 0',
  criado.professorId === 'u-2' &&
    criado.titulo === FORMULARIO.titulo &&
    criado.dificuldade === 'medio' &&
    criado.tempoLimiteSegundos === 90 &&
    criado.atribuidoA === 0,
);
confere('criar: a quebra de linha vira espaço, como a tela faz', criado.texto === 'Primeira linha do texto, segunda linha do mesmo texto.');

for (const [caso, mudanca] of [
  ['título de 2 caracteres', { titulo: 'ab' }],
  ['título de 101 caracteres', { titulo: 'x'.repeat(101) }],
  ['texto de 19 caracteres', { texto: 'x'.repeat(19) }],
  ['texto de 2001 caracteres', { texto: 'x'.repeat(2001) }],
  ['dificuldade fora da lista', { dificuldade: 'facilima' }],
  ['tempo de 3601 segundos', { tempoLimiteSegundos: 3601 }],
  ['tempo negativo', { tempoLimiteSegundos: -1 }],
  ['tempo em texto', { tempoLimiteSegundos: '60' }],
  ['sem título', { titulo: undefined }],
  ['professorId no corpo', { professorId: 'u-2' }],
]) {
  r = await chamar('POST', '/exercicios', { ...FORMULARIO, ...mudanca }, prof);
  confere(`criar: ${caso} 400 (${r.corpo?.mensagem})`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

// ============================================================================
// GET /exercicios e GET /exercicios/:id (professor)
// ============================================================================

r = await chamar('GET', '/exercicios', null, prof);
confere('listar: 200 paginado, pagina 1 com tudo', r.status === 200 && r.corpo.pagina === 1 && r.corpo.total === r.corpo.itens.length);
confere('listar: só os de u-2', r.corpo.itens.every((ex) => ex.professorId === 'u-2'));
confere('listar: não traz o ex-prof-6 (de u-1)', !r.corpo.itens.some((ex) => ex.id === 'ex-prof-6'));
confere('listar: traz o criado', r.corpo.itens.some((ex) => ex.id === criado.id));
confere('listar: atribuidoA contado no back (ex-prof-1 está em turma)', r.corpo.itens.find((ex) => ex.id === 'ex-prof-1').atribuidoA >= 1);

r = await chamar('GET', `/exercicios/${criado.id}`, null, prof);
confere('obter: o próprio, 200 igual ao da criação', r.status === 200 && JSON.stringify(r.corpo) === JSON.stringify(criado));
r = await chamar('GET', '/exercicios/ex-prof-1?turma=turma-5', null, prof);
confere('obter: professor ignora o ?turma=', r.status === 200 && r.corpo.id === 'ex-prof-1');

// ============================================================================
// GET /exercicios/:id (aluno: Ana Pires, da turma-1)
// ============================================================================

r = await chamar('GET', '/exercicios/ex-prof-1?turma=turma-1', null, aluno);
confere('aluno: exercício atribuído à turma dele 200', r.status === 200 && r.corpo.id === 'ex-prof-1' && typeof r.corpo.texto === 'string');
r = await chamar('GET', '/exercicios/ex-prof-1', null, aluno);
confere('aluno: sem ?turma= 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/exercicios/ex-prof-1?turma=turma-2', null, aluno);
confere('aluno: ?turma= que não é a dele 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `/exercicios/${criado.id}?turma=turma-1`, null, aluno);
confere('aluno: exercício não atribuído à turma dele 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// PATCH /exercicios/:id
// ============================================================================

const editado = { titulo: `Teste ${agora} editado`, texto: 'Um texto novo com mais de vinte letras.', dificuldade: 'dificil', tempoLimiteSegundos: 0 };
r = await chamar('PATCH', `/exercicios/${criado.id}`, editado, prof);
confere(
  'atualizar: 200 como ficou',
  r.status === 200 && r.corpo.titulo === editado.titulo && r.corpo.dificuldade === 'dificil' && r.corpo.tempoLimiteSegundos === 0,
);
r = await chamar('PATCH', `/exercicios/${criado.id}`, { titulo: 'Só o título' }, prof);
confere('atualizar: formulário pela metade 400', ehErro(r, 400, 'DADOS_INVALIDOS'));
r = await chamar('PATCH', `/exercicios/${criado.id}`, { ...editado, professorId: 'u-1' }, prof);
confere('atualizar: professorId no corpo 400', ehErro(r, 400, 'DADOS_INVALIDOS'));

// ============================================================================
// Exercício de outro professor (ex-prof-6 é de u-1): 404 em tudo
// ============================================================================

for (const [metodo, corpo] of [['GET'], ['PATCH', editado], ['DELETE']]) {
  r = await chamar(metodo, '/exercicios/ex-prof-6', corpo, prof);
  confere(`${metodo} /exercicios/ex-prof-6 (outro dono): 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
r = await chamar('GET', '/exercicios/nao-existe', null, prof);
confere('GET de id que não existe: 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/exercicios/ex-prof-6', null, leo);
confere('ex-prof-6 continua intacto para o dono', r.status === 200 && r.corpo.titulo === 'Aquecimento');

// ============================================================================
// DELETE /exercicios/:id — arquiva
// ============================================================================

// Preparo: o exercício em duas turmas de teste, com um aluno e uma sessão.
const turmaA = (await chamar('POST', '/turmas', { nome: `Teste exercícios ${agora} A` }, prof)).corpo;
const turmaB = (await chamar('POST', '/turmas', { nome: `Teste exercícios ${agora} B` }, prof)).corpo;
for (const turma of [turmaA, turmaB]) {
  r = await chamar('POST', `/turmas/${turma.id}/atribuicoes`, { exercicioIds: [criado.id] }, prof);
  assert.equal(r.status, 200, 'preparo: atribuir');
}
r = await chamar('POST', `/turmas/${turmaA.id}/alunos/importar`, { nomes: ['Aluno do Teste'] }, prof);
const alunoDoTeste = r.corpo.adicionados[0];
const sessaoId = randomUUID();
await banco.sessionsprof.create({
  data: { ID: sessaoId, AlunoID: alunoDoTeste.id, ExerciseID: criado.id, ClassID: turmaA.id, WPM: 35, Precisao: 92 },
});
r = await chamar('GET', '/exercicios', null, prof);
confere('arquivar: preparo, atribuído a 2 turmas', r.corpo.itens.find((ex) => ex.id === criado.id).atribuidoA === 2);

r = await chamar('DELETE', `/exercicios/${criado.id}`, null, prof);
confere('arquivar: 204 sem corpo', r.status === 204 && r.texto === '');

r = await chamar('GET', '/exercicios', null, prof);
confere('arquivar: some da biblioteca', !r.corpo.itens.some((ex) => ex.id === criado.id));
for (const turma of [turmaA, turmaB]) {
  r = await chamar('GET', `/turmas/${turma.id}/atribuicoes`, null, prof);
  confere(`arquivar: some das atribuições da turma ${turma.nome.slice(-1)}`, r.status === 200 && r.corpo.length === 0);
}
r = await chamar('GET', `/exercicios/${criado.id}`, null, prof);
confere('arquivar: GET dele 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('PATCH', `/exercicios/${criado.id}`, editado, prof);
confere('arquivar: PATCH dele 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('DELETE', `/exercicios/${criado.id}`, null, prof);
confere('arquivar: arquivar de novo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('POST', `/turmas/${turmaA.id}/atribuicoes`, { exercicioIds: [criado.id] }, prof);
confere('arquivar: atribuir de novo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// O que já foi feito fica: a linha (Ativo = false) e a sessão.
const linha = await banco.exerciciosprof.findUnique({ where: { ExerciseID: criado.id } });
confere('arquivar: a linha continua no banco, com Ativo = false', linha !== null && linha.Ativo === false);
confere('arquivar: as atribuições dele foram apagadas', (await banco.atribuicoesprof.count({ where: { ExerciseID: criado.id } })) === 0);
confere('arquivar: a sessão do aluno continua', (await banco.sessionsprof.count({ where: { ID: sessaoId } })) === 1);
r = await chamar('GET', `/turmas/${turmaA.id}/alunos/${alunoDoTeste.id}/desempenho`, null, prof);
confere('arquivar: o histórico do aluno não muda', r.status === 200 && r.corpo.sessoes.some((s) => s.id === sessaoId && s.exerciseId === criado.id));

await banco.$disconnect();
console.log(`\nTudo certo. Exercício de teste (arquivado): ${criado.id}`);
