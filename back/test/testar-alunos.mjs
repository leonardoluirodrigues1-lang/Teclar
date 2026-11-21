// testar-alunos.mjs
// Teste de fumaça das cinco rotas de /turmas/:turmaId/alunos, feito por
// HTTP (fetch) contra o back rodando, sem navegador. Cobre:
//   GET    .../alunos — ordem alfabética, agregados do back (null para quem
//     nunca treinou), senha nunca sai.
//   POST   .../alunos/importar — as três listas; repetido na lista e já na
//     turma comparados sem maiúscula nem acento; importação parcial; 400.
//   POST   .../alunos/:alunoId/senha-provisoria — e a senha provisória de
//     ponta a ponta: login com ela (uso único, validade, sem hash nenhuma
//     senha entra), /auth/eu com precisaTrocarSenha e POST /aluno/senha.
//   DELETE .../alunos/:alunoId — as sessões dele somem junto (CASCADE,
//     conferido no banco) e o login dele para de funcionar.
//   GET    .../alunos/:alunoId/desempenho — sessões e médias batendo.
//   E, em todas: sem token 401, token de aluno 403 TIPO_INVALIDO, turma de
//   outro professor ou aluno de outra turma 404 NAO_ENCONTRADO.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:alunos
//
// Só lê as turmas do seed: importa, gera provisória e remove numa turma que ele mesmo
// cria. Grava no banco direto (pelo BancoService do dist/) uma sessão,
// porque ainda não há rota de sessão do mundo Escola — é ela que prova o
// CASCADE do DELETE. Cada execução cria uma turma "Teste alunos <horário>";
// o npm run seed apaga.
import 'dotenv/config';
import assert from 'node:assert/strict';
import './limpar-no-fim.mjs'; // apaga as contas teste-/solo- no fim
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

function ehVazio204(resposta) {
  return resposta.status === 204 && resposta.texto === '';
}

async function entrar(credenciais) {
  const r = await chamar('POST', '/auth/login', credenciais);
  assert.equal(r.status, 200, `login de ${JSON.stringify(credenciais)}`);
  return r.corpo.token;
}

const banco = new BancoService();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const aluno = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// A turma do teste, do professor u-2.
let r = await chamar('POST', '/turmas', { nome: `Teste alunos ${Date.now()}`, semestre: 1 }, prof);
confere('preparo: turma de teste criada', r.status === 200);
const turma = r.corpo;

// ============================================================================
// Sem token (401) e token de aluno (403), nas cinco rotas
// ============================================================================

const CINCO_ROTAS = [
  ['GET', '/turmas/turma-1/alunos'],
  ['POST', '/turmas/turma-1/alunos/importar', { nomes: ['Intruso'] }],
  ['DELETE', '/turmas/turma-1/alunos/al-44'],
  ['POST', '/turmas/turma-1/alunos/al-44/senha-provisoria'],
  ['GET', '/turmas/turma-1/alunos/al-44/desempenho'],
];

for (const [metodo, rota, corpo] of CINCO_ROTAS) {
  r = await chamar(metodo, rota, corpo);
  confere(`${metodo} ${rota}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar(metodo, rota, corpo, aluno);
  confere(`${metodo} ${rota}: token de aluno 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}

// ============================================================================
// POST .../importar
// ============================================================================

const importar = (nomes, corpoExtra = {}) =>
  chamar('POST', `/turmas/${turma.id}/alunos/importar`, { nomes, ...corpoExtra }, prof);

r = await importar(['Ana Pires', '  Bruno   Sato ', 'ana  pires', 'ÁNA PÍRES', '', 'X', 123, 'Carla Nunes']);
confere('importar: 200', r.status === 200);
const primeira = r.corpo;
confere(
  'importar: adicionados são os três nomes bons, normalizados',
  JSON.stringify(primeira.adicionados.map((a) => a.nome)) === JSON.stringify(['Ana Pires', 'Bruno Sato', 'Carla Nunes']),
);
confere(
  'importar: aluno novo sem senha e sem agregados (null, não 0)',
  primeira.adicionados.every(
    (a) =>
      a.senhaDefinida === false &&
      /^[a-z2-9]{6}$/.test(a.senhaProvisoria) &&
      a.provisoriaAte === a.expiraEm &&
      Math.abs(Date.parse(a.expiraEm) - Date.now() - 7 * 24 * 3600 * 1000) < 60 * 1000 &&
      a.totalSessoes === 0 &&
      a.wpmMedio === null &&
      a.precisaoMedia === null &&
      a.ultimaAtividade === null &&
      /^\d{4}-\d{2}-\d{2}$/.test(a.entrouEm),
  ),
);
confere('importar: nada em jaEstavam na turma vazia', primeira.jaEstavam.length === 0);
const motivos = Object.fromEntries(primeira.falhas.map((f) => [f.nome, f.motivo]));
confere(
  'importar: repetido na lista sem maiúscula nem acento cai em falhas',
  motivos['ana  pires'] === 'Nome repetido na lista.' && motivos['ÁNA PÍRES'] === 'Nome repetido na lista.',
);
confere('importar: vazio, curto e não-texto caem em falhas', motivos[''] === 'Nome vazio.' && 'X' in motivos && '123' in motivos);
confere('importar: 5 falhas no total', primeira.falhas.length === 5);

const [ana, bruno, carla] = primeira.adicionados;
const nasLinhas = await banco.alunosturmas.findMany({ where: { ClassID: turma.id } });
confere('importar: no banco, SenhaHash NULL em todos', nasLinhas.length === 3 && nasLinhas.every((a) => a.SenhaHash === null));

// Já na turma: a comparação ignora maiúscula e acento, e devolve o nome
// como está gravado.
r = await importar(['ANA PIRES', 'brúno sato', 'Débora Lima']);
confere(
  'importar de novo: já na turma vai para jaEstavam, na forma gravada',
  r.status === 200 && JSON.stringify(r.corpo.jaEstavam) === JSON.stringify(['Ana Pires', 'Bruno Sato']),
);
confere('importar de novo: só o nome novo é adicionado', r.corpo.adicionados.length === 1 && r.corpo.adicionados[0].nome === 'Débora Lima');

r = await importar('Ana Pires');
confere('importar: nomes que não é lista 400', ehErro(r, 400, 'DADOS_INVALIDOS'));
r = await importar(Array.from({ length: 501 }, (_, i) => `Aluno ${i}`));
confere('importar: 501 nomes 400', ehErro(r, 400, 'DADOS_INVALIDOS'));
r = await importar(['Eva Souza'], { professorId: 'u-2' });
confere('importar: professorId no corpo 400', ehErro(r, 400, 'DADOS_INVALIDOS'));
confere('importar: nada gravado nos 400', (await banco.alunosturmas.count({ where: { ClassID: turma.id } })) === 4);

// ============================================================================
// GET .../alunos
// ============================================================================

r = await chamar('GET', `/turmas/${turma.id}/alunos`, null, prof);
confere(
  'listar: 200, ordem alfabética',
  r.status === 200 &&
    JSON.stringify(r.corpo.map((a) => a.nome)) === JSON.stringify(['Ana Pires', 'Bruno Sato', 'Carla Nunes', 'Débora Lima']),
);
confere('listar: a senha nunca sai', r.corpo.every((a) => !('senha' in a) && !('senhaHash' in a) && !('SenhaHash' in a)));

r = await chamar('GET', '/turmas/turma-1/alunos', null, prof);
const anaDoSeed = r.corpo.find((a) => a.id === 'al-43-t1');
confere(
  'listar turma-1: agregados prontos para quem treinou',
  anaDoSeed.totalSessoes > 0 && Number.isInteger(anaDoSeed.wpmMedio) && !Number.isNaN(Date.parse(anaDoSeed.ultimaAtividade)),
);
const davi = r.corpo.find((a) => a.id === 'al-45');
confere('listar turma-1: Davi Moreira sem senha, com a provisória do seed', davi?.senhaDefinida === false && typeof davi.provisoriaAte === 'string');
confere('listar: provisoriaAte null para quem tem senha', anaDoSeed.provisoriaAte === null);

// ============================================================================
// GET .../desempenho
// ============================================================================

r = await chamar('GET', '/turmas/turma-1/alunos/al-43-t1/desempenho', null, prof);
const desempenho = r.corpo;
const concluidas = desempenho.sessoes.filter((s) => s.concluida);
const mediaEsperada = Math.round(concluidas.reduce((t, s) => t + s.wpm, 0) / concluidas.length);
confere('desempenho: 200, totalSessoes = sessões da lista', r.status === 200 && desempenho.totalSessoes === desempenho.sessoes.length);
confere(`desempenho: wpmMedio = média das concluídas (${mediaEsperada})`, desempenho.wpmMedio === mediaEsperada);
confere('desempenho: bate com a linha da lista', desempenho.wpmMedio === anaDoSeed.wpmMedio && desempenho.totalSessoes === anaDoSeed.totalSessoes);
confere('desempenho: sessões com números, não texto', desempenho.sessoes.every((s) => typeof s.wpm === 'number' && s.alunoId === 'al-43-t1'));

r = await chamar('GET', `/turmas/${turma.id}/alunos/${ana.id}/desempenho`, null, prof);
confere(
  'desempenho de quem nunca treinou: médias null',
  r.status === 200 && r.corpo.totalSessoes === 0 && r.corpo.wpmMedio === null && r.corpo.sessoes.length === 0,
);

// ============================================================================
// Senha provisória — com login de verdade
// ============================================================================

const loginDoBruno = (senha) => chamar('POST', '/auth/login', { codigo: turma.codigo, nome: 'Bruno Sato', senha });
const criarSenha = (novaSenha, token) => chamar('POST', '/aluno/senha', { novaSenha }, token);
const linhaDe = async (alvo) => (await chamar('GET', `/turmas/${turma.id}/alunos`, null, prof)).corpo.find((a) => a.id === alvo.id);

r = await loginDoBruno('qualquer123');
confere('provisória: sem senha própria, uma senha qualquer NÃO entra', ehErro(r, 401, 'CREDENCIAIS'));
r = await loginDoBruno(bruno.senhaProvisoria);
confere('provisória: entra com ela, com precisaTrocarSenha', r.status === 200 && r.corpo.usuario.precisaTrocarSenha === true);
const tokenDoBruno = r.corpo.token;
r = await loginDoBruno(bruno.senhaProvisoria);
confere('provisória: uso único, o segundo login com ela é 401', ehErro(r, 401, 'CREDENCIAIS'));
confere('provisória: depois do uso, a lista mostra provisoriaAte null', (await linhaDe(bruno)).provisoriaAte === null);
r = await chamar('GET', '/auth/eu', null, tokenDoBruno);
confere('provisória: /auth/eu repete precisaTrocarSenha', r.status === 200 && r.corpo.precisaTrocarSenha === true);

// Enquanto não cria a senha, o token só abre /auth/eu, /auth/logout e POST /aluno/senha.
for (const [metodo, rota, corpo] of [
  ['GET', '/aluno/salas'],
  ['GET', '/aluno/historico'],
  ['GET', '/aluno/resumo'],
  ['GET', `/turmas/${turma.id}/meu-desempenho`],
  ['GET', `/turmas/${turma.id}/ranking`],
  ['POST', '/sessoes', {}],
]) {
  r = await chamar(metodo, rota, corpo, tokenDoBruno);
  confere(`sem senha criada: ${metodo} ${rota} 403 TROCAR_SENHA`, ehErro(r, 403, 'TROCAR_SENHA'));
}
r = await chamar('POST', '/auth/logout', null, tokenDoBruno);
confere('sem senha criada: /auth/logout passa (204)', r.status === 204);

r = await chamar('POST', '/aluno/senha', { novaSenha: 'bruno123' });
confere('/aluno/senha: sem token 401', ehErro(r, 401, 'TOKEN_INVALIDO'));
r = await criarSenha('bruno123', prof);
confere('/aluno/senha: token de conta 403 TIPO_INVALIDO', ehErro(r, 403, 'TIPO_INVALIDO'));
r = await criarSenha('ab', tokenDoBruno);
confere('/aluno/senha: curta demais 400 DADOS_INVALIDOS', ehErro(r, 400, 'DADOS_INVALIDOS'));
r = await criarSenha(' bruno123 ', tokenDoBruno);
confere('/aluno/senha: 204 sem corpo', ehVazio204(r));
r = await criarSenha('outra456', tokenDoBruno);
confere('/aluno/senha: de novo 409 SENHA_JA_CRIADA', ehErro(r, 409, 'SENHA_JA_CRIADA'));
r = await chamar('GET', '/aluno/salas', null, tokenDoBruno);
confere('depois de criar a senha, o MESMO token abre /aluno/salas', r.status === 200);
r = await loginDoBruno('bruno123');
confere('/aluno/senha: a senha criada entra, sem precisaTrocarSenha', r.status === 200 && !('precisaTrocarSenha' in r.corpo.usuario));
r = await chamar('GET', '/auth/eu', null, r.corpo.token);
confere('/aluno/senha: /auth/eu sem precisaTrocarSenha', r.status === 200 && !('precisaTrocarSenha' in r.corpo));
confere('/aluno/senha: lista mostra senhaDefinida true', (await linhaDe(bruno)).senhaDefinida === true);

// O professor gera outra: a senha do Bruno deixa de valer.
r = await chamar('POST', `/turmas/${turma.id}/alunos/${bruno.id}/senha-provisoria`, null, prof);
const primeiraGerada = r.corpo;
confere(
  'gerar: 200 com a senha em texto e a validade',
  r.status === 200 && /^[a-z2-9]{6}$/.test(primeiraGerada.senhaProvisoria) && !Number.isNaN(Date.parse(primeiraGerada.expiraEm)),
);
const linhaDoBruno = await linhaDe(bruno);
confere(
  'gerar: lista mostra sem senha e provisoriaAte = expiraEm',
  linhaDoBruno.senhaDefinida === false && linhaDoBruno.provisoriaAte === primeiraGerada.expiraEm,
);
const noBanco = await banco.alunosturmas.findUnique({ where: { AlunoID: bruno.id } });
confere(
  'gerar: no banco só o hash, nunca o texto',
  noBanco.SenhaProvisoriaHash.startsWith('$2') && noBanco.SenhaProvisoriaHash !== primeiraGerada.senhaProvisoria,
);
r = await loginDoBruno('bruno123');
confere('gerar: a senha antiga não vale mais', ehErro(r, 401, 'CREDENCIAIS'));
r = await chamar('POST', `/turmas/${turma.id}/alunos/${bruno.id}/senha-provisoria`, null, prof);
const segundaGerada = r.corpo;
r = await loginDoBruno(primeiraGerada.senhaProvisoria);
confere('gerar de novo: a provisória anterior deixa de valer', ehErro(r, 401, 'CREDENCIAIS'));
r = await loginDoBruno(segundaGerada.senhaProvisoria);
confere('gerar de novo: a nova entra', r.status === 200 && r.corpo.usuario.precisaTrocarSenha === true);

// Validade: a provisória vencida não entra (a da Ana deste teste, vencida no banco).
await banco.alunosturmas.update({ where: { AlunoID: ana.id }, data: { SenhaProvisoriaExpira: new Date(Date.now() - 1000) } });
r = await chamar('POST', '/auth/login', { codigo: turma.codigo, nome: 'Ana Pires', senha: ana.senhaProvisoria });
confere('validade: provisória vencida 401', ehErro(r, 401, 'CREDENCIAIS'));
confere('validade: lista mostra provisoriaAte null', (await linhaDe(ana)).provisoriaAte === null);
// Sem hash nenhum (nem senha, nem provisória): nenhuma senha entra.
await banco.alunosturmas.update({ where: { AlunoID: ana.id }, data: { SenhaProvisoriaHash: null, SenhaProvisoriaExpira: null } });
r = await chamar('POST', '/auth/login', { codigo: turma.codigo, nome: 'Ana Pires', senha: 'qualquer123' });
confere('sem hash: senha qualquer 401', ehErro(r, 401, 'CREDENCIAIS'));

// Ana Pires tem uma matrícula por turma (al-43-t1 na turma-1, al-43 na
// turma-2): a provisória da turma-2 não mexe na da turma-1. No fim, a
// senha da turma-2 volta a ser a do seed, para as outras suítes.
const loginDaAna = (codigo, senha) => chamar('POST', '/auth/login', { codigo, nome: 'Ana Pires', senha });
async function trocarSenhaDaAnaNaTurma2(nova) {
  const gerada = (await chamar('POST', '/turmas/turma-2/alunos/al-43/senha-provisoria', null, prof)).corpo;
  const login = await loginDaAna('R8VD3K', gerada.senhaProvisoria);
  return criarSenha(nova, login.corpo.token);
}
r = await trocarSenhaDaAnaNaTurma2('outra2026');
confere('Ana: na turma-2, provisória e senha nova', ehVazio204(r));
r = await loginDaAna('K7M2QX', 'aluno2026');
confere('Ana: na turma-1 a senha de antes continua valendo', r.status === 200 && !('precisaTrocarSenha' in r.corpo.usuario));
r = await loginDaAna('K7M2QX', 'outra2026');
confere('Ana: a senha da turma-2 não abre a turma-1', ehErro(r, 401, 'CREDENCIAIS'));
r = await trocarSenhaDaAnaNaTurma2('aluno2026');
confere('Ana: a turma-2 volta à senha do seed', ehVazio204(r) && (await loginDaAna('R8VD3K', 'aluno2026')).status === 200);

// ============================================================================
// DELETE .../alunos/:alunoId — e o CASCADE nas sessões
// ============================================================================

// Uma sessão da Carla, gravada direto no banco.
await banco.sessionsprof.create({
  data: { ID: randomUUID(), AlunoID: carla.id, ExerciseID: 'ex-prof-1', ClassID: turma.id, WPM: 30, Precisao: 90 },
});
confere('remover: preparo, Carla tem 1 sessão', (await banco.sessionsprof.count({ where: { AlunoID: carla.id } })) === 1);

r = await chamar('DELETE', `/turmas/${turma.id}/alunos/${carla.id}`, null, prof);
confere('remover: 204 sem corpo', ehVazio204(r));
r = await chamar('GET', `/turmas/${turma.id}/alunos`, null, prof);
confere('remover: some da lista', !r.corpo.some((a) => a.id === carla.id));
confere('remover: as sessões dela foram junto (CASCADE)', (await banco.sessionsprof.count({ where: { AlunoID: carla.id } })) === 0);
r = await chamar('POST', '/auth/login', { codigo: turma.codigo, nome: 'Carla Nunes', senha: 'carla123' });
confere('remover: o login dela não entra mais', ehErro(r, 401, 'CREDENCIAIS'));
r = await chamar('DELETE', `/turmas/${turma.id}/alunos/${carla.id}`, null, prof);
confere('remover: de novo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// Importada de novo, volta como linha nova, sem senha nem histórico.
r = await importar(['Carla Nunes']);
confere('remover: importar de novo cria linha nova', r.corpo.adicionados.length === 1 && r.corpo.adicionados[0].id !== carla.id);

// ============================================================================
// 404: turma de outro professor (turma-5 é de u-1) e aluno de outra turma
// ============================================================================

const ROTAS_DA_TURMA_5 = [
  ['GET', '/turmas/turma-5/alunos'],
  ['POST', '/turmas/turma-5/alunos/importar', { nomes: ['Intruso'] }],
  ['DELETE', '/turmas/turma-5/alunos/al-43-t5'],
  ['POST', '/turmas/turma-5/alunos/al-43-t5/senha-provisoria'],
  ['GET', '/turmas/turma-5/alunos/al-43-t5/desempenho'],
  ['GET', '/turmas/nao-existe/alunos'],
];
for (const [metodo, rota, corpo] of ROTAS_DA_TURMA_5) {
  r = await chamar(metodo, rota, corpo, prof);
  confere(`${metodo} ${rota} (outro dono): 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}

// al-44 é da turma-1, da MESMA conta: mesmo assim, fora da turma da URL é 404.
for (const [metodo, sufixo] of [['DELETE', ''], ['POST', '/senha-provisoria'], ['GET', '/desempenho']]) {
  r = await chamar(metodo, `/turmas/${turma.id}/alunos/al-44${sufixo}`, null, prof);
  confere(`${metodo} aluno de outra turma da mesma conta${sufixo}: 404`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}

const intactos = await banco.alunosturmas.findMany({ where: { AlunoID: { in: ['al-44', 'al-43-t5'] } } });
confere('os 404 não mexeram em ninguém (al-44 e al-43-t5 com senha)', intactos.length === 2 && intactos.every((a) => a.SenhaHash !== null));
confere('nada foi importado na turma-5', (await banco.alunosturmas.count({ where: { ClassID: 'turma-5', Nome: 'Intruso' } })) === 0);

// Dois importar simultâneos com o mesmo nome novo: um grava, o outro cai em
// jaEstavam (pela consulta ou pelo UNIQUE, que desfaz a transação). Em
// nenhum caso sobra um ID em alunos sem matrícula.
const [corrida1, corrida2] = await Promise.all([importar(['Zeca Lima']), importar(['Zeca Lima'])]);
confere(
  'importar simultâneo: um adiciona, o outro já estava',
  corrida1.corpo.adicionados.length + corrida2.corpo.adicionados.length === 1 &&
    corrida1.corpo.jaEstavam.length + corrida2.corpo.jaEstavam.length === 1,
);
confere('importar: nenhum ID sem matrícula', (await banco.alunos.count({ where: { alunosturmas: { is: null } } })) === 0);

await banco.$disconnect();
console.log(`\nTudo certo. Turma de teste criada: ${turma.id} (${turma.codigo})`);
