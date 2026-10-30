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

// Os usuários estão no Brasil, e o back manda os horários em UTC ("...Z").
// Sem converter, uma sessão às 22h aparecia como 01h do dia seguinte. É a
// mesma regra do diaDe do back (back/src/sessoes/dias-seguidos.ts): UTC-3
// fixo, porque o Brasil não tem horário de verão desde 2019.
const FUSO_DE_BRASILIA_EM_MILISSEGUNDOS = -3 * 60 * 60 * 1000;

// Horário com fuso -> o mesmo instante no relógio de Brasília, sem fuso
// ('2026-10-30T01:00:00.000Z' -> '2026-10-29T22:00:00'). Sai sem fuso de
// propósito: passar de novo por aqui não converte duas vezes. Data sem hora
// ('2026-10-03') e horário sem fuso já são o dia de quem vê: voltam iguais.
export function emBrasilia(iso: string): string {
  const texto = String(iso);
  if (!/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(texto)) return texto;
  const instante = Date.parse(texto);
  if (Number.isNaN(instante)) return texto;
  return new Date(instante + FUSO_DE_BRASILIA_EM_MILISSEGUNDOS).toISOString().slice(0, 19);
}

// 'AAAA-MM-DDTHH:MM...' -> 'DD/MM/AAAA HH:MM', no relógio de Brasília.
export function formatarDataHora(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(emBrasilia(iso));
  if (!m) return String(iso);
  const [, ano, mes, dia, hora, minuto] = m;
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

// 'AAAA-MM-DD...' -> 'DD/MM/AAAA', no calendário de Brasília. Sem data, "—".
export function formatarData(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(emBrasilia(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

