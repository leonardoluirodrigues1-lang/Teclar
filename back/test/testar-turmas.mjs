// testar-turmas.mjs
// Teste de fumaça das quatro rotas de turmas já implementadas, feito por
// HTTP (fetch) contra o back rodando, sem navegador. Cobre:
//   GET /turmas — só as ativas da conta do token, com as contagens; com
//     ?ativa=false, só as arquivadas.
//   POST /turmas — 200 na forma de um item de GET /turmas, código na regra
//     da lousa, capaSemente sorteada, periodo montado de ano e semestre;
//     professorId no corpo 400; 400 DADOS_INVALIDOS e 409.
//   PATCH /turmas/:id — renomear, trocar a capa, arquivar e desarquivar,
//     com os 400 e o 409 de cada um.
//   Nome único só entre ATIVAS: arquivada não bloqueia o nome, mas
//     desarquivar com o nome já em uso por uma ativa dá 409.
//   POST /turmas/:id/codigo/novo — outro código, na mesma regra.
//   E, em todas: sem token 401, token de aluno 403 TIPO_INVALIDO, turma de
//   outro professor (ou que não existe) 404 NAO_ENCONTRADO.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:turmas
//
// Não mexe nas turmas do seed (o código K7M2QX é usado pelo test:auth):
// arquiva e troca o código só das turmas que ele mesmo cria.
//
// Grava no banco: cada execução cria três turmas "Teste <horário>" na
// conta prof@teclar.dev. O npm run seed apaga todas.
import assert from 'node:assert/strict';

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

// A regra do código: 6 de A-Z e 2-9, sem I, O, 0 e 1.
const FORMATO_DO_CODIGO = /^[A-HJ-NP-Z2-9]{6}$/;

// Nomes novos a cada execução: o teste roda de novo sem bater no 409.
const nomeA = `Teste ${Date.now()} A`;
const nomeB = `Teste ${Date.now()} B`;

const loginProf = await chamar('POST', '/auth/login', { email: 'prof@teclar.dev', senha: 'senha123' });
confere('login do professor de teste (u-2)', loginProf.status === 200);
const prof = loginProf.corpo.token;

const loginAluno = await chamar('POST', '/auth/login', { codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });
confere('login do aluno de teste', loginAluno.status === 200);
const aluno = loginAluno.corpo.token;

// ============================================================================
// Sem token (401) e token de aluno (403), nas quatro rotas
// ============================================================================

const QUATRO_ROTAS = [
  ['GET', '/turmas'],
  ['POST', '/turmas', { nome: 'Turma do aluno' }],
  ['PATCH', '/turmas/turma-1', { nome: 'Invadida' }],
  ['POST', '/turmas/turma-1/codigo/novo'],
];

for (const [metodo, rota, corpo] of QUATRO_ROTAS) {
  let r = await chamar(metodo, rota, corpo);
  confere(`${metodo} ${rota}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar(metodo, rota, corpo, aluno);
  confere(`${metodo} ${rota}: token de aluno 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}

// ============================================================================
// GET /turmas
// ============================================================================

let r = await chamar('GET', '/turmas', null, prof);
confere('listar: 200 com array', r.status === 200 && Array.isArray(r.corpo));
confere('listar: só turmas de u-2, todas ativas', r.corpo.every((t) => t.professorId === 'u-2' && t.ativa === true));
confere('listar: não traz a turma-5 (de u-1)', !r.corpo.some((t) => t.id === 'turma-5'));
confere('listar: não traz a turma-8 (arquivada)', !r.corpo.some((t) => t.id === 'turma-8'));
const turma1 = r.corpo.find((t) => t.id === 'turma-1');
confere(
  'listar: turma-1 completa, com contagens do back',
  turma1?.codigo === 'K7M2QX' &&
    turma1.totalAlunos > 0 &&
    turma1.totalExercicios > 0 &&
    turma1.periodo === '2026 · 1º semestre' &&
    turma1.capaSemente === 7001 &&
    turma1.dataCriacao === '2026-02-01',
);
console.log(`     (turma-1: ${turma1.totalAlunos} alunos, ${turma1.totalExercicios} exercícios)`);
const turma7 = r.corpo.find((t) => t.id === 'turma-7');
confere('listar: turma sem ano/semestre nem capa vem sem periodo e capaSemente', turma7 && !('periodo' in turma7) && !('capaSemente' in turma7));

r = await chamar('GET', '/turmas?ativa=false', null, prof);
confere('listar arquivadas: 200, só arquivadas de u-2', r.status === 200 && r.corpo.every((t) => t.ativa === false && t.professorId === 'u-2'));
confere('listar arquivadas: traz a turma-8', r.corpo.some((t) => t.id === 'turma-8'));

// ============================================================================
// POST /turmas
// ============================================================================

// professorId no corpo é recusado, e não ignorado — até o do próprio
// professor: quem manda acharia que escolheu o dono.
for (const professorId of ['u-1', 'u-2']) {
  r = await chamar('POST', '/turmas', { nome: `${nomeA} intrusa`, professorId }, prof);
  confere(`criar: professorId "${professorId}" no corpo 400 DADOS_INVALIDOS`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

r = await chamar('POST', '/turmas', { nome: `  ${nomeA.replace(' ', '  ')} `, ano: 2026, semestre: 1 }, prof);
confere('criar: 200', r.status === 200);
const nova = r.corpo;
confere('criar: nome normalizado', nova.nome === nomeA);
confere('criar: professorId do token', nova.professorId === 'u-2');
confere(`criar: código na regra da lousa (${nova.codigo})`, FORMATO_DO_CODIGO.test(nova.codigo));
confere('criar: capaSemente sorteada', Number.isInteger(nova.capaSemente));
confere('criar: periodo montado', nova.periodo === '2026 · 1º semestre');
confere(
  'criar: nasce ativa, sem alunos nem exercícios, com data',
  nova.ativa === true && nova.totalAlunos === 0 && nova.totalExercicios === 0 && /^\d{4}-\d{2}-\d{2}$/.test(nova.dataCriacao),
);

r = await chamar('GET', '/turmas', null, prof);
confere('criar: aparece em GET /turmas igual à resposta', JSON.stringify(r.corpo.find((t) => t.id === nova.id)) === JSON.stringify(nova));

r = await chamar('POST', '/turmas', { nome: nomeB }, prof);
confere('criar: sem ano e semestre, 200 sem periodo', r.status === 200 && !('periodo' in r.corpo));
const outra = r.corpo;

r = await chamar('POST', '/turmas', { nome: nomeA.toUpperCase() }, prof);
confere('criar: nome de turma ativa repetido (até em maiúscula) 409 TURMA_DUPLICADA', ehErro(r, 409, 'TURMA_DUPLICADA'));

for (const [caso, corpo] of [
  ['nome de 2 caracteres', { nome: 'AB' }],
  ['nome de 101 caracteres', { nome: 'x'.repeat(101) }],
  ['sem nome', {}],
  ['ano que não é inteiro', { nome: 'Turma X', ano: '2026' }],
  ['ano quebrado', { nome: 'Turma X', ano: 2026.5 }],
  ['semestre 3', { nome: 'Turma X', semestre: 3 }],
]) {
  r = await chamar('POST', '/turmas', corpo, prof);
  confere(`criar: ${caso} 400 (${r.corpo?.mensagem})`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

// ============================================================================
// PATCH /turmas/:id — as quatro operações
// ============================================================================

const novoNome = `${nomeA} renomeada`;
r = await chamar('PATCH', `/turmas/${nova.id}`, { nome: novoNome }, prof);
confere('renomear: 200 com o nome novo e o resto igual', r.status === 200 && r.corpo.nome === novoNome && r.corpo.codigo === nova.codigo);

r = await chamar('PATCH', `/turmas/${nova.id}`, { nome: novoNome }, prof);
confere('renomear: para o próprio nome 200 (não é conflito)', r.status === 200);

r = await chamar('PATCH', `/turmas/${nova.id}`, { nome: nomeB }, prof);
confere('renomear: nome de outra turma ativa da conta 409 TURMA_DUPLICADA', ehErro(r, 409, 'TURMA_DUPLICADA'));

r = await chamar('PATCH', `/turmas/${nova.id}`, { nome: 'AB' }, prof);
confere('renomear: nome curto 400', ehErro(r, 400, 'DADOS_INVALIDOS'));

r = await chamar('PATCH', `/turmas/${nova.id}`, { capaSemente: 418207 }, prof);
confere('trocar capa: 200 com a semente nova', r.status === 200 && r.corpo.capaSemente === 418207);

r = await chamar('PATCH', `/turmas/${nova.id}`, { capaSemente: 'abc' }, prof);
confere('trocar capa: não inteiro 400', ehErro(r, 400, 'DADOS_INVALIDOS'));

// Inválido junto com válido: nada pode ser gravado.
r = await chamar('PATCH', `/turmas/${nova.id}`, { nome: 'Não pode gravar', capaSemente: 1.5 }, prof);
confere('PATCH: um campo inválido 400 e nenhum muda', ehErro(r, 400, 'DADOS_INVALIDOS'));

r = await chamar('PATCH', `/turmas/${nova.id}`, { ativa: false }, prof);
confere('arquivar: 200 com ativa false', r.status === 200 && r.corpo.ativa === false && r.corpo.nome === novoNome);

r = await chamar('GET', '/turmas', null, prof);
confere('arquivar: some de GET /turmas', !r.corpo.some((t) => t.id === nova.id));
r = await chamar('GET', '/turmas?ativa=false', null, prof);
confere('arquivar: aparece em GET /turmas?ativa=false', r.corpo.some((t) => t.id === nova.id));

r = await chamar('PATCH', `/turmas/${nova.id}`, { ativa: 'sim' }, prof);
confere('arquivar: ativa que não é booleano 400', ehErro(r, 400, 'DADOS_INVALIDOS'));

// Nome único só entre ATIVAS: com a turma arquivada, o nome dela fica livre.
r = await chamar('POST', '/turmas', { nome: novoNome }, prof);
confere('nome de turma arquivada: criar outra com o mesmo nome 200', r.status === 200 && r.corpo.nome === novoNome);
const herdeira = r.corpo;

// Desarquivar agora deixaria duas ativas com o mesmo nome.
r = await chamar('PATCH', `/turmas/${nova.id}`, { ativa: true }, prof);
confere('desarquivar: nome já usado por uma ativa 409 TURMA_DUPLICADA', ehErro(r, 409, 'TURMA_DUPLICADA'));

r = await chamar('PATCH', `/turmas/${herdeira.id}`, { ativa: false }, prof);
confere('arquivar a herdeira libera o nome de novo', r.status === 200);

r = await chamar('PATCH', `/turmas/${nova.id}`, { ativa: true }, prof);
confere('desarquivar: 200 com ativa true', r.status === 200 && r.corpo.ativa === true);
r = await chamar('GET', '/turmas', null, prof);
confere('desarquivar: volta a GET /turmas', r.corpo.some((t) => t.id === nova.id));

// ============================================================================
// POST /turmas/:id/codigo/novo
// ============================================================================

r = await chamar('POST', `/turmas/${nova.id}/codigo/novo`, null, prof);
confere(
  `código novo: 200, outro código na regra (${nova.codigo} -> ${r.corpo?.codigo})`,
  r.status === 200 && FORMATO_DO_CODIGO.test(r.corpo.codigo) && r.corpo.codigo !== nova.codigo,
);
const codigoNovo = r.corpo.codigo;
r = await chamar('GET', '/turmas', null, prof);
confere('código novo: GET /turmas já mostra o novo', r.corpo.find((t) => t.id === nova.id)?.codigo === codigoNovo);

// ============================================================================
// Turma de outro professor (turma-5 é de u-1) e turma que não existe: 404
// ============================================================================

for (const id of ['turma-5', 'nao-existe']) {
  r = await chamar('PATCH', `/turmas/${id}`, { nome: 'Invadida' }, prof);
  confere(`PATCH ${id}: 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
  r = await chamar('POST', `/turmas/${id}/codigo/novo`, null, prof);
  confere(`código novo ${id}: 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}

// O 404 não pode ter mudado nada na turma do outro.
const loginLeo = await chamar('POST', '/auth/login', { email: 'leo@teclar.dev', senha: 'senha123' });
r = await chamar('GET', '/turmas', null, loginLeo.corpo.token);
const turma5 = r.corpo.find((t) => t.id === 'turma-5');
confere('turma-5 continua intacta para o dono', turma5?.nome === 'Oficina de digitação' && turma5.codigo === 'D6YG2S');

console.log(`\nTudo certo. Turmas de teste criadas: ${nova.id}, ${outra.id}, ${herdeira.id}`);
