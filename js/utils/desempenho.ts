// desempenho.ts
// Contas que uma tela faz sobre a lista de sessões que JÁ carregou:
// sequência de dias e evolução de PPM. Nasceram em js/aluno/Historico.tsx
// e saíram de lá quando a tela de estatísticas do Solo (js/solo/
// Estatisticas.tsx) precisou das mesmas duas — os dois mundos têm sessões
// com data e PPM, e a regra é uma só.
//
// Não há rota para nada disto, de propósito: pedir ao back a sequência ou
// a evolução seria pedir uma conta que o front tem como fazer sobre dado
// que já está na mão. As funções recebem só a forma mínima (data, wpm)
// para servirem a SessaoDoHistorico, SessaoSolo e o que mais vier.

/** O que a sequência precisa de uma sessão: a data ISO. */
export interface SessaoComData {
  data: string;
}

/** O que a evolução precisa de uma sessão: o PPM. */
export interface SessaoComPpm {
  wpm: number;
}

// A evolução compara as 5 sessões mais recentes com as 5 anteriores. Com
// menos de 6 não há duas janelas para comparar, e a tela diz isso em vez
// de inventar uma tendência a partir de duas ou três sessões.
export const JANELA_EVOLUCAO = 5;

// Da mais recente para a mais antiga, sem confiar na ordem em que a
// resposta chegou. É desta ordem que a sequência e a evolução dependem —
// não da ordenação que a pessoa escolheu na tabela.
export function maisRecentesPrimeiro<T extends SessaoComData>(lista: T[]): T[] {
  return [...lista].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

// ============================================================================
// Sequência de dias
// ============================================================================
// Quantos dias SEGUIDOS a pessoa treinou, contados do dia da sessão mais
// recente para trás. Não existe tabela de sequência no banco, e nem
// precisa: a informação está nas datas.
//
// A sequência só conta se a última sessão foi hoje ou ontem — é o que
// "seguidos" quer dizer, e é o que deixa o número vivo: treinar hoje
// continua a de ontem. Uma sequência antiga já terminou, e aí é 0. Não há
// aviso nenhum sobre isso na tela: é um número, não um puxão de orelha.
//
// O dia sai dos 10 primeiros caracteres do ISO, sem Date() no meio, pela
// mesma razão de formatarDataHora (formato.ts): o app inteiro mostra o
// horário como o registro o gravou, sem converter fuso. Converter só aqui
// faria a sequência discordar da data que a linha da tabela mostra.

export function sequenciaDeDias(sessoes: SessaoComData[]): number {
  const dias = [...new Set(sessoes.map((s) => diaDe(s.data)))].filter(Boolean).sort().reverse();
  if (dias.length === 0) return 0;

  const hoje = diaDe(new Date().toISOString());
  if (dias[0] !== hoje && dias[0] !== somarDias(hoje, -1)) return 0;

  let total = 1;
  for (let i = 1; i < dias.length; i++) {
    if (dias[i] !== somarDias(dias[i - 1], -1)) break;
    total++;
  }
  return total;
}

// 'AAAA-MM-DDTHH:MM:SS...' -> 'AAAA-MM-DD'.
export function diaDe(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso));
  return m ? m[1] : '';
}

// Aritmética de dia em cima de 'AAAA-MM-DD'. O T00:00:00Z fixo mantém a
// conta longe de fuso e de horário de verão.
export function somarDias(dia: string, delta: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
}

// ============================================================================
// Evolução
// ============================================================================
// Média de PPM das 5 sessões mais recentes contra a das 5 anteriores. É a
// ÚNICA média que o front calcula, e ela é permitida porque é uma conta
// sobre a lista que a tela já carregou — não uma segunda versão de um
// número que o back também produz.
//
// Entram todas as sessões, inclusive a que ficou sem tempo: o PPM feito
// naqueles segundos foi medido e é da pessoa.
//
// Melhorou, diz quanto. Não melhorou, é 'estavel' — e cada tela escolhe a
// frase, porque o tom do aluno e o do Solo não são o mesmo. Nenhuma das
// duas diz que caiu.

export type Evolucao =
  | { tipo: 'insuficiente' }
  | { tipo: 'melhorou'; diferenca: number }
  | { tipo: 'estavel' };

/** `sessoes` da mais recente para a mais antiga (ver maisRecentesPrimeiro). */
export function evolucaoDe(sessoes: SessaoComPpm[]): Evolucao {
  const ppms = sessoes.map((s) => s.wpm).filter((n) => Number.isFinite(n));
  if (ppms.length < JANELA_EVOLUCAO + 1) return { tipo: 'insuficiente' };

  const recentes = ppms.slice(0, JANELA_EVOLUCAO);
  // Pode ter menos de 5 (entre 6 e 9 sessões no total): a janela anterior
  // é o que houver antes das 5 recentes, e nunca está vazia aqui.
  const anteriores = ppms.slice(JANELA_EVOLUCAO, JANELA_EVOLUCAO * 2);

  const diferenca = arredondar(mediaDe(recentes) - mediaDe(anteriores));
  return diferenca > 0 ? { tipo: 'melhorou', diferenca } : { tipo: 'estavel' };
}

export function mediaDe(numeros: number[]): number {
  return numeros.reduce((total, n) => total + n, 0) / numeros.length;
}

// Uma casa decimal.
export function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

// ============================================================================
// A semana corrente, dia a dia
// ============================================================================
// Os sete quadrados do painel de sequência do lobby: segunda a domingo da
// semana em que hoje cai, cada dia sabendo se houve treino. Como a
// sequência, não existe tabela para isto — sai das datas do histórico.
//
// Fica aqui, e não no Lobby.tsx, porque é a mesma aritmética de dia em
// cima de 'AAAA-MM-DD' que sequenciaDeDias() já usa (diaDe e somarDias), e
// porque sem React em volta dá para conferir com node (desempenho.check.mjs).
//
// A semana começa na segunda: é o calendário brasileiro, e é o que o
// desenho mostra (S T Q Q S S D). O dia de hoje entra por parâmetro para o
// check poder fixar a data; a tela chama sem argumento.

/** Um dos sete quadrados. */
export interface DiaDaSemana {
  /** 'AAAA-MM-DD'. */
  dia: string;
  /** A letra embaixo do quadrado. Repete de propósito: S T Q Q S S D. */
  inicial: string;
  /** Por extenso, para quem ouve a tela — a inicial sozinha é ambígua. */
  nome: string;
  /** Houve ao menos uma sessão neste dia. */
  treinou: boolean;
  /** Ainda não aconteceu: o resto da semana depois de hoje. */
  futuro: boolean;
}

const DIAS_DA_SEMANA = [
  { inicial: 'S', nome: 'segunda-feira' },
  { inicial: 'T', nome: 'terça-feira' },
  { inicial: 'Q', nome: 'quarta-feira' },
  { inicial: 'Q', nome: 'quinta-feira' },
  { inicial: 'S', nome: 'sexta-feira' },
  { inicial: 'S', nome: 'sábado' },
  { inicial: 'D', nome: 'domingo' },
];

export function semanaDeDias(
  sessoes: SessaoComData[],
  hoje: string = diaDe(new Date().toISOString())
): DiaDaSemana[] {
  // getUTCDay() devolve 0 para domingo; a semana aqui começa na segunda,
  // então o domingo é o sexto passo, não o primeiro.
  const diaDaSemana = (new Date(`${hoje}T00:00:00Z`).getUTCDay() + 6) % 7;
  const segunda = somarDias(hoje, -diaDaSemana);

  // Set, não includes() em array: o histórico pode ter centenas de sessões
  // e esta varredura acontece uma vez por carga.
  const treinados = new Set(sessoes.map((s) => diaDe(s.data)).filter(Boolean));

  return DIAS_DA_SEMANA.map((rotulo, passo) => {
    const dia = somarDias(segunda, passo);
    return { dia, ...rotulo, treinou: treinados.has(dia), futuro: dia > hoje };
  });
}
