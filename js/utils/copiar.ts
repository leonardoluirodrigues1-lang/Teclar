// Copiar para a área de transferência com aviso. Sem a área de transferência
// (página fora de HTTPS, permissão negada), o aviso traz o próprio texto,
// para a pessoa copiar à mão — melhor que um erro que não ajuda ninguém.

import type { Toasts } from '../componentes/toast.js';

export async function copiarComAviso(texto: string, toasts: Toasts, mensagem = 'Copiado'): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toasts.mostrar(mensagem);
  } catch {
    toasts.mostrar(`Não foi possível copiar. Código: ${texto}`);
  }
}
