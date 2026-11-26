// O tempo limite pela dificuldade: lição difícil dá mais tempo por
// caractere que a fácil. Vale para as lições do Solo, que também são a
// biblioteca do sistema (js/nucleo/licoes.ts, gravadas pelo seed), e é a
// SUGESTÃO do formulário de exercício do professor (ModalExercicio.tsx) —
// o tempo que o professor escolhe é o dele.
//
//   tempo (s) = arredondar para cima(caracteres ÷ CPM alvo × 60), mínimo 60
//   com repetições: esse tempo × N
//
// Sem nada do navegador: o seed do back (Node) importa este arquivo.
import type { Dificuldade } from '../nucleo/tipos.js';

/** Caracteres por minuto que cada dificuldade pede. */
export const CPM_ALVO: Record<Dificuldade, number> = { facil: 100, medio: 80, dificil: 60 };
export const TEMPO_MINIMO_S = 60;

/** `caracteres` de UMA passada do texto; `repeticoes` multiplica o tempo dela. */
export function tempoPelaDificuldade(caracteres: number, dificuldade: Dificuldade, repeticoes = 1): number {
  // × 60 antes de ÷: com inteiros a conta é exata (7 / 60 * 60 dá 7,000…1 e subiria para 8).
  const umaVez = Math.max(TEMPO_MINIMO_S, Math.ceil((caracteres * 60) / CPM_ALVO[dificuldade]));
  return umaVez * repeticoes;
}
