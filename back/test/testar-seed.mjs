// testar-seed.mjs
// O seed é NÃO destrutivo: apaga e recria só a demonstração (as contas do
// seed e o que pende delas) e não toca nas contas criadas pelo cadastro.
// Feito por HTTP contra o back rodando, com o próprio script chamando o
// `npm run seed` duas vezes. Cobre:
//   - uma conta de verdade (cadastro) com turma, exercício atribuído, aluno
//     com senha própria, sessão escola e sessão Solo continua igual depois
//     de dois seeds, e o aluno dela ainda entra com a senha dele;
//   - a demo volta ao estado original: a turma renomeada volta ao nome, a
//     turma criada na conta do professor da demo some, a sessão Solo do leo
//     some — o mesmo retrato de logo depois de um seed limpo;
//   - a sessão Solo da conta de verdade sobrevive: as lições do Solo são
//     atualizadas no lugar, não apagadas (apagar levaria a sessão junto).
//
// Como rodar (em back/):
//   1. npm run build && npm run start:prod   (em outro terminal)
//   2. npm run test:seed
//
// Grava no banco: a conta "teste-seed-<horário>@teclar.dev" e o que pende
// dela FICAM (é isso que o teste prova); o seed não as apaga.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const URL = 'http://localhost:3000/api';

async function chamar(metodo, rota, corpo, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const opcoes = { method: metodo, headers };
  if (corpo) {
    opcoes.body = JSON.stringify(corpo);
  }
  const resposta = await fetch(URL + rota, opcoes);
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

function confere(nome, condicao) {
  assert.ok(condicao, nome);
  console.log('ok -', nome);
}

// Para no primeiro passo de preparo que falhar, com o corpo da resposta.
async function exigir(nome, promessa, status = 200) {
  const r = await promessa;
  assert.equal(r.status, status, `preparo: ${nome} (${JSON.stringify(r.corpo)})`);
  return r.corpo;
}

function seed() {
  execSync('npm run seed', { stdio: 'ignore' });
}

async function entrar(email) {
  return (await exigir(`login de ${email}`, chamar('POST', '/auth/login', { email, senha: 'senha123' }))).token;
}

// O corpo que o motor de treino monta, coerente com o PPM (40 = 200/5/1 min).
const MEDIDAS = { wpm: 40, precisao: 95, acertos: 200, erros: 2, tempo_gasto_segundos: 60, concluida: true };

// ============================================================================
// Retratos: o que se compara antes e depois dos seeds
// ============================================================================

// A demo, vista pelas três contas dela. Datas relativas ("há 3 dias") saem
// iguais porque tudo roda no mesmo minuto.
async function retratoDaDemo() {
  const prof = await entrar('prof@teclar.dev');
  const leo = await entrar('leo@teclar.dev');
  const turmas = [
    ...(await exigir('turmas do prof', chamar('GET', '/turmas', null, prof))),
    ...(await exigir('arquivadas do prof', chamar('GET', '/turmas?ativa=false', null, prof))),
  ];
  const detalhe = {};
  for (const turma of turmas) {
    detalhe[turma.id] = {
      alunos: await exigir(`alunos de ${turma.id}`, chamar('GET', `/turmas/${turma.id}/alunos`, null, prof)),
      atribuicoes: await exigir(`atribuições de ${turma.id}`, chamar('GET', `/turmas/${turma.id}/atribuicoes`, null, prof)),
    };
  }
  return {
    turmas,
    detalhe,
    exercicios: await exigir('exercícios do prof', chamar('GET', '/exercicios', null, prof)),
    turmasDoLeo: await exigir('turmas do leo', chamar('GET', '/turmas', null, leo)),
    campanhaDoLeo: await exigir('campanha do leo', chamar('GET', '/solo/campanha', null, leo)),
    historicoDoLeo: await exigir('histórico do leo', chamar('GET', '/solo/historico', null, leo)),
  };
}

// A conta de verdade: o que ela vê, e o aluno dela entrando com a senha dele.
async function retratoDaConta(email, turmaId, codigo) {
  const token = await entrar(email);
  const aluno = await exigir('login do aluno da conta', chamar('POST', '/auth/login', { codigo, nome: 'Rita Real', senha: 'rita2026' }));
  return {
    eu: await exigir('auth/eu', chamar('GET', '/auth/eu', null, token)),
    turmas: await exigir('turmas da conta', chamar('GET', '/turmas', null, token)),
    alunos: await exigir('alunos da conta', chamar('GET', `/turmas/${turmaId}/alunos`, null, token)),
    atribuicoes: await exigir('atribuições da conta', chamar('GET', `/turmas/${turmaId}/atribuicoes`, null, token)),
    exercicios: await exigir('exercícios da conta', chamar('GET', '/exercicios', null, token)),
    campanha: await exigir('campanha da conta', chamar('GET', '/solo/campanha', null, token)),
    historicoSolo: await exigir('histórico Solo da conta', chamar('GET', '/solo/historico', null, token)),
    historicoDoAluno: await exigir('histórico do aluno', chamar('GET', '/aluno/historico', null, aluno.token)),
  };
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// As sessões da demo são datadas "há n dias" a partir da hora do seed (para
// continuarem recentes em qualquer dia), e a provisória do Davi vale um ano
// a partir dele: entre um seed e outro, só a HORA dessas datas muda. Na demo
// a comparação é pelo dia; o resto, exato.
const peloDia = (valor) => JSON.stringify(valor).replace(/"(\d{4}-\d{2}-\d{2})T[\d:.]+Z"/g, '"$1"');
const igualPeloDia = (a, b) => peloDia(a) === peloDia(b);

// ============================================================================
// 1. Seed limpo e o retrato da demo original
// ============================================================================

seed();
const demoOriginal = await retratoDaDemo();
confere('a demo do seed tem as turmas do prof', demoOriginal.turmas.some((t) => t.id === 'turma-1'));

// ============================================================================
// 2. Uma conta de verdade, pelo cadastro, com tudo pendurado nela
// ============================================================================

const email = `teste-seed-${Date.now()}@teclar.dev`;
await exigir('cadastro', chamar('POST', '/auth/cadastro', { nome: 'Conta Real', email, senha: 'senha123' }));
const real = await entrar(email);
const turma = await exigir('turma da conta', chamar('POST', '/turmas', { nome: `Turma Real ${Date.now()}`, semestre: 1 }, real));
const exercicio = await exigir(
  'exercício da conta',
  chamar('POST', '/exercicios', { titulo: 'Real', texto: 'O rato roeu a roupa do rei de Roma e a rainha riu.', dificuldade: 'facil', tempoLimiteSegundos: 0 }, real),
);
await exigir('atribuição', chamar('POST', `/turmas/${turma.id}/atribuicoes`, { exercicioIds: [exercicio.id] }, real));
const importados = await exigir('aluno', chamar('POST', `/turmas/${turma.id}/alunos/importar`, { nomes: ['Rita Real'] }, real));
const provisoria = importados.adicionados[0].senhaProvisoria;
const primeiroAcesso = await exigir('primeiro acesso do aluno', chamar('POST', '/auth/login', { codigo: turma.codigo, nome: 'Rita Real', senha: provisoria }));
await exigir('senha do aluno', chamar('POST', '/aluno/senha', { novaSenha: 'rita2026' }, primeiroAcesso.token), 204);
const aluno = (await exigir('login do aluno', chamar('POST', '/auth/login', { codigo: turma.codigo, nome: 'Rita Real', senha: 'rita2026' }))).token;
await exigir('sessão escola', chamar('POST', '/sessoes', { ...MEDIDAS, exercicio_id: exercicio.id, turma_id: turma.id }, aluno));
await exigir('campanha Solo da conta', chamar('POST', '/solo/campanha', null, real));
const licao = (await exigir('missões', chamar('GET', '/solo/missoes', null, real)))[0];
await exigir('sessão Solo da conta', chamar('POST', '/solo/sessoes', { ...MEDIDAS, exercicio_id: licao.exerciseId }, real));
const contaAntes = await retratoDaConta(email, turma.id, turma.codigo);
confere('preparo: a conta tem turma, aluno, atribuição, sessão escola e sessão Solo',
  contaAntes.alunos.length === 1 && contaAntes.atribuicoes.length === 1 && contaAntes.historicoDoAluno.total === 1 && contaAntes.historicoSolo.total === 1);

// ============================================================================
// 3. A demo é mexida, como numa apresentação
// ============================================================================

const prof = await entrar('prof@teclar.dev');
await exigir('renomear a turma-1', chamar('PATCH', '/turmas/turma-1', { nome: 'Renomeada na apresentação' }, prof));
await exigir('turma nova na conta da demo', chamar('POST', '/turmas', { nome: `Criada na apresentação ${Date.now()}`, semestre: 2 }, prof));
const leo = await entrar('leo@teclar.dev');
const licaoDoLeo = (await exigir('missões do leo', chamar('GET', '/solo/missoes', null, leo)))[0];
await exigir('sessão Solo do leo', chamar('POST', '/solo/sessoes', { ...MEDIDAS, exercicio_id: licaoDoLeo.exerciseId }, leo));
confere('preparo: a demo mudou', !igualPeloDia(await retratoDaDemo(), demoOriginal));

// ============================================================================
// 4. Dois seeds: a conta fica, a demo volta
// ============================================================================

for (const vez of ['1º', '2º']) {
  seed();
  const conta = await retratoDaConta(email, turma.id, turma.codigo);
  confere(`${vez} seed: a conta do cadastro continua igual (turma, aluno, atribuição, exercício)`,
    igual(conta.turmas, contaAntes.turmas) && igual(conta.alunos, contaAntes.alunos) && igual(conta.atribuicoes, contaAntes.atribuicoes) && igual(conta.exercicios, contaAntes.exercicios));
  confere(`${vez} seed: as sessões da conta continuam (escola e Solo) e o aluno entra com a senha dele`,
    igual(conta.historicoDoAluno, contaAntes.historicoDoAluno) && igual(conta.historicoSolo, contaAntes.historicoSolo) && igual(conta.campanha, contaAntes.campanha));
  confere(`${vez} seed: a conta é a mesma (id, nome, e-mail)`, igual(conta.eu, contaAntes.eu));
  const demo = await retratoDaDemo();
  const diferentes = Object.keys(demoOriginal).filter((parte) => !igualPeloDia(demo[parte], demoOriginal[parte]));
  confere(`${vez} seed: a demo voltou ao retrato de um seed limpo${diferentes.length ? ` (difere: ${diferentes.join(', ')})` : ''}`, diferentes.length === 0);
}

console.log(`\nTudo certo. Conta de teste que fica no banco: ${email}`);
