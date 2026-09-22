// ordenacao.ts
// A regra de ordenação das tabelas (componentes/Tabela.tsx diz qual
// cabeçalho foi clicado; quem ordena é a tela): nulo por último NAS DUAS
// DIREÇÕES. Quem não tem o dado não deve ficar pulando entre o topo e o
// fim da lista conforme o clique — ele não é "o menor", é "o sem".
//
// Texto compara com localeCompare em pt-BR, sem pesar acento nem caixa:
// "Ângela" fica entre "Amanda" e "Bruno", e não depois de "Zé" como com
// < e >. Número e data ISO (AAAA-MM-DD…, que já ordena como texto por
// ser de largura fixa) continuam com < e >.
//
// Cada tela entrega só o `valorDe`, que diz o que cada campo vale numa
// linha dela — inclusive um peso numérico para uma coluna de rótulos, como
// a dificuldade da Biblioteca.

import type { Ordenacao } from '../componentes/Tabela.js';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}/;

function comparar(va: string | number, vb: string | number): number {
  if (typeof va === 'string' && typeof vb === 'string' && !DATA_ISO.test(va) && !DATA_ISO.test(vb)) {
    return va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
  }
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

export function ordenar<T>(
  lista: T[],
  { campo, direcao }: Ordenacao,
  valorDe: (linha: T, campo: string) => string | number | null
): T[] {
  if (!campo) return lista;
  const sinal = direcao === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = valorDe(a, campo);
    const vb = valorDe(b, campo);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return comparar(va, vb) * sinal;
  });
}
