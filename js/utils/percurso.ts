// percurso.ts
// A regra que decide a próxima lição do Solo: a ordem do percurso
// (agrupada por nível) e para onde o botão "Continuar" leva e como ele se
// chama. Existia duplicada em js/solo/Campanhas.tsx e js/solo/Lobby.tsx;
// agora as duas telas usam esta, e mostram sempre a mesma lição com o
// mesmo texto.
//
// Só a decisão mora aqui: nada de JSX e nada de chamada de API. As telas
// carregam as lições (GET /solo/missoes) e o histórico (GET
// /solo/historico) e passam as listas prontas.

import type { Missao, SessaoSolo } from '../nucleo/tipos.js';
import { maisRecentesPrimeiro } from './desempenho.js';

export interface GrupoDoPercurso {
  nivel: number;
  /** As lições do nível, em `ordem` crescente. */
  licoes: Missao[];
}

export interface ProgressoDoPercurso {
  /** Lições com ao menos uma sessão concluída. */
  concluidas: Set<string>;
  /** A lição da sessão mais recente (concluída ou não). null: nunca treinou. */
  ultimaFeita: Missao | null;
  /** Para onde "Continuar" leva. `repetir`: tudo concluído, o convite é
   *  repetir a última feita. */
  proxima: { licao: Missao; repetir: boolean };
}

// Agrupa por nível e ordena tudo por `ordem`, sem confiar na ordem em que
// a resposta chegou: os grupos saem na ordem do menor `ordem` de cada um
// (que é a ordem dos níveis no percurso), e as lições dentro do grupo em
// ordem crescente. O percurso do professor intercala — o nível 1 tem as
// lições 1 a 8 e também a 49 e a 50 —, então ordenar é o que junta as
// duas pontas no mesmo grupo, na sequência certa.
export function agruparPorNivel(licoes: Missao[]): GrupoDoPercurso[] {
  const porNivel = new Map<number, Missao[]>();
  for (const licao of licoes) {
    const lista = porNivel.get(licao.nivel);
    if (lista) lista.push(licao);
    else porNivel.set(licao.nivel, [licao]);
  }

  return [...porNivel.entries()]
    .map(([nivel, doNivel]) => ({
      nivel,
      licoes: [...doNivel].sort((a, b) => a.ordem - b.ordem),
    }))
    .sort((a, b) => a.licoes[0].ordem - b.licoes[0].ordem);
}

// O percurso inteiro numa lista só: os grupos, achatados. NÃO é o mesmo
// que ordenar por `ordem` — a lição 49 vem logo depois da 8, dentro do
// nível 1.
export function ordemDoPercurso(licoes: Missao[]): Missao[] {
  return agruparPorNivel(licoes).flatMap((grupo) => grupo.licoes);
}

// `licoesEmOrdem` já na ordem do percurso (ver ordemDoPercurso). A próxima
// é a primeira não concluída nessa ordem; com tudo concluído, o convite é
// repetir a última feita; sem sessão nenhuma, é a primeira lição. Sem
// lição nenhuma não há próxima: null.
export function progressoDoPercurso(
  licoesEmOrdem: Missao[],
  sessoes: SessaoSolo[]
): ProgressoDoPercurso | null {
  if (licoesEmOrdem.length === 0) return null;

  const concluidas = new Set(sessoes.filter((s) => s.concluida).map((s) => s.exerciseId));
  const porId = new Map(licoesEmOrdem.map((l) => [l.exerciseId, l]));

  // Sessão de uma lição que não está na lista (apagada do banco) não conta
  // como "a última feita": não haveria para onde levar.
  const maisRecente = maisRecentesPrimeiro(sessoes).find((s) => porId.has(s.exerciseId));
  const ultimaFeita = maisRecente ? porId.get(maisRecente.exerciseId) ?? null : null;

  const primeiraPendente = licoesEmOrdem.find((l) => !concluidas.has(l.exerciseId));
  const proxima = primeiraPendente
    ? { licao: primeiraPendente, repetir: false }
    : { licao: ultimaFeita ?? licoesEmOrdem[0], repetir: true };

  return { concluidas, ultimaFeita, proxima };
}

// O texto do botão: "Repetir a última" com tudo concluído, "Começar" para
// quem nunca treinou, "Continuar" no resto.
export function textoDoBotao(progresso: ProgressoDoPercurso): string {
  if (progresso.proxima.repetir) return 'Repetir a última';
  if (progresso.ultimaFeita == null) return 'Começar';
  return 'Continuar';
}
