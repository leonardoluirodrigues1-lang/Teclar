// dedosDoTeclado.ts
// Qual dedo aperta cada tecla do teclado ABNT2, pela digitação de dez
// dedos. É DADO, não lógica: uma tabela tecla → dedo, uma linha por tecla.
//
// Quem usa: js/componentes/TecladoAbnt2.tsx, para desenhar a marca do dedo
// na tecla acesa e escrever "indicador esquerdo" embaixo do teclado; e
// js/utils/teclasDoCaractere.ts, para saber de que lado fica o Shift (o
// Shift é sempre o da mão contrária à da letra).
//
// As chaves são os ids das teclas desenhadas em TecladoAbnt2.tsx: a própria
// letra ou sinal, em minúscula, e um nome para as teclas de borda.

export type Mao = 'esquerda' | 'direita';
export type NomeDoDedo = 'mínimo' | 'anelar' | 'médio' | 'indicador' | 'polegar';

export interface Dedo {
  /** null só para o polegar, que aperta o espaço com qualquer mão. */
  mao: Mao | null;
  nome: NomeDoDedo;
}

const MINIMO_ESQUERDO: Dedo = { mao: 'esquerda', nome: 'mínimo' };
const ANELAR_ESQUERDO: Dedo = { mao: 'esquerda', nome: 'anelar' };
const MEDIO_ESQUERDO: Dedo = { mao: 'esquerda', nome: 'médio' };
const INDICADOR_ESQUERDO: Dedo = { mao: 'esquerda', nome: 'indicador' };
const INDICADOR_DIREITO: Dedo = { mao: 'direita', nome: 'indicador' };
const MEDIO_DIREITO: Dedo = { mao: 'direita', nome: 'médio' };
const ANELAR_DIREITO: Dedo = { mao: 'direita', nome: 'anelar' };
const MINIMO_DIREITO: Dedo = { mao: 'direita', nome: 'mínimo' };
const POLEGAR: Dedo = { mao: null, nome: 'polegar' };

export const DEDO_DA_TECLA: Record<string, Dedo> = {
  // Fileira de cima
  'tab': MINIMO_ESQUERDO,
  'q': MINIMO_ESQUERDO,
  'w': ANELAR_ESQUERDO,
  'e': MEDIO_ESQUERDO,
  'r': INDICADOR_ESQUERDO,
  't': INDICADOR_ESQUERDO,
  'y': INDICADOR_DIREITO,
  'u': INDICADOR_DIREITO,
  'i': MEDIO_DIREITO,
  'o': ANELAR_DIREITO,
  'p': MINIMO_DIREITO,
  '´': MINIMO_DIREITO,
  '[': MINIMO_DIREITO,
  'enter': MINIMO_DIREITO,

  // Fileira do meio (a linha-guia)
  'caps': MINIMO_ESQUERDO,
  'a': MINIMO_ESQUERDO,
  's': ANELAR_ESQUERDO,
  'd': MEDIO_ESQUERDO,
  'f': INDICADOR_ESQUERDO,
  'g': INDICADOR_ESQUERDO,
  'h': INDICADOR_DIREITO,
  'j': INDICADOR_DIREITO,
  'k': MEDIO_DIREITO,
  'l': ANELAR_DIREITO,
  'ç': MINIMO_DIREITO,
  '~': MINIMO_DIREITO,
  ']': MINIMO_DIREITO,
  'enter-baixo': MINIMO_DIREITO,

  // Fileira de baixo
  'shift-esquerdo': MINIMO_ESQUERDO,
  'z': MINIMO_ESQUERDO,
  'x': ANELAR_ESQUERDO,
  'c': MEDIO_ESQUERDO,
  'v': INDICADOR_ESQUERDO,
  'b': INDICADOR_ESQUERDO,
  'n': INDICADOR_DIREITO,
  'm': INDICADOR_DIREITO,
  ',': MEDIO_DIREITO,
  '.': ANELAR_DIREITO,
  ';': MINIMO_DIREITO,
  'shift-direito': MINIMO_DIREITO,

  // Espaço
  'espaco': POLEGAR,
};

/** "indicador esquerdo", "mínimo direito", "polegar". */
export function nomeDoDedo(dedo: Dedo): string {
  if (dedo.mao == null) return dedo.nome;
  const lado = dedo.mao === 'esquerda' ? 'esquerdo' : 'direito';
  return `${dedo.nome} ${lado}`;
}
