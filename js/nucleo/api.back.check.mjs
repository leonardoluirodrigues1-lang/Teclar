// api.back.check.mjs
// Teste do front ligado no back de verdade: importa o api.js COMPILADO (o
// mesmo que as telas usam) e chama cada uma das 54 funções contra o back
// rodando, sem navegador. Prova que o front fala a língua do back — rota,
// corpo, query e tratamento de erro —, coisa que os testes do back (que
// montam o fetch na mão) não provam.
//
// Cobre os três fluxos inteiros, cada um com uma conta nova:
//   Professor: cadastro, turma, alunos, exercício, atribuição, relatório.
//   Aluno:     primeiro acesso, treino (exercício + sessão), histórico, ranking.
//   Solo:      cadastro, campanha, missões, sessão, histórico e estatísticas.
// E, no fim, administração (com a conta admin do seed), a fila de sessões
// quando a rede cai e o 401 que derruba a sessão.
//
// Como rodar (na pasta teclar/):
//   1. em back/: npm run seed, npm run build e npm run start:prod (deixe aberto)
//   2. npx tsc                       (gera o api.js a partir do api.ts)
//   3. node js/nucleo/api.back.check.mjs
//
// Precisa de CONFIG.MOCK = false: com o mock ligado, nada disto sai para a rede.
// Grava no banco (contas teste-*@teclar.dev, turma, alunos); o npm run seed apaga.
import assert from 'node:assert/strict';

// --- o navegador de mentira -------------------------------------------------
// sessao.js e api.js usam sessionStorage, localStorage, location e window.
// Precisam existir ANTES do import, porque o sessao.js os lê ao carregar.

function storageDe(mapa) {
  const api = {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
  };
  // Object.keys(localStorage) precisa listar as chaves, como no navegador
  // (o sessao.limparTudo() percorre assim).
  return new Proxy(api, {
    ownKeys: () => [...mapa.keys()],
    getOwnPropertyDescriptor: (alvo, p) =>
      p in alvo
        ? { enumerable: false, configurable: true, value: alvo[p] }
        : { enumerable: true, configurable: true, value: mapa.get(p) },
  });
}

globalThis.sessionStorage = storageDe(new Map());
globalThis.localStorage = storageDe(new Map());
globalThis.location = { hostname: 'localhost', search: '' };
// Onde o api.js manda a pessoa quando a sessão expira: guardamos para conferir.
let redirecionouPara = null;
globalThis.window = { location: { replace: (url) => (redirecionouPara = url) } };

const { CONFIG } = await import('../config.js');
const { api, filaSessoes, ErroApi } = await import('./api.js');
const { sessao } = await import('./sessao.js');

assert.equal(CONFIG.MOCK, false, 'CONFIG.MOCK precisa ser false (e o api.js recompilado).');

// --- ajudantes --------------------------------------------------------------

let verificacoes = 0;

// Para no primeiro caso que falhar, com o nome dele.
function confere(nome, condicao) {
  assert.ok(condicao, nome);
  verificacoes++;
  console.log('ok -', nome);
}

// A chamada TEM de falhar com esse status e esse código, e com um ErroApi
// (a tela decide pelo status e pelo código, ver api.ts).
async function confereErro(nome, promessa, status, codigo) {
  try {
    await promessa;
  } catch (erro) {
    confere(`${nome} -> ${status} ${codigo}`, erro instanceof ErroApi && erro.status === status && erro.codigo === codigo);
    return;
  }
  assert.fail(`${nome}: devia falhar com ${status} ${codigo}, mas passou`);
}

// Faz o login (ou cadastro) e grava a sessão como a tela de login faz.
async function entrarCom(promessaDoLogin) {
  const resposta = await promessaDoLogin;
  sessao.entrar(resposta);
  return resposta;
}

const marca = Date.now();
const SENHA = 'senha123';
const TEXTO = 'O rato roeu a roupa do rei de Roma e a rainha riu.';

// O corpo que o motor de treino monta (typingEngine.montarCorpoSessao).
// acertos coerente com o PPM e o tempo (wpm = acertos / 5 / minutos): 200
// acertos em 60 s dá 40 PPM. Sem isso, a regra de plausibilidade recusa.
const medidas = { wpm: 40, precisao: 95, acertos: 200, erros: 2, tempo_gasto_segundos: 60, concluida: true };

// ============================================================================
// 1. Professor
// ============================================================================

const cadastroProf = await entrarCom(
  api.auth.cadastrar({ nome: 'Prof Teste', email: `teste-prof-${marca}@teclar.dev`, senha: SENHA })
);
confere('auth.cadastrar devolve token e conta', cadastroProf.token && cadastroProf.usuario.tipo === 'conta');
await confereErro(
  'auth.cadastrar com e-mail repetido',
  api.auth.cadastrar({ nome: 'Prof Teste', email: `teste-prof-${marca}@teclar.dev`, senha: SENHA }),
  409,
  'EMAIL_EM_USO'
);
await confereErro('auth.entrar com senha errada', api.auth.entrar({ email: `teste-prof-${marca}@teclar.dev`, senha: 'errada123' }), 401, 'CREDENCIAIS');
confere('401 de login não derruba a sessão', sessao.logado() && redirecionouPara === null);

const loginProf = await entrarCom(api.auth.entrar({ email: `teste-prof-${marca}@teclar.dev`, senha: SENHA }));
confere('auth.entrar (conta) devolve o mesmo id do cadastro', loginProf.usuario.id === cadastroProf.usuario.id);
confere('auth.eu é o dono do token', (await api.auth.eu()).id === cadastroProf.usuario.id);

// Turma
const turma = await api.turmas.criar(`Turma Teste ${marca}`);
confere('turmas.criar devolve turma ativa com código', turma.ativa === true && /^[A-HJ-NP-Z2-9]{6}$/.test(turma.codigo));
await confereErro('turmas.criar com nome repetido', api.turmas.criar(`Turma Teste ${marca}`), 409, 'TURMA_DUPLICADA');
confere('turmas.listar traz a turma nova', (await api.turmas.listar()).some((t) => t.id === turma.id));
confere('turmas.obter traz ppmMedio null (ninguém treinou)', (await api.turmas.obter(turma.id)).ppmMedio === null);
confere('turmas.renomear', (await api.turmas.renomear(turma.id, `Turma Renomeada ${marca}`)).nome === `Turma Renomeada ${marca}`);
confere('turmas.trocarCapa', (await api.turmas.trocarCapa(turma.id, 4242)).capaSemente === 4242);
confere('turmas.arquivar', (await api.turmas.arquivar(turma.id)).ativa === false);
confere('turmas.listarArquivadas traz a arquivada', (await api.turmas.listarArquivadas()).some((t) => t.id === turma.id));
confere('turmas.desarquivar', (await api.turmas.desarquivar(turma.id)).ativa === true);
const { codigo } = await api.turmas.novoCodigo(turma.id);
confere('turmas.novoCodigo troca o código', codigo !== turma.codigo);
await confereErro('turmas.obter de turma que não existe', api.turmas.obter('turma-nao-existe'), 404, 'NAO_ENCONTRADO');

// Alunos: Bia vai treinar; Caio só ocupa lugar no ranking
const importacao = await api.alunos.importar(turma.id, ['Bia Teste', 'Caio Teste', 'bia teste', '']);
confere('alunos.importar adiciona dois e recusa repetido e vazio', importacao.adicionados.length === 2 && importacao.falhas.length === 2);
const alunos = await api.alunos.daTurma(turma.id);
confere('alunos.daTurma em ordem alfabética, sem senha', alunos.map((a) => a.nome).join() === 'Bia Teste,Caio Teste' && alunos.every((a) => a.senhaDefinida === false));
const bia = alunos[0];
const caio = alunos[1];

// Exercício e atribuição
const exercicio = await api.exercicios.criar({ titulo: 'Exercício Teste', texto: TEXTO, dificuldade: 'facil', tempoLimiteSegundos: 0 });
confere('exercicios.criar', exercicio.id && exercicio.atribuidoA === 0);
await confereErro(
  'exercicios.criar com texto curto',
  api.exercicios.criar({ titulo: 'Curto', texto: 'pouco', dificuldade: 'facil', tempoLimiteSegundos: 0 }),
  400,
  'DADOS_INVALIDOS'
);
const atualizado = await api.exercicios.atualizar(exercicio.id, { titulo: 'Exercício Teste 2', texto: TEXTO, dificuldade: 'medio', tempoLimiteSegundos: 90 });
confere('exercicios.atualizar', atualizado.titulo === 'Exercício Teste 2' && atualizado.tempoLimiteSegundos === 90);
const descartavel = await api.exercicios.criar({ titulo: 'Para arquivar', texto: TEXTO, dificuldade: 'dificil', tempoLimiteSegundos: 0 });

const atribuidas = await api.turmas.atribuir(turma.id, [exercicio.id, descartavel.id]);
confere('turmas.atribuir devolve a lista crua', atribuidas.length === 2 && atribuidas.every((a) => a.prazo === null));
confere('turmas.removerAtribuicao devolve null (204)', (await api.turmas.removerAtribuicao(turma.id, descartavel.id)) === null);
confere('exercicios.excluir devolve null (204)', (await api.exercicios.excluir(descartavel.id)) === null);
const biblioteca = await api.exercicios.listar();
confere('exercicios.listar (paginado) sem o arquivado', biblioteca.pagina === 1 && biblioteca.itens.map((e) => e.id).join() === exercicio.id);
confere('exercicios.obter (conta)', (await api.exercicios.obter(exercicio.id)).atribuidoA === 1);
const atribuicoes = await api.turmas.atribuicoes(turma.id);
confere('turmas.atribuicoes com contagem pronta', atribuicoes.length === 1 && atribuicoes[0].concluidoPor === 0 && atribuicoes[0].totalAlunos === 2);
await confereErro('sessoes.registrar com token de conta', api.sessoes.registrar({ ...medidas, exercicio_id: exercicio.id, turma_id: turma.id }), 403, 'TIPO_INVALIDO');

// ============================================================================
// 2. Aluno
// ============================================================================

await api.auth.sair();
sessao.sair();
await confereErro('auth.entrar (aluno) com o código antigo', api.auth.entrar({ codigo: turma.codigo, nome: 'Bia Teste', senha: 'bia2026' }), 401, 'CREDENCIAIS');
const loginBia = await entrarCom(api.auth.entrar({ codigo, nome: 'bia  teste', senha: 'bia2026' }));
confere('primeiro acesso do aluno', loginBia.primeiroAcesso === true && loginBia.usuario.tipo === 'aluno');
confere('a turma do aluno vem no login (sessao.turmaAtiva)', sessao.turmaAtiva() === turma.id);

const salas = await api.escola.aluno.salas();
confere('escola.aluno.salas: uma sala, nada feito', salas.length === 1 && salas[0].exerciciosFeitos === 0 && salas[0].exerciciosTotal === 1);
const sala = await api.escola.aluno.sala(turma.id);
confere('escola.aluno.sala: exercício não feito', sala.lista[0].id === exercicio.id && sala.lista[0].estado === 'nao_feito');
const paraTreinar = await api.exercicios.obter(exercicio.id, turma.id);
confere('exercicios.obter (aluno, com ?turma=) traz o texto', paraTreinar.texto === TEXTO);
await confereErro('exercicios.obter (aluno) de exercício fora da turma', api.exercicios.obter(descartavel.id, turma.id), 404, 'NAO_ENCONTRADO');

// Treino: como a tela de treino envia (filaSessoes.enviar com mundo 'escola')
const envio = await filaSessoes.enviar({ ...medidas, exercicio_id: exercicio.id, turma_id: turma.id }, 'escola');
confere('filaSessoes.enviar grava a sessão escola', envio.ok && envio.resposta.recordePessoal === true && envio.resposta.alunoId === bia.id);
const segunda = await api.sessoes.registrar({ ...medidas, wpm: 30, acertos: 150, exercicio_id: exercicio.id, turma_id: turma.id });
confere('sessoes.registrar (pior) não é recorde', segunda.recordePessoal === false);
await confereErro('sessoes.registrar com alunoId no corpo', api.sessoes.registrar({ ...medidas, alunoId: caio.id, exercicio_id: exercicio.id, turma_id: turma.id }), 400, 'DADOS_INVALIDOS');
confere('sessoes.obter (F5 do resultado)', (await api.sessoes.obter(envio.resposta.id)).wpm === 40);

const historico = await api.escola.aluno.historico();
confere('escola.aluno.historico, mais recente primeiro', historico.total === 2 && historico.itens[0].id === segunda.id && historico.itens[0].tituloExercicio === 'Exercício Teste 2');
const resumo = await api.escola.aluno.resumo();
confere('escola.aluno.resumo', resumo.sessoesTotais === 2 && resumo.wpmMedio === 35 && resumo.melhorWpm === 40 && resumo.diasSeguidos === 1);
const meu = await api.escola.aluno.desempenhoNaTurma(turma.id);
confere('escola.aluno.desempenhoNaTurma: médias null abaixo de 3 sessões', meu.sessoesConcluidas === 2 && meu.minhaMedia === null);

// Ranking: Bia 1 lição, ritmo 35, 1 dia -> 20 + 35 + 5 = 60; Caio zerado
const ranking = await api.escola.aluno.rankingDaTurma(turma.id);
confere('ranking ordenado e pontuado pelo back', ranking.length === 2 && ranking[0].voce && ranking[0].pontos === 60 && ranking[1].pontos === 0);
confere('ranking: no pódio o colega tem nome', ranking[1].nome === 'Caio Teste' && ranking[1].ritmo === null);
await confereErro('ranking de outra turma', api.escola.aluno.rankingDaTurma('turma-1'), 404, 'NAO_ENCONTRADO');
await confereErro('turmas.listar com token de aluno', api.turmas.listar(), 403, 'TIPO_INVALIDO');
await confereErro('solo.campanhaAtual com token de aluno', api.solo.campanhaAtual(), 403, 'TIPO_INVALIDO');

// ============================================================================
// 1b. Professor de novo: o relatório já vê o treino da Bia
// ============================================================================

sessao.sair();
await entrarCom(api.auth.entrar({ email: `teste-prof-${marca}@teclar.dev`, senha: SENHA }));
const relatorio = await api.relatorios.turma(turma.id);
confere('relatorios.turma', relatorio.totalAlunos === 2 && relatorio.alunosComSessao === 1 && relatorio.wpmMedio === 35 && relatorio.exerciciosConcluidos === 1);
const porAluno = await api.relatorios.porAluno(turma.id);
confere('relatorios.porAluno, inclusive quem nunca treinou', porAluno.length === 2 && porAluno.find((a) => a.id === caio.id).wpmMedio === null);
const porExercicio = await api.relatorios.porExercicio(turma.id);
confere('relatorios.porExercicio', porExercicio.length === 1 && porExercicio[0].concluidoPor === 1);
const sessoesBia = await api.relatorios.sessoesDoAluno(turma.id, bia.id);
confere('relatorios.sessoesDoAluno com título', sessoesBia.total === 2 && sessoesBia.itens[0].tituloExercicio === 'Exercício Teste 2');
confere('alunos.desempenho', (await api.alunos.desempenho(turma.id, bia.id)).totalSessoes === 2);
confere('turmas.atribuicoes conta a Bia como concluinte', (await api.turmas.atribuicoes(turma.id))[0].concluidoPor === 1);
confere('turmas.obter: ppmMedio de quem treinou', (await api.turmas.obter(turma.id)).ppmMedio === 35);
confere('alunos.zerarSenha devolve null (204)', (await api.alunos.zerarSenha(turma.id, bia.id)) === null);
confere('alunos.remover devolve null (204)', (await api.alunos.remover(turma.id, caio.id)) === null);
confere('alunos.daTurma sem o removido', (await api.alunos.daTurma(turma.id)).length === 1);
await confereErro('alunos.remover de quem já saiu', api.alunos.remover(turma.id, caio.id), 404, 'NAO_ENCONTRADO');

// ============================================================================
// 3. Solo
// ============================================================================

sessao.sair();
await entrarCom(api.auth.cadastrar({ nome: 'Jogador Teste', email: `teste-solo-${marca}@teclar.dev`, senha: SENHA }));
confere('solo.campanhaAtual é null antes de começar', (await api.solo.campanhaAtual()) === null);
await confereErro('solo.missoes sem campanha', api.solo.missoes(), 404, 'NAO_ENCONTRADO');
const campanha = await api.solo.criarCampanha();
confere('solo.criarCampanha: nível 1, 0 XP', campanha.nivelAtual === 1 && campanha.xpTotal === 0);
confere('solo.criarCampanha é idempotente', (await api.solo.criarCampanha()).campanhaId === campanha.campanhaId);
sessao.definirCampanha(campanha.campanhaId);
confere('solo.campanha (por id)', (await api.solo.campanha(campanha.campanhaId)).jogadorId === sessao.usuario().id);

const missoes = await api.solo.missoes();
confere('solo.missoes: as 76 lições sem texto', missoes.length === 76 && missoes[0].texto === undefined);
const primeira = await api.solo.missao(missoes[0].exerciseId);
confere('solo.missao traz o texto', typeof primeira.texto === 'string' && primeira.texto.length > 0);

// precisao 95 -> 50 + round(50 * 0,95 * 0,5) = 74 XP
const envioSolo = await filaSessoes.enviar({ ...medidas, exercicio_id: primeira.exerciseId }, 'solo');
confere('filaSessoes.enviar grava a sessão solo com XP do back', envioSolo.ok && envioSolo.resposta.xpGanho === 74 && envioSolo.resposta.xpTotal === 74);
await confereErro('solo.registrarSessao com campanha_id no corpo', api.solo.registrarSessao({ ...medidas, campanha_id: 'x', exercicio_id: primeira.exerciseId }), 400, 'DADOS_INVALIDOS');
confere('sessoes.obter lê a sessão solo', (await api.sessoes.obter(envioSolo.resposta.id)).xpGanho === 74);
confere('solo.historico', (await api.solo.historico()).total === 1);
const indicadores = await api.solo.indicadores();
confere('solo.indicadores', indicadores.sessoesTotais === 1 && indicadores.wpmMedio === 40 && indicadores.xpTotal === 74);
const estatisticas = await api.solo.estatisticas();
confere('solo.estatisticas', estatisticas.licoesConcluidas === 1 && estatisticas.porLicao[0].exerciseId === primeira.exerciseId);
await confereErro('turmas.obter de turma de outra conta', api.turmas.obter(turma.id), 404, 'NAO_ENCONTRADO');

// ============================================================================
// 4. Fila de sessões: a rede cai no meio do treino
// ============================================================================

const urlCerta = CONFIG.BASE_URL;
CONFIG.BASE_URL = 'http://localhost:1/api'; // porta onde ninguém escuta
const semRede = await filaSessoes.enviar({ ...medidas, exercicio_id: primeira.exerciseId }, 'solo');
confere('sem rede, a sessão vai para a fila', semRede.enfileirada === true && filaSessoes.pendentes() === 1);
CONFIG.BASE_URL = urlCerta;
const sincronia = await filaSessoes.sincronizar();
confere('filaSessoes.sincronizar reenvia quando a rede volta', sincronia.enviadas === 1 && sincronia.restantes === 0);
confere('solo.historico com a sessão da fila', (await api.solo.historico()).total === 2);

confere('solo.apagarCampanha devolve null (204)', (await api.solo.apagarCampanha(campanha.campanhaId)) === null);
await confereErro('solo.campanha depois de apagada', api.solo.campanha(campanha.campanhaId), 404, 'NAO_ENCONTRADO');

// ============================================================================
// 5. Administração (a conta admin do seed: ana@teclar.dev)
// ============================================================================

confere('admin.categorias com conta comum', Array.isArray(await api.admin.categorias()));
confere('admin.parametros com conta comum', (await api.admin.parametros()).xpPorNivel > 0);
await confereErro('admin.criarCategoria com conta comum', api.admin.criarCategoria('Nada'), 404, 'NAO_ENCONTRADO');

sessao.sair();
await entrarCom(api.auth.entrar({ email: 'ana@teclar.dev', senha: SENHA }));
const categoria = await api.admin.criarCategoria(`Teste ${marca}`);
confere('admin.criarCategoria', categoria.ativo === true);
confere('admin.renomearCategoria', (await api.admin.renomearCategoria(categoria.id, `Teste 2 ${marca}`)).nome === `Teste 2 ${marca}`);
confere('admin.apagarCategoria devolve null (204)', (await api.admin.apagarCategoria(categoria.id)) === null);
const parametros = await api.admin.parametros();
confere('admin.salvarParametros (o mesmo valor: nada muda)', (await api.admin.salvarParametros({ wpmMeta: parametros.wpmMeta })).wpmMeta === parametros.wpmMeta);
await confereErro('admin.salvarParametros fora da faixa', api.admin.salvarParametros({ wpmMeta: 0 }), 400, 'DADOS_INVALIDOS');

// ============================================================================
// 6. Sessão expirada: 401 numa rota comum derruba a sessão e volta ao login
// ============================================================================

sessionStorage.setItem(CONFIG.CHAVES_STORAGE.TOKEN, 'token-que-o-back-nao-reconhece');
await confereErro('auth.eu com token inválido', api.auth.eu(), 401, 'TOKEN_INVALIDO');
confere('401 limpa a sessão e manda para o login', !sessao.logado() && redirecionouPara === '/pages/login.html?expirou=1');

console.log(`\nTudo certo: ${verificacoes} verificações, as 54 funções do api.ts contra o back.`);
