// dias-seguidos.ts
// "Dias seguidos com sessão, terminando hoje ou ontem; senão 0": a conta
// que o ranking, o resumo do aluno e o relatório dele na sala fazem. Fica
// num lugar só para as três rotas nunca discordarem do mesmo número (o
// aluno vê os três na mesma tarde).
//
// É a mesma conta do front (sequenciaDeDias, em js/utils/desempenho.ts),
// repetida aqui porque o back não importa código do front. O dia é o do
// calendário de Brasília (ver diaDe); o front ainda conta em UTC.

// O que a conta precisa de cada sessão: só a data.
interface ComData {
  Data_Sessao: Date | null;
}

const UM_DIA_EM_MILISSEGUNDOS = 24 * 60 * 60 * 1000;

// Quantos dias seguidos com sessão, contando para trás a partir do dia mais
// recente — que tem de ser hoje ou ontem, senão a sequência já quebrou e
// vale 0. Duas sessões no mesmo dia contam um dia.
export function contarDiasSeguidos(sessoes: ComData[], agora: Date = new Date()): number {
  const hoje = diaDe(agora);
  const dias = [...new Set(sessoes.filter((s) => s.Data_Sessao).map((s) => diaDe(s.Data_Sessao as Date)))]
    .sort()
    .reverse();
  if (dias.length === 0) {
    return 0;
  }
  if (dias[0] !== hoje && dias[0] !== somarDias(hoje, -1)) {
    return 0;
  }
  let total = 1;
  for (let i = 1; i < dias.length; i++) {
    if (dias[i] !== somarDias(dias[i - 1], -1)) {
      break;
    }
    total++;
  }
  return total;
}

// Os usuários estão no Brasil. Em UTC, uma sessão depois das 21h caía no
// dia seguinte — e quebrava, ou inventava, dias seguidos. UTC-3 fixo: o
// Brasil não tem horário de verão desde 2019.
const FUSO_DE_BRASILIA_EM_MILISSEGUNDOS = -3 * 60 * 60 * 1000;

// Date -> "AAAA-MM-DD" no calendário de Brasília. Também é o "só a data"
// das rotas que devolvem dia (turma criada, aluno entrou, atribuído em).
export function diaDe(data: Date): string {
  return new Date(data.getTime() + FUSO_DE_BRASILIA_EM_MILISSEGUNDOS).toISOString().slice(0, 10);
}

// "AAAA-MM-DD" mais (ou menos) N dias. O T00:00:00Z fixo deixa a conta
// longe de fuso e de horário de verão.
function somarDias(dia: string, quantos: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + quantos * UM_DIA_EM_MILISSEGUNDOS).toISOString().slice(0, 10);
}
