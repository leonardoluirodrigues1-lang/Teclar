// api.ts
// Todas as chamadas ao back passam por aqui. Nenhuma tela usa fetch direto.
// Enquanto CONFIG.MOCK for true, nada de rede sai daqui: tudo é respondido
// por ./mocks.js.

import { CONFIG, ROTA_LOGIN } from '../config.js';
import { sessao } from './sessao.js';
import { responderMock } from './mocks.js';
import type {
  Aluno,
  AlunoCriado,
  Atribuicao,
  AtribuicaoProfessor,
  Campanha,
  Categoria,
  Credenciais,
  DadosCadastro,
  DadosExercicio,
  DadosNovoAluno,
  DadosSessaoTreino,
  DadosTurma,
  DesempenhoAluno,
  DesempenhoTurma,
  ErroDaApi,
  Exercicio,
  ExercicioDetalhe,
  Filtros,
  EstatisticasSolo,
  IndicadoresSolo,
  ItemFila,
  LinhaImportacao,
  Missao,
  MissaoDetalhe,
  Mundo,
  Paginado,
  Parametros,
  RelatorioAluno,
  RelatorioExercicio,
  RelatorioTurma,
  ResumoDoAluno,
  RespostaCadastro,
  RespostaLogin,
  RpDaConta,
  NovaSenhaAluno,
  ConviteDoAluno,
  SalaDetalhe,
  SalaDoAluno,
  RespostaSessaoEscola,
  RespostaSessaoSolo,
  ResultadoEnvio,
  ResultadoImportacao,
  ResultadoSincronizacao,
  SenhaResetada,
  Sessao,
  SessaoDoAluno,
  SessaoDoHistorico,
  SessaoSolo,
  Turma,
  TurmaDetalhe,
  Usuario,
} from './tipos.js';

// ============================================================================
// 1. ErroApi
// ============================================================================

// Erro de qualquer chamada à API. A tela precisa do status HTTP para decidir
// o que fazer: 401 -> mandar para o login; 403 -> mostrar "sem permissão";
// 409 -> avisar de conflito (nome repetido, turma já encerrada); status 0 ->
// a rede caiu, dá para oferecer "tentar de novo" ou enfileirar.
export class ErroApi extends Error implements ErroDaApi {
  status: number;
  codigo: string | null;

  constructor(mensagem: string, status: number = 0, codigo: string | null = null) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status; // status HTTP; 0 = falha de rede, sem resposta
    this.codigo = codigo; // código curto vindo do corpo, ex.: 'ID_EM_USO'
  }

  get ehAutenticacao(): boolean {
    return this.status === 401;
  }
  get ehPermissao(): boolean {
    return this.status === 403;
  }
  get ehConflito(): boolean {
    return this.status === 409;
  }
  get ehRede(): boolean {
    return this.status === 0;
  }
}

// ============================================================================
// 2. Sessão expirada — 401 em qualquer chamada do app
// ============================================================================
// Token vencido, revogado ou apagado no back: a sessão local não vale mais
// nada. Vale para o app inteiro, não só para a tela de login — qualquer
// chamada pode ser a primeira a descobrir que o token morreu.
//
// As rotas PÚBLICAS ficam de fora: no /auth/login, 401 significa "senha
// errada", e derrubar a tela nesse caso seria trocar uma mensagem de erro
// por um redirecionamento sem explicação.

// Uma vez só: várias chamadas em paralelo podem receber 401 juntas, e sem
// esta trava cada uma dispararia o próprio replace().
let expirando = false;

function expirarSessao(): void {
  if (expirando) return;
  expirando = true;
  sessao.sair();
  // replace, não href: a tela que tomou 401 não volta no botão voltar.
  window.location.replace(`${ROTA_LOGIN}?expirou=1`);
}

// ============================================================================
// 3. req — o único ponto que fala fetch
// ============================================================================

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface OpcoesReq {
  publico?: boolean;
}

// `publico`: rota que pode responder 401 como resultado legítimo (as de
// autenticação). Sem a marca, todo 401 derruba a sessão.
//
// `T` é o formato da resposta que a rota promete — quem decide é cada
// método do objeto `api`, abaixo. O corpo é `unknown` porque só passa por
// JSON.stringify: esta camada não olha dentro dele.
async function req<T = unknown>(
  metodo: Metodo,
  rota: string,
  corpo?: unknown,
  { publico = false }: OpcoesReq = {}
): Promise<T> {
  try {
    return await executar<T>(metodo, rota, corpo);
  } catch (erro) {
    if (!publico && erro?.status === 401) {
      expirarSessao();
    }
    throw erro;
  }
}

async function executar<T = unknown>(metodo: Metodo, rota: string, corpo?: unknown): Promise<T> {
  // Modo mock: devolve dado falso, com o atraso de CONFIG.ATRASO_MOCK,
  // e nenhuma requisição de rede acontece. O token vai junto porque o mock
  // também o confere: sem isso, "sessão expirada" seria um caminho que só
  // existe no código e nunca dá para ver na tela.
  if (CONFIG.MOCK) {
    return responderMock(metodo, rota, corpo, sessao.token());
  }

  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = sessao.token();
  if (token) {
    cabecalhos.Authorization = `Bearer ${token}`;
  }

  const opcoes: RequestInit = { method: metodo, headers: cabecalhos };
  if (corpo !== undefined) {
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta: Response;
  try {
    resposta = await fetch(CONFIG.BASE_URL + rota, opcoes);
  } catch {
    // fetch só rejeita quando não houve resposta nenhuma (rede, DNS, CORS).
    // Erro HTTP (4xx/5xx) não cai aqui — é tratado logo abaixo.
    throw new ErroApi('Não foi possível falar com o servidor.', 0, 'REDE');
  }

  // Sem conteúdo: DELETE e afins.
  if (resposta.status === 204) {
    return null;
  }

  // O corpo de erro pode não ser JSON (ex.: 500 devolvendo HTML).
  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const mensagem = dados?.mensagem ?? dados?.message ?? 'Erro inesperado no servidor.';
    const codigo = dados?.codigo ?? dados?.code ?? null;
    throw new ErroApi(mensagem, resposta.status, codigo);
  }

  return dados;
}

// Atalhos por verbo HTTP. Mantêm o objeto api abaixo enxuto.
const get = <T = unknown>(rota: string) => req<T>('GET', rota);
const post = <T = unknown>(rota: string, corpo?: unknown, opcoes?: OpcoesReq) =>
  req<T>('POST', rota, corpo, opcoes);
// Rota de autenticação: 401 é resposta esperada, não sessão expirada.
const postPublico = <T = unknown>(rota: string, corpo?: unknown) =>
  post<T>(rota, corpo, { publico: true });
const put = <T = unknown>(rota: string, corpo?: unknown) => req<T>('PUT', rota, corpo);
const patch = <T = unknown>(rota: string, corpo?: unknown) => req<T>('PATCH', rota, corpo);
const del = <T = null>(rota: string) => req<T>('DELETE', rota);

// ============================================================================
// 4. montarQuery — query string a partir de um objeto de filtros
// ============================================================================

// Ignora undefined, null e string vazia, para não sujar a URL com
// "?pagina=&status=". Devolve '' quando não sobra nada.
function montarQuery(filtros?: Filtros | null): string {
  const usados = Object.entries(filtros ?? {}).filter(
    ([, valor]) => valor !== undefined && valor !== null && valor !== ''
  );
  if (usados.length === 0) {
    return '';
  }
  const parametros = new URLSearchParams();
  for (const [chave, valor] of usados) {
    parametros.append(chave, String(valor));
  }
  return `?${parametros.toString()}`;
}

// ============================================================================
// 5. api — chamadas organizadas por grupo
// ============================================================================

export const api = {
  auth: {
    // Login, um endpoint só. O corpo é que diz de onde a pessoa vem, porque
    // o banco é assim: Users entra por e-mail, Alunos entra pelo RP e pela
    // senha de aluno, que o back gerou no cadastro da conta.
    //   Conta: { email, senha }
    //   Aluno: { perfil: 'Aluno', rp, senha }
    // Resposta: { token, usuario: { ..., tipo } } — `tipo` é 'conta' ou
    // 'aluno', conforme a tabela em que o back autenticou.
    entrar: (credenciais: Credenciais) =>
      postPublico<RespostaLogin>('/auth/login', credenciais),

    // Cria a conta e já devolve token + usuario: quem acabou de se cadastrar
    // não passa pelo login de novo. 409 = e-mail já tem conta.
    // Devolve também { rp, senhaAluno }, a entrada de aluno que o back gera
    // junto com a conta. senhaAluno só vem AQUI, nunca em outra resposta.
    cadastrar: ({ nome, email, senha }: DadosCadastro) =>
      postPublico<RespostaCadastro>('/auth/cadastro', { nome, email, senha }),

    // Dados do usuário do token atual.
    eu: () => get<Usuario>('/auth/eu'),

    // Invalida a sessão no back. Pode falhar em silêncio: quem apaga a
    // sessão local é o sessao.sair(), e ele não depende desta resposta.
    sair: () => post<null>('/auth/logout', undefined, { publico: true }),
  },

  // A conta logada, fora de qualquer mundo.
  conta: {
    // O RP da conta do token (Configurações do Solo). A senha de aluno não
    // tem rota de leitura: ela só existe na resposta do cadastro.
    rp: () => get<RpDaConta>('/conta/rp'),
    // Troca a senha de aluno da conta do token e devolve a nova, uma vez.
    // A antiga deixa de valer na hora. Sem parâmetro: é sempre a própria.
    novaSenhaAluno: () => post<NovaSenhaAluno>('/conta/rp/nova-senha'),
  },

  // Mundo SOLO — rotas sob /solo/.
  solo: {
    // --- a campanha do jogador logado (singular, /solo/campanha) ----------
    // Um jogador tem UMA campanha, então não há listagem: quem pergunta
    // "qual é a minha?" não passa id nenhum — o dono sai do token.
    //
    // Devolve null quando o jogador ainda não começou. null é ESTADO, não
    // falha: é a primeira vez dele no Solo, e é o que o lobby mostra como
    // convite. Quem chamar isto não deve tratar a ausência no catch.
    campanhaAtual: () => get<Campanha | null>('/solo/campanha'),

    // Sem corpo: a campanha nasce com NivelAtual 1 e XPTotal 0, e o dono
    // sai do token. Não há nome de personagem nem avatar para mandar — a
    // tabela CampanhasSolo não tem essas colunas (ver o tipo Campanha).
    // Chamar duas vezes não cria duas campanhas: o back responde a que já
    // existe. Isso é o que torna o botão do lobby seguro.
    criarCampanha: () => post<Campanha>('/solo/campanha'),

    // --- a campanha por id (sub-recursos continuam no plural) -------------
    campanha: (id: string) => get<Campanha>(`/solo/campanhas/${id}`),
    apagarCampanha: (id: string) => del(`/solo/campanhas/${id}`),
    // As 76 lições do percurso, sem o texto de cada uma. Vêm todas: são
    // conteúdo semeado, iguais para qualquer jogador, e nenhuma é
    // bloqueada — a tabela ExerciciosSolo não tem nível mínimo. Quem
    // agrupa por nível e recolhe os grupos é a tela. Sem id na URL, como
    // /solo/historico: a campanha é a do token (sem campanha, 404).
    missoes: (filtros?: Filtros) => get<Missao[]>(`/solo/missoes${montarQuery(filtros)}`),
    missao: (id: string) => get<MissaoDetalhe>(`/solo/missoes/${id}`),
    registrarSessao: (dados: DadosSessaoTreino) =>
      post<RespostaSessaoSolo>('/solo/sessoes', dados),
    // As sessões da campanha do jogador do token, paginadas. Sem id na
    // URL, como /solo/campanha e /solo/estatisticas: era
    // /solo/campanhas/:id/historico, e um id de campanha na URL é um
    // caminho para pedir o histórico de outra pessoa. Sem campanha, 404.
    historico: (filtros?: Filtros) =>
      get<Paginado<SessaoSolo>>(`/solo/historico${montarQuery(filtros)}`),
    // Idem: os indicadores da campanha do token.
    indicadores: () => get<IndicadoresSolo>('/solo/indicadores'),

    // --- estatísticas (pages/solo/estatisticas.html) ----------------------
    // O agregado por lição e as melhores marcas da campanha do jogador do
    // token — sem id na URL, como /solo/campanha. Nível e XP NÃO vêm aqui:
    // saem de campanhaAtual(). Sequência de dias e evolução também não: a
    // tela deriva das datas e dos PPM de historico(). Ver EstatisticasSolo.
    estatisticas: () => get<EstatisticasSolo>('/solo/estatisticas'),
  },

  // Mundo ESCOLA — turmas.
  turmas: {
    // Lista curta (um professor tem turmas, não milhares): array direto, sem
    // envelope de paginação. Cada item traz totalAlunos e totalExercicios,
    // que são COUNT feito no back — o front não soma nada.
    listar: (filtros?: Filtros) => get<Turma[]>(`/turmas${montarQuery(filtros)}`),
    // Uma turma tem nome e nada mais: a tabela Turmas não tem ano, semestre
    // nem status para a tela preencher.
    criar: (nome: string) => post<Turma>('/turmas', { nome }),
    obter: (id: string) => get<TurmaDetalhe>(`/turmas/${id}`),
    // Renomear é a única edição que a tela de turmas faz, e PATCH diz isso:
    // só o campo enviado muda. O atualizar() abaixo é a troca completa
    // (PUT), para quando houver uma tela de edição de verdade.
    renomear: (id: string, nome: string) => patch<Turma>(`/turmas/${id}`, { nome }),
    atualizar: (id: string, dados: DadosTurma) => put<Turma>(`/turmas/${id}`, dados),
    // encerrar e reabrir são o mesmo endpoint de status, só muda o valor.
    // 'Encerrada' e 'Ativa' com maiúscula: são exatamente os rótulos do
    // ENUM Status da tabela Turmas. Fora do ENUM, o MySQL estrito recusa e
    // o não-estrito grava string vazia sem avisar.
    encerrar: (id: string) => patch<Turma>(`/turmas/${id}/status`, { status: 'Encerrada' }),
    reabrir: (id: string) => patch<Turma>(`/turmas/${id}/status`, { status: 'Ativa' }),
    // Os dois números da turma que o back já agrega. A tela de relatórios
    // NÃO usa esta rota: ela precisa de mais duas métricas e chama
    // api.relatorios.turma, cujo tipo ESTENDE o DesempenhoTurma daqui — as
    // duas respostas têm o mesmo miolo, de propósito, e não podem divergir.
    desempenho: (id: string) => get<DesempenhoTurma>(`/turmas/${id}/desempenho`),

    // --- atribuições de exercício (tabela AtribuicoesProf) ----------------
    // A visão do PROFESSOR sobre o que a turma recebeu: cada linha traz o
    // exercício MAIS quantos alunos da turma já concluíram.
    //
    // A visão do ALUNO sobre a mesma tabela é api.aluno.sala(), e não
    // carrega contagem da turma inteira — seria entregar o desempenho dos
    // colegas a quem só devia ver a própria lição.
    atribuicoes: (turmaId: string) =>
      get<AtribuicaoProfessor[]>(`/turmas/${turmaId}/atribuicoes`),

    // Vários de uma vez: o modal marca quantos exercícios quiser e confirma
    // uma vez só. `ids` é array de ExerciseID.
    atribuir: (turmaId: string, ids: string[]) =>
      post<Atribuicao[]>(`/turmas/${turmaId}/atribuicoes`, { exercicioIds: ids }),

    // A chave primária de AtribuicoesProf é (ClassID, ExerciseID): a
    // atribuição não tem id próprio, então a remoção é pelo PAR turma +
    // exercício, e não por um /atribuicoes/:id que não existe.
    removerAtribuicao: (turmaId: string, exercicioId: string) =>
      del(`/turmas/${turmaId}/atribuicoes/${exercicioId}`),
  },

  alunos: {
    daTurma: (turmaId: string) => get<Aluno[]>(`/turmas/${turmaId}/alunos`),
    // dados: { id, nome? } — a matrícula e, opcional, o nome (a coluna Nome
    // de Alunos aceita nulo; vazio vai como null). Sem id, o back gera a
    // matrícula. A resposta traz senha_inicial em texto puro. É a ÚNICA vez
    // que ela aparece — depois fica só o hash no back e não há como
    // recuperá-la.
    cadastrar: (turmaId: string, dados: DadosNovoAluno) =>
      post<AlunoCriado>(`/turmas/${turmaId}/alunos`, dados),
    // lista: array de linhas { id, nome? }. Matrícula que já existe é
    // vinculada à turma — e o nome da linha NÃO sobrescreve um nome já
    // gravado, só preenche quem estava sem (regra do back); matrícula nova
    // é cadastrada, e só essa volta com senha inicial.
    importar: (turmaId: string, lista: LinhaImportacao[]) =>
      post<ResultadoImportacao>(`/turmas/${turmaId}/alunos/importar`, { lista }),
    // Nome de quem já existe. null apaga (fica sem nome), nunca "".
    renomear: (alunoId: string, nome: string | null) =>
      patch<Aluno>(`/alunos/${alunoId}`, { nome }),
    remover: (turmaId: string, alunoId: string) =>
      del(`/turmas/${turmaId}/alunos/${alunoId}`),
    resetarSenha: (alunoId: string) => post<SenhaResetada>(`/alunos/${alunoId}/resetar-senha`),
    // Agregados de UM aluno na turma, com as sessões dele em anexo (array
    // completo, sem envelope). Quem quer só a lista de sessões — o modal de
    // histórico da tela de relatórios — usa api.relatorios.sessoesDoAluno,
    // que é paginada e traz o título do exercício no JOIN.
    desempenho: (turmaId: string, alunoId: string) =>
      get<DesempenhoAluno>(`/turmas/${turmaId}/alunos/${alunoId}/desempenho`),
  },

  // Relatórios do professor (pages/professor/relatorios.html). Tudo sai de
  // SessionsProf com JOIN e chega PRONTO: o back agrega, o front só mostra.
  // Nenhuma média é calculada na tela — e toda média pode vir null enquanto
  // o back não a calcular.
  //
  // Não é um paralelo dos /desempenho acima: os tipos destas três rotas
  // estendem os de lá (ver a seção 10 de tipos.ts), então o relatório é o
  // superconjunto declarado do que a tela de turma já consumia.
  relatorios: {
    // As quatro métricas do topo: alunos ativos (últimos 7 dias, janela do
    // back), PPM médio, precisão média e exercícios concluídos.
    turma: (turmaId: string) => get<RelatorioTurma>(`/turmas/${turmaId}/relatorio`),
    // Uma linha por aluno MATRICULADO — inclusive quem nunca treinou, que
    // vem com totalSessoes 0 e os agregados em null. Lista curta (uma
    // turma), array puro, como /turmas/:id/alunos.
    porAluno: (turmaId: string) => get<RelatorioAluno[]>(`/turmas/${turmaId}/relatorio/alunos`),
    // Uma linha por exercício ATRIBUÍDO à turma. Nada atribuído: array
    // vazio, e a tela mostra o estado vazio com link para a turma.
    porExercicio: (turmaId: string) =>
      get<RelatorioExercicio[]>(`/turmas/${turmaId}/relatorio/exercicios`),
    // O histórico que o modal abre: as sessões do aluno NESTA turma, já da
    // mais recente para a mais antiga. Paginada no contrato — um aluno
    // acumula tentativas —, então quem lê passa por desembrulhar().
    sessoesDoAluno: (turmaId: string, matricula: string) =>
      get<Paginado<SessaoDoAluno>>(`/turmas/${turmaId}/alunos/${matricula}/sessoes`),
  },

  // Biblioteca do professor (ExerciciosProf). A listagem devolve só os do
  // professor logado; busca e filtro de dificuldade são no cliente, por isso
  // não há query string aqui. Cada item traz o texto e o atribuidoA (COUNT
  // em AtribuicoesProf, feito pelo back). Quem lê a lista passa a resposta
  // por desembrulhar(): o contrato é paginado, o mock devolve tudo na 1.
  exercicios: {
    listar: () => get<Paginado<Exercicio>>('/exercicios'),
    // Aluno manda a turma em que está treinando (?turma=): o back só
    // devolve o exercício se ele estiver atribuído a ela. Conta ignora.
    obter: (id: string, turmaId?: string | null) =>
      get<ExercicioDetalhe>(`/exercicios/${id}${montarQuery({ turma: turmaId })}`),
    criar: (dados: DadosExercicio) => post<Exercicio>('/exercicios', dados),
    atualizar: (id: string, dados: DadosExercicio) => patch<Exercicio>(`/exercicios/${id}`, dados),
    // DELETE de verdade, não exclusão lógica: SessionsProf e AtribuicoesProf
    // têm ON DELETE CASCADE — a tela avisa antes.
    excluir: (id: string) => del(`/exercicios/${id}`),
    atribuir: (turmaId: string, ids: string[], prazo?: string | null) =>
      post<Atribuicao[]>(`/turmas/${turmaId}/exercicios`, { exercicio_ids: ids, prazo }),
    desatribuir: (turmaId: string, exId: string) =>
      del(`/turmas/${turmaId}/exercicios/${exId}`),
  },

  // Sessões do mundo ESCOLA (aluno): gravar uma e reler uma.
  //
  // A LISTA e o RESUMO das sessões do aluno não estão aqui: são o grupo
  // `aluno`, abaixo. Existiam também neste grupo, como GET /sessoes e
  // GET /sessoes/indicadores, e foram removidos — duas duplas de rotas
  // para a mesma pergunta acabariam respondendo coisas diferentes.
  sessoes: {
    registrar: (dados: DadosSessaoTreino) => post<RespostaSessaoEscola>('/sessoes', dados),
    // Escola primeiro; depois o histórico Solo — ver o mock de /sessoes/:id.
    obter: (id: string) => get<Sessao | SessaoSolo>(`/sessoes/${id}`),
  },

  // O PRÓPRIO aluno logado (pages/aluno/historico.html).
  //
  // Não confunda com o grupo `alunos` lá em cima: aquele é o PROFESSOR
  // administrando o quadro de uma turma dele, e a autorização vem de ele
  // ser dono da turma. Este é o aluno pedindo o que é dele, e a
  // autorização vem do TOKEN: nenhuma das duas rotas recebe matrícula por
  // parâmetro, então não existe caminho — nem por URL editada à mão — para
  // um aluno pedir o histórico de outro. É o mesmo motivo pelo qual
  // /turmas/:id/alunos/:matricula/sessoes (o modal do relatório do
  // professor) continua separada em vez de servir às duas telas: mesma
  // forma de resposta, autorizações diferentes.
  //
  // Esta é a ÚNICA dupla para "como eu estou indo?". As antigas
  // GET /sessoes e GET /sessoes/indicadores faziam a mesma pergunta, não
  // tinham consumidor e foram apagadas; os tipos daqui seguem estendendo
  // os de lá que ainda servem de base (ver a seção 11 de tipos.ts).
  aluno: {
    // A lista inteira das sessões dele, em todas as turmas, já da mais
    // recente para a mais antiga. Paginada no contrato (um semestre de
    // treino rende muita linha); quem lê passa por desembrulhar().
    //
    // Sem filtro por exercício na query: o seletor da tela é montado com
    // os exercícios que aparecem NESTA lista, então filtrar no cliente não
    // custa requisição nenhuma e não há como o seletor oferecer um
    // exercício que a lista não tem.
    historico: () => get<Paginado<SessaoDoHistorico>>('/aluno/historico'),
    // Os números do topo: melhor PPM, melhor precisão, quantas sessões e
    // quantas ele concluiu. Sequência de dias e evolução NÃO vêm daqui —
    // saem das datas e dos PPM da lista, no front.
    resumo: () => get<ResumoDoAluno>('/aluno/resumo'),
    // As salas em que ele está (a tela inicial do aluno), cada uma com o
    // progresso dele: feitos de total.
    salas: () => get<SalaDoAluno[]>('/aluno/salas'),
    // Uma sala e os exercícios dela, com o estado de cada um PARA ELE. O id
    // é da sala, nunca de aluno: sala em que ele não está é 404.
    sala: (id: string) => get<SalaDetalhe>(`/aluno/salas/${encodeURIComponent(id)}`),
    // Os convites que esperam resposta dele.
    convites: () => get<ConviteDoAluno[]>('/aluno/convites'),
    // Aceitar põe ele na sala e devolve a sala, pronta para a tela inicial.
    // Convite que não existe mais (cancelado, já respondido) é 404.
    aceitarConvite: (turmaId: string) =>
      post<SalaDoAluno>(`/aluno/convites/${encodeURIComponent(turmaId)}/aceitar`),
    recusarConvite: (turmaId: string) =>
      post<null>(`/aluno/convites/${encodeURIComponent(turmaId)}/recusar`),
  },

  admin: {
    categorias: () => get<Categoria[]>('/categorias'),
    criarCategoria: (nome: string) => post<Categoria>('/categorias', { nome }),
    renomearCategoria: (id: string | number, nome: string) =>
      patch<Categoria>(`/categorias/${id}`, { nome }),
    apagarCategoria: (id: string | number) => del(`/categorias/${id}`),
    parametros: () => get<Parametros>('/parametros'),
    salvarParametros: (dados: Partial<Parametros>) => put<Parametros>('/parametros', dados),
  },
};

// ============================================================================
// 6. filaSessoes — resultado de treino não se perde se a rede cair
// ============================================================================
// O cálculo (PPM, precisão, erros) é todo feito no front, então a tela de
// resultado mostra o número de qualquer jeito. O que pode falhar é só a
// gravação no back — e para isso existe esta fila no localStorage.

const CHAVE_FILA = CONFIG.CHAVES_STORAGE.FILA_SESSOES;

function lerFila(): ItemFila[] {
  const bruto = localStorage.getItem(CHAVE_FILA);
  if (bruto == null) {
    return [];
  }
  // Fila corrompida não pode derrubar a tela: trata como vazia.
  try {
    const fila = JSON.parse(bruto);
    return Array.isArray(fila) ? fila : [];
  } catch {
    return [];
  }
}

function escreverFila(fila: ItemFila[]): void {
  localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
}

// Escolhe o endpoint de gravação conforme o mundo.
function registradorDe(mundo: Mundo) {
  return mundo === 'solo' ? api.solo.registrarSessao : api.sessoes.registrar;
}

export const filaSessoes = {
  // Tenta gravar a sessão. Se falhar POR REDE, guarda na fila e devolve
  // { ok:false, enfileirada:true, pendentes:n }. Qualquer outro erro sobe.
  async enviar(dados: DadosSessaoTreino, mundo: Mundo): Promise<ResultadoEnvio> {
    try {
      const resposta = await registradorDe(mundo)(dados);
      return { ok: true, enfileirada: false, resposta };
    } catch (erro) {
      if (erro instanceof ErroApi && erro.ehRede) {
        const fila = lerFila();
        fila.push({ dados, mundo, em: Date.now() });
        escreverFila(fila);
        return { ok: false, enfileirada: true, pendentes: fila.length };
      }
      throw erro;
    }
  },

  // Quantas sessões estão esperando reenvio.
  pendentes(): number {
    return lerFila().length;
  },

  // Reenvia tudo o que está na fila. O que falhar por rede volta para a
  // fila; o que falhar por validação é descartado, senão a fila nunca
  // esvazia. Devolve { enviadas, restantes }.
  async sincronizar(): Promise<ResultadoSincronizacao> {
    const fila = lerFila();
    if (fila.length === 0) {
      return { enviadas: 0, restantes: 0 };
    }

    const sobraram: ItemFila[] = [];
    let enviadas = 0;

    for (const item of fila) {
      try {
        await registradorDe(item.mundo)(item.dados);
        enviadas++;
      } catch (erro) {
        if (erro instanceof ErroApi && erro.ehRede) {
          sobraram.push(item); // rede ainda fora: tenta na próxima sincronização
        }
        // erro de validação (400/409/...): descarta o item silenciosamente
      }
    }

    escreverFila(sobraram);
    return { enviadas, restantes: sobraram.length };
  },

  limpar(): void {
    localStorage.removeItem(CHAVE_FILA);
  },
};
