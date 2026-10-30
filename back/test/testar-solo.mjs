// testar-solo.mjs
// Teste de fumaça das dez rotas do grupo "Solo", feito por HTTP (fetch)
// contra o back rodando, sem navegador. Cobre:
//   - sem token 401; token de aluno 403 TIPO_INVALIDO (menos em
//     GET /solo/missoes/:id, que aceita qualquer token);
//   - conta sem campanha: GET /solo/campanha null; as rotas que precisam
//     de campanha 404;
//   - POST /solo/campanha idempotente, também com 8 pedidos simultâneos
//     (o UNIQUE do banco v9 deixa uma linha só); GET e DELETE /solo/campanhas/:id só
//     do dono (de outra conta, 404);
//   - as 76 lições na ordem, sem o texto; o detalhe com o texto;
//   - POST /solo/sessoes: os 400 (ids de identidade no corpo e medidas
//     fora das colunas), o XP e o nível calculados no back, o recorde;
//   - o PROGRESSO NÃO REGRIDE: refazer uma lição pior não tira a lição das
//     concluídas, não baixa a melhor marca, não tira XP nem nível;
//   - histórico, indicadores e estatísticas batendo com as sessões.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: leo@teclar.dev...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:solo
//
// Cria uma conta "solo-<horário>@teclar.dev" pelo POST /auth/cadastro (uma
// conta nova é o único jeito de ter "ainda não começou o Solo" sem mexer
// nas do seed) e a apaga no fim, direto no banco (pelo BancoService do
// dist/): o CASCADE leva a campanha e as sessões junto.
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

// Uma sessão do Solo válida, com o que o motor da tela mandaria. Os acertos
// acompanham o PPM (wpm = acertos / 5 / minutos), senão a regra de
// plausibilidade recusa por "wpm não bate com os acertos e o tempo".
function sessao(licao, wpm, precisao, concluida) {
  const tempo = 90;
  const acertos = Math.round((wpm * 5 * tempo) / 60);
  return { exercicio_id: licao, wpm, precisao, acertos, erros: 3, tempo_gasto_segundos: tempo, concluida };
}

const banco = new BancoService();
const email = `solo-${Date.now()}@teclar.dev`;
const cadastro = await chamar('POST', '/auth/cadastro', { nome: 'Teste Solo', email, senha: 'senha1234' });
assert.equal(cadastro.status, 200, 'cadastro da conta de teste');
const novo = cadastro.corpo.token;
const contaNova = cadastro.corpo.usuario.id;
const leo = await entrar({ email: 'leo@teclar.dev', senha: 'senha123' });
const aluno = await entrar({ codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });

// ============================================================================
// 401 e 403
// ============================================================================

const ROTAS = [
  ['GET', '/solo/campanha'],
  ['POST', '/solo/campanha'],
  ['GET', '/solo/campanhas/camp-1'],
  ['DELETE', '/solo/campanhas/camp-1'],
  ['GET', '/solo/missoes'],
  ['GET', '/solo/missoes/solo-001'],
  ['POST', '/solo/sessoes', sessao('solo-001', 30, 90, true)],
  ['GET', '/solo/historico'],
  ['GET', '/solo/indicadores'],
  ['GET', '/solo/estatisticas'],
];
for (const [metodo, rota, corpo] of ROTAS) {
  const r = await chamar(metodo, rota, corpo);
  confere(`${metodo} ${rota}: sem token 401 TOKEN_INVALIDO`, ehErro(r, 401, 'TOKEN_INVALIDO'));
}
for (const [metodo, rota, corpo] of ROTAS.filter(([, rota]) => rota !== '/solo/missoes/solo-001')) {
  const r = await chamar(metodo, rota, corpo, aluno);
  confere(`${metodo} ${rota}: token de aluno 403 TIPO_INVALIDO`, ehErro(r, 403, 'TIPO_INVALIDO'));
}
let r = await chamar('GET', '/solo/missoes/solo-001', null, aluno);
confere('GET /solo/missoes/:id: token de aluno 200 (a lição não é de ninguém)', r.status === 200 && r.corpo.exerciseId === 'solo-001');

// ============================================================================
// Conta que ainda não começou o Solo
// ============================================================================

r = await chamar('GET', '/solo/campanha', null, novo);
confere('sem campanha: GET /solo/campanha 200 com null (estado, não erro)', r.status === 200 && r.corpo === null);
for (const rota of ['/solo/missoes', '/solo/historico', '/solo/indicadores', '/solo/estatisticas']) {
  r = await chamar('GET', rota, null, novo);
  confere(`sem campanha: GET ${rota} 404 NAO_ENCONTRADO`, ehErro(r, 404, 'NAO_ENCONTRADO'));
}
r = await chamar('POST', '/solo/sessoes', sessao('solo-001', 30, 90, true), novo);
confere('sem campanha: POST /solo/sessoes 404 NAO_ENCONTRADO', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// A campanha: criar (idempotente), ler pelo id, só do dono
// ============================================================================

// A primeira criação é uma CORRIDA: oito POSTs disparados juntos, como um
// clique duplo nervoso em duas abas. O UNIQUE de CampanhasSolo.JogadorID
// (banco v9) deixa só um INSERT passar; os outros recebem a mesma campanha.
const simultaneos = await Promise.all(Array.from({ length: 8 }, () => chamar('POST', '/solo/campanha', null, novo)));
const campanha = simultaneos[0].corpo;
confere(
  'POST /solo/campanha: 200, nível 1, 0 XP, jogador do token',
  simultaneos[0].status === 200 && campanha.nivelAtual === 1 && campanha.xpTotal === 0 && campanha.jogadorId === contaNova,
);
confere(
  'POST /solo/campanha: 8 simultâneos, todos 200 com a MESMA campanha (nenhum 500, nenhum erro)',
  simultaneos.every((resposta) => resposta.status === 200 && resposta.corpo.campanhaId === campanha.campanhaId),
);
confere(
  'POST /solo/campanha: 8 simultâneos, uma linha só no banco',
  (await banco.campanhassolo.count({ where: { JogadorID: contaNova } })) === 1,
);
r = await chamar('POST', '/solo/campanha', null, novo);
confere('POST /solo/campanha de novo: devolve a MESMA campanha (idempotente)', r.status === 200 && r.corpo.campanhaId === campanha.campanhaId);
const campanhasNoBanco = await banco.campanhassolo.count({ where: { JogadorID: contaNova } });
confere('POST /solo/campanha duas vezes: uma campanha só no banco', campanhasNoBanco === 1);
r = await chamar('GET', '/solo/campanha', null, novo);
confere('GET /solo/campanha: a do token', JSON.stringify(r.corpo) === JSON.stringify(campanha));

r = await chamar('GET', `/solo/campanhas/${campanha.campanhaId}`, null, novo);
confere('GET /solo/campanhas/:id: o dono lê', r.status === 200 && r.corpo.campanhaId === campanha.campanhaId);
r = await chamar('GET', `/solo/campanhas/${campanha.campanhaId}`, null, leo);
confere('GET /solo/campanhas/:id: outra conta 404 (não 403)', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/solo/campanhas/camp-1', null, novo);
confere('GET /solo/campanhas/:id: a camp-1 (de leo) pedida pela conta nova 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('DELETE', '/solo/campanhas/camp-1', null, novo);
confere('DELETE /solo/campanhas/:id: a de outra conta 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/solo/campanha', null, leo);
confere('DELETE de outra conta não apagou nada: leo continua com a camp-1', r.corpo?.campanhaId === 'camp-1');
r = await chamar('GET', '/solo/campanhas/nao-existe', null, novo);
confere('GET /solo/campanhas/:id que não existe 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// As lições
// ============================================================================

r = await chamar('GET', '/solo/missoes', null, novo);
const missoes = r.corpo;
confere('GET /solo/missoes: 200 com as 76 lições', r.status === 200 && missoes.length === 76);
confere('GET /solo/missoes: na ordem do percurso (1 a 76)', missoes.every((missao, i) => missao.ordem === i + 1));
confere('GET /solo/missoes: o texto não vem na lista', missoes.every((missao) => !('texto' in missao)));
confere(
  'GET /solo/missoes: a primeira igual ao exemplo do contrato',
  JSON.stringify(missoes[0]) ===
    JSON.stringify({
      exerciseId: 'solo-001',
      ordem: 1,
      nivel: 1,
      titulo: 'Lição 01 — Linha-guia',
      dificuldade: 'facil',
      repeticoes: 10,
      tempoLimiteSegundos: 472,
      tamanhoCaracteres: 59,
    }),
);
confere('GET /solo/missoes: nenhuma vem com cadeado (sem campo de bloqueio)', missoes.every((m) => Object.keys(m).length === 8));

r = await chamar('GET', '/solo/missoes/solo-001', null, novo);
confere(
  'GET /solo/missoes/:id: a lição com o texto, e tamanhoCaracteres = tamanho do texto',
  r.status === 200 && typeof r.corpo.texto === 'string' && r.corpo.texto.length === r.corpo.tamanhoCaracteres,
);
r = await chamar('GET', '/solo/missoes/nao-existe', null, novo);
confere('GET /solo/missoes/:id que não existe 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// POST /solo/sessoes: o que é recusado
// ============================================================================

const valida = sessao('solo-001', 30, 96, true);
const CORPOS_INVALIDOS = [
  ['campanha_id no corpo (a campanha sai do token)', { ...valida, campanha_id: 'camp-1' }],
  ['jogadorId no corpo', { ...valida, jogadorId: 'u-1' }],
  ['usuario_id no corpo', { ...valida, usuario_id: 'u-1' }],
  ['alunoId no corpo', { ...valida, alunoId: 'al-44' }],
  ['professorId no corpo', { ...valida, professorId: 'u-2' }],
  ['sem exercicio_id', { ...valida, exercicio_id: undefined }],
  ['wpm -1', { ...valida, wpm: -1 }],
  ['wpm 1000 (não cabe em DECIMAL(5,2))', { ...valida, wpm: 1000 }],
  ['wpm "30" (texto)', { ...valida, wpm: '30' }],
  ['precisao 100,5', { ...valida, precisao: 100.5 }],
  ['acertos 1,5', { ...valida, acertos: 1.5 }],
  ['erros -1', { ...valida, erros: -1 }],
  ['tempo_gasto_segundos "90"', { ...valida, tempo_gasto_segundos: '90' }],
  ['concluida "sim"', { ...valida, concluida: 'sim' }],
  // Plausibilidade (trapaça): impossíveis, mesmo cabendo nas colunas.
  ['sessão concluída em 0 s', { ...valida, tempo_gasto_segundos: 0 }],
  ['PPM acima do plausível (251)', { ...valida, wpm: 251 }],
  ['PPM que não bate com acertos e tempo', { ...valida, wpm: 200 }],
];
for (const [caso, corpo] of CORPOS_INVALIDOS) {
  r = await chamar('POST', '/solo/sessoes', corpo, novo);
  confere(`POST /solo/sessoes: ${caso} 400 DADOS_INVALIDOS`, ehErro(r, 400, 'DADOS_INVALIDOS'));
}
r = await chamar('POST', '/solo/sessoes', sessao('nao-existe', 30, 96, true), novo);
confere('POST /solo/sessoes: lição que não existe 404', ehErro(r, 404, 'NAO_ENCONTRADO'));
r = await chamar('GET', '/solo/campanha', null, novo);
confere('nada do que foi recusado mexeu no XP', r.corpo.xpTotal === 0);
confere('nada do que foi recusado virou sessão', (await banco.sessionssolo.count({ where: { CampanhaID: campanha.campanhaId } })) === 0);

// ============================================================================
// POST /solo/sessoes: XP, nível e recorde (XP por nível = 200, de Configuracoes)
// ============================================================================

r = await chamar('GET', '/parametros', null, novo);
confere('GET /parametros: xpPorNivel 200 (o valor do banco v9)', r.corpo.xpPorNivel === 200);

// As cinco sessões e o que o back tem de responder:
//   1. solo-001 concluída, 96%, 30 PPM   XP 50 + round(50*0,96*0,5) = 74   total  74  nível 1  recorde (1ª vez)
//   2. solo-001 concluída, 100%, 40 PPM  XP 50 + 25 = 75                    total 149  nível 1  recorde (40 > 30)
//   3. solo-002 NÃO concluída, 50%, 20   XP 30% de 50 = 15                  total 164  nível 1  recorde (1ª vez na lição)
//   4. solo-002 concluída, 80%, 25 PPM   XP 50 + 20 = 70                    total 234  nível 2  SUBIU  recorde (25 > 20)
//   5. solo-001 NÃO concluída, 40%, 10   XP 15                              total 249  nível 2  sem recorde
// A 5ª é "refazer uma lição concluída e ir pior".
const JOGADAS = [
  [sessao('solo-001', 30, 96, true), { xpGanho: 74, xpTotal: 74, nivelAtual: 1, subiuDeNivel: false, recordePessoal: true }],
  [sessao('solo-001', 40, 100, true), { xpGanho: 75, xpTotal: 149, nivelAtual: 1, subiuDeNivel: false, recordePessoal: true }],
  [sessao('solo-002', 20, 50, false), { xpGanho: 15, xpTotal: 164, nivelAtual: 1, subiuDeNivel: false, recordePessoal: true }],
  [sessao('solo-002', 25, 80, true), { xpGanho: 70, xpTotal: 234, nivelAtual: 2, subiuDeNivel: true, recordePessoal: true }],
  [sessao('solo-001', 10, 40, false), { xpGanho: 15, xpTotal: 249, nivelAtual: 2, subiuDeNivel: false, recordePessoal: false }],
];
const idsDasSessoes = [];
const respostas = [];
let estatisticasAntesDaPior = null;
for (const [indice, [corpo, esperado]] of JOGADAS.entries()) {
  if (indice === 4) {
    estatisticasAntesDaPior = (await chamar('GET', '/solo/estatisticas', null, novo)).corpo;
  }
  r = await chamar('POST', '/solo/sessoes', corpo, novo);
  const { id, ...numeros } = r.corpo ?? {};
  confere(
    `sessão ${indice + 1} (${corpo.exercicio_id}, ${corpo.wpm} PPM, ${corpo.precisao}%, ${corpo.concluida ? 'concluída' : 'não concluída'}): ${JSON.stringify(esperado)}`,
    r.status === 200 && typeof id === 'string' && JSON.stringify(numeros) === JSON.stringify(esperado),
  );
  idsDasSessoes.push(id);
  respostas.push(r.corpo);
}

r = await chamar('GET', '/solo/campanha', null, novo);
confere('a campanha gravou o XP e o nível (249, nível 2)', r.corpo.xpTotal === 249 && r.corpo.nivelAtual === 2);
r = await chamar('GET', `/sessoes/${idsDasSessoes[0]}`, null, novo);
confere('GET /sessoes/:id relê a sessão do Solo com o xpGanho', r.status === 200 && r.corpo.xpGanho === 74 && r.corpo.wpm === 30);
r = await chamar('GET', `/sessoes/${idsDasSessoes[0]}`, null, leo);
confere('GET /sessoes/:id: a sessão do Solo de outra conta 404', ehErro(r, 404, 'NAO_ENCONTRADO'));

// ============================================================================
// O progresso não regride
// ============================================================================

r = await chamar('GET', '/solo/estatisticas', null, novo);
const estatisticas = r.corpo;
const licao1 = estatisticas.porLicao.find((linha) => linha.exerciseId === 'solo-001');
const licao1Antes = estatisticasAntesDaPior.porLicao.find((linha) => linha.exerciseId === 'solo-001');
confere(
  'refazer pior: a solo-001 continua concluída (licoesConcluidas 2 antes e depois)',
  estatisticasAntesDaPior.licoesConcluidas === 2 && estatisticas.licoesConcluidas === 2,
);
confere(
  'refazer pior: a melhor marca da solo-001 continua 40 PPM e 100% (não virou 10 e 40%)',
  licao1Antes.melhorWpm === 40 && licao1.melhorWpm === 40 && licao1.melhorPrecisao === 100,
);
confere('refazer pior: a tentativa conta (3 tentativas) e vira a última vez', licao1.tentativas === 3 && licao1.ultimaVez > licao1Antes.ultimaVez);
confere(
  'refazer pior: o XP só subiu e o nível não desceu (o que o back respondeu na 4ª e na 5ª)',
  respostas[4].xpTotal > respostas[3].xpTotal && respostas[4].nivelAtual >= respostas[3].nivelAtual,
);

// ============================================================================
// Histórico, indicadores e estatísticas batendo com as sessões
// ============================================================================

r = await chamar('GET', '/solo/historico', null, novo);
confere('histórico: paginado com as 5, pagina 1', r.status === 200 && r.corpo.total === 5 && r.corpo.pagina === 1 && r.corpo.itens.length === 5);
confere('histórico: da mais antiga para a mais recente', JSON.stringify(r.corpo.itens.map((s) => s.id)) === JSON.stringify(idsDasSessoes));
confere(
  'histórico: o xpGanho de cada uma, e a soma é o XP da campanha',
  JSON.stringify(r.corpo.itens.map((s) => s.xpGanho)) === JSON.stringify([74, 75, 15, 70, 15]) &&
    r.corpo.itens.reduce((soma, s) => soma + s.xpGanho, 0) === 249,
);
confere(
  'histórico: na forma de SessaoSolo (sem alunoId), medidas como chegaram',
  r.corpo.itens[0].tempoSegundos === 90 && r.corpo.itens[0].acertos === 225 && !('alunoId' in r.corpo.itens[0]),
);

r = await chamar('GET', '/solo/indicadores', null, novo);
confere(
  'indicadores: 5 sessões; médias só das 3 concluídas (PPM 30, 40, 25 -> 32; precisão 96, 100, 80 -> 92); melhor PPM 40',
  JSON.stringify(r.corpo) ===
    JSON.stringify({
      campanhaId: campanha.campanhaId,
      nivelAtual: 2,
      xpTotal: 249,
      sessoesTotais: 5,
      wpmMedio: 32,
      precisaoMedia: 92,
      melhorWpm: 40,
    }),
);

const licao2 = estatisticas.porLicao.find((linha) => linha.exerciseId === 'solo-002');
confere(
  'estatísticas: melhores marcas da campanha (40 PPM, 100%) e uma linha por lição tentada',
  estatisticas.melhorWpm === 40 && estatisticas.melhorPrecisao === 100 && estatisticas.porLicao.length === 2,
);
confere(
  'estatísticas: o JOIN em ExerciciosSolo dá título e nível; solo-002 com 2 tentativas, melhor 25 PPM e 80%',
  licao2.titulo === missoes[1].titulo && licao2.nivel === 1 && licao2.tentativas === 2 && licao2.melhorWpm === 25 && licao2.melhorPrecisao === 80,
);

// ============================================================================
// DELETE /solo/campanhas/:id (o dono)
// ============================================================================

r = await chamar('DELETE', `/solo/campanhas/${campanha.campanhaId}`, null, novo);
confere('DELETE /solo/campanhas/:id: o dono apaga, 204 sem corpo', r.status === 204 && r.texto === '');
r = await chamar('GET', '/solo/campanha', null, novo);
confere('depois do DELETE: GET /solo/campanha volta a null', r.corpo === null);
confere('depois do DELETE: as sessões foram junto (CASCADE)', (await banco.sessionssolo.count({ where: { CampanhaID: campanha.campanhaId } })) === 0);
r = await chamar('POST', '/solo/campanha', null, novo);
confere('depois do DELETE: começar de novo cria outra campanha, do zero', r.corpo.campanhaId !== campanha.campanhaId && r.corpo.xpTotal === 0);

// A conta de teste sai do banco; o CASCADE leva a campanha nova junto.
await banco.users.delete({ where: { ID: contaNova } });
await banco.$disconnect();
console.log(`\nTudo certo. Conta de teste ${email} criada e apagada.`);
