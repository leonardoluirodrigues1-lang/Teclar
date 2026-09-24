// teclasDoCaractere.ts
// Dado o PRÓXIMO caractere do texto do exercício, quais teclas do teclado
// ABNT2 a pessoa precisa apertar — é o que o teclado guia da tela de
// treino acende. A tecla sai do texto que VEM, nunca do que foi digitado.
//
// Quem usa: js/componentes/TecladoAbnt2.tsx. O check fica em
// teclasDoCaractere.check.mjs, ao lado.
//
// As regras:
//   · letra minúscula, espaço, pontuação básica — uma tecla;
//   · letra maiúscula — a letra E o Shift da mão contrária;
//   · letra acentuada — dois passos. Primeiro a tecla morta do acento (´ ou
//     ~, com Shift para ` e ^); depois de ela ser digitada, a vogal. Quem
//     diz em que passo se está é quem chama (`esperandoVogal`);
//   · caractere que não está no teclado desenhado — null, e nada acende.

import { DEDO_DA_TECLA, type Dedo } from '../componentes/dedosDoTeclado.js';

export interface TeclasParaDigitar {
  /** Ids das teclas a acender (ver TecladoAbnt2.tsx). */
  teclas: string[];
  /** O dedo da tecla principal — o que a legenda escreve. */
  dedo: Dedo;
  /** O dedo que segura o Shift, quando há Shift. */
  dedoDoShift: Dedo | null;
}

// Os acentos que o ABNT2 faz com tecla morta, pelo sinal que o Unicode
// separa da vogal (normalize('NFD')): qual tecla morta e se ela vai com
// Shift.
const TECLA_MORTA_DO_ACENTO: Record<string, { tecla: string; comShift: boolean }> = {
  '́': { tecla: '´', comShift: false }, // agudo: á
  '̀': { tecla: '´', comShift: true }, // grave: à
  '̃': { tecla: '~', comShift: false }, // til: ã
  '̂': { tecla: '~', comShift: true }, // circunflexo: â
};

// Pontuação que sai com Shift de uma tecla desenhada.
const PONTUACAO_COM_SHIFT: Record<string, string> = {
  ':': ';',
  '<': ',',
  '>': '.',
  '{': '[',
  '}': ']',
};

// O Shift é apertado pela mão que NÃO está na letra.
function shiftContrario(tecla: string): string {
  return DEDO_DA_TECLA[tecla].mao === 'esquerda' ? 'shift-direito' : 'shift-esquerdo';
}

// Uma tecla só, ou a tecla com o Shift da outra mão.
function montar(tecla: string, comShift: boolean): TeclasParaDigitar | null {
  if (!(tecla in DEDO_DA_TECLA)) return null;
  if (!comShift) return { teclas: [tecla], dedo: DEDO_DA_TECLA[tecla], dedoDoShift: null };
  const shift = shiftContrario(tecla);
  return { teclas: [tecla, shift], dedo: DEDO_DA_TECLA[tecla], dedoDoShift: DEDO_DA_TECLA[shift] };
}

// "A" -> maiúscula; "a", "1", "," -> não. Só conta como maiúscula o que
// muda ao virar minúscula.
function ehMaiuscula(caractere: string): boolean {
  return caractere !== caractere.toLowerCase();
}

// Letra, espaço ou pontuação, sem acento.
function teclasDoSimples(caractere: string): TeclasParaDigitar | null {
  if (caractere === ' ') return montar('espaco', false);
  if (caractere in PONTUACAO_COM_SHIFT) return montar(PONTUACAO_COM_SHIFT[caractere], true);
  return montar(caractere.toLowerCase(), ehMaiuscula(caractere));
}

export function teclasDoCaractere(
  caractere: string | null | undefined,
  esperandoVogal: boolean
): TeclasParaDigitar | null {
  if (!caractere) return null;

  // O ç tem tecla própria no ABNT2. Precisa vir antes do NFD, que o
  // separaria em "c" + cedilha.
  if (caractere === 'ç' || caractere === 'Ç') return teclasDoSimples(caractere);

  const [vogal, acento] = caractere.normalize('NFD');
  const morta = acento ? TECLA_MORTA_DO_ACENTO[acento] : undefined;

  // Sem acento conhecido: é um caractere simples (ou não está no teclado).
  if (!acento) return teclasDoSimples(caractere);
  if (!morta) return null; // ex.: ü — o trema não está no teclado desenhado

  // Segundo passo: a tecla morta já foi, falta a vogal (com Shift se for
  // maiúscula: "Á" é ´ e depois Shift + A).
  if (esperandoVogal) return teclasDoSimples(vogal);

  // Primeiro passo: a tecla morta.
  return montar(morta.tecla, morta.comShift);
}
