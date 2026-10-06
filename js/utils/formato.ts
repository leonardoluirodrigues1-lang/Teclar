// formato.ts
// As portas de formatação de dado das telas de números: null e undefined
// viram "—"; zero é 0. Nunca "null", nunca "NaN", nunca 0 no lugar de um
// dado que não veio.
//
// Saíram de js/aluno/Historico.tsx quando a tela de estatísticas do Solo
// precisou das mesmas. Relatorios.tsx e Turma.tsx ainda carregam a própria
// cópia de numero/porcentagem/formatarDataHora — são as mesmas regras, e
// podem passar a importar daqui quando forem tocados.
//
// (Havia um js/utils/formato.js vazio, placeholder da época em que tudo
// era JS; foi apagado para este .ts poder nascer sem colidir com o .js que
// o tsc gera ao lado — ver a nota sobre caixa de nome em tsconfig.json.)

export function numero(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '—' : formatarDecimal(valor);
}

export function porcentagem(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '—' : `${formatarDecimal(valor)}%`;
}

export function contagem(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '—' : String(valor);
}

// Vírgula decimal, e só quando há decimal: 38 é "38", 12.8 é "12,8".
export function formatarDecimal(valor: number): string {
  return String(valor).replace('.', ',');
}

// 'AAAA-MM-DDTHH:MM...' -> 'DD/MM/AAAA HH:MM', sem Date() no meio: o app
// mostra o horário como o registro o gravou, sem converter fuso.
export function formatarDataHora(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const [, ano, mes, dia, hora, minuto] = m;
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

// 'AAAA-MM-DD...' -> 'DD/MM/AAAA'. Sem data, "—".
export function formatarData(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

