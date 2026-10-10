// testar-alunos.mjs
// Teste de fumaça das cinco rotas de /turmas/:turmaId/alunos, feito por
// HTTP (fetch) contra o back rodando, sem navegador. Cobre:
//   GET    .../alunos — ordem alfabética, agregados do back (null para quem
//     nunca treinou), senha nunca sai.
//   POST   .../alunos/importar — as três listas; repetido na lista e já na
//     turma comparados sem maiúscula nem acento; importação parcial; 400.
//   POST   .../alunos/:alunoId/zerar-senha — o aluno FAZ LOGIN depois e
//     cai no primeiro acesso, com a senha nova.
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
// Só lê as turmas do seed: importa, zera e remove numa turma que ele mesmo
// cria. Grava no banco direto (pelo BancoService do dist/) uma sessão,
// porque ainda não há rota de sessão do mundo Escola — é ela que prova o
// CASCADE do DELETE. Cada execução cria uma turma "Teste alunos <horário>";
// o npm run seed apaga.
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
let r = await chamar('POST', '/turmas', { nome: `Teste alunos ${Date.now()}` }, prof);
confere('preparo: turma de teste criada', r.status === 200);
const turma = r.corpo;

// ============================================================================
// Sem token (401) e token de aluno (403), nas cinco rotas
// ============================================================================

const CINCO_ROTAS = [
  ['GET', '/turmas/turma-1/alunos'],
  ['POST', '/turmas/turma-1/alunos/importar', { nomes: ['Intruso'] }],
  ['DELETE', '/turmas/turma-1/alunos/al-44'],
  ['POST', '/turmas/turma-1/alunos/al-44/zerar-senha'],
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
const nasLinhas = await banco.alunos.findMany({ where: { ClassID: turma.id } });
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
confere('importar: nada gravado nos 400', (await banco.alunos.count({ where: { ClassID: turma.id } })) === 4);

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
confere('listar turma-1: Davi Moreira ainda sem senha', r.corpo.find((a) => a.id === 'al-45')?.senhaDefinida === false);

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
// POST .../zerar-senha — com login de verdade
// ============================================================================

const loginDoBruno = (senha) => chamar('POST', '/auth/login', { codigo: turma.codigo, nome: 'Bruno Sato', senha });

r = await loginDoBruno('bruno123');
confere('zerar: preparo, primeiro acesso do Bruno grava a senha', r.status === 200 && r.corpo.primeiroAcesso === true);
r = await loginDoBruno('bruno123');
confere('zerar: preparo, segundo login já confere a senha', r.status === 200 && !('primeiroAcesso' in r.corpo));

r = await chamar('POST', `/turmas/${turma.id}/alunos/${bruno.id}/zerar-senha`, null, prof);
confere('zerar: 204 sem corpo', ehVazio204(r));
r = await chamar('GET', `/turmas/${turma.id}/alunos`, null, prof);
confere('zerar: lista mostra senhaDefinida false', r.corpo.find((a) => a.id === bruno.id).senhaDefinida === false);

r = await chamar('POST', `/turmas/${turma.id}/alunos/${bruno.id}/zerar-senha`, null, prof);
confere('zerar: zerar quem já está sem senha 204 igual', ehVazio204(r));

// A prova: o login seguinte é primeiro acesso, com QUALQUER senha nova.
r = await loginDoBruno('nova4567');
confere('zerar: login depois vira primeiro acesso, com a senha nova', r.status === 200 && r.corpo.primeiroAcesso === true);
r = await loginDoBruno('bruno123');
confere('zerar: a senha antiga não vale mais', ehErro(r, 401, 'CREDENCIAIS'));

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
  ['POST', '/turmas/turma-5/alunos/al-43-t5/zerar-senha'],
  ['GET', '/turmas/turma-5/alunos/al-43-t5/desempenho'],
  ['GET', '/turmas/nao-existe/alunos'],
];
for (const [metodo, rota, corpo] of ROTAS_DA_TURMA_5) {
  r = await chamar(metodo, rota, corpo, prof);
  confere(`${metodo} ${rota} (outro dono): 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}

// al-44 é da turma-1, da MESMA conta: mesmo assim, fora da turma da URL é 404.
for (const [metodo, sufixo] of [['DELETE', ''], ['POST', '/zerar-senha'], ['GET', '/desempenho']]) {
  r = await chamar(metodo, `/turmas/${turma.id}/alunos/al-44${sufixo}`, null, prof);
  confere(`${metodo} aluno de outra turma da mesma conta${sufixo}: 404`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}

const intactos = await banco.alunos.findMany({ where: { ID: { in: ['al-44', 'al-43-t5'] } } });
confere('os 404 não mexeram em ninguém (al-44 e al-43-t5 com senha)', intactos.length === 2 && intactos.every((a) => a.SenhaHash !== null));
confere('nada foi importado na turma-5', (await banco.alunos.count({ where: { ClassID: 'turma-5', Nome: 'Intruso' } })) === 0);

await banco.$disconnect();
console.log(`\nTudo certo. Turma de teste criada: ${turma.id} (${turma.codigo})`);
