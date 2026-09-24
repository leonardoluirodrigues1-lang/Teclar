// MaosGuia.tsx
// As duas mãos vistas de cima, embaixo do teclado guia da tela de treino
// (js/treino/Treino.tsx). Desenho à mão, em SVG escrito aqui mesmo: traço
// fino e claro, sem preenchimento. Estilizado de propósito — uma forma
// simples para a palma e cinco dedos alongados —, porque linha simples erra
// menos que tentativa de realismo.
//
// As mãos descansam na linha-guia: a esquerda sobre A S D F, a direita
// sobre J K L Ç, os polegares na barra de espaço. A posição de cada dedo
// sai do mesmo desenho do teclado (centroDaTecla, em TecladoAbnt2.tsx) e o
// dono de cada tecla, do mesmo mapa de dedos (dedosDoTeclado.ts) — não há
// segunda tabela.
//
// Quando uma tecla acende, o dedo dela acende e dá um toque curto na
// direção da tecla, e volta. Só o dedo, nunca a mão. Tecla com Shift: o
// mínimo da outra mão também reage (o Shift é uma das teclas acesas, e o
// dono dele é esse dedo). Espaço: os dois polegares.
//
// Desempenho: o componente é memo e só recebe o próximo caractere; cada
// <Dedo> também é memo e só muda quando ele mesmo acende, apaga ou troca de
// alvo. O movimento é só transform e opacity (css/componentes/teclado.css).

import { memo } from 'react';
import { centroDaTecla, LARGURA_DO_TECLADO } from './TecladoAbnt2.js';
import { DEDO_DA_TECLA, type Mao, type NomeDoDedo } from './dedosDoTeclado.js';
import { teclasDoCaractere } from '../utils/teclasDoCaractere.js';

// ============================================================================
// Medidas do desenho
// ============================================================================
// O viewBox tem a largura do teclado: 10 pontos por unidade de tecla. Assim,
// com o SVG na mesma largura do teclado, o x de um dedo é o x da tecla dele.

const PONTOS_POR_UNIDADE = 10;
const LARGURA = LARGURA_DO_TECLADO * PONTOS_POR_UNIDADE;
const ALTURA = 54;

const PALMA_TOPO = 28; // onde os dedos nascem
const PALMA_BASE = 50;
const RAIO_DO_DEDO = 4; // metade da largura do dedo

// Onde fica a ponta de cada dedo: o médio é o mais comprido, o mínimo o
// mais curto.
const PONTA_DO_DEDO: Record<Exclude<NomeDoDedo, 'polegar'>, number> = {
  indicador: 6,
  médio: 2,
  anelar: 5,
  mínimo: 12,
};

// O polegar: comprimento e inclinação em direção à barra de espaço.
const COMPRIMENTO_DO_POLEGAR = 16;
const INCLINACAO_DO_POLEGAR = 20; // graus
const ALTURA_DA_BASE_DO_POLEGAR = 44;

// Quanto o dedo anda no toque, em pontos do viewBox: um gesto, não um
// deslocamento até a tecla.
const ALCANCE = 3.5;

// Em que tecla cada dedo descansa. O polegar descansa no espaço.
const TECLA_DE_DESCANSO: Record<NomeDoDedo, { esquerda: string; direita: string }> = {
  mínimo: { esquerda: 'a', direita: 'ç' },
  anelar: { esquerda: 's', direita: 'l' },
  médio: { esquerda: 'd', direita: 'k' },
  indicador: { esquerda: 'f', direita: 'j' },
  polegar: { esquerda: 'espaco', direita: 'espaco' },
};

// ============================================================================
// Os dedos
// ============================================================================

interface DedoDaMao {
  id: string;
  mao: Mao;
  nome: NomeDoDedo;
  /** A tecla em que ele descansa. */
  descanso: string;
  /** O traço do dedo (U invertido, aberto embaixo, sobre a palma). */
  caminho: string;
  /** Só o polegar: ele é desenhado em pé e girado para a barra de espaço. */
  transformacao?: string;
}

// x da tecla, em pontos do viewBox.
function xDaTecla(id: string): number {
  return (centroDaTecla(id)?.x ?? 0) * PONTOS_POR_UNIDADE;
}

// Um dedo reto: sobe da palma até a ponta arredondada e desce de novo.
function caminhoDoDedo(x: number, ponta: number): string {
  const r = RAIO_DO_DEDO;
  return `M ${x - r} ${PALMA_TOPO} V ${ponta + r} A ${r} ${r} 0 0 1 ${x + r} ${ponta + r} V ${PALMA_TOPO}`;
}

// O polegar, desenhado em pé com a base na origem; a transformação o leva
// ao lado da palma e o inclina.
function caminhoDoPolegar(): string {
  const r = RAIO_DO_DEDO;
  const topo = -COMPRIMENTO_DO_POLEGAR + r;
  return `M ${-r} 0 V ${topo} A ${r} ${r} 0 0 1 ${r} ${topo} V 0`;
}

// Lado da mão: -1 na esquerda (os dedos seguem para a esquerda a partir do
// indicador), +1 na direita.
function sentido(mao: Mao): number {
  return mao === 'esquerda' ? -1 : 1;
}

function montarDedos(): DedoDaMao[] {
  const dedos: DedoDaMao[] = [];
  const maos: Mao[] = ['esquerda', 'direita'];
  for (const mao of maos) {
    for (const nome of ['mínimo', 'anelar', 'médio', 'indicador'] as const) {
      const descanso = TECLA_DE_DESCANSO[nome][mao];
      dedos.push({
        id: `${mao}-${nome}`,
        mao,
        nome,
        descanso,
        caminho: caminhoDoDedo(xDaTecla(descanso), PONTA_DO_DEDO[nome]),
      });
    }
    // O polegar sai do lado de dentro da palma, junto do indicador, e
    // inclina para o meio, onde fica a barra de espaço.
    const s = sentido(mao);
    const xBase = xDaTecla(TECLA_DE_DESCANSO.indicador[mao]) - s * 4.5;
    dedos.push({
      id: `${mao}-polegar`,
      mao,
      nome: 'polegar',
      descanso: 'espaco',
      caminho: caminhoDoPolegar(),
      transformacao: `translate(${xBase} ${ALTURA_DA_BASE_DO_POLEGAR}) rotate(${-s * INCLINACAO_DO_POLEGAR})`,
    });
  }
  return dedos;
}

const DEDOS = montarDedos();

// ============================================================================
// As palmas
// ============================================================================

// A palma: aberta em cima (os dedos fecham esse lado), do lado de fora do
// mínimo até o lado de dentro do indicador, com a base arredondada.
function caminhoDaPalma(mao: Mao): string {
  const s = sentido(mao);
  const xi = xDaTecla(TECLA_DE_DESCANSO.indicador[mao]);
  const xm = xDaTecla(TECLA_DE_DESCANSO.mínimo[mao]);
  return [
    `M ${xm + s * RAIO_DO_DEDO} ${PALMA_TOPO}`,
    `Q ${xm + s * 6} 42 ${xm - s * 5} ${PALMA_BASE}`,
    `L ${xi + s * 2} ${PALMA_BASE}`,
    `Q ${xi - s * 6} 47 ${xi - s * 5} 38`,
    `L ${xi - s * RAIO_DO_DEDO} ${PALMA_TOPO}`,
  ].join(' ');
}

// Sem props: desenhada uma vez e nunca mais.
const Palmas = memo(function Palmas() {
  return (
    <g className="maos-palma">
      <path d={caminhoDaPalma('esquerda')} />
      <path d={caminhoDaPalma('direita')} />
    </g>
  );
});

// ============================================================================
// O toque
// ============================================================================

// Para onde o dedo anda: na direção da tecla, a partir da tecla em que ele
// descansa, sempre com o mesmo tamanho (ALCANCE). Se a tecla é a própria
// tecla de descanso, um toque curto para cima, em direção ao teclado.
function movimentoAte(dedo: DedoDaMao, tecla: string): { dx: number; dy: number } {
  const de = centroDaTecla(dedo.descanso);
  const ate = centroDaTecla(tecla);
  if (!de || !ate) return { dx: 0, dy: 0 };
  const dx = ate.x - de.x;
  const dy = ate.y - de.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia === 0) return { dx: 0, dy: -ALCANCE * 0.7 };
  return { dx: (dx / distancia) * ALCANCE, dy: (dy / distancia) * ALCANCE };
}

// Qual tecla acesa é de qual dedo. O polegar (mão null no mapa) é dos
// dois lados.
function alvosDosDedos(teclas: string[]): Map<string, string> {
  const alvos = new Map<string, string>();
  for (const tecla of teclas) {
    const dono = DEDO_DA_TECLA[tecla];
    for (const dedo of DEDOS) {
      const mesmaMao = dono.mao == null || dono.mao === dedo.mao;
      if (dedo.nome === dono.nome && mesmaMao) alvos.set(dedo.id, tecla);
    }
  }
  return alvos;
}

// ============================================================================
// Um dedo
// ============================================================================

interface PropsDedo {
  dedo: DedoDaMao;
  aceso: boolean;
  dx: number;
  dy: number;
}

// memo: `dedo` é um objeto fixo de DEDOS, e o resto são números e um
// booleano. Um dedo que não muda não é redesenhado.
const Dedo = memo(function Dedo({ dedo, aceso, dx, dy }: PropsDedo) {
  // O alcance vai em variáveis CSS; a animação (teclado.css) lê de lá.
  const estilo = { '--dx': `${dx}px`, '--dy': `${dy}px` } as React.CSSProperties;
  return (
    <g className={aceso ? 'maos-dedo maos-dedo-aceso' : 'maos-dedo'} style={estilo}>
      <path d={dedo.caminho} transform={dedo.transformacao} />
    </g>
  );
});

// ============================================================================
// As mãos
// ============================================================================

interface PropsMaos {
  /** O próximo caractere do texto. null: nenhum dedo acende. */
  caractere: string | null;
  /** A tecla morta do acento já foi digitada, falta a vogal. */
  esperandoVogal: boolean;
}

export const MaosGuia = memo(function MaosGuia({ caractere, esperandoVogal }: PropsMaos) {
  const destaque = teclasDoCaractere(caractere, esperandoVogal);
  const alvos = alvosDosDedos(destaque?.teclas ?? []);

  return (
    <svg className="maos" viewBox={`0 0 ${LARGURA} ${ALTURA}`} aria-hidden="true">
      <Palmas />
      {DEDOS.map((dedo) => {
        const alvo = alvos.get(dedo.id) ?? null;
        const { dx, dy } = alvo ? movimentoAte(dedo, alvo) : { dx: 0, dy: 0 };
        // A key muda com o alvo: um dedo que troca de tecla sem apagar
        // (de F para G) é montado de novo e o toque roda outra vez. Só
        // esse dedo; os outros nove ficam como estão.
        return <Dedo key={`${dedo.id}:${alvo ?? ''}`} dedo={dedo} aceso={alvo != null} dx={dx} dy={dy} />;
      })}
    </svg>
  );
});
