// Repetições de uma atividade da turma (AtribuicoesProf.Repeticoes, 1 a 5):
// o aluno digita o texto N vezes num bloco só, separado por espaço, com um
// cronômetro só (o tempo limite × N), igual à lição do Solo (montarLicao em
// js/nucleo/licoes.ts). O texto guardado no exercício não muda: a repetição
// é montada na hora em que o aluno recebe o texto.
import { dadosInvalidos } from '../dados-invalidos.js';

export const REPETICOES_MINIMO = 1;
export const REPETICOES_MAXIMO = 5;

export function textoRepetido(texto: string, repeticoes: number): string {
  return Array(repeticoes).fill(texto).join(' ');
}

// Sem limite (0) continua sem limite.
export function tempoRepetido(tempoLimiteSegundos: number, repeticoes: number): number {
  return tempoLimiteSegundos * repeticoes;
}

// Inteiro de 1 a 5; ausente é 1. Qualquer outra coisa é 400.
export function repeticoesValidas(valor: unknown): number {
  if (valor === undefined) {
    return REPETICOES_MINIMO;
  }
  if (!Number.isInteger(valor) || (valor as number) < REPETICOES_MINIMO || (valor as number) > REPETICOES_MAXIMO) {
    throw dadosInvalidos(`repeticoes precisa ser um número inteiro de ${REPETICOES_MINIMO} a ${REPETICOES_MAXIMO}.`);
  }
  return valor as number;
}
