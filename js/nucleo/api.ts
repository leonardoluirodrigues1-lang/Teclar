// api.ts
// Todas as chamadas ao back passam por aqui. Nenhuma tela usa fetch direto.
// Enquanto CONFIG.MOCK for true, nada de rede sai daqui: tudo é respondido
// por ./mocks.js.
//
// O contrato de cada rota (corpo, resposta, erros, regras do back) vive em
// ./api.contrato.ts, com a mesma chave da função ('auth.entrar').

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
  RespostaLogin,
  LinhaDoRanking,
  ResultadoImportacao,
  CodigoDaTurma,
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

export const api = {
  auth: {
    entrar: (credenciais: Credenciais) =>
      postPublico<RespostaLogin>('/auth/login', credenciais),

    cadastrar: ({ nome, email, senha }: DadosCadastro) =>
      postPublico<RespostaLogin>('/auth/cadastro', { nome, email, senha }),

    eu: () => get<Usuario>('/auth/eu'),

    sair: () => post<null>('/auth/logout', undefined, { publico: true }),
  },

  solo: {
    campanhaAtual: () => get<Campanha | null>('/solo/campanha'),

    criarCampanha: () => post<Campanha>('/solo/campanha'),

    campanha: (id: string) => get<Campanha>(`/solo/campanhas/${id}`),

    apagarCampanha: (id: string) => del(`/solo/campanhas/${id}`),

    missoes: (filtros?: Filtros) => get<Missao[]>(`/solo/missoes${montarQuery(filtros)}`),

    missao: (id: string) => get<MissaoDetalhe>(`/solo/missoes/${id}`),

    registrarSessao: (dados: DadosSessaoTreino) =>
      post<RespostaSessaoSolo>('/solo/sessoes', dados),

    historico: (filtros?: Filtros) =>
      get<Paginado<SessaoSolo>>(`/solo/historico${montarQuery(filtros)}`),

    indicadores: () => get<IndicadoresSolo>('/solo/indicadores'),

    estatisticas: () => get<EstatisticasSolo>('/solo/estatisticas'),
  },

  turmas: {
    listar: (filtros?: Filtros) => get<Turma[]>(`/turmas${montarQuery(filtros)}`),

    listarArquivadas: () => get<Turma[]>('/turmas?ativa=false'),

    criar: (nome: string) => post<Turma>('/turmas', { nome }),

    obter: (id: string) => get<TurmaDetalhe>(`/turmas/${id}`),

    renomear: (id: string, nome: string) => patch<Turma>(`/turmas/${id}`, { nome }),

    trocarCapa: (id: string, semente: number) =>
      patch<Turma>(`/turmas/${id}`, { capaSemente: semente }),

    arquivar: (id: string) => patch<Turma>(`/turmas/${id}`, { ativa: false }),

    desarquivar: (id: string) => patch<Turma>(`/turmas/${id}`, { ativa: true }),

    novoCodigo: (id: string) => post<CodigoDaTurma>(`/turmas/${id}/codigo/novo`),

    atribuicoes: (turmaId: string) =>
      get<AtribuicaoProfessor[]>(`/turmas/${turmaId}/atribuicoes`),

    atribuir: (turmaId: string, ids: string[]) =>
      post<Atribuicao[]>(`/turmas/${turmaId}/atribuicoes`, { exercicioIds: ids }),

    removerAtribuicao: (turmaId: string, exercicioId: string) =>
      del(`/turmas/${turmaId}/atribuicoes/${exercicioId}`),
  },

  alunos: {
    daTurma: (turmaId: string) => get<Aluno[]>(`/turmas/${turmaId}/alunos`),

    importar: (turmaId: string, nomes: string[]) =>
      post<ResultadoImportacao>(`/turmas/${turmaId}/alunos/importar`, { nomes }),

    remover: (turmaId: string, alunoId: string) =>
      del(`/turmas/${turmaId}/alunos/${alunoId}`),

    zerarSenha: (turmaId: string, alunoId: string) =>
      post<null>(`/turmas/${turmaId}/alunos/${alunoId}/zerar-senha`),

    desempenho: (turmaId: string, alunoId: string) =>
      get<DesempenhoAluno>(`/turmas/${turmaId}/alunos/${alunoId}/desempenho`),
  },

  relatorios: {
    turma: (turmaId: string) => get<RelatorioTurma>(`/turmas/${turmaId}/relatorio`),

    porAluno: (turmaId: string) => get<RelatorioAluno[]>(`/turmas/${turmaId}/relatorio/alunos`),

    porExercicio: (turmaId: string) =>
      get<RelatorioExercicio[]>(`/turmas/${turmaId}/relatorio/exercicios`),

    sessoesDoAluno: (turmaId: string, alunoId: string) =>
      get<Paginado<SessaoDoAluno>>(`/turmas/${turmaId}/alunos/${alunoId}/sessoes`),
  },

  exercicios: {
    listar: () => get<Paginado<Exercicio>>('/exercicios'),

    obter: (id: string, turmaId?: string | null) =>
      get<ExercicioDetalhe>(`/exercicios/${id}${montarQuery({ turma: turmaId })}`),

    criar: (dados: DadosExercicio) => post<Exercicio>('/exercicios', dados),

    atualizar: (id: string, dados: DadosExercicio) => patch<Exercicio>(`/exercicios/${id}`, dados),

    excluir: (id: string) => del(`/exercicios/${id}`),
  },

  sessoes: {
    registrar: (dados: DadosSessaoTreino) => post<RespostaSessaoEscola>('/sessoes', dados),

    obter: (id: string) => get<Sessao | SessaoSolo>(`/sessoes/${id}`),
  },

  escola: {
    aluno: {
      historico: () => get<Paginado<SessaoDoHistorico>>('/aluno/historico'),

      resumo: () => get<ResumoDoAluno>('/aluno/resumo'),

      salas: () => get<SalaDoAluno[]>('/aluno/salas'),

      sala: (id: string) => get<SalaDetalhe>(`/aluno/salas/${encodeURIComponent(id)}`),

      desempenhoNaTurma: (turmaId: string) =>
        get<DesempenhoNaTurma>(`/turmas/${encodeURIComponent(turmaId)}/meu-desempenho`),

      rankingDaTurma: (turmaId: string) =>
        get<LinhaDoRanking[]>(`/turmas/${encodeURIComponent(turmaId)}/ranking`),
    },
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
