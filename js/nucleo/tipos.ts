// tipos.ts
// Interfaces do domínio: o contrato entre o front e o back, extraído do
// que ./mocks.ts devolve hoje. Nenhum campo aqui foi inventado ou
// renomeado — se um nome parece estranho, é porque o back é assim.
//
// Regra dos nulos: campo que pode vir null do back é `T | null`; campo que
// pode simplesmente não vir é `campo?:`. O tsc está com strict desligado e
// não cobra nada disso hoje, mas o tipo é a documentação do contrato.
//
// Este arquivo só tem tipos: o tipos.js gerado é vazio e ninguém o importa
// em tempo de execução (os .ts usam `import type`).

// ============================================================================
// 1. Enumerações do banco
// ============================================================================

/** Rótulos exatos do ENUM Dificuldade. */
export type Dificuldade = 'facil' | 'medio' | 'dificil';

/** Os dois mundos do app. Casa com as classes .mundo-solo / .mundo-escola. */
export type Mundo = 'solo' | 'escola';

/**
 * De qual tabela o login veio. NÃO é coluna do banco: o back sabe porque
 * autenticou em Users (e-mail e senha) ou em Alunos (RP e senha de aluno).
 *   conta — Users. Acessa Solo E Professor.
 *   aluno — Alunos. Acessa só o mundo do aluno.
 */
export type TipoSessao = 'conta' | 'aluno';

/**
 * Onde a CONTA está navegando agora. É estado de navegação, não permissão:
 * qualquer conta abre os dois, e a tela aberta é quem define o modo (ver
 * guarda.soConta). Nunca vai ao back nem ao token. Não existe para aluno.
 */
export type Modo = 'solo' | 'professor';

// ============================================================================
// 2. Usuário e sessão de login
// ============================================================================

/** Turma como aparece dentro do usuário aluno (conveniência do login). */
export interface TurmaDoUsuario {
  id: string;
  nome: string;
}

/**
 * O `usuario` gravado pelo sessao.entrar() e devolvido no login/cadastro.
 * Espelha a tabela Users (ID, Nome, Email) mais campos de conveniência que
 * o back manda junto para a tela não pedir de novo logo após o login.
 *
 * nome e email são opcionais: o aluno não tem e-mail, e o nome dele é o
 * da conta dona (Alunos.UserID -> Users.Nome), que pode faltar. O id do
 * aluno é o RP. Ver sessao.nomeExibicao().
 *
 * Não há campo de perfil: a tabela Users não tem essa coluna. O que existe
 * é `tipo` (de qual tabela o login veio) e, só no front, o modo (ver
 * sessao.modo). Solo/Professor não é identidade da conta.
 */
export interface Usuario {
  id: string;
  /** nome null para aluno: a tabela Alunos não tem a coluna. */
  nome?: string | null;
  email?: string;
  tipo: TipoSessao;
  avatar?: string;
  /** Solo: campanha escolhida no lobby. Gravado por sessao.definirCampanha(). */
  campanhaAtiva?: string | null;
  /** Escola: turmas em que o aluno está matriculado. */
  turmas?: TurmaDoUsuario[];
  /** Escola: turma em uso. Gravado por sessao.definirTurma(). */
  turmaAtiva?: string | null;
}

/** Resposta de POST /auth/login. O cadastro devolve isto e mais a entrada
 *  de aluno (ver RespostaCadastro). */
export interface RespostaLogin {
  token: string;
  usuario: Usuario;
}

/**
 * Resposta de POST /auth/cadastro: a sessão, como no login, mais a entrada
 * de aluno que o back gerou para a conta nova.
 *
 * senhaAluno vem em texto puro SÓ nesta resposta, nunca em outra: depois
 * dela o back guarda só o hash. A tela de cadastro mostra uma vez e não
 * grava em lugar nenhum — por isso o sessao.entrar() recebe só token e
 * usuario, nunca esta resposta inteira.
 */
export interface RespostaCadastro extends RespostaLogin {
  /** "RP" + 7 dígitos, ex.: RP2025043. */
  rp: string;
  senhaAluno: string;
}

/** Corpo de POST /auth/login. Conta entra por e-mail; aluno entra pelo RP
 *  e pela senha de aluno, e o perfil 'Aluno' diz ao back em qual tabela
 *  procurar. */
export interface CredenciaisEmail {
  email: string;
  senha: string;
}
export interface CredenciaisAluno {
  perfil: 'Aluno';
  rp: string;
  senha: string;
}
export type Credenciais = CredenciaisEmail | CredenciaisAluno;

/** Resposta de GET /conta/rp. null se a conta ainda não tem RP — a tela
 *  mostra "—". */
export interface RpDaConta {
  rp: string | null;
}

/** Resposta de POST /conta/rp/nova-senha: a senha de aluno nova, em texto
 *  puro, só nesta resposta. A antiga deixa de valer na mesma hora. */
export interface NovaSenhaAluno {
  senhaAluno: string;
}

/** Corpo de POST /auth/cadastro. */
export interface DadosCadastro {
  nome: string;
  email: string;
  senha: string;
}

// ============================================================================
// 3. Erro da API
// ============================================================================

/**
 * A forma de todo erro que sai do api.ts — tanto o ErroApi real quanto o
 * que ./mocks.ts fabrica em erro(). As telas leem status/codigo e os
 * quatro atalhos booleanos; nunca precisam saber de onde o erro veio.
 */
export interface ErroDaApi extends Error {
  /** status HTTP; 0 = falha de rede, sem resposta */
  status: number;
  /** código curto vindo do corpo, ex.: 'ID_EM_USO' */
  codigo: string | null;
  readonly ehAutenticacao: boolean;
  readonly ehPermissao: boolean;
  readonly ehConflito: boolean;
  readonly ehRede: boolean;
}

// ============================================================================
// 4. Envelopes e filtros
// ============================================================================

/** Listagem paginada: { total, pagina, itens }. */
export interface Paginado<T> {
  total: number;
  pagina: number;
  itens: T[];
}

/** Filtros de listagem viram query string (ver montarQuery em api.ts).
 *  undefined, null e '' são ignorados. */
export type Filtros = Record<string, string | number | boolean | null | undefined>;

// ============================================================================
// 5. Mundo SOLO
// ============================================================================

/**
 * A campanha Solo, EXATAMENTE como a tabela CampanhasSolo:
 *   CampanhaID, JogadorID, NivelAtual, XPTotal.
 *
 * Quatro colunas, e nada mais. Não existe nome de personagem, avatar, nome
 * de campanha nem data de criação — e não adianta inventar um aqui: sem
 * coluna, o back não tem onde receber o campo e o dado não sobrevive à
 * troca de navegador. Este tipo já teve nomePersonagem, avatar, dataCriacao
 * e ativo; os quatro foram apagados quando o lobby entrou, porque eram
 * promessa que o banco não cumpre.
 *
 * Um jogador tem UMA campanha (ver api.solo.campanhaAtual). Por isso não há
 * mais listagem de campanhas nem DadosNovaCampanha: POST /solo/campanha não
 * recebe corpo nenhum.
 */
export interface Campanha {
  campanhaId: string;
  /** O dono. No back sai do token; aqui aparece porque é coluna da tabela. */
  jogadorId: string;
  nivelAtual: number;
  xpTotal: number;
}

/**
 * Uma lição do Solo, como está na tabela ExerciciosSolo (sem texto: ele só
 * sai no detalhe). São as 76 lições que o professor escreveu e que já
 * foram semeadas no banco — conteúdo inicial do sistema, não algo que a
 * conta cria.
 *
 * `nivel`, `repeticoes` e `ordem` são colunas de verdade
 * (ExerciciosSolo.Nivel, Repeticoes, Ordem), não invenção da tela:
 *   ordem      — 1 a 76, o percurso que o professor montou. É por ela que
 *                a lista ordena, e ela também é o NN do título.
 *   nivel      — 1 a 10, o agrupamento da tela. NÃO é requisito de
 *                acesso: não existe nível mínimo, e toda lição é clicável.
 *   repeticoes — quantas vezes a lição deve ser repetida (2, 5 ou 10).
 *
 * `titulo` e `dificuldade` não vinham do CSV do professor: foram gerados
 * pela mesma regra usada na carga do banco (ver montarLicao em mocks.ts),
 * para os dois lados não divergirem.
 *
 * O que NÃO está aqui não está porque a tabela não tem a coluna:
 * categoria, nível mínimo e XP por missão saíram daqui quando as lições
 * reais entraram. O XP de uma sessão vem de CONFIG.SOLO.XP_BASE_MISSAO —
 * a regra é uma só, do config, e não um número por lição.
 */
export interface Missao {
  exerciseId: string;
  ordem: number;
  nivel: number;
  titulo: string;
  dificuldade: Dificuldade;
  repeticoes: number;
  tempoLimiteSegundos: number;
  tamanhoCaracteres: number;
}

/**
 * GET /solo/missoes/:id — o único lugar com o texto completo.
 *
 * Não há tipo separado para o item da listagem: MissaoDaCampanha existia
 * só para carregar o campo `bloqueada`, e o cadeado foi embora junto com o
 * nível mínimo. A listagem devolve Missao puro.
 */
export interface MissaoDetalhe extends Missao {
  texto: string;
}

/** Uma linha do histórico Solo (GET /solo/historico, escopado pelo token). */
export interface SessaoSolo {
  id: string;
  exerciseId: string;
  wpm: number;
  precisao: number;
  tempoSegundos: number;
  /** Caracteres digitados certo, como o motor contou e a tela de treino
   *  enviou no POST. Volta na leitura para a tela de resultado mostrar o
   *  mesmo número depois de um F5. */
  acertos: number;
  erros: number;
  concluida: boolean;
  xpGanho: number;
  data: string;
}

/** Resposta de POST /solo/sessoes. O id abre a tela de resultado. */
export interface RespostaSessaoSolo {
  id: string;
  xpGanho: number;
  xpTotal: number;
  nivelAtual: number;
  subiuDeNivel: boolean;
  recordePessoal: boolean;
}

/** GET /solo/indicadores (campanha do token). Médias são null sem sessão. */
export interface IndicadoresSolo {
  campanhaId: string;
  nivelAtual: number;
  xpTotal: number;
  sessoesTotais: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  melhorWpm: number | null;
}

/**
 * Uma linha de GET /solo/estatisticas: o agregado de UMA lição já tentada,
 * sobre as sessões de SessionsSolo da campanha do jogador do token, com o
 * JOIN em ExerciciosSolo para o título e o nível. Lição nunca tentada não
 * aparece — a tela de estatísticas é sobre o que foi feito.
 */
export interface DesempenhoLicaoSolo {
  exerciseId: string;
  titulo: string;
  /** O nível da lição (ExerciciosSolo.Nivel, 1 a 10): é por ele que a tela filtra. */
  nivel: number;
  /** Quantas sessões nesta lição, concluídas ou não. Zero nunca acontece aqui. */
  tentativas: number;
  /** Maior PPM e maior precisão entre as tentativas. null só por segurança
   *  de contrato: uma lição com tentativa sempre tem um PPM. */
  melhorWpm: number | null;
  melhorPrecisao: number | null;
  /** Data ISO da sessão mais recente nesta lição. */
  ultimaVez: string;
}

/**
 * GET /solo/estatisticas — o que a tela de estatísticas do Solo mostra e
 * que não sai de outra rota. Escopada pela campanha do jogador DO TOKEN:
 * não recebe id de campanha nem de usuário, de propósito.
 *
 * O que NÃO está aqui, e não por esquecimento:
 *   · nível e XP — vêm de GET /solo/campanha (api.solo.campanhaAtual), a
 *     única verdade sobre a campanha; duplicar aqui seria duas respostas
 *     para a mesma pergunta;
 *   · sequência de dias e evolução — o front deriva das datas e dos PPM do
 *     histórico (GET /solo/historico), como o histórico do
 *     aluno faz (ver utils/desempenho.ts).
 *
 * Não estende IndicadoresSolo: aquele é médias (wpmMedio, precisaoMedia),
 * e esta tela não mostra média nenhuma — mostra melhor marca e agregado
 * por lição.
 */
export interface EstatisticasSolo {
  campanhaId: string;
  /** Lições DISTINTAS com pelo menos uma sessão concluída — o "quantas do
   *  percurso eu já fechei", não quantas sessões. Zero é 0. */
  licoesConcluidas: number;
  /** Melhor PPM e melhor precisão em toda a campanha. null sem sessão. */
  melhorWpm: number | null;
  melhorPrecisao: number | null;
  /** Uma linha por lição já tentada, em qualquer ordem — quem ordena é a tela. */
  porLicao: DesempenhoLicaoSolo[];
}

// ============================================================================
// 6. Mundo ESCOLA — turmas, alunos, exercícios, atribuições
// ============================================================================

export interface Turma {
  id: string;
  /** ProfessorID de ClassesProf: a conta dona. É isso que faz uma conta
   *  ser professora — não um perfil. */
  professorId: string;
  nome: string;
  /** COUNT feito no back — o front não soma nada. Só alunos ATIVOS:
   *  convidado que não respondeu não é aluno da turma ainda. */
  totalAlunos: number;
  totalExercicios: number;
  /** COUNT dos convites ainda sem resposta (ClassMembers com Status =
   *  'convidado'). Opcional: só GET /turmas manda. */
  convitesPendentes?: number;
  /** Texto pronto do back, ex.: "2026 · 1º semestre". A tela não monta. */
  periodo?: string;
  /** Semente do desenho da capa. Sem ela, a tela deriva uma do id. */
  capaSemente?: number;
  /** false = arquivada: some de GET /turmas e aparece em
   *  GET /turmas?ativa=false; o histórico continua. É o único estado da
   *  turma — não existe "encerrada" à parte. */
  ativa: boolean;
  dataCriacao: string;
}

/** GET /turmas/:id — as métricas do topo da tela de turma, já calculadas. */
export interface TurmaDetalhe extends Turma {
  /** média com 1 casa decimal, só dos alunos que treinaram; null se ninguém */
  ppmMedio: number | null;
}

/**
 * Linha de aluno numa turma (GET /turmas/:id/alunos). O `id` É o RP e é o
 * que identifica o aluno. Agregados vêm prontos do back; quem nunca
 * treinou tem os três últimos em null, e não em zero.
 *
 * `nome` é o da conta dona (Alunos.UserID -> Users.Nome): é a mesma
 * pessoa. Só aluno antigo, sem conta ligada, cai na coluna Nome de Alunos.
 * Sem nenhum dos dois vem null, e as telas mostram o RP.
 */
export interface Aluno {
  id: string;
  nome?: string | null;
  /** Data em que ele entrou na turma (a linha de ClassMembers). */
  entrouEm: string;
  totalSessoes: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  ultimaAtividade: string | null;
}

/**
 * Estado do aluno na turma: a coluna Status de ClassMembers. 'recusado'
 * também existe no banco, mas não chega ao professor: para ele, convite
 * recusado é convite que sumiu.
 */
export type EstadoNaTurma = 'ativo' | 'convidado';

/** Linha de GET /turmas/:id/alunos de quem está na turma. */
export interface AlunoAtivoDaTurma extends Aluno {
  estado: 'ativo';
}

/** Linha de GET /turmas/:id/alunos de quem foi convidado e ainda não
 *  respondeu. Não traz número de desempenho nenhum: ainda não é aluno da
 *  turma, e nada dele entra em contador, média ou relatório. */
export interface ConvidadoDaTurma {
  estado: 'convidado';
  /** O RP. */
  id: string;
  nome?: string | null;
  convidadoEm: string;
}

/** Item de GET /turmas/:id/alunos: ativos e convidados, na mesma lista,
 *  sempre com o estado dizendo qual é qual. */
export type LinhaDaTurma = AlunoAtivoDaTurma | ConvidadoDaTurma;

/** Resposta de POST /turmas/:id/convites/importar. Importação parcial é
 *  permitida: cada RP cai numa das três listas. */
export interface ResultadoConvites {
  convidados: ConvidadoDaTurma[];
  /** Já estavam na turma, ativos ou convidados: nada mudou para eles. */
  jaEstavam: { rp: string; estado: EstadoNaTurma }[];
  falhas: { rp: string; motivo: string }[];
}

/**
 * Exercício da biblioteca do professor (tabela ExerciciosProf), como cada
 * item de GET /exercicios chega. O texto vem junto: é ele que a tela edita,
 * e é dele que sai a contagem de caracteres — não existe coluna para isso
 * no banco, o front conta. A listagem devolve só os do professor logado.
 */
export interface Exercicio {
  id: string;
  /** ProfessorID de ExerciciosProf: a conta dona. */
  professorId: string;
  titulo: string;
  texto: string;
  dificuldade: Dificuldade;
  /** Em segundos; 0 = sem limite. */
  tempoLimiteSegundos: number;
  /** Em quantas turmas está atribuído: COUNT em AtribuicoesProf feito pelo
   *  back, nunca pelo front. Ausente: a tela mostra "—". */
  atribuidoA?: number;
  /** O banco v7 tem a tabela Categorias e ExerciciosProf.CategoriaID, mas
   *  nenhuma rota grava nem devolve a categoria (@nao-usado no api.ts), e a
   *  biblioteca não pede isso. O campo sobrevive, opcional, só porque o HUD
   *  do treino e o painel do aluno ainda o leem (com fallback). */
  categoria?: string;
}

/** GET /exercicios/:id. Hoje é a mesma forma da listagem (o texto já vem
 *  nela); o nome fica para o Treino, que só conhece o detalhe. */
export type ExercicioDetalhe = Exercicio;

/** Corpo de POST /exercicios e PATCH /exercicios/:id. A biblioteca manda o
 *  formulário inteiro nos dois casos. */
export interface DadosExercicio {
  titulo: string;
  texto: string;
  dificuldade: Dificuldade;
  tempoLimiteSegundos: number;
}

/**
 * Linha da tabela AtribuicoesProf, cuja chave primária é o PAR
 * (ClassID, ExerciseID): não há id de atribuição. `atribuidoEm` é a data
 * em que o professor atribuiu; `prazo` é a data de entrega.
 */
export interface Atribuicao {
  exerciseId: string;
  atribuidoEm?: string;
  prazo: string | null;
}

/** Item de GET /turmas/:id/atribuicoes — a visão do PROFESSOR: o exercício
 *  mais quantos alunos da turma já concluíram. */
export interface AtribuicaoProfessor {
  exercicioId: string;
  titulo: string;
  dificuldade: Dificuldade;
  atribuidoEm: string | null;
  concluidoPor: number;
  totalAlunos: number;
}

/** O miolo dos números de uma turma: a base de RelatorioTurma. Era a
 *  resposta de GET /turmas/:id/desempenho, apagada por repetir o
 *  relatório; o tipo fica como base, para o relatório não repetir campo.
 *  Médias só sobre alunos com sessão. */
export interface DesempenhoTurma {
  turmaId: string;
  totalAlunos: number;
  alunosComSessao: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
}

// ============================================================================
// 7. Sessões de treino (mundo ESCOLA)
// ============================================================================

/**
 * Pacote que a tela de treino envia ao gravar uma sessão: o que o motor
 * calcula (snake_case, como o back espera) mais os ids que a tela põe
 * conforme o mundo. Os nomes camelCase antigos seguem aceitos pelo mock
 * como fallback, mas não fazem parte do contrato.
 */
export interface DadosSessaoTreino {
  wpm: number;
  precisao: number;
  acertos: number;
  erros: number;
  tempo_gasto_segundos: number;
  concluida: boolean;
  exercicio_id?: string;
  turma_id?: string | null;
}

/** Uma sessão do mundo Escola (GET /sessoes/:id; e a base das linhas de histórico). */
export interface Sessao {
  id: string;
  exerciseId: string | null;
  alunoId: string;
  turmaId?: string | null;
  wpm: number;
  precisao: number;
  tempoSegundos: number;
  /** Caracteres digitados certo, como o motor contou e a tela de treino
   *  enviou no POST. Volta na leitura para a tela de resultado mostrar o
   *  mesmo número depois de um F5. */
  acertos: number;
  erros: number;
  concluida: boolean;
  data: string;
}

/** Resposta de POST /sessoes: a sessão gravada mais o recorde. */
export interface RespostaSessaoEscola extends Sessao {
  recordePessoal: boolean;
}

/**
 * Os quatro indicadores de treino do mundo Escola. Médias são null sem
 * sessão — nunca 0.
 *
 * NÃO tem rota própria: era o corpo de GET /sessoes/indicadores, que foi
 * apagado por duplicar /aluno/resumo. Fica como BASE do ResumoDoAluno
 * (seção 11), que é quem responde hoje. Vale também como a forma de
 * qualquer painel de indicadores de escola que venha depois — e é por isso
 * que continua um tipo com nome, e não campos soltos dentro do resumo.
 */
export interface IndicadoresEscola {
  sessoesTotais: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  melhorWpm: number | null;
}

/** GET /turmas/:id/alunos/:id/desempenho. */
export interface DesempenhoAluno {
  alunoId: string;
  totalSessoes: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  sessoes: Sessao[];
}

// ============================================================================
// 8. Admin
// ============================================================================

/** As do seed têm id numérico; as criadas pelo mock recebem id string. */
export interface Categoria {
  id: number | string;
  nome: string;
  ativo: boolean;
}

/** Espelha a tabela Configuracoes. */
export interface Parametros {
  wpmMeta: number;
  precisaoMinima: number;
  tempoLimitePadrao: number;
  xpPorNivel: number;
}

// ============================================================================
// 9. Fila de sessões (api.ts → filaSessoes)
// ============================================================================

/** Um item guardado no localStorage à espera de reenvio. */
export interface ItemFila {
  dados: DadosSessaoTreino;
  mundo: Mundo;
  em: number;
}

/** Resultado de filaSessoes.enviar(). */
export type ResultadoEnvio =
  | { ok: true; enfileirada: false; resposta: RespostaSessaoSolo | RespostaSessaoEscola }
  | { ok: false; enfileirada: true; pendentes: number };

/** Resultado de filaSessoes.sincronizar(). */
export interface ResultadoSincronizacao {
  enviadas: number;
  restantes: number;
}

// ============================================================================
// 10. Relatórios do professor (pages/professor/relatorios.html)
// ============================================================================
// Tudo aqui é AGREGADO PELO BACK, em SessionsProf com JOIN (Alunos_Turmas
// para saber quem é da turma, AtribuicoesProf para saber o que foi
// atribuído, ExerciciosProf para o título). O front não calcula média de
// nada: recebe pronto e mostra.
//
// Os três tipos ESTENDEM os que já existiam, em vez de repetir campo:
//   RelatorioTurma     estende DesempenhoTurma     (a base, sem rota própria)
//   RelatorioAluno     estende Aluno               (/turmas/:id/alunos)
//   RelatorioExercicio estende AtribuicaoProfessor (/turmas/:id/atribuicoes)
// Assim o relatório é o superconjunto declarado dessas rotas, e o dia em
// que um campo mudar de forma lá, muda aqui junto.
//
// Regra dos nulos, que a tela obedece à risca: toda média pode vir null
// enquanto o back não calcular, e null vira "—". Nunca "null", nunca
// "NaN", nunca 0 no lugar de null — zero é uma informação diferente.

/**
 * GET /turmas/:id/relatorio — as quatro métricas do topo da tela.
 *
 * Estende DesempenhoTurma: de lá vêm totalAlunos, alunosComSessao,
 * wpmMedio e precisaoMedia; aqui entram os dois números que só o
 * relatório mostra.
 */
export interface RelatorioTurma extends DesempenhoTurma {
  /** Quantos alunos treinaram nos ÚLTIMOS 7 DIAS — a janela é do back.
   *  É o numerador de "8 de 12"; o denominador é totalAlunos. */
  alunosAtivos: number | null;
  /** Pares (aluno, exercício) concluídos na turma. Zero é 0: a turma tem
   *  exercício atribuído e ninguém terminou nenhum. */
  exerciciosConcluidos: number | null;
}

/**
 * Uma linha da aba "Por aluno" (GET /turmas/:id/relatorio/alunos).
 *
 * Estende Aluno, então traz id (o RP, que É a identidade), o `nome`
 * (da conta dona, e pode faltar), totalSessoes, wpmMedio, precisaoMedia e
 * ultimaAtividade. Atenção: os agregados aqui são DA TURMA — só as sessões
 * dela entram na conta —, enquanto os de /turmas/:id/alunos são os do
 * aluno no sistema todo. São grandezas diferentes de propósito: um aluno
 * em duas turmas tem um relatório em cada uma.
 *
 * Aluno que nunca treinou nesta turma vem com totalSessoes 0 e os demais
 * agregados em null (nunca em zero: zero afirmaria "treinou e fez 0 PPM").
 */
export interface RelatorioAluno extends Aluno {
  /** Quantos dos exercícios atribuídos à turma ele concluiu — o "3" de
   *  "3 de 5". null: o back ainda não contou. */
  exerciciosConcluidos: number | null;
  /** Quantos exercícios a turma tem atribuídos — o "5" de "3 de 5". É o
   *  mesmo número em toda linha da tabela, e vem por linha porque é o
   *  COUNT que o back já tem na mão no JOIN. */
  exerciciosAtribuidos: number;
}

/**
 * Uma linha da aba "Por exercício" (GET /turmas/:id/relatorio/exercicios).
 * Só exercícios ATRIBUÍDOS à turma escolhida entram.
 *
 * Estende AtribuicaoProfessor: de lá vêm exercicioId, titulo, dificuldade,
 * atribuidoEm e o par concluidoPor/totalAlunos ("8 de 12").
 */
export interface RelatorioExercicio extends AtribuicaoProfessor {
  /** Média da TURMA neste exercício. null enquanto ninguém concluiu. */
  wpmMedio: number | null;
  precisaoMedia: number | null;
  /**
   * Quantas sessões ficaram com concluida = false: o aluno não terminou o
   * texto dentro do tempo limite. Exercício sem tempo limite
   * (tempoLimiteSegundos = 0) vem sempre 0 — não há tempo para estourar.
   */
  estouraramTempo: number;
}

/**
 * Uma sessão no modal de histórico do aluno
 * (GET /turmas/:id/alunos/:matricula/sessoes).
 *
 * É a Sessao de SessionsProf mais o título do exercício, que vem do JOIN —
 * a tela não tem a biblioteca do professor carregada para procurar o nome.
 * A rota devolve as sessões JÁ ORDENADAS da mais recente para a mais
 * antiga, e é paginada no contrato (um aluno acumula tentativa em cima de
 * tentativa ao longo do semestre).
 */
export interface SessaoDoAluno extends Sessao {
  /** null: o exercício foi excluído da biblioteca depois da sessão. */
  tituloExercicio: string | null;
}

// ============================================================================
// 11. Histórico do aluno (pages/aluno/historico.html)
// ============================================================================
// A tela em que o ALUNO vê o próprio desempenho. Nada aqui fala de turma
// como coletivo: não existe média da turma, posição, nem comparação com
// colega nenhum — nem como campo opcional. O que o aluno não pode ver não
// deve nem ter nome no contrato.
//
// As duas rotas (/aluno/historico e /aluno/resumo) são escopadas pelo
// AlunoID DO TOKEN. Não recebem matrícula por parâmetro, de propósito: o
// front não tem como pedir o histórico de outra pessoa nem por engano.
//
// De novo, nada de tipo paralelo — os dois estendem o que já existia:
//   SessaoDoHistorico estende SessaoDoAluno    (o histórico do relatório)
//   ResumoDoAluno     estende IndicadoresEscola (seção 7, sem rota própria)

/**
 * Uma linha da tabela do histórico.
 *
 * É a SessaoDoAluno do relatório do professor (sessão + título do
 * exercício, vindo do JOIN) mais o nome da turma — que ali não fazia
 * sentido, porque aquela rota já era de UMA turma, e aqui faz: o aluno vê
 * as sessões dele em todas as turmas em que está.
 */
export interface SessaoDoHistorico extends SessaoDoAluno {
  /** Nome da turma da sessão. null: sessão sem turma (ou turma removida).
   *  A tela só mostra esta coluna quando o aluno está em mais de uma. */
  nomeTurma: string | null;
}

/**
 * GET /aluno/resumo — os números do topo da tela, agregados pelo back
 * sobre as sessões DESTE aluno.
 *
 * Estende IndicadoresEscola, de onde vêm sessoesTotais, wpmMedio,
 * precisaoMedia e melhorWpm. Aquele tipo era o corpo de
 * GET /sessoes/indicadores, que respondia a esta mesma pergunta — "como eu
 * estou indo?" — e por isso foi apagado; o tipo ficou como base, e é ele
 * que mantém os quatro campos com um nome e uma forma só.
 *
 * A sequência de dias vem pronta porque a tela das salas mostra esse
 * número e não carrega a lista de sessões. O histórico continua contando
 * a dele sobre a lista, porque lá ela muda com o filtro por exercício. A
 * evolução não vem: só o histórico a mostra, e ele já tem a lista na mão.
 */
export interface ResumoDoAluno extends IndicadoresEscola {
  /** Quantas sessões ele terminou (concluida = true). É o "exercícios
   *  feitos" da tela: uma sessão concluída é um exercício feito. Zero é 0 —
   *  ele treinou e não terminou nenhuma. */
  sessoesConcluidas: number;
  /** A maior precisão que ele já alcançou. null sem nenhuma sessão. */
  melhorPrecisao: number | null;
  /** Dias seguidos com treino, terminando hoje ou ontem. 0 é 0: a
   *  sequência quebrou ou nunca começou. */
  diasSeguidos: number;
}

// ============================================================================
// 12. As salas do aluno (pages/aluno/dashboard.html e sala.html)
// ============================================================================
// "Sala" é a turma vista pelo aluno. Todas as rotas daqui saem do TOKEN,
// como as da seção 11: nenhuma recebe RP ou id de aluno (ver o grupo
// escola.aluno em api.ts).

/**
 * Item de GET /aluno/salas: uma turma em que ele está ATIVO, já com o
 * progresso DELE. Tudo pronto do back — a tela não conta nada.
 *
 * `professor` é o nome da conta dona da turma; null se não veio (a tela
 * mostra "—"). `capaSemente` é a mesma da tela de turmas do professor:
 * as duas telas desenham a mesma capa para a mesma turma.
 */
export interface SalaDoAluno {
  id: string;
  nome: string;
  professor: string | null;
  capaSemente?: number;
  /** Alunos ATIVOS da sala, ele incluído. COUNT do back. */
  totalAlunos: number;
  /** Exercícios atribuídos que ele já fez (concluído ou tempo esgotado). */
  exerciciosFeitos: number;
  exerciciosTotal: number;
}

/**
 * O estado de um exercício da sala para este aluno:
 *   nao_feito       — nenhuma sessão ainda;
 *   feito           — terminou o texto pelo menos uma vez;
 *   tempo_esgotado  — tentou, mas o tempo acabou em todas as vezes.
 * "Tempo esgotado" conta como feito no progresso: ele fez a atividade, e
 * o texto não diz que falhou. Pode treinar de novo quando quiser.
 */
export type EstadoExercicioDaSala = 'nao_feito' | 'feito' | 'tempo_esgotado';

/** Um exercício dentro de GET /aluno/salas/:id. Sem o texto (só sai no
 *  treino) e sem número de colega. */
export interface ExercicioDaSala {
  id: string;
  titulo: string;
  dificuldade: Dificuldade;
  /** Tamanho do texto, contado pelo back, que é quem tem o texto. */
  caracteres: number;
  /** Em segundos; 0 = sem limite. */
  tempoLimiteSegundos: number;
  atribuidoEm: string | null;
  prazo: string | null;
  estado: EstadoExercicioDaSala;
  /** A melhor sessão dele neste exercício, nesta sala. Tudo null quando o
   *  estado é nao_feito. */
  melhorWpm: number | null;
  melhorPrecisao: number | null;
  /** Data da sessão mais recente. */
  ultimaSessao: string | null;
}

/** GET /aluno/salas/:id — a sala e os exercícios dela, na ordem em que o
 *  professor atribuiu. Quem ordena para a tela (não feitos primeiro) é o
 *  front. */
export interface SalaDetalhe extends SalaDoAluno {
  lista: ExercicioDaSala[];
}

/**
 * GET /turmas/:id/meu-desempenho — o relatório individual do aluno NA
 * SALA: só as sessões dele naquela turma contam.
 *
 * Com sessoesConcluidas abaixo de 3, minhaMedia e mediaSala vêm null: com
 * uma ou duas sessões a média não diz nada, e a tela mostra quanto falta
 * em vez de um número. A média é sempre do BACK; a tela não calcula.
 */
export interface DesempenhoNaTurma {
  sessoesConcluidas: number;
  /** Exercícios diferentes que ele concluiu na sala. */
  licoes: number;
  diasSeguidos: number;
  minhaMedia: MediaDaSala | null;
  mediaSala: MediaDaSala | null;
}

/** Ritmo (PPM) e precisão (%), inteiros. */
export interface MediaDaSala {
  velocidade: number;
  precisao: number;
}

/**
 * Uma linha de GET /turmas/:id/ranking, já na ordem por pontos.
 *
 * `nome` vem null do quarto lugar em diante — a não ser na linha do
 * próprio aluno (`voce`). Quem esconde é o BACK: o nome dos colegas não
 * chega ao navegador, nem escondido.
 */
export interface LinhaDoRanking {
  posicao: number;
  nome: string | null;
  voce: boolean;
  licoes: number;
  /** PPM médio das sessões concluídas; null sem nenhuma. */
  ritmo: number | null;
  diasSeguidos: number;
  pontos: number;
}

/**
 * Item de GET /aluno/convites: uma sala que convidou este aluno pelo RP e
 * ainda espera resposta (ClassMembers com Status = 'convidado'). Traz o
 * bastante para ele saber o que está aceitando.
 */
export interface ConviteDoAluno {
  turmaId: string;
  nome: string;
  /** Nome da conta dona da turma; null se não veio. */
  professor: string | null;
  /** Alunos ATIVOS da sala: quem só foi convidado não conta. */
  totalAlunos: number;
  totalExercicios: number;
  convidadoEm: string | null;
}
