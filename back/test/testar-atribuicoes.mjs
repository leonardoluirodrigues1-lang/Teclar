// testar-atribuicoes.mjs
// Teste de fumaça das três rotas de /turmas/:turmaId/atribuicoes, feito
// por HTTP (fetch) contra o back rodando, sem navegador. Cobre:
//   GET    — a visão do professor: título, dificuldade, data, e
//     concluidoPor / totalAlunos contados no back.
//   POST   — vários de uma vez; repetir não duplica nem muda a data; um id
//     ruim recusa a lista inteira ANTES de gravar; os 400.
//   PATCH  — muda as repetições (1 a 5) de uma atribuição.
//   DELETE — pelo par turma + exercício; as sessões ficam.
//   Repetições: padrão 1, limite 1 a 5, e o aluno recebe o texto repetido.
//   Post da atividade: limites de tamanho, tipo e quantidade dos anexos, HTML
//   nas instruções guardado como texto, aluno de outra turma, atividade
//   agendada invisível antes da data, tentativa depois do prazo marcada com
//   atraso, download só para quem pode, e retirar a atribuição apaga tudo.
//   E, nas três: sem token 401, token de aluno 403 TIPO_INVALIDO, turma ou
//   exercício de outro professor 404 NAO_ENCONTRADO.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:atribuicoes
//
// Só lê as atribuições do seed: atribui e remove numa turma que ele mesmo
// cria, com exercícios que ele mesmo cria. Grava sessões direto no banco
// (pelo BancoService do dist/), porque ainda não há rota de sessão do
// mundo Escola — são elas que fazem o concluidoPor sair de 0. O npm run
// seed apaga tudo o que ele cria.
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

async function entrar(credenciais) {
  const r = await chamar('POST', '/auth/login', credenciais);
  assert.equal(r.status, 200, `login de ${JSON.stringify(credenciais)}`);
  return r.corpo.token;
}

// Uma sessão gravada direto no banco.
function gravarSessao(alunoId, exercicioId, turmaId, concluida) {
  return banco.sessionsprof.create({
    data: { ID: randomUUID(), AlunoID: alunoId, ExerciseID: exercicioId, ClassID: turmaId, WPM: 30, Precisao: 90, Concluida: concluida },
  });
}

const banco = new BancoService();
const agora = Date.now();

const prof = await entrar({ email: 'prof@teclar.dev', senha: 'senha123' });
const aluno = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// Preparo: uma turma e três exercícios do professor u-2.
let r = await chamar('POST', '/turmas', { nome: `Teste atribuições ${agora}`, semestre: 1 }, prof);
const turma = r.corpo;
const exercicios = [];
for (const [letra, dificuldade] of [['A', 'facil'], ['B', 'medio'], ['C', 'dificil']]) {
  r = await chamar(
    'POST',
    '/exercicios',
    { titulo: `Teste ${agora} ${letra}`, texto: 'Um texto qualquer com mais de vinte letras.', dificuldade, tempoLimiteSegundos: 0 },
    prof,
  );
  assert.equal(r.status, 200, 'preparo: criar exercício');
  exercicios.push(r.corpo);
}
const [exA, exB, exC] = exercicios;
const rota = `/turmas/${turma.id}/atribuicoes`;

// ============================================================================
// Sem token (401) e token de aluno (403)
// ============================================================================

for (const [metodo, caminho, corpo] of [
  ['GET', '/turmas/turma-1/atribuicoes'],
  ['POST', '/turmas/turma-1/atribuicoes', { exercicioIds: ['ex-prof-3'] }],
  ['DELETE', '/turmas/turma-1/atribuicoes/ex-prof-1'],
]) {
  r = await chamar(metodo, caminho, corpo);
  confere(`${metodo} ${caminho}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
  r = await chamar(metodo, caminho, corpo, aluno);
  confere(`${metodo} ${caminho}: token de aluno 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}

// ============================================================================
// GET (turma do seed, só leitura)
// ============================================================================

r = await chamar('GET', '/turmas/turma-1/atribuicoes', null, prof);
confere('listar turma-1: 200 com as 8 do seed', r.status === 200 && r.corpo.length === 8);
const primeiraDoSeed = r.corpo[0];
confere(
  'listar turma-1: na ordem de atribuição, com título e data',
  primeiraDoSeed.exercicioId === 'ex-prof-1' && primeiraDoSeed.atribuidoEm === '2026-02-03' && typeof primeiraDoSeed.titulo === 'string',
);
confere('listar turma-1: totalAlunos = alunos ativos (4)', r.corpo.every((a) => a.totalAlunos === 4));
confere('listar turma-1: concluidoPor entre 0 e totalAlunos', r.corpo.every((a) => a.concluidoPor >= 0 && a.concluidoPor <= a.totalAlunos));

r = await chamar('GET', rota, null, prof);
confere('listar: turma nova começa vazia', r.status === 200 && r.corpo.length === 0);

// ============================================================================
// POST
// ============================================================================

r = await chamar('POST', rota, { exercicioIds: [exA.id, exB.id, exA.id] }, prof);
confere('atribuir: 200 com a lista crua, sem repetir o id duplicado', r.status === 200 && r.corpo.length === 2);
confere(
  'atribuir: cada item com exerciseId, data e prazo null',
  r.corpo.every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.atribuidoEm) && a.prazo === null) &&
    r.corpo.map((a) => a.exerciseId).sort().join() === [exA.id, exB.id].sort().join(),
);
const dataDoA = r.corpo.find((a) => a.exerciseId === exA.id).atribuidoEm;

r = await chamar('POST', rota, { exercicioIds: [exA.id] }, prof);
confere('atribuir: repetir não duplica', r.status === 200 && r.corpo.length === 2);
confere('atribuir: repetir não muda a data da primeira vez', r.corpo.find((a) => a.exerciseId === exA.id).atribuidoEm === dataDoA);

// Um id de outro professor no meio: a lista inteira é recusada, e o bom
// também não entra.
r = await chamar('POST', rota, { exercicioIds: [exC.id, 'ex-prof-6'] }, prof);
confere('atribuir: exercício de outro professor 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('POST', rota, { exercicioIds: [exC.id, 'nao-existe'] }, prof);
confere('atribuir: exercício que não existe 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
confere('atribuir: nos 404, nem o id bom foi gravado', (await banco.atribuicoesprof.count({ where: { ClassID: turma.id } })) === 2);

for (const [caso, corpo] of [
  ['lista vazia', { exercicioIds: [] }],
  ['exercicioIds que não é lista', { exercicioIds: exC.id }],
  ['sem exercicioIds', {}],
  ['id que não é texto', { exercicioIds: [123] }],
  ['professorId no corpo', { exercicioIds: [exC.id], professorId: 'u-2' }],
]) {
  r = await chamar('POST', rota, corpo, prof);
  confere(`atribuir: ${caso} 400`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

// ============================================================================
// GET: concluidoPor e totalAlunos
// ============================================================================

r = await chamar('POST', `/turmas/${turma.id}/alunos/importar`, { nomes: ['Lia Rocha', 'Rui Prado'] }, prof);
const [lia, rui] = r.corpo.adicionados;
// Lia conclui o A duas vezes (conta uma); Rui estoura o tempo no A (não conta).
await gravarSessao(lia.id, exA.id, turma.id, true);
await gravarSessao(lia.id, exA.id, turma.id, true);
await gravarSessao(rui.id, exA.id, turma.id, false);

r = await chamar('GET', rota, null, prof);
const itemA = r.corpo.find((a) => a.exercicioId === exA.id);
const itemB = r.corpo.find((a) => a.exercicioId === exB.id);
confere(
  'listar: título e dificuldade do exercício',
  itemA.titulo === exA.titulo && itemA.dificuldade === 'facil' && itemB.dificuldade === 'medio',
);
confere('listar: totalAlunos = 2', r.corpo.every((a) => a.totalAlunos === 2));
confere('listar: concluidoPor conta alunos distintos que concluíram (1)', itemA.concluidoPor === 1);
confere('listar: concluidoPor 0 em quem ninguém fez', itemB.concluidoPor === 0);

// ============================================================================
// DELETE
// ============================================================================

r = await chamar('DELETE', `${rota}/${exA.id}`, null, prof);
confere('remover: 204 sem corpo', r.status === 204 && r.texto === '');
r = await chamar('GET', rota, null, prof);
confere('remover: some da lista', r.corpo.length === 1 && r.corpo[0].exercicioId === exB.id);
confere('remover: as sessões no exercício ficam', (await banco.sessionsprof.count({ where: { ExerciseID: exA.id } })) === 3);
r = await chamar('GET', '/exercicios', null, prof);
confere('remover: o exercício continua na biblioteca', r.corpo.itens.some((ex) => ex.id === exA.id));
r = await chamar('DELETE', `${rota}/${exA.id}`, null, prof);
confere('remover: de novo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('DELETE', `${rota}/${exC.id}`, null, prof);
confere('remover: exercício que nunca foi atribuído 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// Turma de outro professor (turma-5 é de u-1): 404 nas três
// ============================================================================

for (const [metodo, caminho, corpo] of [
  ['GET', '/turmas/turma-5/atribuicoes'],
  ['POST', '/turmas/turma-5/atribuicoes', { exercicioIds: [exC.id] }],
  ['DELETE', '/turmas/turma-5/atribuicoes/ex-prof-6'],
  ['GET', '/turmas/nao-existe/atribuicoes'],
]) {
  r = await chamar(metodo, caminho, corpo, prof);
  confere(`${metodo} ${caminho} (outro dono): 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
confere(
  'a turma-5 continua só com o ex-prof-6',
  (await banco.atribuicoesprof.findMany({ where: { ClassID: 'turma-5' } })).map((a) => a.ExerciseID).join() === 'ex-prof-6',
);

// ============================================================================
// Modo de seleção com exercício do sistema: o "Atribuir à turma" copia a
// lição para a biblioteca (se ainda não está) e atribui a cópia, junto com os
// outros marcados, numa atribuição só.
// ============================================================================

const leo = await entrar({ email: 'leo@teclar.dev', senha: 'senha123' });
const licaoDoSistema = (await chamar('GET', '/exercicios/sistema', null, prof)).corpo[4];
async function atribuirComoNaSelecao(licaoIds, proprios) {
  const copias = await Promise.all(licaoIds.map((id) => chamar('POST', `/exercicios/sistema/${id}/copiar`, null, prof)));
  const ids = [...new Set([...proprios, ...copias.map((c) => c.corpo.exercicio.id)])];
  return { copias, atribuicao: await chamar('POST', rota, { exercicioIds: ids }, prof) };
}
let selecao = await atribuirComoNaSelecao([licaoDoSistema.id], [exC.id]);
const copiaNaTurma = selecao.copias[0].corpo.exercicio;
confere('seleção: a lição vira cópia na biblioteca (nova)', selecao.copias[0].status === 200 && selecao.copias[0].corpo.jaExistia === false);
confere(
  'seleção: a cópia e o exercício próprio entram na turma na mesma atribuição',
  selecao.atribuicao.status === 200 && selecao.atribuicao.corpo.some((a) => a.exerciseId === copiaNaTurma.id) && selecao.atribuicao.corpo.some((a) => a.exerciseId === exC.id),
);
confere(
  'seleção: a lista do sistema diz que a lição está na biblioteca (a tela mostra "Já atribuído")',
  (await chamar('GET', '/exercicios/sistema', null, prof)).corpo.find((e) => e.id === licaoDoSistema.id).naBiblioteca === copiaNaTurma.id,
);
const quantasNaTurma = selecao.atribuicao.corpo.length;
selecao = await atribuirComoNaSelecao([licaoDoSistema.id], []);
confere(
  'seleção de novo: a mesma cópia (jaExistia) e nada duplica na turma nem na biblioteca',
  selecao.copias[0].corpo.jaExistia === true && selecao.copias[0].corpo.exercicio.id === copiaNaTurma.id &&
    selecao.atribuicao.corpo.length === quantasNaTurma &&
    (await banco.exerciciosprof.count({ where: { ProfessorID: 'u-2', ExerciseID: { startsWith: `sis-${licaoDoSistema.id}-` } } })) === 1,
);
confere('seleção: o id da lição não se atribui direto (sem cópia é 404)', ehErro(await chamar('POST', rota, { exercicioIds: [licaoDoSistema.id] }, prof), 404, 'NAO_ENCONTRADO'));
confere(
  'outra conta: o leo não atribui a cópia do prof à turma dele (404)',
  ehErro(await chamar('POST', '/turmas/turma-5/atribuicoes', { exercicioIds: [copiaNaTurma.id] }, leo), 404, 'NAO_ENCONTRADO'),
);

// ============================================================================
// Repetições: padrão 1, 1 a 5 no POST e no PATCH, e o aluno recebe o texto
// repetido N vezes (separado por espaço) com o tempo limite × N.
// ============================================================================

r = await chamar('POST', '/exercicios', { titulo: `Teste ${agora} R`, texto: 'Repete este texto aqui.', dificuldade: 'facil', tempoLimiteSegundos: 30 }, prof);
const exR = r.corpo;
r = await chamar('GET', rota, null, prof);
confere('repetições: as atribuições sem repetições ficam com 1', r.corpo.every((a) => a.repeticoes === 1));
for (const [caso, rep] of [['0', 0], ['6', 6], ['2.5', 2.5], ['texto', '3']]) {
  r = await chamar('POST', rota, { exercicioIds: [exR.id], repeticoes: { [exR.id]: rep } }, prof);
  confere(`repetições: ${caso} no POST 400`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}
r = await chamar('POST', rota, { exercicioIds: [exR.id], repeticoes: { [exC.id]: 2 } }, prof);
confere('repetições: id fora de exercicioIds 400', ehErro(r, 400, 'DADOS_INVALIDOS'));
r = await chamar('POST', rota, { exercicioIds: [exR.id], repeticoes: [3] }, prof);
confere('repetições: lista em vez de objeto 400', ehErro(r, 400, 'DADOS_INVALIDOS'));
confere('repetições: nos 400, nada foi gravado', (await banco.atribuicoesprof.count({ where: { ClassID: turma.id, ExerciseID: exR.id } })) === 0);
r = await chamar('POST', rota, { exercicioIds: [exR.id], repeticoes: { [exR.id]: 3 } }, prof);
confere('repetições: POST com 3 grava 3', r.status === 200 && r.corpo.find((a) => a.exerciseId === exR.id).repeticoes === 3);
r = await chamar('GET', rota, null, prof);
confere('repetições: o GET do professor mostra 3', r.corpo.find((a) => a.exercicioId === exR.id).repeticoes === 3);

const { codigo } = (await chamar('GET', `/turmas/${turma.id}`, null, prof)).corpo;
r = await chamar('POST', '/auth/aluno', { codigo, nome: 'Teo Lima', senha: 'teo2026' });
assert.equal(r.status, 200, 'preparo: o Teo entra na turma de teste (primeiro acesso)');
const tokenLia = r.corpo.token;
r = await chamar('GET', `/exercicios/${exR.id}?turma=${turma.id}`, null, tokenLia);
confere(
  'repetições: o aluno recebe o texto 3 vezes, separado por espaço, com o tempo × 3',
  r.status === 200 && r.corpo.texto === 'Repete este texto aqui. Repete este texto aqui. Repete este texto aqui.' && r.corpo.tempoLimiteSegundos === 90,
);
r = await chamar('GET', `/aluno/salas/${turma.id}`, null, tokenLia);
const naSala = r.corpo.lista?.find((e) => e.id === exR.id);
confere('repetições: a sala do aluno conta os caracteres repetidos', naSala?.caracteres === 'Repete este texto aqui.'.length * 3 + 2 && naSala.repeticoes === 3);

for (const [caso, corpo] of [['sem repeticoes', {}], ['0', { repeticoes: 0 }], ['6', { repeticoes: 6 }], ['professorId', { repeticoes: 2, professorId: 'u-2' }]]) {
  r = await chamar('PATCH', `${rota}/${exR.id}`, corpo, prof);
  confere(`alterar: ${caso} 400`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}
r = await chamar('PATCH', `${rota}/${exR.id}`, { repeticoes: 5 }, prof);
confere('alterar: 200 com a linha nova (5)', r.status === 200 && r.corpo.exerciseId === exR.id && r.corpo.repeticoes === 5);
r = await chamar('GET', `/exercicios/${exR.id}?turma=${turma.id}`, null, tokenLia);
confere('alterar: vale para a próxima tentativa (5 vezes)', r.corpo.texto.split('Repete').length - 1 === 5 && r.corpo.tempoLimiteSegundos === 150);
r = await chamar('PATCH', `${rota}/${exA.id}`, { repeticoes: 2 }, prof);
confere('alterar: exercício não atribuído 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('PATCH', '/turmas/turma-5/atribuicoes/ex-prof-6', { repeticoes: 2 }, prof);
confere('alterar: turma de outra conta 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('PATCH', `${rota}/${exR.id}`, { repeticoes: 2 }, tokenLia);
confere('alterar: token de aluno 403', ehErro(r, 403, 'TIPO_INVALIDO'));
r = await chamar('PATCH', `${rota}/${exR.id}`, { repeticoes: 2 });
confere('alterar: sem token 401', ehErro(r, 401, 'TOKEN_INVALIDO'));

// ============================================================================
// Post da atividade e anexos
// ============================================================================

const rotaPost = `${rota}/${exR.id}/post`;
const ana = aluno; // Ana Pires, da turma-2: outra turma
const b64 = (texto) => Buffer.from(texto, 'latin1').toString('base64');
const PDF = b64('%PDF-1.4\n%teste\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('resto')]).toString('base64');

r = await chamar('GET', rotaPost, null, prof);
confere('post: sem post, os padrões (título do exercício, aberto na atribuição)', r.status === 200 && r.corpo.existe === false && r.corpo.titulo === exR.titulo && r.corpo.abertoEm !== null && r.corpo.prazo === null);
r = await chamar('POST', `${rotaPost}/anexos`, { nome: 'a.pdf', conteudo: PDF }, prof);
confere('anexo: sem post salvo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

const MALICIOSO = '<script>alert(1)</script> <img src=x onerror=alert(1)> **ok**';
r = await chamar('PUT', rotaPost, { titulo: '', instrucoes: MALICIOSO, links: [{ titulo: 'Guia', url: 'https://exemplo.org/guia' }] }, prof);
confere('post: PUT cria, título vazio vira o do exercício', r.status === 200 && r.corpo.existe === true && r.corpo.titulo === exR.titulo);
confere('post: HTML nas instruções é guardado como texto cru (a tela escapa; ver js/utils/markdown.check.mjs)', r.corpo.instrucoes === MALICIOSO);
for (const [caso, corpo] of [
  ['link javascript:', { links: [{ titulo: 'x', url: 'javascript:alert(1)' }] }],
  ['link data:', { links: [{ titulo: 'x', url: 'data:text/html,<b>oi</b>' }] }],
  ['6 links', { links: Array.from({ length: 6 }, (_, i) => ({ titulo: `l${i}`, url: `https://exemplo.org/${i}` })) }],
  ['título com 151', { titulo: 'x'.repeat(151) }],
  ['instruções com 10.001', { instrucoes: 'x'.repeat(10001) }],
  ['data inválida', { prazo: 'amanhã' }],
  ['vencimento antes de Aberto em', { abertoEm: '2030-01-02T00:00:00.000Z', prazo: '2030-01-01T00:00:00.000Z' }],
  ['professorId', { professorId: 'u-2' }],
]) {
  r = await chamar('PUT', rotaPost, corpo, prof);
  confere(`post: ${caso} 400`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}

// Anexos: tipo pelo conteúdo, até 2 MB, até 3.
for (const [caso, corpo] of [
  ['exe com nome .pdf', { nome: 'virus.pdf', conteudo: b64('MZ\u0090\u0000 executavel') }],
  ['ZIP que não é DOCX', { nome: 'a.docx', conteudo: b64('PK\u0003\u0004 qualquer coisa') }],
  ['HTML com nome .png', { nome: 'a.png', conteudo: b64('<html><script>alert(1)</script></html>') }],
  ['mais de 2 MB', { nome: 'grande.pdf', conteudo: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(2 * 1024 * 1024)]).toString('base64') }],
  ['conteudo que não é base64', { nome: 'a.pdf', conteudo: '%%%' }],
  ['sem nome', { conteudo: PDF }],
]) {
  r = await chamar('POST', `${rotaPost}/anexos`, corpo, prof);
  confere(`anexo: ${caso} 400`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}
r = await chamar('POST', `${rotaPost}/anexos`, { nome: 'C:\\pasta\\roteiro.pdf', conteudo: PDF }, prof);
const anexoPdf = r.corpo;
confere('anexo: PDF entra, só com o nome (sem pasta), o tipo do conteúdo e o tamanho', r.status === 200 && anexoPdf.nome === 'roteiro.pdf' && anexoPdf.tipo === 'application/pdf' && anexoPdf.tamanho === 16 && Boolean(anexoPdf.enviadoEm));
r = await chamar('POST', `${rotaPost}/anexos`, { nome: 'foto.png', conteudo: `data:image/png;base64,${PNG}` }, prof);
confere('anexo: PNG em data URL entra como image/png', r.status === 200 && r.corpo.tipo === 'image/png');
r = await chamar('POST', `${rotaPost}/anexos`, { nome: 'outro.pdf', conteudo: PDF }, prof);
confere('anexo: o 3º entra', r.status === 200);
r = await chamar('POST', `${rotaPost}/anexos`, { nome: 'quarto.pdf', conteudo: PDF }, prof);
confere('anexo: o 4º é recusado (400)', ehErro(r, 400, 'DADOS_INVALIDOS'));
r = await chamar('GET', rotaPost, null, prof);
confere('post: lê os 3 anexos sem o conteúdo, e o link', r.corpo.anexos.length === 3 && r.corpo.anexos.every((a) => a.conteudo === undefined) && r.corpo.links[0].url === 'https://exemplo.org/guia');
r = await chamar('GET', rota, null, prof);
const naLista = r.corpo.find((a) => a.exercicioId === exR.id);
confere('lista do professor: temPost e 3 anexos', naLista.temPost === true && naLista.anexos === 3);

// Download: o professor dono e o aluno da sala; outro professor, aluno de outra turma, sem token: não.
r = await chamar('GET', `${rotaPost}/anexos/${anexoPdf.id}`, null, prof);
confere('download (professor): o mesmo arquivo', r.status === 200 && r.corpo.conteudo === PDF && r.corpo.nome === 'roteiro.pdf');
const rotaDoAluno = `/aluno/salas/${turma.id}/atividades/${exR.id}`;
r = await chamar('GET', `${rotaDoAluno}/anexos/${anexoPdf.id}`, null, tokenLia);
confere('download (aluno da sala): o mesmo arquivo', r.status === 200 && r.corpo.conteudo === PDF);
r = await chamar('GET', `${rotaDoAluno}/anexos/${anexoPdf.id}`, null, ana);
confere('download: aluno de outra turma 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `${rotaPost}/anexos/${anexoPdf.id}`, null, leo);
confere('download: outro professor 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', `${rotaPost}/anexos/${anexoPdf.id}`, null, tokenLia);
confere('download: aluno na rota do professor 403', ehErro(r, 403, 'TIPO_INVALIDO'));
r = await chamar('GET', `${rotaPost}/anexos/${anexoPdf.id}`);
confere('download: sem token 401', r.status === 401);
r = await chamar('GET', `/turmas/turma-2/atribuicoes/ex-prof-3/post/anexos/${anexoPdf.id}`, null, prof);
confere('download: anexo pedido por outro post 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
for (const [metodo, caminho, corpo] of [
  ['GET', rotaPost],
  ['PUT', rotaPost, { titulo: 'x' }],
  ['POST', `${rotaPost}/anexos`, { nome: 'a.pdf', conteudo: PDF }],
  ['DELETE', `${rotaPost}/anexos/${anexoPdf.id}`],
]) {
  r = await chamar(metodo, caminho, corpo, leo);
  confere(`${metodo} post (outra conta): 404`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
r = await chamar('DELETE', `${rotaPost}/anexos/${anexoPdf.id}`, null, prof);
confere('anexo: remover 204', r.status === 204);
r = await chamar('DELETE', `${rotaPost}/anexos/${anexoPdf.id}`, null, prof);
confere('anexo: remover de novo 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// O aluno lê a página da atividade: título do post, instruções, anexos, status.
r = await chamar('GET', rotaDoAluno, null, tokenLia);
confere(
  'aluno: a página traz o post, as datas e o status (não feita)',
  r.status === 200 && r.corpo.titulo === exR.titulo && r.corpo.post.instrucoes === MALICIOSO && r.corpo.post.anexos.length === 2 &&
    r.corpo.situacao === 'nao_feita' && r.corpo.tentativas === 0 && r.corpo.prazo === null,
);
confere('aluno: bloqueada, com o motivo (o B, anterior, não foi concluído)', r.corpo.bloqueada === true && r.corpo.motivo === `Conclua antes “${exB.titulo}”.`);
confere('aluno de outra turma: a página é 404', ehErro(await chamar('GET', rotaDoAluno, null, ana), 404, 'NAO_ENCONTRADO'));
confere('conta na rota do aluno: 403', ehErro(await chamar('GET', rotaDoAluno, null, prof), 403, 'TIPO_INVALIDO'));

// Agendada: antes de "Aberto em" o aluno não vê nem faz.
r = await chamar('PUT', rotaPost, { abertoEm: '2099-01-01T12:00:00.000Z' }, prof);
const umAnexo = r.corpo.anexos[0].id;
confere('agendar: 200 com abertoEm no futuro', r.status === 200 && r.corpo.abertoEm === '2099-01-01T12:00:00.000Z');
confere('agendar: o PUT sem instruções e links limpa os dois e mantém os anexos', r.corpo.instrucoes === '' && r.corpo.links.length === 0 && r.corpo.anexos.length === 2);
confere('agendada: a página do aluno é 404', ehErro(await chamar('GET', rotaDoAluno, null, tokenLia), 404, 'NAO_ENCONTRADO'));
confere('agendada: some da sala', !(await chamar('GET', `/aluno/salas/${turma.id}`, null, tokenLia)).corpo.lista.some((e) => e.id === exR.id));
confere('agendada: o treino não abre (404)', ehErro(await chamar('GET', `/exercicios/${exR.id}?turma=${turma.id}`, null, tokenLia), 404, 'NAO_ENCONTRADO'));
confere('agendada: o download do aluno é 404', ehErro(await chamar('GET', `${rotaDoAluno}/anexos/${umAnexo}`, null, tokenLia), 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', rota, null, prof);
confere('agendada: o professor vê a data de abertura', r.corpo.find((a) => a.exercicioId === exR.id).abertoEm === '2099-01-01T12:00:00.000Z');

// Vencida: o aluno ainda faz, e a tentativa fica marcada com atraso.
r = await chamar('PUT', rotaPost, { abertoEm: '2020-01-01T00:00:00.000Z', prazo: '2020-01-02T00:00:00.000Z' }, prof);
confere('prazo: 200 com o vencimento no passado', r.status === 200 && r.corpo.prazo === '2020-01-02T00:00:00.000Z');
confere('vencida: a página do aluno abre (é treino)', (await chamar('GET', rotaDoAluno, null, tokenLia)).status === 200);
const teo = await banco.alunosturmas.findFirst({ where: { ClassID: turma.id, Nome: 'Teo Lima' } });
await gravarSessao(teo.AlunoID, exR.id, turma.id, true);
r = await chamar('GET', rotaDoAluno, null, tokenLia);
confere('vencida: concluída depois do prazo é "concluida_com_atraso"', r.corpo.situacao === 'concluida_com_atraso' && r.corpo.tentativas === 1);
r = await chamar('GET', `/turmas/${turma.id}/alunos/${teo.AlunoID}/sessoes`, null, prof);
confere('vencida: o professor vê a tentativa com atraso', r.corpo.itens.some((s) => s.exerciseId === exR.id && s.comAtraso === true));
r = await chamar('GET', rota, null, prof);
confere('vencida: a lista conta 1 com atraso', r.corpo.find((a) => a.exercicioId === exR.id).concluidoComAtraso === 1);
await chamar('PUT', rotaPost, { prazo: null }, prof);
confere('sem prazo: a mesma tentativa volta a ser só "concluida"', (await chamar('GET', rotaDoAluno, null, tokenLia)).corpo.situacao === 'concluida');

// Retirar a atribuição apaga o post, os links e os anexos.
await chamar('PUT', rotaPost, { links: [{ titulo: 'Guia', url: 'https://exemplo.org/guia' }] }, prof);
const doPost = { where: { ClassID: turma.id, ExerciseID: exR.id } };
confere(
  'antes de retirar: post, link e anexos no banco',
  (await banco.atribuicoesposts.count(doPost)) === 1 && (await banco.atribuicoeslinks.count(doPost)) === 1 && (await banco.atribuicoesanexos.count(doPost)) === 2,
);
r = await chamar('DELETE', `${rota}/${exR.id}`, null, prof);
confere('retirar: 204', r.status === 204);
confere(
  'retirar: o post, os links e os anexos sumiram',
  (await banco.atribuicoesposts.count(doPost)) === 0 && (await banco.atribuicoeslinks.count(doPost)) === 0 && (await banco.atribuicoesanexos.count(doPost)) === 0,
);
confere('retirar: as sessões ficam', (await banco.sessionsprof.count({ where: { ExerciseID: exR.id } })) === 1);

await banco.$disconnect();
console.log(`\nTudo certo. Turma de teste criada: ${turma.id}`);
