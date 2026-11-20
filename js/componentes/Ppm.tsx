// "PPM" por extenso: quem não conhece a sigla passa o mouse (ou o leitor de
// tela lê o title) e vê "palavras por minuto". Usado nos rótulos das telas
// (cabeçalho de tabela, métricas, HUD do treino).
import type { ReactNode } from 'react';

export const PPM_POR_EXTENSO = 'palavras por minuto';

/** O texto com cada "PPM" trocado por <abbr title="palavras por minuto">. */
export function comPpm(texto: string): ReactNode {
  if (!texto.includes('PPM')) return texto;
  const partes = texto.split('PPM');
  return partes.flatMap((parte, i) =>
    i === 0
      ? [parte]
      : [
          <abbr key={i} title={PPM_POR_EXTENSO}>
            PPM
          </abbr>,
          parte,
        ]
  );
}
