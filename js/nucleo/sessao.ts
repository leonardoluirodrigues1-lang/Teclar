// sessao.ts
// Guarda quem está logado. É o ÚNICO arquivo do projeto que lê ou escreve
// as chaves de autenticação (token e usuário). Todo o resto do front
// pergunta o estado da sessão através deste módulo.
//
// Token e usuário moram no sessionStorage, que morre quando a aba fecha:
// quem abre o site de novo faz login de novo. Recarregar a página não
// apaga o sessionStorage, então recarregar não desloga. O resto (modo,
// preferências do aparelho, tutorial visto, fila de sessões) continua no
// localStorage, porque não é segredo e deve durar entre sessões.

import { CONFIG } from '../config.js';
import type { Usuario, RespostaLogin, Mundo, Modo, TipoSessao } from './tipos.js';

const CHAVES = CONFIG.CHAVES_STORAGE;

// Até a sessão ir para o sessionStorage, token e usuário ficavam no
// localStorage. O que sobrou de lá não vale mais (ninguém lê) e é segredo
// esquecido no disco: apaga ao carregar.
localStorage.removeItem(CHAVES.TOKEN);
localStorage.removeItem(CHAVES.USUARIO);

// Cache em memória do usuário logado. O api.js consulta a sessão em toda
// requisição, então não vale reparsear o JSON do sessionStorage a cada chamada.
//   undefined -> ainda não lido do sessionStorage nesta carga de página
//   null      -> já lido, não há usuário
//   objeto    -> usuário atual
let cacheUsuario: Usuario | null | undefined;

// Grava a sessão do login OU do cadastro:
//   { token, usuario: { id, nome?, email?, tipo } }
// Do cadastro, a tela passa só esses dois campos: a resposta dele traz
// também a senha de aluno, que não pode ser guardada em lugar nenhum.
// `tipo` diz de qual tabela o login veio ('conta' = Users, 'aluno' =
// Alunos); não é coluna do banco, o back sabe porque autenticou num lugar
// ou no outro. nome e email são opcionais de propósito: o aluno não tem
// e-mail, e o nome dele é o da conta dona — que pode faltar (aluno antigo
// sem conta ligada e sem nome em Alunos). Ver nomeExibicao().
function entrar(resposta: RespostaLogin): Usuario {
  const token = resposta?.token;
  const usuario = resposta?.usuario;
  if (!token || (usuario?.tipo !== 'conta' && usuario?.tipo !== 'aluno')) {
    // Resposta fora do contrato: gravar meia sessão deixa o app num estado
    // que nenhuma tela sabe tratar. Melhor falhar aqui, onde dá para ver.
    throw new Error('sessao.entrar: resposta sem token ou sem tipo.');
  }
  sessionStorage.setItem(CHAVES.TOKEN, token);
  sessionStorage.setItem(CHAVES.USUARIO, JSON.stringify(usuario));
  cacheUsuario = usuario;
  return usuario;
}

function token(): string | null {
  return sessionStorage.getItem(CHAVES.TOKEN);
}

// Apaga a sessão e TODA chave 'teclar:' do localStorage, inclusive o modo,
// que o sair() preserva de propósito. Usado só para descartar sessão inválida:
// se o formato do que está gravado não é mais reconhecido, o modo salvo
// junto também não vale nada.
function limparTudo(): void {
  sessionStorage.removeItem(CHAVES.TOKEN);
  sessionStorage.removeItem(CHAVES.USUARIO);
  for (const chave of Object.keys(localStorage)) {
    if (chave.startsWith('teclar:')) localStorage.removeItem(chave);
  }
  cacheUsuario = null;
}

// Lê do cache; se não tiver, lê do sessionStorage e faz parse.
//
// Uma sessão gravada só vale se tiver tipo ('conta' | 'aluno') e token. A
// sessão pode ter sobrado de antes da conta única, quando o usuário
// tinha `perfil` e não tinha `tipo`: esse formato o resto do front não sabe
// ler — o guarda não resolve a casa da pessoa e a devolve para a landing,
// então login.html entra e sai na hora e não há como chegar a lugar nenhum
// sem limpar o navegador na mão. JSON corrompido cai no mesmo caso.
//
// O tratamento é o mesmo nos três: limpar e devolver null, uma vez, aqui na
// leitura. Ninguém redireciona daqui — quem decide para onde ir é o guarda,
// que passa a ver "ninguém logado" e manda para o login.
function usuario(): Usuario | null {
  if (cacheUsuario !== undefined) return cacheUsuario;

  const bruto = sessionStorage.getItem(CHAVES.USUARIO);
  if (bruto == null) {
    cacheUsuario = null;
    return null;
  }

  let lido: unknown;
  try {
    lido = JSON.parse(bruto);
  } catch {
    limparTudo();
    return null;
  }

  const candidato = lido as (Usuario & { perfil?: unknown }) | null;
  const valido =
    candidato != null &&
    (candidato.tipo === 'conta' || candidato.tipo === 'aluno') &&
    candidato.perfil === undefined &&
    token() != null;

  if (!valido) {
    limparTudo();
    return null;
  }

  cacheUsuario = candidato;
  return cacheUsuario;
}

// Tem token E usuário.
function logado(): boolean {
  return token() != null && usuario() != null;
}

function tipo(): TipoSessao | null {
  return usuario()?.tipo ?? null;
}

// O que a tela escreve quando precisa chamar a pessoa por algo. Aluno sem
// nome cai no RP (o próprio id). Nunca devolve
// undefined — string vazia é o pior caso, e string vazia não aparece.
function nomeExibicao(): string {
  const atual = usuario();
  if (atual == null) return '';
  return atual.nome ?? String(atual.id ?? '');
}

// --- Modo: onde a conta está navegando (solo | professor) --------------------
// Estado de NAVEGAÇÃO, não permissão: qualquer conta abre os dois mundos.
// Não vai ao back nem ao token. Só existe para sessão de conta — para
// aluno, modo() é sempre null.
//
// Fica no localStorage (sobrevive ao fechar a aba) junto com o id da
// conta. Ele NÃO decide para onde a conta vai depois do login — ali é sempre a tela de modo (ver
// destinoAoEntrar() em guarda.ts). Serve durante a sessão: a casa() do
// guarda e o "Ir para ..." da Nav. Outra conta no mesmo navegador não
// herda (o id não bate).

function modo(): Modo | null {
  const atual = usuario();
  if (atual == null || atual.tipo !== 'conta') return null;
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVES.MODO) ?? 'null');
    if (salvo?.id !== atual.id) return null;
    return salvo.modo === 'solo' || salvo.modo === 'professor' ? salvo.modo : null;
  } catch {
    return null;
  }
}

function definirModo(novo: Modo): void {
  const atual = usuario();
  if (atual == null || atual.tipo !== 'conta') return;
  localStorage.setItem(CHAVES.MODO, JSON.stringify({ id: atual.id, modo: novo }));
}

// 'solo' para conta em modo solo; 'escola' para aluno e conta em modo
// professor. Casa com as classes .mundo-solo / .mundo-escola aplicadas no
// <body>. null sem sessão, e null para conta sem modo: devolver 'escola'
// nesses casos seria estado errado em silêncio — pior que erro visível.
function mundo(): Mundo | null {
  const atual = tipo();
  if (atual == null) return null;
  if (atual === 'aluno') return 'escola';
  const m = modo();
  if (m == null) return null;
  return m === 'solo' ? 'solo' : 'escola';
}

// --- Reduzir movimento (pages/solo/configuracoes.html) ------------------------
// Preferência do APARELHO, não da conta: quem pediu menos movimento neste
// computador continua pedindo depois de sair, e por isso o sair() não a
// apaga. Soma-se ao prefers-reduced-motion do sistema, não o substitui.

function movimentoReduzido(): boolean {
  return localStorage.getItem(CHAVES.MOVIMENTO_REDUZIDO) === 'sim';
}

function definirMovimentoReduzido(ligado: boolean): void {
  if (ligado) localStorage.setItem(CHAVES.MOVIMENTO_REDUZIDO, 'sim');
  else localStorage.removeItem(CHAVES.MOVIMENTO_REDUZIDO);
}

// --- Teclado guia do treino (pages/solo/configuracoes.html) ------------------
// Também preferência do APARELHO, como o reduzir movimento, e também
// sobrevive ao sair(). Vale para toda tela de treino (Solo, aluno e
// prévia), que é uma tela só.

function tecladoGuiaEscondido(): boolean {
  return localStorage.getItem(CHAVES.TECLADO_GUIA_ESCONDIDO) === 'sim';
}

function definirTecladoGuiaEscondido(escondido: boolean): void {
  if (escondido) localStorage.setItem(CHAVES.TECLADO_GUIA_ESCONDIDO, 'sim');
  else localStorage.removeItem(CHAVES.TECLADO_GUIA_ESCONDIDO);
}

// --- Tutoriais do Solo e do Professor: já visto? ----------------------------
// PROVISÓRIO: enquanto a tabela Users não tiver uma coluna para isso, a
// marca fica no navegador, uma chave por conta (o id vai no nome da
// chave). Outra conta no mesmo navegador vê o tutorial dela; a mesma conta
// em outro navegador vê de novo. Quando a coluna existir, estas três
// funções passam a ler e gravar pela API, e quem as chama não muda.
// O sair() não apaga a marca: quem já viu não precisa ver de novo só por
// ter saído.
//
// São DUAS marcas, uma por modo (`qual`): a mesma conta vê o tutorial do
// Solo na primeira vez no Solo e o do Professor na primeira vez no
// Professor, em qualquer ordem.

type QualTutorial = 'solo' | 'professor';

function prefixoDoTutorial(qual: QualTutorial): string {
  return qual === 'solo' ? CHAVES.TUTORIAL_SOLO : CHAVES.TUTORIAL_PROFESSOR;
}

function chaveDoTutorial(qual: QualTutorial): string | null {
  const atual = usuario();
  if (atual == null || atual.tipo !== 'conta') return null;
  return prefixoDoTutorial(qual) + atual.id;
}

function tutorialVisto(qual: QualTutorial): boolean {
  const chave = chaveDoTutorial(qual);
  // Sem conta não há de quem ser a marca: trata como visto, para não
  // mostrar o tutorial a quem nem tem os modos Solo e Professor.
  return chave == null || localStorage.getItem(chave) === 'visto';
}

function marcarTutorialVisto(qual: QualTutorial): void {
  const chave = chaveDoTutorial(qual);
  if (chave) localStorage.setItem(chave, 'visto');
}

// O "Rever o tutorial" das Configurações de cada modo.
function esquecerTutorial(qual: QualTutorial): void {
  const chave = chaveDoTutorial(qual);
  if (chave) localStorage.removeItem(chave);
}

// --- Modo Solo: campanha escolhida no lobby ---------------------------------
// Fica gravada dentro do próprio usuário, então persiste entre as telas
// (lobby -> treino -> resultado) e é apagada junto no sair().

function campanhaAtiva(): string | null {
  return usuario()?.campanhaAtiva ?? null;
}

function definirCampanha(id: string): Usuario | null {
  return atualizarUsuario({ campanhaAtiva: id });
}

// --- Modo Escola: turma em uso --------------------------------------------
// Um aluno pode estar matriculado em várias turmas; a tela precisa saber
// qual está aberta. Sem escolha explícita, cai na primeira da lista de
// turmas do usuário.

function turmaAtiva(): string | null {
  return usuario()?.turmaAtiva ?? usuario()?.turmas?.[0]?.id ?? null;
}

function definirTurma(id: string): Usuario | null {
  return atualizarUsuario({ turmaAtiva: id });
}

// Mescla campos no usuário salvo (ex.: nível novo, xp, avatar, campanha).
function atualizarUsuario(campos: Partial<Usuario>): Usuario | null {
  const atual = usuario();
  if (atual == null) return null;

  const novo = { ...atual, ...campos };
  sessionStorage.setItem(CHAVES.USUARIO, JSON.stringify(novo));
  cacheUsuario = novo;
  return novo;
}

// Apaga TUDO o que pertence à pessoa que estava logada e esfria o cache.
// A campanha ativa e a turma ativa moram dentro do objeto usuário, então
// saem junto. A fila de sessões pendentes é apagada à parte: são resultados
// de treino de quem saiu, e reenviá-los com o token do próximo a entrar
// gravaria sessão de uma pessoa na conta de outra.
// O modo fica de propósito (ver modo()): é amarrado ao id da conta.
function sair(): void {
  sessionStorage.removeItem(CHAVES.TOKEN);
  sessionStorage.removeItem(CHAVES.USUARIO);
  localStorage.removeItem(CHAVES.FILA_SESSOES);
  cacheUsuario = null;
}

export const sessao = {
  entrar,
  sair,
  token,
  usuario,
  logado,
  tipo,
  nomeExibicao,
  modo,
  definirModo,
  mundo,
  movimentoReduzido,
  definirMovimentoReduzido,
  tecladoGuiaEscondido,
  definirTecladoGuiaEscondido,
  tutorialVisto,
  marcarTutorialVisto,
  esquecerTutorial,
  campanhaAtiva,
  definirCampanha,
  turmaAtiva,
  definirTurma,
  atualizarUsuario,
};
