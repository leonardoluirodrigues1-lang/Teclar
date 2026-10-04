// Estrela.tsx
// A estrela de quatro pontas, desenhada à mão em SVG. É o símbolo de
// CONQUISTA do site e só aparece onde houve uma: lição concluída, dia
// treinado, recorde batido, nível que subiu, exercício entregue, melhor
// número da turma, toast de acertos seguidos. Nunca como ícone de menu,
// marcador de lista, separador nem enfeite.
//
// Quem usa: solo/Caminho.tsx, solo/Lobby.tsx, treino/Resultado.tsx,
// professor/Relatorios.tsx, aluno/Dashboard.tsx (sala com tudo feito),
// aluno/Sala.tsx (primeiro lugar do ranking) e componentes/toast.ts.
//
// Duas formas:
//   · clara  — branca com brilho em volta, para fundo escuro;
//   · escura — preta sem brilho, para dentro de superfície clara (a pedra
//              concluída, o dia com treino).
//
// Sempre aria-hidden: é desenho. Onde ela é a única informação, quem a
// usa escreve o significado em texto (rótulo do botão ou texto sr-only).
//
// O estilo vai inline, e não numa folha CSS, porque a estrela entra em
// lugares cujas folhas já estilizam "svg" (ex.: `.pedra svg` em solo.css
// tira o preenchimento e põe contorno). Inline, nenhuma regra de fora
// muda o desenho.
//
// Com `nasce`, a estrela chega com o pulso de conquista nova: cresce um
// pouco além do tamanho e assenta, e na clara um brilho em volta sobe e
// volta (.estrela-nasce, css/base/movimento.css). Só para a conquista que
// acabou de acontecer — quem decide é js/utils/estrelasJaVistas.ts.

import { useId, useState } from 'react';
import type { CSSProperties } from 'react';

interface PropsEstrela {
  /** Largura e altura, em px. */
  tamanho: number;
  /** De 0 a 1. A estrela apagada do "tempo esgotado" usa 0.3. */
  opacidade?: number;
  forma?: 'clara' | 'escura';
  /** Conquista nova: nasce com o pulso. Lido só ao montar. */
  nasce?: boolean;
}

// A mesma cor do número escuro da pedra concluída (.pedra-feita em solo.css).
const COR_ESCURA = 'rgba(0, 0, 0, 0.72)';

// As quatro pontas: de cada ponta até a seguinte, uma curva que passa
// perto do centro. Quanto menor o `miolo`, mais finas as pontas.
function caminhoDaEstrela(tamanho: number): string {
  const r = tamanho / 2;
  const m = r * 0.22;
  return (
    `M0 ${-r} C ${m} ${-m} ${m} ${-m} ${r} 0 ` +
    `C ${m} ${m} ${m} ${m} 0 ${r} ` +
    `C ${-m} ${m} ${-m} ${m} ${-r} 0 ` +
    `C ${-m} ${-m} ${-m} ${-m} 0 ${-r} Z`
  );
}

export function Estrela({ tamanho, opacidade = 1, forma = 'clara', nasce = false }: PropsEstrela) {
  // Guardado ao montar: se a tela redesenhar no meio do pulso e o `nasce`
  // vier false, a classe fica e a animação não é cortada.
  const [pulsa] = useState(nasce);
  const idDoBrilho = useId();
  const clara = forma === 'clara';
  const estilo: CSSProperties = {
    display: 'inline-block',
    flex: 'none',
    verticalAlign: 'middle',
    width: tamanho,
    height: tamanho,
    fill: clara ? '#fff' : COR_ESCURA,
    stroke: 'none',
    opacity: opacidade,
    filter: clara ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.65))' : 'none',
    // O brilho do pulso passa da caixa da estrela.
    overflow: 'visible',
  };
  const r = tamanho / 2;

  return (
    <svg
      className={pulsa ? 'estrela estrela-nasce' : 'estrela'}
      style={estilo}
      viewBox={`${-r} ${-r} ${tamanho} ${tamanho}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* O brilho que sobe e volta no pulso. Um gradiente parado, e só a
          opacidade anima: um filtro animado recalcularia o desfoque a cada
          quadro. Começa em 0, então sem a animação ele não aparece. A
          escura fica sem: ela mora em superfície clara, onde brilho branco
          não se vê. */}
      {pulsa && clara && (
        <>
          <defs>
            <radialGradient id={idDoBrilho}>
              <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className="estrela-brilho" r={tamanho} fill={`url(#${idDoBrilho})`} style={{ opacity: 0 }} />
        </>
      )}
      <path d={caminhoDaEstrela(tamanho)} />
    </svg>
  );
}
