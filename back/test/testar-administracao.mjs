// testar-administracao.mjs
// Teste de fumaça das seis rotas do grupo "Administração" (categorias e
// parâmetros), feito por HTTP (fetch) contra o back rodando, sem
// navegador. Cobre:
//   - as leituras (GET /categorias, GET /parametros) com qualquer token;
//   - as escritas só para administrador (Users.Administrador, banco v9):
//     conta comum e aluno recebem 404, como se a rota não existisse, e
//     nada muda; o papel é lido do banco a cada pedido;
//   - categorias: nome normalizado, 400, 409 CATEGORIA_DUPLICADA só entre
//     as ativas, exclusão lógica, 409 CATEGORIA_EM_USO;
//   - parâmetros: só os campos enviados mudam; campo desconhecido ou fora
//     da faixa é 400 e não grava nada (nem os campos válidos do corpo).
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: ana@teclar.dev é a administradora)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:administracao
//
// O seed não toca em Categorias nem em Configuracoes (quem as semeia é o
// .sql), então este script desfaz o que faz: no fim, apaga do banco as
// categorias "Teste <horário>" que criou e devolve os parâmetros aos
// valores do começo. Também cria um exercício na conta prof@teclar.dev
// (para o CATEGORIA_EM_USO), que o npm run seed apaga.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { BancoService } from '../dist/banco/banco.service.js';

const URL = 'http://localhost:3000/api';

// Faz a requisição e devolve status, corpo já lido como JSON e o texto cru.
async function chamar(metodo, rota, corpo, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const opcoes = { method: metodo, headers };
  // GET não pode levar body (o fetch recusa), então só põe quando há corpo.
  if (corpo !== undefined && corpo !== null) {
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

const admin = await entrar({ email: 'ana@teclar.dev', senha: 'senha123' });
const comum = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const aluno = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// ============================================================================
// Leituras: qualquer token
// ============================================================================

let r = await chamar('GET', '/categorias');
confere('GET /categorias: sem token 401', ehErro(r, 401, 'TOKEN_INVALIDO'));
r = await chamar('GET', '/parametros');
confere('GET /parametros: sem token 401', ehErro(r, 401, 'TOKEN_INVALIDO'));

const categoriasNoComeco = (await chamar('GET', '/categorias', null, comum)).corpo;
for (const [quem, token] of [['conta comum', comum], ['aluno', aluno], ['administradora', admin]]) {
  r = await chamar('GET', '/categorias', null, token);
  confere(`GET /categorias: ${quem} lê, só as ativas`, r.status === 200 && r.corpo.length > 0 && r.corpo.every((c) => c.ativo === true));
}
confere(
  'GET /categorias: na forma { id, nome, ativo }, id numérico',
  categoriasNoComeco.every((c) => typeof c.id === 'number' && typeof c.nome === 'string' && Object.keys(c).length === 3),
);

const parametrosNoComeco = (await chamar('GET', '/parametros', null, aluno)).corpo;
confere(
  'GET /parametros: aluno lê os quatro, como números (xpPorNivel 200 do banco v9)',
  Object.keys(parametrosNoComeco).join() === 'wpmMeta,precisaoMinima,tempoLimitePadrao,xpPorNivel' &&
    Object.values(parametrosNoComeco).every((v) => typeof v === 'number') &&
    parametrosNoComeco.xpPorNivel === 200,
);

// ============================================================================
// Escritas: quem não é administrador recebe 404 e não muda nada
// ============================================================================

const ESCRITAS = [
  ['POST', '/categorias', { nome: `Teste ${agora} invasora` }],
  ['POST', '/categorias', { nome: '' }],
  ['PATCH', `/categorias/${categoriasNoComeco[0].id}`, { nome: 'Invadida' }],
  ['DELETE', `/categorias/${categoriasNoComeco[0].id}`],
  ['PUT', '/parametros', { wpmMeta: 99 }],
  ['PUT', '/parametros', { wpmMeta: 'lixo' }],
];
for (const [metodo, rota, corpo] of ESCRITAS) {
  const descricao = `${metodo} ${rota} ${corpo ? JSON.stringify(corpo) : ''}`;
  r = await chamar(metodo, rota, corpo);
  confere(`${descricao}: sem token 401`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar(metodo, rota, corpo, comum);
  confere(`${descricao}: conta comum 404 NAO_ENCONTRADO (nem o 400 aparece)`, ehErro(r, 404, 'NAO_ENCONTRADO'));
  r = await chamar(metodo, rota, corpo, aluno);
  confere(`${descricao}: aluno 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
r = await chamar('GET', '/categorias', null, comum);
confere('os 404 não mudaram nenhuma categoria', JSON.stringify(r.corpo) === JSON.stringify(categoriasNoComeco));
r = await chamar('GET', '/parametros', null, comum);
confere('os 404 não mudaram nenhum parâmetro', JSON.stringify(r.corpo) === JSON.stringify(parametrosNoComeco));

// O papel é lido do banco a cada pedido: dar e tirar vale na hora, com o
// mesmo token.
await banco.users.update({ where: { ID: 'u-2' }, data: { Administrador: true } });
r = await chamar('PUT', '/parametros', {}, comum);
confere('papel dado no banco vale na hora, sem novo login (PUT vazio 200, nada muda)', r.status === 200 && JSON.stringify(r.corpo) === JSON.stringify(parametrosNoComeco));
await banco.users.update({ where: { ID: 'u-2' }, data: { Administrador: false } });
r = await chamar('PUT', '/parametros', {}, comum);
confere('papel tirado no banco vale na hora: 404 de novo', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// POST /categorias
// ============================================================================

r = await chamar('POST', '/categorias', { nome: `  Teste   ${agora}  A ` }, admin);
const categoriaA = r.corpo;
confere(
  'POST: 200, nome aparado e com espaços reduzidos, ativa, id numérico',
  r.status === 200 && categoriaA.nome === `Teste ${agora} A` && categoriaA.ativo === true && typeof categoriaA.id === 'number',
);
r = await chamar('GET', '/categorias', null, aluno);
confere('POST: a nova aparece em GET /categorias', r.corpo.some((c) => c.id === categoriaA.id));
r = await chamar('POST', '/categorias', { nome: `TESTE ${agora} a` }, admin);
confere('POST: mesmo nome de uma ativa, em outra caixa, 409 CATEGORIA_DUPLICADA', ehErro(r, 409, 'CATEGORIA_DUPLICADA'));

const NOMES_INVALIDOS = [
  ['vazio', { nome: '' }],
  ['só espaços', { nome: '   ' }],
  ['sem nome', {}],
  ['número', { nome: 123 }],
  ['51 caracteres (a coluna é VARCHAR(50))', { nome: 'x'.repeat(51) }],
];
for (const [caso, corpo] of NOMES_INVALIDOS) {
  r = await chamar('POST', '/categorias', corpo, admin);
  confere(`POST: nome ${caso} 400 DADOS_INVALIDOS`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

// ============================================================================
// PATCH /categorias/:id
// ============================================================================

r = await chamar('PATCH', `/categorias/${categoriaA.id}`, { nome: `Teste ${agora} A2` }, admin);
const categoriaA2 = r.corpo;
confere('PATCH: renomeia, 200 como ficou', r.status === 200 && categoriaA2.nome === `Teste ${agora} A2` && categoriaA2.id === categoriaA.id);
r = await chamar('PATCH', `/categorias/${categoriaA.id}`, { nome: `teste ${agora} a2` }, admin);
confere('PATCH: o próprio nome em outra caixa não é conflito', r.status === 200);
r = await chamar('PATCH', `/categorias/${categoriaA.id}`, { nome: categoriasNoComeco[0].nome.toLowerCase() }, admin);
confere(`PATCH: nome de OUTRA ativa ("${categoriasNoComeco[0].nome}") 409 CATEGORIA_DUPLICADA`, ehErro(r, 409, 'CATEGORIA_DUPLICADA'));
r = await chamar('PATCH', `/categorias/${categoriaA.id}`, { nome: ' ' }, admin);
confere('PATCH: nome vazio 400', ehErro(r, 400, 'DADOS_INVALIDOS'));
for (const id of ['999999', 'abc']) {
  r = await chamar('PATCH', `/categorias/${id}`, { nome: 'Qualquer' }, admin);
  confere(`PATCH /categorias/${id}: não existe 404`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}

// ============================================================================
// DELETE /categorias/:id
// ============================================================================

// Em uso: um exercício ATIVO do professor aponta para a categoria. Nenhuma
// rota grava categoria em exercício (está em `naoUsadas`), então o teste
// liga os dois no banco.
const emUso = (await chamar('POST', '/categorias', { nome: `Teste ${agora} B` }, admin)).corpo;
const exercicio = (
  await chamar(
    'POST',
    '/exercicios',
    { titulo: `Teste ${agora}`, texto: 'Um texto qualquer com mais de vinte letras.', dificuldade: 'facil', tempoLimiteSegundos: 0 },
    comum,
  )
).corpo;
await banco.exerciciosprof.update({ where: { ExerciseID: exercicio.id }, data: { CategoriaID: emUso.id } });
r = await chamar('DELETE', `/categorias/${emUso.id}`, null, admin);
confere('DELETE: categoria de um exercício ativo 409 CATEGORIA_EM_USO', ehErro(r, 409, 'CATEGORIA_EM_USO'));
await chamar('DELETE', `/exercicios/${exercicio.id}`, null, comum);
r = await chamar('DELETE', `/categorias/${emUso.id}`, null, admin);
confere('DELETE: depois de o exercício ser arquivado, 204 (exercício arquivado não segura)', r.status === 204 && r.texto === '');

r = await chamar('GET', '/categorias', null, aluno);
confere('DELETE: some de GET /categorias', !r.corpo.some((c) => c.id === emUso.id));
const linha = await banco.categorias.findUnique({ where: { ID: emUso.id } });
confere('DELETE: exclusão LÓGICA, a linha fica com Ativo = false', linha?.Ativo === false);
r = await chamar('DELETE', `/categorias/${emUso.id}`, null, admin);
confere('DELETE de novo: 404 (apagada é como inexistente)', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('PATCH', `/categorias/${emUso.id}`, { nome: 'Ressuscitada' }, admin);
confere('PATCH de apagada: 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('POST', '/categorias', { nome: `Teste ${agora} B` }, admin);
confere('POST com o nome de uma APAGADA: 200 (o nome só é único entre as ativas)', r.status === 200 && r.corpo.id !== emUso.id);

// ============================================================================
// PUT /parametros
// ============================================================================

r = await chamar('PUT', '/parametros', { wpmMeta: 45 }, admin);
confere(
  'PUT { wpmMeta: 45 }: 200, só ele muda',
  r.status === 200 && JSON.stringify(r.corpo) === JSON.stringify({ ...parametrosNoComeco, wpmMeta: 45 }),
);
r = await chamar('GET', '/parametros', null, aluno);
confere('PUT: GET /parametros já mostra o novo', r.corpo.wpmMeta === 45);
r = await chamar('PUT', '/parametros', { precisaoMinima: 85, tempoLimitePadrao: 0, xpPorNivel: 250 }, admin);
confere(
  'PUT com três campos: os três mudam (tempoLimitePadrao 0 = sem limite vale)',
  r.status === 200 && r.corpo.wpmMeta === 45 && r.corpo.precisaoMinima === 85 && r.corpo.tempoLimitePadrao === 0 && r.corpo.xpPorNivel === 250,
);
const antesDosInvalidos = r.corpo;

const PARAMETROS_INVALIDOS = [
  ['wpmMeta 0', { wpmMeta: 0 }],
  ['wpmMeta 1000', { wpmMeta: 1000 }],
  ['wpmMeta "45"', { wpmMeta: '45' }],
  ['wpmMeta 45,5', { wpmMeta: 45.5 }],
  ['precisaoMinima 101', { precisaoMinima: 101 }],
  ['tempoLimitePadrao 3601', { tempoLimitePadrao: 3601 }],
  ['tempoLimitePadrao -1', { tempoLimitePadrao: -1 }],
  ['xpPorNivel 0 (é divisor do nível)', { xpPorNivel: 0 }],
  ['campo desconhecido "xpNivel"', { xpNivel: 300 }],
  ['campo "toString" (vem do protótipo)', { toString: 1 }],
  ['um campo válido junto com um inválido', { wpmMeta: 50, xpPorNivel: 0 }],
  ['corpo que é lista', [45]],
];
for (const [caso, corpo] of PARAMETROS_INVALIDOS) {
  r = await chamar('PUT', '/parametros', corpo, admin);
  confere(`PUT: ${caso} 400 DADOS_INVALIDOS`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}
r = await chamar('GET', '/parametros', null, admin);
confere('os 400 não gravaram nada (nem o wpmMeta 50 que vinha junto do inválido)', JSON.stringify(r.corpo) === JSON.stringify(antesDosInvalidos));

// ============================================================================
// Arrumação: o banco volta como estava
// ============================================================================

r = await chamar('PUT', '/parametros', parametrosNoComeco, admin);
confere('parâmetros de volta aos valores do começo', JSON.stringify(r.corpo) === JSON.stringify(parametrosNoComeco));
const apagadas = await banco.categorias.deleteMany({ where: { Nome: { startsWith: `Teste ${agora}` } } });
r = await chamar('GET', '/categorias', null, aluno);
confere(`categorias de teste apagadas do banco (${apagadas.count}); a lista voltou à do começo`, JSON.stringify(r.corpo) === JSON.stringify(categoriasNoComeco));

await banco.$disconnect();
console.log('\nTudo certo.');
