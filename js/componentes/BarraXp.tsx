// BarraXp.tsx
// A barra de XP do mundo Solo: quanto do nível atual já foi percorrido e
// quanto falta para o próximo. Nasceu em js/solo/Lobby.tsx e saiu de lá
// quando a tela de estatísticas (js/solo/Estatisticas.tsx) precisou da
// mesma barra — uma receita, dois lugares. As classes continuam as
// .lobby-xp* de css/solo.css, sem alteração.
//
// A regra do XP é a do config, não uma segunda conta feita aqui: quanto
// custa um nível está em CONFIG.SOLO.XP_POR_NIVEL, que espelha a tabela
// Configuracoes. O NÍVEL em si a barra não calcula: ele vem pronto na
// campanha (campanha.nivelAtual), como o back o gravou. Se o front
// recalculasse o nível a partir do XP, passaria a existir uma segunda
// verdade sobre a mesma coisa — e as duas divergiriam no dia em que a
// regra mudar no banco e não aqui.

import { useEffect, useState } from 'react';
import { CONFIG } from '../config.js';
import type { Campanha } from '../nucleo/tipos.js';

export interface ProgressoXp {
  /** O nível que a campanha diz ter. */
  nivel: number;
  /** XP acumulado DENTRO do nível atual. */
  noNivel: number;
  /** O que um nível custa. */
  porNivel: number;
  /** Quanto falta para o próximo. */
  falta: number;
  /** 0 a 100, para a largura da barra. */
  percentual: number;
}

export function progressoDe(campanha: Campanha): ProgressoXp {
  const porNivel = CONFIG.SOLO.XP_POR_NIVEL;
  // Math.max(0, ...) para um xpTotal torto não virar barra negativa.
  const xpTotal = Math.max(0, campanha.xpTotal ?? 0);
  const noNivel = xpTotal % porNivel;
  return {
    nivel: campanha.nivelAtual,
    noNivel,
    porNivel,
    falta: porNivel - noNivel,
    percentual: Math.round((noNivel / porNivel) * 100),
  };
}

export function movimentoReduzido(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function BarraXp({ progresso }: { progresso: ProgressoXp }) {
  // A barra crescendo de zero até a marca é o único movimento da tela.
  // Quem pediu menos movimento recebe a barra já no lugar final, sem
  // passar por zero — a informação é a mesma, só não se mexe.
  const [largura, setLargura] = useState(() =>
    movimentoReduzido() ? progresso.percentual : 0
  );

  useEffect(() => {
    if (movimentoReduzido()) {
      setLargura(progresso.percentual);
      return;
    }

    // Dois quadros: o primeiro pinta a barra em 0, o segundo muda a
    // largura e a transição do CSS acontece. Num quadro só, o navegador
    // agrupa as duas larguras e nada anima.
    let cancelado = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelado) setLargura(progresso.percentual);
      });
    });
    return () => {
      cancelado = true;
      cancelAnimationFrame(id);
    };
  }, [progresso.percentual]);

  return (
    <div className="lobby-xp">
      {/* O trilho é o progressbar, e ele fala em XP, não em porcentagem:
          quem ouve a tela recebe "130 de 200 XP", que é o número que
          aparece escrito logo abaixo. */}
      <div
        className="lobby-xp-trilho"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progresso.porNivel}
        aria-valuenow={progresso.noNivel}
        aria-valuetext={`${progresso.noNivel} de ${progresso.porNivel} XP`}
        aria-label={`Progresso para o nível ${progresso.nivel + 1}`}
      >
        <div className="lobby-xp-preenchimento" style={{ width: `${largura}%` }} />
      </div>
      <p className="lobby-xp-legenda">
        <strong>{progresso.noNivel}</strong> / {progresso.porNivel} XP
        {' · '}
        faltam {progresso.falta} para o nível {progresso.nivel + 1}
      </p>
    </div>
  );
}
