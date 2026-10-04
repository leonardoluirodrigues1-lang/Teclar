// NumeroQueConta.tsx
// Um número que conta do zero até o valor, em vez de aparecer pronto. Só
// para o número que é a CONQUISTA da tela: o desempenho do treino
// (treino/BlocoDeMetricas.tsx, na tela de resultado e no modal de fim), o XP
// do resultado e o dashboard do Solo (solo/Lobby.tsx).
// Nunca em tabela, relatório ou lista: quem está comparando números
// precisa lê-los parados.
//
// As regras:
//   · dura --t-tela (css/base/movimento.css) e desacelera no fim;
//   · o valor final é escrito EXATO, com o formato de sempre, mesmo que a
//     contagem seja interrompida (aba em segundo plano, por exemplo);
//   · tabular-nums: todos os algarismos com a mesma largura, para o número
//     não tremer enquanto conta;
//   · com movimento reduzido o token vale 0ms, e o número já nasce final;
//   · quem ouve a tela recebe só o valor final (a contagem é aria-hidden).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { duracaoDoToken } from '../utils/movimento.js';

interface PropsNumeroQueConta {
  /** null ou não finito: não conta, mostra formatar(valor) (o "—"). */
  valor: number | null | undefined;
  /** Escreve o número. O padrão é String, como `{valor}` no JSX. */
  formatar?: (valor: number | null | undefined) => string;
}

// Visível só para o leitor de tela. Inline porque resultado.css não tem a
// classe .sr-only das outras folhas.
const SO_PARA_LEITOR: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// Rápido no começo, pousando no fim — o mesmo desenho da --curva do CSS.
// ponytail: aproximação cúbica da --curva, e não a bézier lida do token;
// ler e resolver a bézier em JS só vale se o ritmo do CSS mudar muito.
function desacelerar(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function podeContar(valor: number | null | undefined): boolean {
  return valor != null && Number.isFinite(valor) && valor !== 0;
}

export function NumeroQueConta({ valor, formatar = String }: PropsNumeroQueConta) {
  // De 0 (começo da contagem) a 1 (valor final). Já nasce 1 quando não há
  // o que contar, ou com movimento reduzido: nem um quadro de "0".
  const [progresso, setProgresso] = useState(() =>
    podeContar(valor) && duracaoDoToken('--t-tela', 300) > 0 ? 0 : 1
  );

  useEffect(() => {
    const duracao = duracaoDoToken('--t-tela', 300);
    if (!podeContar(valor) || duracao === 0) {
      setProgresso(1);
      return;
    }

    const inicio = performance.now();
    let pedido = requestAnimationFrame(function quadro(agora) {
      const t = Math.min(1, (agora - inicio) / duracao);
      setProgresso(desacelerar(t));
      if (t < 1) pedido = requestAnimationFrame(quadro);
    });
    // O requestAnimationFrame para em aba de fundo. Este timer garante o
    // valor final mesmo assim.
    const garantia = window.setTimeout(() => setProgresso(1), duracao + 100);

    return () => {
      cancelAnimationFrame(pedido);
      window.clearTimeout(garantia);
    };
  }, [valor]);

  const final = formatar(valor);
  // No meio da contagem, só inteiros: "12,8" conta 0, 1, 2… e termina no
  // formato exato.
  const mostrado = progresso >= 1 ? final : formatar(Math.round(valor * progresso));

  return (
    <>
      <span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {mostrado}
      </span>
      <span style={SO_PARA_LEITOR}>{final}</span>
    </>
  );
}
