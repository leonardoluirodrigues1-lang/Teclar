// sessao-escola.ts
// A sessão do mundo Escola (tabela SessionsProf) na forma do contrato, e as
// duas contas de média que toda rota com sessão faz. Ficam aqui porque
// alunos, relatórios, sessões e ranking devolvem a mesma sessão e a mesma
// média: um lugar só, para nenhuma rota arredondar diferente da outra.
import type { Prisma } from '../generated/prisma/client.js';

// Uma sessão do mundo Escola, na forma do tipo Sessao do front
// (js/nucleo/tipos.ts).
export interface Sessao {
  id: string;
  exerciseId: string;
  alunoId: string;
  wpm: number;
  precisao: number;
  tempoSegundos: number;
  acertos: number;
  erros: number;
  concluida: boolean;
  data: string;
}

export type LinhaDeSessao = Prisma.sessionsprofGetPayload<object>;

export function sessaoNaForma(linha: LinhaDeSessao): Sessao {
  // WPM e Precisao são DECIMAL no banco (o Prisma devolve Decimal): Number
  // para a resposta sair como número no JSON, e não como texto.
  return {
    id: linha.ID,
    exerciseId: linha.ExerciseID,
    alunoId: linha.AlunoID,
    wpm: Number(linha.WPM ?? 0),
    precisao: Number(linha.Precisao ?? 0),
    tempoSegundos: linha.Tempo_Gasto_Segundos ?? 0,
    acertos: linha.Acertos ?? 0,
    erros: linha.Erros ?? 0,
    concluida: linha.Concluida,
    data: linha.Data_Sessao?.toISOString() ?? '',
  };
}

// Média inteira, ou null sem amostra. Null, e não 0: zero diria "treinou e
// fez 0 PPM", e a tela mostra "—" para null.
export function mediaInteira(numeros: number[]): number | null {
  if (numeros.length === 0) {
    return null;
  }
  const soma = numeros.reduce((total, numero) => total + numero, 0);
  return Math.round(soma / numeros.length);
}

// O _avg do Prisma: Decimal, ou null quando não há linha para a média.
export function arredondarOuNull(valor: Prisma.Decimal | null | undefined): number | null {
  return valor === null || valor === undefined ? null : Math.round(Number(valor));
}
