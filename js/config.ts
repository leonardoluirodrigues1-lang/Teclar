// config.ts
// Único lugar do front que sabe onde o back mora e quais são as regras
// numéricas do sistema. Qualquer outro módulo importa daqui em vez de
// repetir URL ou número mágico.
//
// Os outros módulos importam './config.js': é o .js que o tsc gera ao lado
// deste arquivo. Este .ts é a fonte; o .js não se edita.
//
// Não existe mais PERFIS: a tabela Users não tem coluna de perfil. O que
// existe é o tipo da sessão (conta | aluno) e o modo de navegação da conta
// (solo | professor) — ver TipoSessao e Modo em nucleo/tipos.ts.

import type { Modo, TipoSessao } from './nucleo/tipos.js';

/** Níveis de dificuldade de exercício. */
export const DIFICULDADES = {
  facil: 'facil',
  medio: 'medio',
  dificil: 'dificil',
} as const;

/** Modos da tela de treino — ver CONFIG.TREINO.MODO_PADRAO. */
export type ModoTreino = 'livre' | 'bloqueante';

export const CONFIG = {
  // Enquanto MOCK for true, o api.js responde com dados falsos (js/nucleo/mocks.js)
  // e nenhuma requisição de rede acontece. Vira false quando o back estiver de pé.
  MOCK: true,

  // Raiz da API do back (Node + Express + MySQL na porta 3000).
  BASE_URL: 'http://localhost:3000/api',

  // Atraso artificial dos mocks, em ms. Sem ele os mocks respondem
  // instantaneamente e os estados de carregamento nunca são testados de verdade.
  ATRASO_MOCK: 400,

  // Chaves do storage (token e usuário no sessionStorage, o resto no
  // localStorage; ver sessao.ts). Prefixo 'teclar:' para isolar do resto do host
  // durante o desenvolvimento (Live Server na 5500).
  CHAVES_STORAGE: {
    TOKEN: 'teclar:token',
    USUARIO: 'teclar:usuario',
    MODO: 'teclar:modo', // último modo (solo | professor) da conta, ver sessao.modo()
    FILA_SESSOES: 'teclar:fila_sessoes', // sessões de treino aguardando envio ao back
    MOVIMENTO_REDUZIDO: 'teclar:movimento_reduzido', // escolha feita em pages/solo/configuracoes.html
    TECLADO_GUIA_ESCONDIDO: 'teclar:teclado_guia_escondido', // escolha feita em pages/solo/configuracoes.html
    // PREFIXOS, não chaves inteiras: o id da conta vai no fim (ver
    // sessao.tutorialVisto). Provisório até existir coluna no banco. Uma
    // marca por modo: ver o tutorial de um não conta como ter visto o outro.
    TUTORIAL_SOLO: 'teclar:tutorial_solo:',
    TUTORIAL_PROFESSOR: 'teclar:tutorial_professor:',
    // Também PREFIXO + id da pessoa: as estrelas de conquista que ela já
    // viu neste aparelho (ver js/utils/estrelasJaVistas.ts).
    ESTRELAS_VISTAS: 'teclar:estrelas_vistas:',
  },

  // A versão que o rodapé da barra lateral do Solo mostra. A mesma do
  // package.json: ao subir uma, sobe a outra.
  VERSAO: '1.0.0',

  TREINO: {
    // 'livre'      — o erro não trava; o usuário continua digitando e o erro
    //                conta contra a precisão. Fluxo mais natural, é o padrão.
    // 'bloqueante' — a tela não avança enquanto o caractere certo não for
    //                digitado. Mais rígido, usado em treino guiado.
    MODO_PADRAO: 'livre' as ModoTreino,

    // Convenção universal de teste de digitação: 1 "palavra" = 5 caracteres.
    // Base do cálculo de PPM (palavras por minuto).
    CARACTERES_POR_PALAVRA: 5,

    // De quanto em quanto tempo a tela de treino recalcula PPM / precisão / tempo.
    INTERVALO_ATUALIZACAO_MS: 100,

    // Contagem regressiva, em segundos, antes de a sessão começar a contar.
    // Zero de propósito: o cronômetro já parte na primeira tecla, então a
    // contagem não protege nada — só impõe uma espera a cada tentativa. Quem
    // repete a mesma missão várias vezes seguidas (o uso normal de um
    // treinador de digitação) paga esse atrito toda vez.
    CONTAGEM_REGRESSIVA_S: 0,
  },

  SOLO: {
    // Espelha a tabela Configuracoes do banco. Enquanto a API não responde,
    // estes valores são o fallback usado pela lógica de XP e de missões.
    // 200 mantém a proporção saudável de 3 a 5 missões por nível
    // (XP_BASE_MISSAO 50). Com 1000, eram ~20 missões por nível: o jogador
    // chegava ao nível 2 e emperrava, porque as missões desbloqueiam por
    // NivelMinimo e não havia conteúdo liberado suficiente para continuar.
    XP_POR_NIVEL: 200,                  // XP necessário para subir um nível
    XP_BASE_MISSAO: 50,                 // XP concedido ao concluir uma missão
    // Fração do XP base concedida como bônus, proporcional à precisão:
    // precisão 100% rende +50% do base; precisão 0%, nenhum bônus.
    MULTIPLICADOR_BONUS_PRECISAO: 0.5,
  },

  METAS: {
    PPM_ALVO: 40,       // palavras por minuto que o usuário quer alcançar
    PRECISAO_ALVO: 90,  // precisão alvo, em % — mesmo valor de precisao_minima
                        // no seed da tabela Configuracoes; a tela não pode
                        // mostrar uma meta e o back validar outra.
  },

  // Itens por página nas listagens (turmas, alunos, histórico, biblioteca...).
  TAMANHO_PAGINA: 20,
};

/**
 * Telas de entrada. Moram aqui porque o api.js também precisa do login:
 * quando o back responde 401, a sessão morre e a pessoa volta para o login
 * — e isso acontece em qualquer chamada do app, não só nas telas de
 * autenticação.
 *
 * ROTA_MODO é a escolha Solo/Professor, que só existe DEPOIS do login e
 * só para sessão de conta.
 */
export const ROTA_MODO = '/pages/modo.html';
export const ROTA_LOGIN = '/pages/login.html';
export const ROTA_CADASTRO = '/pages/cadastro.html';
export const ROTA_LANDING = '/index.html';

/** A casa de cada modo da conta e a do aluno. */
export const ROTA_INICIAL = {
  // O CAMINHO das lições. Quem ainda não tem campanha é mandado de lá para
  // o dashboard (pages/solo/dashboard.html), que é onde mora o convite de
  // começar — ver o fim de js/solo/Caminho.tsx.
  solo: '/pages/solo/caminho.html',
  // As TURMAS, com a Nav e o menu do avatar (onde mora o "Ir para o Solo").
  // O antigo professor/dashboard.html (lista mínima) foi apagado.
  professor: '/pages/professor/turmas.html',
  aluno: '/pages/aluno/dashboard.html',
} as const;

/**
 * Para onde "voltar ao início" leva quem já está navegando (guarda.casa()).
 * Logo depois do login a conta vai sempre para a tela de modo, não daqui:
 * ver destinoAoEntrar() em js/nucleo/guarda.ts.
 *   aluno            -> dashboard do aluno
 *   conta com modo   -> a casa do modo
 *   conta sem modo   -> tela de modo
 */
export function rotaInicial(tipo: TipoSessao, modo: Modo | null): string {
  if (tipo === 'aluno') return ROTA_INICIAL.aluno;
  return modo ? ROTA_INICIAL[modo] : ROTA_MODO;
}
