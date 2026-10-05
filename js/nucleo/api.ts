// api.ts
// Todas as chamadas ao back passam por aqui. Nenhuma tela usa fetch direto.
// Enquanto CONFIG.MOCK for true, nada de rede sai daqui: tudo é respondido
// por ./mocks.js.
//
// Este arquivo é a FONTE do contrato com o back: o CONTRATO-API.md da raiz
// é gerado daqui (node gerar-contrato.mjs). Se os dois divergirem, vale
// este. As marcas @ abaixo e na seção 5 são lidas pelo gerador.
//
// @convencao Toda rota, menos as três públicas de /auth (login, cadastro e
//   logout), exige o cabeçalho Authorization: Bearer <token>. Token
//   ausente, vencido ou inválido: 401 TOKEN_INVALIDO, e a tela volta ao login.
// @convencao Corpo de erro: { "mensagem": "...", "codigo": "NAO_ENCONTRADO" }.
//   A tela decide pelo status e pelo código, nunca pelo texto da mensagem.
// @convencao A identidade SEMPRE sai do token. Recurso de outra conta
//   responde 404, igual ao que não existe — 403 confirmaria que ele existe.
//   403 TIPO_INVALIDO é só para o tipo de token errado (conta numa rota de
//   aluno, aluno numa rota de conta).
// @convencao Sucesso sem corpo (DELETE, recusar convite, logout): 204.
//   Datas em ISO 8601 ("2026-10-03T14:20:00.000Z"; só a data: "2026-10-03").
// @convencao Média que o back não pôde calcular (sem amostra) vem null, nunca
//   0: zero é informação diferente. A tela mostra "—".
// @convencao Listas que crescem sem teto vêm paginadas:
//   { "total": 12, "pagina": 1, "itens": [...] }. As curtas, array puro.
//
// Banco: DB_Teclar_v7.sql. Toda coluna que o contrato usa existe nele —
// Alunos.UserID, ClassMembers.Status e Data_Convite (desde a v6),
// ClassesProf.Ativa, CapaSemente e Data_Criacao (desde a v7). Não há
// mais coluna pendente.
//
// Coluna que JÁ EXISTE e muda de SIGNIFICADO na v6:
// @coluna-redefinida ClassMembers.Data_Matricula — deixa de ser a data em
//   que o professor matriculou o aluno e passa a ser a data em que o ALUNO
//   ACEITOU o convite. Fica NULL enquanto Status = 'convidado' e é
//   preenchida no aceite (POST /aluno/convites/:turmaId/aceitar). É o
//   "entrouEm" das respostas. A data do convite é Data_Convite. Na v7 a
//   coluna perdeu o DEFAULT CURRENT_TIMESTAMP: o convite já nasce com NULL.
//
// Colunas que EXISTEM no v7 e nenhuma rota grava. Não é esquecimento: a
// coluna está lá esperando a rota. Até ela existir, fica no valor padrão.
// @nao-usado ExerciciosSolo.NivelMinimo — nível da campanha que desbloqueia
//   a lição. Nenhuma rota lê: GET /solo/missoes não manda cadeado, e a tela
//   não bloqueia nada.
// @nao-usado ExerciciosSolo.XPConcessao — XP base da lição. Nenhuma rota
//   lê: o XP de POST /solo/sessoes sai de uma constante do back
//   (XP_BASE_MISSAO), igual para toda lição.
// @nao-usado ExerciciosSolo.CategoriaID / ExerciciosProf.CategoriaID — FK
//   para Categorias. Nenhuma rota grava nem devolve: DadosExercicio não tem
//   categoria, e a resposta de /exercicios também não.
// @nao-usado AtribuicoesProf.Prazo — data de entrega. As respostas já
//   devolvem `prazo` (POST /turmas/:id/atribuicoes, GET /aluno/salas/:turmaId),
//   mas nenhuma rota grava: vem sempre null.
// @nao-usado ClassesProf.Ano / ClassesProf.Semestre — de onde o back monta
//   o texto de `periodo`. Nenhuma rota grava (POST /turmas só recebe o
//   nome): ficam NULL, e a turma vem sem `periodo`.
//
// Ainda sem lugar no banco (não é coluna pedida, é decisão a tomar):
// @pendencia Papel de administrador — POST, PATCH e DELETE /categorias e
//   PUT /parametros exigem administrador, mas a tabela Users não tem coluna
//   de papel. O back precisa de um jeito de saber quem é administrador
//   (uma coluna ou uma tabela). Até lá, o mock não tem nenhum.

import { CONFIG, ROTA_LOGIN } from '../config.js';
import { sessao } from './sessao.js';
import { responderMock } from './mocks.js';
import type {
  Aluno,
  Atribuicao,
  AtribuicaoProfessor,
  Campanha,
  Categoria,
  Credenciais,
  DadosCadastro,
  DadosExercicio,
  DadosSessaoTreino,
  DesempenhoNaTurma,
  DesempenhoAluno,
  ErroDaApi,
  Exercicio,
  ExercicioDetalhe,
  Filtros,
  EstatisticasSolo,
  IndicadoresSolo,
  ItemFila,
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
  ConvidadoDaTurma,
  LinhaDaTurma,
  LinhaDoRanking,
  ResultadoConvites,
  SalaDetalhe,
  SalaDoAluno,
  RespostaSessaoEscola,
  RespostaSessaoSolo,
  ResultadoEnvio,
  ResultadoSincronizacao,
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
// 409 -> avisar de conflito (nome repetido); status 0 ->
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
// Este objeto É o contrato com o back. Cada rota tem um bloco de comentário
// com as marcas abaixo, e é desses blocos que o gerar-contrato.mjs (na
// raiz) monta o CONTRATO-API.md para o Swagger. Mudou uma rota, muda o
// bloco dela aqui; o .md é regerado, nunca editado à mão.
//
//   @grupo       abre um grupo de rotas (uma seção do .md); as linhas
//                seguintes, até a primeira @rota, são a introdução
//   @rota        MÉTODO /caminho
//   @corpo       a 1ª linha diz o que vai; o resto é o exemplo em JSON
//   @resposta    a 1ª linha diz status e tipo; o resto é o exemplo em JSON
//   @erros       um por linha: status CODIGO — quando
//   @identidade  de onde sai quem pede, e o que responde quando o recurso
//                é de outra conta
//   @back        o que o back calcula e a tela NÃO pode calcular
//   @nota        o porquê de alguma decisão
//
// Os tipos citados (Turma, Sessao...) estão em ./tipos.ts.

export const api = {
  // @grupo Autenticação
  // Um login para as duas tabelas: Users entra por e-mail; Alunos entra
  // pelo RP e pela senha de aluno. As três primeiras rotas são PÚBLICAS:
  // nelas 401 quer dizer "credencial errada", não "sessão expirada".
  auth: {
    // @rota POST /auth/login
    // @corpo Conta: { email, senha }. Aluno: { perfil: "Aluno", rp, senha } (Credenciais)
    //   { "email": "prof@teclar.dev", "senha": "senha123" }
    //   { "perfil": "Aluno", "rp": "RP2025043", "senha": "Aluno#2025" }
    // @resposta 200 RespostaLogin
    //   { "token": "eyJhbGciOi...",
    //     "usuario": { "id": "u-2", "nome": "Henrique Lima", "email": "prof@teclar.dev",
    //                  "tipo": "conta", "campanhaAtiva": "camp-2" } }
    //   Aluno: { "token": "...", "usuario": { "id": "RP2025043", "nome": "Ana Pires", "tipo": "aluno",
    //            "turmas": [{ "id": "turma-1", "nome": "9º Ano A — Manhã" }] } }
    // @erros 401 CREDENCIAIS — e-mail/RP ou senha errados (mesma mensagem para os dois, existindo a conta ou não)
    //   403 CONTA_INATIVA — a conta existe e está desativada
    // @identidade Pública. O token devolvido carrega o id e o tipo de quem entrou.
    // @back O `tipo` é a tabela em que o back autenticou ('conta' = Users,
    //   'aluno' = Alunos), nunca o que a tela mandou. O RP aceita espaço e
    //   minúscula ("rp 2025043"): o back normaliza antes de procurar.
    //   A tela apara as pontas da senha (de conta e de aluno) antes de
    //   enviar; o back faz o mesmo antes de comparar o hash.
    // @nota Senha colada costuma trazer um espaço ou uma quebra de linha no
    //   fim, e isso virava "senha incorreta". Aparar no login só é seguro
    //   porque nenhuma senha válida tem espaço nas pontas: ver a regra no
    //   POST /auth/cadastro e no POST /conta/rp/nova-senha.
    entrar: (credenciais: Credenciais) =>
      postPublico<RespostaLogin>('/auth/login', credenciais),

    // @rota POST /auth/cadastro
    // @corpo DadosCadastro
    //   { "nome": "Henrique Lima", "email": "prof@teclar.dev", "senha": "senha123" }
    // @resposta 200 RespostaCadastro — a sessão, como no login, mais a entrada de aluno
    //   { "token": "...", "usuario": { "id": "u-9", "nome": "Henrique Lima",
    //     "email": "prof@teclar.dev", "tipo": "conta" },
    //     "rp": "RP2026117", "senhaAluno": "Kx7#pq2M" }
    // @erros 400 DADOS_INVALIDOS — a senha começa ou termina com espaço
    //   409 EMAIL_EM_USO — o e-mail já tem conta
    // @identidade Pública.
    // @back Cria a linha em Users E a linha em Alunos (com Alunos.UserID
    //   apontando para a conta nova), gerando o RP e a senha de aluno.
    //   senhaAluno sai em texto puro SÓ nesta resposta; depois o back
    //   guarda apenas o hash.
    //   Recusa senha que comece ou termine com espaço (no meio pode), e
    //   grava a senha como veio, sem aparar. A senha de aluno gerada também
    //   nunca tem espaço nas pontas.
    // @nota Quem acabou de se cadastrar não passa pelo login de novo.
    //   A regra do espaço existe porque o login apara as pontas da senha:
    //   uma conta criada com "abc12345 " nunca mais entraria. A tela já
    //   barra antes de enviar, mas o back precisa barrar também.
    cadastrar: ({ nome, email, senha }: DadosCadastro) =>
      postPublico<RespostaCadastro>('/auth/cadastro', { nome, email, senha }),

    // @rota GET /auth/eu
    // @resposta 200 Usuario — o dono do token, na forma do login
    //   { "id": "u-2", "nome": "Henrique Lima", "email": "prof@teclar.dev", "tipo": "conta" }
    // @erros 401 TOKEN_INVALIDO
    // @identidade O token. Não recebe id: é sempre "quem sou eu".
    eu: () => get<Usuario>('/auth/eu'),

    // @rota POST /auth/logout
    // @resposta 204 (sem corpo)
    // @identidade O token, que deixa de valer. Marcada como pública: um 401
    //   aqui não pode derrubar a tela no meio da saída.
    // @nota Pode falhar em silêncio: quem apaga a sessão local é o
    //   sessao.sair(), que não depende desta resposta.
    sair: () => post<null>('/auth/logout', undefined, { publico: true }),
  },

  // @grupo Conta
  // A conta logada, fora de qualquer mundo. Token de aluno nestas rotas é
  // 403: são da conta (Users), não da entrada de aluno.
  conta: {
    // @rota GET /conta/rp
    // @resposta 200 RpDaConta
    //   { "rp": "RP2025043" }
    // @erros 403 TIPO_INVALIDO — token de aluno
    // @identidade O token. Sem parâmetro: é sempre o RP da própria conta.
    // @back O RP é a linha de Alunos ligada à conta por Alunos.UserID.
    //   Conta sem linha em Alunos: { "rp": null }.
    rp: () => get<RpDaConta>('/conta/rp'),

    // @rota POST /conta/rp/nova-senha
    // @resposta 200 NovaSenhaAluno — a senha nova, uma vez
    //   { "senhaAluno": "Q2w#e4Rt" }
    // @erros 403 TIPO_INVALIDO — token de aluno
    //   404 NAO_ENCONTRADO — a conta não tem RP
    // @identidade O token. Sem parâmetro: troca sempre a senha da própria conta.
    // @back Gera a senha, grava só o hash e invalida a antiga na mesma hora.
    //   Não existe rota de LEITURA da senha de aluno. A senha gerada nunca
    //   tem espaço nas pontas: o login apara antes de enviar.
    novaSenhaAluno: () => post<NovaSenhaAluno>('/conta/rp/nova-senha'),
  },

  // @grupo Solo
  // O mundo Solo é da CONTA (Users). Token de aluno em qualquer rota daqui
  // é 403 TIPO_INVALIDO. Um jogador tem UMA campanha, e ela sai do token:
  // nenhuma rota usada pelas telas recebe id de campanha.
  solo: {
    // @rota GET /solo/campanha
    // @resposta 200 Campanha | null — null quando o jogador ainda não começou
    //   { "campanhaId": "camp-1", "jogadorId": "u-1", "nivelAtual": 4, "xpTotal": 669 }
    // @erros 403 TIPO_INVALIDO — token de aluno
    // @identidade O token (JogadorID). Não recebe id.
    // @nota null é ESTADO, não falha: é a primeira vez dele no Solo, e o
    //   lobby mostra o convite de começar. 404 obrigaria a tela a tratar
    //   isso dentro de um catch.
    campanhaAtual: () => get<Campanha | null>('/solo/campanha'),

    // @rota POST /solo/campanha
    // @corpo Nenhum.
    // @resposta 200 Campanha — a nova (nível 1, 0 XP) ou a que já existia
    //   { "campanhaId": "camp-7", "jogadorId": "u-3", "nivelAtual": 1, "xpTotal": 0 }
    // @erros 403 TIPO_INVALIDO — token de aluno
    // @identidade O token (JogadorID).
    // @back Idempotente: quem já tem campanha recebe a que existe, e
    //   nenhuma segunda é criada (clique duplo, aba duplicada, F5).
    // @nota Sem corpo porque nenhuma das seis colunas de CampanhasSolo vem
    //   da tela: CampanhaID, NivelAtual, XPTotal, Data_Criacao e Ativo são
    //   do back, e JogadorID sai do token. Não há nome de personagem nem
    //   avatar para mandar.
    criarCampanha: () => post<Campanha>('/solo/campanha'),

    // @rota GET /solo/campanhas/:id
    // @resposta 200 Campanha
    //   { "campanhaId": "camp-1", "jogadorId": "u-1", "nivelAtual": 4, "xpTotal": 669 }
    // @erros 404 NAO_ENCONTRADO — não existe, ou é de outra conta (o mesmo 404)
    //   403 TIPO_INVALIDO — token de aluno
    // @identidade O token. Só o dono lê: campanha cujo JogadorID não é a
    //   conta do token responde 404, nunca 403.
    // @nota Nenhuma tela usa: as telas pedem a campanha do token em
    //   GET /solo/campanha, sem id.
    campanha: (id: string) => get<Campanha>(`/solo/campanhas/${id}`),

    // @rota DELETE /solo/campanhas/:id
    // @resposta 204 (sem corpo)
    // @erros 404 NAO_ENCONTRADO — não existe, ou é de outra conta (o mesmo 404)
    //   403 TIPO_INVALIDO — token de aluno
    // @identidade O token. Só o dono apaga: campanha cujo JogadorID não é a
    //   conta do token responde 404, nunca 403.
    // @nota Nenhuma tela usa.
    apagarCampanha: (id: string) => del(`/solo/campanhas/${id}`),

    // @rota GET /solo/missoes
    // @resposta 200 Missao[] — as 76 lições, na ordem do percurso, SEM o texto
    //   [{ "exerciseId": "solo-001", "ordem": 1, "nivel": 1,
    //      "titulo": "Lição 01 — Linha-guia", "dificuldade": "facil",
    //      "repeticoes": 10, "tempoLimiteSegundos": 472, "tamanhoCaracteres": 59 }]
    // @erros 404 NAO_ENCONTRADO — a conta ainda não tem campanha
    // @identidade O token (precisa ter campanha). Não recebe id.
    // @back Nenhuma lição vem bloqueada: ExerciciosSolo.NivelMinimo existe
    //   desde a v7, mas esta rota não o lê (ver @nao-usado no topo). Quem
    //   agrupa por nível é a tela.
    // @nota Aceita filtros em query string (montarQuery), mas nenhuma tela
    //   manda filtro hoje. O texto fica de fora: na lista seria ~30 KB que
    //   nenhum cartão mostra.
    missoes: (filtros?: Filtros) => get<Missao[]>(`/solo/missoes${montarQuery(filtros)}`),

    // @rota GET /solo/missoes/:id
    // @resposta 200 MissaoDetalhe — a lição com o texto
    //   { "exerciseId": "solo-001", "ordem": 1, "nivel": 1,
    //     "titulo": "Lição 01 — Linha-guia", "dificuldade": "facil",
    //     "repeticoes": 10, "tempoLimiteSegundos": 472, "tamanhoCaracteres": 59,
    //     "texto": "asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg" }
    // @erros 404 NAO_ENCONTRADO — lição inexistente
    // @identidade Qualquer token válido. As lições são conteúdo semeado,
    //   iguais para todos: não há recurso "de outra conta" aqui.
    missao: (id: string) => get<MissaoDetalhe>(`/solo/missoes/${id}`),

    // @rota POST /solo/sessoes
    // @corpo DadosSessaoTreino — o que o motor mediu, mais a lição
    //   { "exercicio_id": "solo-009", "wpm": 38, "precisao": 95, "acertos": 57,
    //     "erros": 3, "tempo_gasto_segundos": 96, "concluida": true }
    // @resposta 200 RespostaSessaoSolo — o id abre a tela de resultado
    //   { "id": "hs-11", "xpGanho": 74, "xpTotal": 743, "nivelAtual": 4,
    //     "subiuDeNivel": false, "recordePessoal": true }
    // @erros 403 TIPO_INVALIDO — token de aluno
    //   404 NAO_ENCONTRADO — sem campanha, ou lição inexistente
    // @identidade O token: a sessão vai para a campanha DO TOKEN. Não aceita
    //   campanha_id no corpo — com ele, dava para gravar XP na campanha de
    //   outro jogador.
    // @back XP ganho (concluída: XP_BASE_MISSAO + bônus proporcional à
    //   precisão; não concluída: 30% do base), o novo XPTotal, o nível
    //   (recalculado do XP), subiuDeNivel e recordePessoal (PPM maior que o
    //   melhor anterior NESTA lição). A tela não calcula XP nem nível.
    registrarSessao: (dados: DadosSessaoTreino) =>
      post<RespostaSessaoSolo>('/solo/sessoes', dados),

    // @rota GET /solo/historico
    // @resposta 200 Paginado<SessaoSolo> — as sessões da campanha
    //   { "total": 10, "pagina": 1, "itens": [
    //     { "id": "hs-10", "exerciseId": "solo-015", "wpm": 41, "precisao": 92,
    //       "tempoSegundos": 84, "acertos": 46, "erros": 4, "concluida": true,
    //       "xpGanho": 73, "data": "2026-10-02T21:10:00.000Z" } ] }
    // @erros 404 NAO_ENCONTRADO — a conta ainda não tem campanha
    // @identidade O token. Não recebe id: era /solo/campanhas/:id/historico,
    //   e um id de campanha na URL é um caminho para o histórico de outra pessoa.
    // @nota Aceita filtros em query string; as telas não mandam nenhum.
    historico: (filtros?: Filtros) =>
      get<Paginado<SessaoSolo>>(`/solo/historico${montarQuery(filtros)}`),

    // @rota GET /solo/indicadores
    // @resposta 200 IndicadoresSolo
    //   { "campanhaId": "camp-1", "nivelAtual": 4, "xpTotal": 669, "sessoesTotais": 10,
    //     "wpmMedio": 35, "precisaoMedia": 91, "melhorWpm": 41 }
    // @erros 404 NAO_ENCONTRADO — a conta ainda não tem campanha
    // @identidade O token. Não recebe id.
    // @back Médias só das sessões concluídas, inteiras; null sem nenhuma
    //   (nunca 0). melhorWpm considera todas as sessões.
    indicadores: () => get<IndicadoresSolo>('/solo/indicadores'),

    // @rota GET /solo/estatisticas
    // @resposta 200 EstatisticasSolo
    //   { "campanhaId": "camp-1", "licoesConcluidas": 5, "melhorWpm": 41, "melhorPrecisao": 96,
    //     "porLicao": [{ "exerciseId": "solo-015", "titulo": "Lição 15 — Vocabulário real",
    //       "nivel": 3, "tentativas": 2, "melhorWpm": 41, "melhorPrecisao": 92,
    //       "ultimaVez": "2026-10-02T21:10:00.000Z" }] }
    // @erros 404 NAO_ENCONTRADO — a conta ainda não tem campanha
    // @identidade O token. Não recebe id.
    // @back licoesConcluidas = lições DISTINTAS com sessão concluída; o
    //   agregado por lição (tentativas, melhores marcas, última vez) com o
    //   JOIN em ExerciciosSolo para título e nível. Lição nunca tentada não
    //   aparece.
    // @nota Nível e XP não vêm aqui (são de /solo/campanha). Sequência de
    //   dias e evolução a tela deriva das datas e dos PPM do histórico.
    estatisticas: () => get<EstatisticasSolo>('/solo/estatisticas'),
  },

  // @grupo Turmas (professor)
  // Mundo ESCOLA, lado do professor. A turma é da conta do token
  // (Turmas.ProfessorID): token de aluno é 403 TIPO_INVALIDO, e turma de
  // OUTRA conta responde 404 NAO_ENCONTRADO — o mesmo de turma que não
  // existe, para não confirmar a quem tenta ids que ela existe.
  turmas: {
    // @rota GET /turmas
    // @resposta 200 Turma[] — só as com ativa = true, array puro (lista curta)
    //   [{ "id": "turma-1", "professorId": "u-2", "nome": "9º Ano A — Manhã",
    //      "totalAlunos": 4, "totalExercicios": 3, "convitesPendentes": 0,
    //      "periodo": "2026 · 1º semestre", "capaSemente": 7001, "ativa": true,
    //      "dataCriacao": "2026-02-01" }]
    // @erros 403 TIPO_INVALIDO — token de aluno
    // @identidade O token: WHERE ProfessorID = conta do token.
    // @back totalAlunos (COUNT em ClassMembers com Status = 'ativo'),
    //   totalExercicios (COUNT em AtribuicoesProf) e convitesPendentes
    //   (COUNT com Status = 'convidado'). O filtro é Turmas.Ativa. O texto de
    //   `periodo` vem pronto. A tela não soma nada por turma.
    listar: (filtros?: Filtros) => get<Turma[]>(`/turmas${montarQuery(filtros)}`),

    // @rota GET /turmas?ativa=false
    // @resposta 200 Turma[] — só as arquivadas (Turmas.Ativa = false), mesma forma de item de GET /turmas
    //   [{ "id": "turma-8", "professorId": "u-2", "nome": "8º Ano B — 2025",
    //      "totalAlunos": 0, "totalExercicios": 0, "convitesPendentes": 0,
    //      "periodo": "2025 · 2º semestre", "capaSemente": 7823, "ativa": false,
    //      "dataCriacao": "2025-08-04" }]
    // @erros 403 TIPO_INVALIDO — token de aluno
    // @identidade O token, como em GET /turmas.
    // @nota É a mesma rota de listar(); só o filtro muda. Serve ao "Mostrar
    //   arquivadas" da tela de turmas.
    listarArquivadas: () => get<Turma[]>('/turmas?ativa=false'),

    // @rota POST /turmas
    // @corpo { nome } — 3 a 100 caracteres
    //   { "nome": "7º Ano C — Tarde" }
    // @resposta 200 Turma — já na forma de um item de GET /turmas
    //   { "id": "turma-9", "professorId": "u-2", "nome": "7º Ano C — Tarde",
    //     "totalAlunos": 0, "totalExercicios": 0, "convitesPendentes": 0,
    //     "ativa": true, "dataCriacao": "2026-10-03" }
    // @erros 400 DADOS_INVALIDOS — nome fora de 3 a 100 caracteres
    //   409 — a conta já tem uma turma com esse nome
    //   403 TIPO_INVALIDO — token de aluno
    // @identidade O token vira o ProfessorID. Não aceita professorId no corpo.
    // @back Nasce com Ativa = true. O período, se houver, é o back que monta.
    // @nota ClassesProf.Ano e Semestre existem desde a v7, mas esta rota não
    //   os recebe (ver @nao-usado no topo): a turma nasce com os dois NULL e
    //   sem `periodo`. O mock ainda não valida o nome no POST (só no PATCH); a tela valida antes.
    criar: (nome: string) => post<Turma>('/turmas', { nome }),

    // @rota GET /turmas/:id
    // @resposta 200 TurmaDetalhe — a turma mais o PPM médio
    //   { "id": "turma-1", "professorId": "u-2", "nome": "9º Ano A — Manhã",
    //     "totalAlunos": 4, "totalExercicios": 3, "periodo": "2026 · 1º semestre",
    //     "capaSemente": 7001, "ativa": true, "dataCriacao": "2026-02-01", "ppmMedio": 33.3 }
    // @erros 404 NAO_ENCONTRADO — não existe ou é de outra conta
    //   403 TIPO_INVALIDO — token de aluno
    // @identidade O token: a turma tem de ser da conta.
    // @back ppmMedio com 1 casa decimal, só dos alunos que treinaram (quem
    //   nunca treinou não entra); null se ninguém treinou.
    obter: (id: string) => get<TurmaDetalhe>(`/turmas/${id}`),

    // @rota PATCH /turmas/:id
    // @corpo { nome } — renomear; só o campo enviado muda
    //   { "nome": "9º Ano A — Manhã (2026)" }
    // @resposta 200 Turma — a turma como ficou
    //   { "id": "turma-1", "professorId": "u-2", "nome": "9º Ano A — Manhã (2026)",
    //     "totalAlunos": 4, "totalExercicios": 3, "periodo": "2026 · 1º semestre",
    //     "capaSemente": 7001, "ativa": true, "dataCriacao": "2026-02-01" }
    // @erros 400 DADOS_INVALIDOS — nome fora de 3 a 100 caracteres
    //   409 — a conta já tem uma turma com esse nome
    //   404 NAO_ENCONTRADO — não existe ou é de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @nota PATCH porque só o campo enviado muda. A tela mantém as
    //   contagens que já tinha: o PATCH não as recalcula.
    renomear: (id: string, nome: string) => patch<Turma>(`/turmas/${id}`, { nome }),

    // @rota PATCH /turmas/:id
    // @corpo { capaSemente } — inteiro; troca o desenho da capa
    //   { "capaSemente": 418207 }
    // @resposta 200 Turma — a turma como ficou (mesma forma do renomear)
    //   { "id": "turma-1", "nome": "9º Ano A — Manhã", "capaSemente": 418207, "ativa": true }
    // @erros 400 DADOS_INVALIDOS — capaSemente não é inteiro
    //   404 NAO_ENCONTRADO — não existe ou é de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Grava em Turmas.CapaSemente. Sem semente gravada, a tela deriva
    //   uma do id — por isso a coluna aceita NULL.
    trocarCapa: (id: string, semente: number) =>
      patch<Turma>(`/turmas/${id}`, { capaSemente: semente }),

    // @rota PATCH /turmas/:id
    // @corpo { ativa: false } — arquivar
    //   { "ativa": false }
    // @resposta 200 Turma — a turma como ficou
    //   { "id": "turma-3", "nome": "Projeto de Extensão 2025", "ativa": false }
    // @erros 400 DADOS_INVALIDOS — ativa não é booleano
    //   404 NAO_ENCONTRADO — não existe ou é de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Grava Turmas.Ativa = false. A turma some de GET /turmas e o
    //   histórico de sessões fica intacto.
    // @nota Arquivar, e NÃO excluir: SessionsProf aponta para a turma com
    //   ON DELETE CASCADE, e apagar a turma apagaria o histórico de treino
    //   de todos os alunos dela. Por isso não existe DELETE /turmas/:id.
    arquivar: (id: string) => patch<Turma>(`/turmas/${id}`, { ativa: false }),

    // @rota PATCH /turmas/:id
    // @corpo { ativa: true } — desarquivar
    //   { "ativa": true }
    // @resposta 200 Turma — a turma como ficou
    //   { "id": "turma-8", "nome": "8º Ano B — 2025", "ativa": true }
    // @erros 400 DADOS_INVALIDOS — ativa não é booleano
    //   404 NAO_ENCONTRADO — não existe ou é de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Grava Turmas.Ativa = true: a turma volta a GET /turmas como estava.
    desarquivar: (id: string) => patch<Turma>(`/turmas/${id}`, { ativa: true }),

    // @rota GET /turmas/:id/atribuicoes
    // @resposta 200 AtribuicaoProfessor[] — o que a turma recebeu, na ordem de atribuição
    //   [{ "exercicioId": "ex-prof-1", "titulo": "Acentuação em foco", "dificuldade": "medio",
    //      "atribuidoEm": "2026-02-03", "concluidoPor": 3, "totalAlunos": 4 }]
    // @erros 404 NAO_ENCONTRADO — não existe ou é de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back concluidoPor = alunos ATIVOS da turma com sessão concluída no
    //   exercício; totalAlunos = alunos ativos. A tela não conta.
    // @nota A visão do ALUNO sobre a mesma tabela é GET /aluno/salas/:id, e
    //   não traz contagem da turma: seria entregar o desempenho dos colegas.
    atribuicoes: (turmaId: string) =>
      get<AtribuicaoProfessor[]>(`/turmas/${turmaId}/atribuicoes`),

    // @rota POST /turmas/:id/atribuicoes
    // @corpo { exercicioIds } — vários de uma vez
    //   { "exercicioIds": ["ex-prof-3", "ex-prof-4"] }
    // @resposta 200 Atribuicao[] — a lista crua de atribuições da turma, como ficou
    //   [{ "exerciseId": "ex-prof-1", "atribuidoEm": "2026-02-03", "prazo": null },
    //    { "exerciseId": "ex-prof-3", "atribuidoEm": "2026-10-03", "prazo": null }]
    // @erros 404 NAO_ENCONTRADO — turma ou algum exercício não é da conta
    // @identidade O token: a turma E cada exercício têm de ser da conta.
    // @back Confere todos os ids ANTES de gravar qualquer um (metade
    //   atribuída é pior que nada). Repetir um já atribuído não duplica: a
    //   chave de AtribuicoesProf é o par (ClassID, ExerciseID).
    // @nota A resposta não traz título nem concluidoPor: a tela relê
    //   GET /turmas/:id/atribuicoes depois.
    atribuir: (turmaId: string, ids: string[]) =>
      post<Atribuicao[]>(`/turmas/${turmaId}/atribuicoes`, { exercicioIds: ids }),

    // @rota DELETE /turmas/:id/atribuicoes/:exercicioId
    // @resposta 204 (sem corpo)
    // @erros 404 NAO_ENCONTRADO — turma de outra conta, ou o exercício não está atribuído a ela
    // @identidade O token: a turma tem de ser da conta.
    // @nota A atribuição não tem id próprio: a remoção é pelo PAR turma +
    //   exercício, a chave primária de AtribuicoesProf.
    removerAtribuicao: (turmaId: string, exercicioId: string) =>
      del(`/turmas/${turmaId}/atribuicoes/${exercicioId}`),
  },

  // @grupo Alunos e convites (professor)
  // O professor administrando o quadro de UMA turma dele. A turma sai do
  // token (tem de ser da conta: senão 404); o aluno-alvo vai na URL pelo
  // RP, porque é sobre ELE que a ação é — não é a identidade de quem pede.
  // RP na URL aqui é decisão, não descuido: a identidade continua saindo
  // do token, e o aluno só é alcançável dentro de uma turma da conta.
  alunos: {
    // @rota GET /turmas/:id/alunos
    // @resposta 200 LinhaDaTurma[] — ativos primeiro, depois os convidados, cada um com o estado
    //   [{ "estado": "ativo", "id": "RP2025043", "nome": "Ana Pires", "entrouEm": "2026-02-01",
    //      "totalSessoes": 12, "wpmMedio": 39, "precisaoMedia": 91,
    //      "ultimaAtividade": "2026-10-03T12:00:00.000Z" },
    //    { "estado": "convidado", "id": "RP2025047", "nome": null,
    //      "convidadoEm": "2026-10-01T12:00:00.000Z" }]
    // @erros 404 NAO_ENCONTRADO — turma inexistente ou de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Junta ClassMembers com Status = 'ativo' e 'convidado' (o
    //   'recusado' não aparece). O nome é o da conta dona do RP
    //   (Alunos.UserID -> Users.Nome). Os agregados (totalSessoes, médias,
    //   última atividade) são do aluno no sistema todo e vêm prontos; quem
    //   nunca treinou vem com null, nunca 0. Convidado não traz número.
    daTurma: (turmaId: string) => get<LinhaDaTurma[]>(`/turmas/${turmaId}/alunos`),

    // @rota DELETE /turmas/:id/alunos/:rp
    // @resposta 204 (sem corpo)
    // @erros 404 NAO_ENCONTRADO — turma de outra conta, ou o RP não está ativo nela
    // @identidade O token: a turma tem de ser da conta (senão 404). O RP na
    //   URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a
    //   identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.
    // @back Tira o aluno ativo da turma, e o histórico de sessões dele nesta
    //   turma vai junto. Para quem só foi convidado, é DELETE .../convites/:rp.
    remover: (turmaId: string, alunoId: string) =>
      del(`/turmas/${turmaId}/alunos/${alunoId}`),

    // @rota POST /turmas/:id/convites
    // @corpo { rp } — de uma conta que já existe
    //   { "rp": "RP2025001" }
    // @resposta 200 ConvidadoDaTurma
    //   { "estado": "convidado", "id": "RP2025001", "nome": "Leonardo",
    //     "convidadoEm": "2026-10-03T14:02:00.000Z" }
    // @erros 400 RP_INVALIDO — fora do formato RP + 7 dígitos
    //   400 CONVITE_PROPRIO — o RP é o da própria conta do token
    //   404 RP_NAO_ENCONTRADO — nenhuma conta com esse RP
    //   409 JA_NA_TURMA — o RP já está ativo na turma
    //   409 JA_CONVIDADO — já foi convidado e ainda não respondeu
    //   404 NAO_ENCONTRADO — turma inexistente ou de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Normaliza o RP (sem espaço, maiúsculo) e grava ClassMembers com
    //   Status = 'convidado' e Data_Convite = agora. Ninguém entra na turma
    //   sem aceitar: o professor não cria aluno nem vê senha.
    convidar: (turmaId: string, rp: string) =>
      post<ConvidadoDaTurma>(`/turmas/${turmaId}/convites`, { rp }),

    // @rota POST /turmas/:id/convites/importar
    // @corpo { rps } — o lote inteiro numa requisição
    //   { "rps": ["RP2025001", "RP2025002", "RP2025043", "RP9999999"] }
    // @resposta 200 ResultadoConvites — cada RP cai numa das três listas
    //   { "convidados": [{ "estado": "convidado", "id": "RP2025001", "nome": "Leonardo",
    //                      "convidadoEm": "2026-10-03T14:02:00.000Z" }],
    //     "jaEstavam": [{ "rp": "RP2025043", "estado": "ativo" }],
    //     "falhas": [{ "rp": "RP9999999", "motivo": "Nenhuma conta com esse RP." }] }
    // @erros 404 NAO_ENCONTRADO — turma inexistente ou de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Importação parcial é permitida. RP repetido na lista vira falha
    //   ("RP repetido na lista"); os outros motivos são os do convite um por um.
    convidarVarios: (turmaId: string, rps: string[]) =>
      post<ResultadoConvites>(`/turmas/${turmaId}/convites/importar`, { rps }),

    // @rota DELETE /turmas/:id/convites/:rp
    // @resposta 204 (sem corpo)
    // @erros 404 NAO_ENCONTRADO — turma de outra conta, ou não há convite pendente para esse RP
    // @identidade O token: a turma tem de ser da conta (senão 404). O RP na
    //   URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a
    //   identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.
    // @back Apaga o convite ainda não respondido; ele some da lista do aluno.
    cancelarConvite: (turmaId: string, rp: string) =>
      del(`/turmas/${turmaId}/convites/${rp}`),

    // @rota GET /turmas/:id/alunos/:rp/desempenho
    // @resposta 200 DesempenhoAluno — os agregados e as sessões do aluno NESTA turma
    //   { "alunoId": "RP2025043", "totalSessoes": 2, "wpmMedio": 38, "precisaoMedia": 94,
    //     "sessoes": [{ "id": "ses-1", "exerciseId": "ex-prof-1", "alunoId": "RP2025043",
    //       "wpm": 40, "precisao": 95, "tempoSegundos": 58, "acertos": 76, "erros": 4,
    //       "concluida": true, "data": "2026-02-18T14:10:00.000Z" }] }
    // @erros 404 NAO_ENCONTRADO — turma de outra conta, ou o RP não está ativo nela
    // @identidade O token: a turma tem de ser da conta (senão 404). O RP na
    //   URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a
    //   identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.
    // @back Só as sessões DESTA turma (e os agregados sobre elas): as das
    //   outras turmas do aluno são de outros professores, e este não pode
    //   vê-las.
    // @nota Nenhuma tela usa (o modal de relatórios usa
    //   GET /turmas/:id/alunos/:rp/sessoes).
    desempenho: (turmaId: string, alunoId: string) =>
      get<DesempenhoAluno>(`/turmas/${turmaId}/alunos/${alunoId}/desempenho`),
  },

  // @grupo Relatórios (professor)
  // pages/professor/relatorios.html e a aba Relatório da turma. Tudo sai de
  // SessionsProf com JOIN e chega PRONTO: nenhuma média é calculada na
  // tela, e toda média pode vir null — que vira "—", nunca 0. A turma tem
  // de ser da conta do token (senão 404); token de aluno é 403.
  relatorios: {
    // @rota GET /turmas/:id/relatorio
    // @resposta 200 RelatorioTurma — as quatro métricas do topo
    //   { "turmaId": "turma-1", "totalAlunos": 4, "alunosComSessao": 3, "alunosAtivos": 2,
    //     "wpmMedio": 33, "precisaoMedia": 87, "exerciciosConcluidos": 5 }
    // @erros 404 NAO_ENCONTRADO — turma inexistente ou de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back alunosAtivos = alunos que treinaram nos últimos 7 dias (a janela
    //   é do back); médias inteiras das sessões concluídas da turma, null
    //   sem amostra; exerciciosConcluidos = pares (aluno, exercício)
    //   concluídos (COUNT: zero é zero).
    turma: (turmaId: string) => get<RelatorioTurma>(`/turmas/${turmaId}/relatorio`),

    // @rota GET /turmas/:id/relatorio/alunos
    // @resposta 200 RelatorioAluno[] — uma linha por aluno ATIVO, inclusive quem nunca treinou
    //   [{ "id": "RP2025049", "nome": "Marina Duarte Alves", "entrouEm": "2026-02-05",
    //      "totalSessoes": 2, "wpmMedio": 32, "precisaoMedia": 78,
    //      "ultimaAtividade": "2026-10-01T12:00:00.000Z",
    //      "exerciciosConcluidos": 2, "exerciciosAtribuidos": 3 }]
    // @erros 404 NAO_ENCONTRADO — turma inexistente ou de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Agregados DESTA turma (só as sessões dela), diferentes dos de
    //   GET /turmas/:id/alunos, que são do sistema todo. Quem nunca treinou:
    //   totalSessoes 0 e médias null. exerciciosConcluidos = exercícios
    //   DISTINTOS concluídos.
    porAluno: (turmaId: string) => get<RelatorioAluno[]>(`/turmas/${turmaId}/relatorio/alunos`),

    // @rota GET /turmas/:id/relatorio/exercicios
    // @resposta 200 RelatorioExercicio[] — uma linha por exercício ATRIBUÍDO; nada atribuído = []
    //   [{ "exercicioId": "ex-prof-1", "titulo": "Acentuação em foco", "dificuldade": "medio",
    //      "atribuidoEm": "2026-02-03", "concluidoPor": 2, "totalAlunos": 4,
    //      "wpmMedio": 37, "precisaoMedia": 87, "estouraramTempo": 1 }]
    // @erros 404 NAO_ENCONTRADO — turma inexistente ou de outra conta
    // @identidade O token: a turma tem de ser da conta.
    // @back Médias da turma no exercício (null enquanto ninguém concluiu);
    //   estouraramTempo = sessões não concluídas, e 0 sempre que o
    //   exercício não tem tempo limite.
    porExercicio: (turmaId: string) =>
      get<RelatorioExercicio[]>(`/turmas/${turmaId}/relatorio/exercicios`),

    // @rota GET /turmas/:id/alunos/:rp/sessoes
    // @resposta 200 Paginado<SessaoDoAluno> — as sessões do aluno NESTA turma, da mais recente para a mais antiga
    //   { "total": 2, "pagina": 1, "itens": [
    //     { "id": "ses-2", "exerciseId": "ex-prof-2", "alunoId": "RP2025043", "wpm": 36,
    //       "precisao": 92, "tempoSegundos": 61, "acertos": 80, "erros": 7, "concluida": true,
    //       "data": "2026-02-19T09:30:00.000Z", "tituloExercicio": "Números do cotidiano" } ] }
    // @erros 404 NAO_ENCONTRADO — turma de outra conta, ou o RP não está ativo nela (não lista vazia)
    // @identidade O token: a turma tem de ser da conta (senão 404). O RP na
    //   URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a
    //   identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.
    // @back A ordem (mais recente primeiro) é parte do contrato. O título
    //   vem do JOIN com ExerciciosProf; exercício excluído: null.
    sessoesDoAluno: (turmaId: string, matricula: string) =>
      get<Paginado<SessaoDoAluno>>(`/turmas/${turmaId}/alunos/${matricula}/sessoes`),
  },

  // @grupo Biblioteca de exercícios (professor)
  // ExerciciosProf. A listagem devolve só os do professor do token; busca
  // e filtro de dificuldade são no cliente. Exercício de outra conta
  // responde 404, como o que não existe.
  exercicios: {
    // @rota GET /exercicios
    // @resposta 200 Paginado<Exercicio> — paginado no contrato; quem lê passa por desembrulhar()
    //   { "total": 4, "pagina": 1, "itens": [
    //     { "id": "ex-prof-1", "professorId": "u-2", "titulo": "Acentuação em foco",
    //       "texto": "...", "dificuldade": "medio", "tempoLimiteSegundos": 120, "atribuidoA": 2 } ] }
    // @erros 403 TIPO_INVALIDO — token de aluno
    // @identidade O token: WHERE ProfessorID = conta do token.
    // @back atribuidoA = em quantas turmas está atribuído (COUNT em
    //   AtribuicoesProf). A tela não conta.
    listar: () => get<Paginado<Exercicio>>('/exercicios'),

    // @rota GET /exercicios/:id?turma=:turmaId
    // @resposta 200 ExercicioDetalhe — mesma forma de um item da listagem
    //   { "id": "ex-prof-1", "professorId": "u-2", "titulo": "Acentuação em foco",
    //     "texto": "...", "dificuldade": "medio", "tempoLimiteSegundos": 120, "atribuidoA": 2 }
    // @erros 404 NAO_ENCONTRADO — não existe, é de outra conta, ou (aluno) não está atribuído à turma dele
    // @identidade Conta: o exercício tem de ser dela; ?turma= é ignorado.
    //   Aluno: ?turma= é a turma em que ele está treinando, e o exercício
    //   tem de estar atribuído a ela E ele tem de estar ativo nela.
    // @nota A mesma regra vale no POST /sessoes, para o aluno descobrir na
    //   ABERTURA do treino, e não depois de digitar o texto inteiro.
    obter: (id: string, turmaId?: string | null) =>
      get<ExercicioDetalhe>(`/exercicios/${id}${montarQuery({ turma: turmaId })}`),

    // @rota POST /exercicios
    // @corpo DadosExercicio — o formulário inteiro
    //   { "titulo": "Pontuação e ritmo", "texto": "Vírgula, ponto; dois-pontos: ...",
    //     "dificuldade": "facil", "tempoLimiteSegundos": 0 }
    // @resposta 200 Exercicio
    //   { "id": "ex-prof-8", "professorId": "u-2", "titulo": "Pontuação e ritmo",
    //     "texto": "Vírgula, ponto; dois-pontos: ...", "dificuldade": "facil",
    //     "tempoLimiteSegundos": 0, "atribuidoA": 0 }
    // @erros 403 TIPO_INVALIDO — token de aluno
    // @identidade O token vira o ProfessorID.
    // @nota tempoLimiteSegundos 0 = sem limite. A contagem de caracteres
    //   não tem coluna: a tela conta do texto.
    criar: (dados: DadosExercicio) => post<Exercicio>('/exercicios', dados),

    // @rota PATCH /exercicios/:id
    // @corpo DadosExercicio — o formulário inteiro
    //   { "titulo": "Pontuação e ritmo", "texto": "...", "dificuldade": "medio",
    //     "tempoLimiteSegundos": 90 }
    // @resposta 200 Exercicio — como ficou
    //   { "id": "ex-prof-2", "professorId": "u-2", "titulo": "Pontuação e ritmo",
    //     "texto": "...", "dificuldade": "medio", "tempoLimiteSegundos": 90, "atribuidoA": 2 }
    // @erros 404 NAO_ENCONTRADO — não existe ou é de outra conta
    // @identidade O token: o exercício tem de ser da conta.
    atualizar: (id: string, dados: DadosExercicio) => patch<Exercicio>(`/exercicios/${id}`, dados),

    // @rota DELETE /exercicios/:id
    // @resposta 204 (sem corpo)
    // @erros 404 NAO_ENCONTRADO — não existe ou é de outra conta
    // @identidade O token: o exercício tem de ser da conta.
    // @back DELETE de verdade: SessionsProf e AtribuicoesProf têm ON DELETE
    //   CASCADE, então ele sai de todas as turmas e leva junto as sessões
    //   dos alunos nele. A tela avisa antes de confirmar.
    excluir: (id: string) => del(`/exercicios/${id}`),
  },

  // @grupo Sessões
  // Gravar uma sessão do mundo Escola e reler uma sessão (Escola ou Solo)
  // na tela de resultado. A lista e o resumo das sessões do aluno são do
  // grupo "Aluno", em /aluno/.
  sessoes: {
    // @rota POST /sessoes
    // @corpo DadosSessaoTreino — o que o motor mediu, mais o exercício e a turma
    //   { "exercicio_id": "ex-prof-7", "turma_id": "turma-1", "wpm": 42, "precisao": 94,
    //     "acertos": 141, "erros": 9, "tempo_gasto_segundos": 88, "concluida": true }
    // @resposta 200 RespostaSessaoEscola — a sessão gravada mais o recorde
    //   { "id": "ses-31", "exerciseId": "ex-prof-7", "alunoId": "RP2025043",
    //     "turmaId": "turma-1", "wpm": 42, "precisao": 94, "tempoSegundos": 88,
    //     "acertos": 141, "erros": 9, "concluida": true,
    //     "data": "2026-10-03T14:20:00.000Z", "recordePessoal": true }
    // @erros 403 TIPO_INVALIDO — token de conta (o Solo grava em /solo/sessoes; a prévia do professor não grava)
    //   404 NAO_ENCONTRADO — exercício não atribuído à turma, ou o aluno não está ativo nela
    // @identidade O token: o AlunoID sai dele, nunca do corpo.
    // @back recordePessoal (PPM maior que o melhor anterior dele no
    //   exercício) e os agregados do aluno, que passam a contar esta sessão.
    //   PPM, precisão, acertos e erros vêm do motor da tela e são gravados
    //   como chegaram.
    registrar: (dados: DadosSessaoTreino) => post<RespostaSessaoEscola>('/sessoes', dados),

    // @rota GET /sessoes/:id
    // @resposta 200 Sessao | SessaoSolo — a sessão gravada, com acertos e tempo
    //   Escola: { "id": "ses-17", "exerciseId": "ex-prof-3", "alunoId": "RP2025043",
    //     "turmaId": "turma-2", "wpm": 49, "precisao": 96, "tempoSegundos": 126,
    //     "acertos": 144, "erros": 6, "concluida": true, "data": "2026-10-03T12:00:00.000Z" }
    //   Solo: { "id": "hs-10", "exerciseId": "solo-015", "wpm": 41, "precisao": 92,
    //     "tempoSegundos": 84, "acertos": 46, "erros": 4, "concluida": true,
    //     "xpGanho": 73, "data": "2026-10-02T21:10:00.000Z" }
    // @erros 404 NAO_ENCONTRADO — não existe, ou é de outra pessoa (o mesmo 404)
    // @identidade O token. Só o DONO lê: token de aluno lê só as sessões
    //   Escola dele (SessionsProf.AlunoID); token de conta lê só as sessões
    //   Solo da campanha dele (SessionsSolo da CampanhaID do token). Sessão
    //   de outra pessoa responde 404, nunca 403. É a rota do F5 da tela de
    //   resultado: sem esta regra, trocar o ?sessao= da URL mostraria o
    //   treino de outra pessoa.
    // @back Procura em SessionsProf e depois em SessionsSolo.
    // @nota É o que a tela de resultado lê num F5. Os acertos voltam aqui
    //   para ela mostrar o mesmo número de antes, sem cálculo nenhum.
    obter: (id: string) => get<Sessao | SessaoSolo>(`/sessoes/${id}`),
  },

  // @grupo Aluno
  // O PRÓPRIO aluno logado: as telas de pages/aluno/. Não confundir com o
  // grupo "Alunos e convites", que é o PROFESSOR administrando a turma dele.
  //
  // Regras que o back cumpre em TODAS as rotas daqui:
  //   · O aluno sai do TOKEN (Alunos.ID). Nenhuma rota recebe RP ou id de
  //     aluno na URL: não existe caminho — nem por URL editada à mão — para
  //     um aluno pedir o histórico, a sala ou o relatório de outro.
  //   · Token de conta é 403 TIPO_INVALIDO.
  //   · Turma da qual ele não participa responde 404, e não 403: o 403
  //     diria "essa turma existe, só não é sua".
  //   · Aceitar o convite grava ClassMembers.Status = 'ativo' e preenche
  //     Data_Matricula com a data do aceite (o significado novo da v6:
  //     antes era a data em que o professor matriculava); recusar grava
  //     Status = 'recusado' (a linha fica, para o professor ver que o
  //     convite foi respondido).
  //
  // `escola.aluno`, e não só `aluno`: é o aluno do mundo Escola. O Solo é
  // da conta, e mora em `solo`.
  escola: {
    aluno: {
      // @rota GET /aluno/historico
      // @resposta 200 Paginado<SessaoDoHistorico> — todas as sessões dele, da mais recente para a mais antiga
      //   { "total": 12, "pagina": 1, "itens": [
      //     { "id": "ses-17", "exerciseId": "ex-prof-3", "alunoId": "RP2025043",
      //       "turmaId": "turma-2", "wpm": 49, "precisao": 96, "tempoSegundos": 126,
      //       "acertos": 144, "erros": 6, "concluida": true,
      //       "data": "2026-10-03T12:00:00.000Z",
      //       "tituloExercicio": "Funções em JavaScript", "nomeTurma": "Reforço de digitação" } ] }
      // @erros 403 TIPO_INVALIDO — token de conta
      // @identidade O token. Não recebe id.
      // @back O JOIN com o título do exercício e o nome da turma; a ordem
      //   é parte do contrato. Sem filtro por exercício: a tela filtra a
      //   própria lista.
      historico: () => get<Paginado<SessaoDoHistorico>>('/aluno/historico'),

      // @rota GET /aluno/resumo
      // @resposta 200 ResumoDoAluno — os números do topo do histórico
      //   { "sessoesTotais": 12, "sessoesConcluidas": 11, "wpmMedio": 39, "precisaoMedia": 91,
      //     "melhorWpm": 49, "melhorPrecisao": 96, "diasSeguidos": 3 }
      // @erros 403 TIPO_INVALIDO — token de conta
      // @identidade O token. Não recebe id.
      // @back Médias só das concluídas (null sem nenhuma); melhores marcas de
      //   todas as sessões; diasSeguidos terminando hoje ou ontem (senão 0).
      //   Nenhuma média de turma: o aluno não recebe número de colega.
      resumo: () => get<ResumoDoAluno>('/aluno/resumo'),

      // @rota GET /aluno/salas
      // @resposta 200 SalaDoAluno[] — as turmas em que ele está ATIVO, com o progresso dele
      //   [{ "id": "turma-1", "nome": "9º Ano A — Manhã", "professor": "Henrique Lima",
      //      "capaSemente": 7001, "totalAlunos": 4, "exerciciosFeitos": 2, "exerciciosTotal": 3 }]
      // @erros 403 TIPO_INVALIDO — token de conta
      // @identidade O token. Não recebe id.
      // @back Só turmas com ClassMembers.Status = 'ativo' para ele e Turmas.Ativa = true.
      //   exerciciosFeitos = atribuídos com sessão dele (concluída ou tempo
      //   esgotado); totalAlunos = alunos ativos; professor = nome da conta dona.
      salas: () => get<SalaDoAluno[]>('/aluno/salas'),

      // @rota GET /aluno/salas/:turmaId
      // @resposta 200 SalaDetalhe — a sala e os exercícios dela, com o estado de cada um PARA ELE
      //   { "id": "turma-1", "nome": "9º Ano A — Manhã", "professor": "Henrique Lima",
      //     "capaSemente": 7001, "totalAlunos": 4, "exerciciosFeitos": 2, "exerciciosTotal": 3,
      //     "lista": [{ "id": "ex-prof-1", "titulo": "Acentuação em foco", "dificuldade": "medio",
      //       "caracteres": 247, "tempoLimiteSegundos": 120, "atribuidoEm": "2026-02-03",
      //       "prazo": null, "estado": "feito", "melhorWpm": 40, "melhorPrecisao": 95,
      //       "ultimaSessao": "2026-02-18T14:10:00.000Z" }] }
      // @erros 404 NAO_ENCONTRADO — a sala não existe ou ele não está nela
      //   403 TIPO_INVALIDO — token de conta
      // @identidade O token. O :turmaId é da SALA, nunca de aluno.
      // @back O estado de cada exercício para ele (nao_feito, feito,
      //   tempo_esgotado), a melhor marca dele e a contagem de caracteres
      //   (o texto não vem). Na ordem em que o professor atribuiu. Nenhum
      //   número de colega.
      sala: (id: string) => get<SalaDetalhe>(`/aluno/salas/${encodeURIComponent(id)}`),

      // @rota GET /aluno/convites
      // @resposta 200 ConviteDoAluno[] — os que esperam resposta dele, o mais recente primeiro
      //   [{ "turmaId": "turma-4", "nome": "7º Ano C — Tarde", "professor": "Henrique Lima",
      //      "totalAlunos": 2, "totalExercicios": 0, "convidadoEm": "2026-10-01T12:00:00.000Z" }]
      // @erros 403 TIPO_INVALIDO — token de conta
      // @identidade O token. Não recebe id.
      // @back ClassMembers com Status = 'convidado' para o RP dele, só de
      //   turmas ativas; totalAlunos conta só os ativos.
      convites: () => get<ConviteDoAluno[]>('/aluno/convites'),

      // @rota POST /aluno/convites/:turmaId/aceitar
      // @corpo Nenhum.
      // @resposta 200 SalaDoAluno — a sala, pronta para entrar na grade
      //   { "id": "turma-4", "nome": "7º Ano C — Tarde", "professor": "Henrique Lima",
      //     "capaSemente": 7412, "totalAlunos": 3, "exerciciosFeitos": 0, "exerciciosTotal": 0 }
      // @erros 404 NAO_ENCONTRADO — não há convite pendente dele para a turma (cancelado, já respondido, nunca existiu)
      //   403 TIPO_INVALIDO — token de conta
      // @identidade O token: só vale o convite que é DELE.
      // @back Grava ClassMembers.Status = 'ativo' e preenche
      //   ClassMembers.Data_Matricula com a data de agora: na v6 ela é a data
      //   em que o ALUNO aceitou, e era NULL até aqui.
      aceitarConvite: (turmaId: string) =>
        post<SalaDoAluno>(`/aluno/convites/${encodeURIComponent(turmaId)}/aceitar`),

      // @rota POST /aluno/convites/:turmaId/recusar
      // @corpo Nenhum.
      // @resposta 204 (sem corpo)
      // @erros 404 NAO_ENCONTRADO — não há convite pendente dele para a turma
      //   403 TIPO_INVALIDO — token de conta
      // @identidade O token: só vale o convite que é DELE.
      // @back Grava ClassMembers.Status = 'recusado'. Não tem volta pelo lado
      //   dele: só o professor pode mandar outro convite.
      recusarConvite: (turmaId: string) =>
        post<null>(`/aluno/convites/${encodeURIComponent(turmaId)}/recusar`),

      // @rota GET /turmas/:turmaId/meu-desempenho
      // @resposta 200 DesempenhoNaTurma — o relatório individual dele NA sala
      //   { "sessoesConcluidas": 9, "licoes": 2, "diasSeguidos": 3,
      //     "minhaMedia": { "velocidade": 40, "precisao": 90 },
      //     "mediaSala":  { "velocidade": 43, "precisao": 92 } }
      //   Abaixo de 3 sessões concluídas: { "sessoesConcluidas": 2, "licoes": 2, "diasSeguidos": 0,
      //     "minhaMedia": null, "mediaSala": null }
      // @erros 404 NAO_ENCONTRADO — a turma não existe ou ele não está nela
      //   403 TIPO_INVALIDO — token de conta
      // @identidade O token. O :turmaId é da turma, nunca de aluno.
      // @back Tudo sobre as sessões DESTA turma: sessoesConcluidas; licoes
      //   (exercícios distintos concluídos); diasSeguidos; minhaMedia (PPM e
      //   precisão médios dele, inteiros) e mediaSala (das sessões concluídas
      //   de todos os alunos ativos). Com menos de 3 sessões concluídas, as
      //   duas médias vêm null. A tela não calcula média.
      desempenhoNaTurma: (turmaId: string) =>
        get<DesempenhoNaTurma>(`/turmas/${encodeURIComponent(turmaId)}/meu-desempenho`),

      // @rota GET /turmas/:turmaId/ranking
      // @resposta 200 LinhaDoRanking[] — JÁ ORDENADO E PONTUADO; a tela só exibe
      //   [{ "posicao": 1, "nome": "Bruno Sato", "voce": false, "licoes": 2, "ritmo": 46,
      //      "diasSeguidos": 12, "pontos": 146 },
      //    { "posicao": 4, "nome": null, "voce": false, "licoes": 2, "ritmo": 42,
      //      "diasSeguidos": 8, "pontos": 122 },
      //    { "posicao": 6, "nome": "Ana Pires", "voce": true, "licoes": 2, "ritmo": 40,
      //      "diasSeguidos": 3, "pontos": 95 }]
      // @erros 404 NAO_ENCONTRADO — a turma não existe ou ele não está nela
      //   403 TIPO_INVALIDO — token de conta
      // @identidade O token marca a linha `voce`. O :turmaId é da turma.
      // @back A ANONIMIZAÇÃO É DO BACK: do 4º lugar em diante, nome = null —
      //   menos na linha dele, que vem sempre com o nome. O nome dos colegas
      //   não pode chegar ao navegador, nem escondido. Sem nome no cadastro,
      //   vai o RP; nunca um nome inventado.
      //   Para cada aluno ATIVO, só com as sessões DESTA turma (SessionsProf):
      //     licoes        exercícios DIFERENTES com sessão concluída
      //                   (COUNT DISTINCT ExercicioID WHERE concluida = 1)
      //     ritmo         PPM médio das concluídas, inteiro; null sem nenhuma
      //     diasSeguidos  dias de calendário seguidos com sessão (concluída
      //                   ou não), terminando HOJE ou ONTEM; senão 0
      //     pontos = licoes * 20 + (ritmo ?? 0) + diasSeguidos * 5
      //   Ordem: pontos desc; empate, mais lições; depois mais dias.
      //   posicao começa em 1.
      // @nota Lição pesa mais que tudo: quem fez mais exercícios fica na
      //   frente de quem só digita rápido; o ritmo entra a 1 ponto por PPM e
      //   cada dia seguido vale 5, para a constância contar. Nunca é
      //   velocidade pura.
      rankingDaTurma: (turmaId: string) =>
        get<LinhaDoRanking[]>(`/turmas/${encodeURIComponent(turmaId)}/ranking`),
    },
  },

  // @grupo Administração
  // Categorias e parâmetros globais (tabela Configuracoes).
  admin: {
    // @rota GET /categorias
    // @resposta 200 Categoria[] — só as ativas
    //   [{ "id": 1, "nome": "Palavras comuns", "ativo": true }]
    // @identidade Qualquer token válido: ler a lista não exige papel.
    categorias: () => get<Categoria[]>('/categorias'),

    // @rota POST /categorias
    // @corpo { nome }
    //   { "nome": "Atalhos de teclado" }
    // @resposta 200 Categoria
    //   { "id": 6, "nome": "Atalhos de teclado", "ativo": true }
    // @erros 400 DADOS_INVALIDOS — nome vazio
    //   409 CATEGORIA_DUPLICADA — já existe uma ativa com esse nome (sem diferenciar maiúscula)
    //   404 NAO_ENCONTRADO — o token não é de administrador
    // @identidade O token, que tem de ser de ADMINISTRADOR. Conta comum ou
    //   aluno: 404, como se a rota não existisse (ver a pendência do papel
    //   de administrador, no topo).
    criarCategoria: (nome: string) => post<Categoria>('/categorias', { nome }),

    // @rota PATCH /categorias/:id
    // @corpo { nome }
    //   { "nome": "Palavras do dia a dia" }
    // @resposta 200 Categoria
    //   { "id": 1, "nome": "Palavras do dia a dia", "ativo": true }
    // @erros 404 NAO_ENCONTRADO — a categoria não existe, ou o token não é de administrador
    // @identidade O token, que tem de ser de ADMINISTRADOR. Conta comum ou
    //   aluno: 404, como se a rota não existisse.
    renomearCategoria: (id: string | number, nome: string) =>
      patch<Categoria>(`/categorias/${id}`, { nome }),

    // @rota DELETE /categorias/:id
    // @resposta 204 (sem corpo)
    // @erros 404 NAO_ENCONTRADO — a categoria não existe, ou o token não é de administrador
    //   409 CATEGORIA_EM_USO — algum exercício ativo usa a categoria
    // @identidade O token, que tem de ser de ADMINISTRADOR. Conta comum ou
    //   aluno: 404, como se a rota não existisse.
    // @back Exclusão LÓGICA (ativo = false).
    apagarCategoria: (id: string | number) => del(`/categorias/${id}`),

    // @rota GET /parametros
    // @resposta 200 Parametros — a tabela Configuracoes
    //   { "wpmMeta": 40, "precisaoMinima": 90, "tempoLimitePadrao": 60, "xpPorNivel": 200 }
    // @identidade Qualquer token válido: o lobby do Solo lê o xpPorNivel.
    parametros: () => get<Parametros>('/parametros'),

    // @rota PUT /parametros
    // @corpo Partial<Parametros> — só os campos que mudam
    //   { "wpmMeta": 45 }
    // @resposta 200 Parametros — como ficou
    //   { "wpmMeta": 45, "precisaoMinima": 90, "tempoLimitePadrao": 60, "xpPorNivel": 200 }
    // @erros 404 NAO_ENCONTRADO — o token não é de administrador
    // @identidade O token, que tem de ser de ADMINISTRADOR. Conta comum ou
    //   aluno: 404, como se a rota não existisse.
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
