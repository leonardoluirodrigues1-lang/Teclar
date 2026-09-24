// TecladoAbnt2.tsx
// O desenho do teclado ABNT2, o teclado do projeto. Um componente só, em
// dois tamanhos:
//   · 'tutorial' — o do tutorial do Solo (js/solo/Tutorial.tsx): grande,
//                  com a linha-guia (A S D F J K L Ç) acesa;
//   · 'treino'   — o teclado guia da tela de treino (js/treino/Treino.tsx):
//                  menor e mais apagado, e quem acende é a PRÓXIMA tecla a
//                  digitar, com a marca do dedo e o nome do dedo embaixo.
//
// Como um teclado de verdade: as fileiras são desalinhadas (cada uma
// começa um pouco mais à direita que a de cima, porque as teclas de borda
// crescem) e as teclas têm larguras diferentes. A largura é medida em
// "unidades": 1 é uma tecla de letra, quadrada. Toda fileira soma 15
// unidades, para as bordas da direita baterem. F e J têm o risquinho de
// relevo que o dedo sente.
//
// É ilustração: nenhuma tecla se clica nem recebe foco, e o bloco inteiro
// é aria-hidden.
//
// Desempenho (o treino repinta a cada tecla): o componente é memo e só
// recebe o próximo caractere; cada <Tecla> também é memo e só muda quando
// ela mesma acende ou apaga. A cada caractere, só a tecla que perde e a que
// ganha o destaque são redesenhadas.

import { memo } from 'react';
import { DEDO_DA_TECLA, nomeDoDedo, type Dedo } from './dedosDoTeclado.js';
import { teclasDoCaractere, type TeclasParaDigitar } from '../utils/teclasDoCaractere.js';

export type TamanhoDoTeclado = 'tutorial' | 'treino';

// ============================================================================
// As teclas
// ============================================================================

interface TeclaDoDesenho {
  /** A chave em DEDO_DA_TECLA e em teclasDoCaractere. */
  id: string;
  rotulo: string;
  /** Em unidades: 1 = tecla de letra. */
  largura: number;
  /** Espaço vazio ao lado da barra de espaço: ocupa lugar, não é tecla. */
  vazia?: boolean;
}

const LINHA_GUIA = new Set(['a', 's', 'd', 'f', 'j', 'k', 'l', 'ç']);
const MARCA_DE_RELEVO = new Set(['f', 'j']);

// As teclas de uma unidade: o id é a letra em minúscula, o rótulo em
// maiúscula, como está gravado na tecla.
function teclasDeLetra(letras: string[]): TeclaDoDesenho[] {
  return letras.map((letra) => ({ id: letra, rotulo: letra.toUpperCase(), largura: 1 }));
}

const FILEIRAS: TeclaDoDesenho[][] = [
  // 1,5 + 12 + 1,5 = 15
  [
    { id: 'tab', rotulo: 'tab', largura: 1.5 },
    ...teclasDeLetra(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '´', '[']),
    { id: 'enter', rotulo: 'enter', largura: 1.5 },
  ],
  // 1,75 + 12 + 1,25 = 15. A última é a parte de baixo do Enter, que no
  // ABNT2 desce por duas fileiras.
  [
    { id: 'caps', rotulo: 'caps', largura: 1.75 },
    ...teclasDeLetra(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç', '~', ']']),
    { id: 'enter-baixo', rotulo: '', largura: 1.25 },
  ],
  // 2,25 + 10 + 2,75 = 15
  [
    { id: 'shift-esquerdo', rotulo: 'shift', largura: 2.25 },
    ...teclasDeLetra(['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', ';']),
    { id: 'shift-direito', rotulo: 'shift', largura: 2.75 },
  ],
  // 4 + 7 + 4 = 15: a barra de espaço, larga, no meio.
  [
    { id: 'vazio-esquerdo', rotulo: '', largura: 4, vazia: true },
    { id: 'espaco', rotulo: '', largura: 7 },
    { id: 'vazio-direito', rotulo: '', largura: 4, vazia: true },
  ],
];

// ============================================================================
// Onde fica cada tecla
// ============================================================================
// O centro de cada tecla, em unidades: x a partir da borda esquerda do
// teclado, y é a fileira (0 = a de cima). Sai de FILEIRAS, o mesmo desenho
// acima — é o que as mãos (componentes/MaosGuia.tsx) usam para saber para
// onde cada dedo aponta. Os espaços entre as teclas ficam de fora: para a
// mão, "a região da tecla" basta.

export interface CentroDaTecla {
  x: number;
  y: number;
}

function calcularCentros(): Map<string, CentroDaTecla> {
  const centros = new Map<string, CentroDaTecla>();
  FILEIRAS.forEach((fileira, y) => {
    let inicio = 0;
    for (const tecla of fileira) {
      centros.set(tecla.id, { x: inicio + tecla.largura / 2, y });
      inicio += tecla.largura;
    }
  });
  return centros;
}

const CENTROS = calcularCentros();

/** Centro da tecla em unidades, ou null se a tecla não está no desenho. */
export function centroDaTecla(id: string): CentroDaTecla | null {
  return CENTROS.get(id) ?? null;
}

/** A largura do teclado, em unidades: toda fileira soma isto. */
export const LARGURA_DO_TECLADO = 15;

// ============================================================================
// A marca do dedo
// ============================================================================
// Sem cor nova: o dedo se lê pela FORMA e pela POSIÇÃO da marca na base da
// tecla. Pontinhos — 1 no indicador, 2 no médio, 3 no anelar, 4 no mínimo —
// encostados no lado da mão (esquerda ou direita). O polegar é um traço
// comprido no meio.

const PONTOS_DO_DEDO: Record<string, number> = {
  indicador: 1,
  médio: 2,
  anelar: 3,
  mínimo: 4,
};

function MarcaDoDedo({ dedo }: { dedo: Dedo }) {
  if (dedo.mao == null) return <span className="teclado-marca-dedo teclado-marca-polegar" />;
  const pontos = Array.from({ length: PONTOS_DO_DEDO[dedo.nome] }, (_, i) => <i key={i} />);
  return <span className={`teclado-marca-dedo teclado-marca-${dedo.mao}`}>{pontos}</span>;
}

// ============================================================================
// Uma tecla
// ============================================================================

interface PropsTecla {
  tecla: TeclaDoDesenho;
  /** A próxima a digitar (só no treino). */
  acesa: boolean;
  /** Linha-guia acesa (só no tutorial). */
  guiaAcesa: boolean;
}

function classeDaTecla(tecla: TeclaDoDesenho, acesa: boolean, guiaAcesa: boolean): string {
  let classe = 'teclado-tecla tecla';
  if (tecla.largura === 1) classe += ' teclado-tecla-letra';
  if (MARCA_DE_RELEVO.has(tecla.id)) classe += ' teclado-tecla-relevo';
  if (acesa || guiaAcesa) classe += ' teclado-tecla-acesa tecla-clara';
  return classe;
}

// memo: só re-renderiza quando `acesa` ou `guiaAcesa` mudam — `tecla` é um
// objeto fixo de FILEIRAS e nunca muda de referência.
const Tecla = memo(function Tecla({ tecla, acesa, guiaAcesa }: PropsTecla) {
  // A largura vai no flex-grow: a tecla cresce na proporção das unidades.
  if (tecla.vazia) return <span className="teclado-vazio" style={{ flexGrow: tecla.largura }} />;
  return (
    <span className={classeDaTecla(tecla, acesa, guiaAcesa)} style={{ flexGrow: tecla.largura }}>
      {tecla.rotulo}
      {acesa && <MarcaDoDedo dedo={DEDO_DA_TECLA[tecla.id]} />}
    </span>
  );
});

// ============================================================================
// O teclado
// ============================================================================

// O que vai embaixo do teclado do treino: "indicador esquerdo", e o Shift
// quando há. Sem destaque, um espaço fixo, para a altura não pular.
function legendaDoDedo(destaque: TeclasParaDigitar | null): string {
  if (destaque == null) return ' ';
  const principal = nomeDoDedo(destaque.dedo);
  if (destaque.dedoDoShift == null) return principal;
  return `${principal} · Shift com o ${nomeDoDedo(destaque.dedoDoShift)}`;
}

interface PropsTeclado {
  tamanho: TamanhoDoTeclado;
  /** Só no treino: o próximo caractere do texto. null: nada acende. */
  caractere?: string | null;
  /** Só no treino: a tecla morta do acento já foi digitada, falta a vogal. */
  esperandoVogal?: boolean;
}

export const TecladoAbnt2 = memo(function TecladoAbnt2({
  tamanho,
  caractere = null,
  esperandoVogal = false,
}: PropsTeclado) {
  const noTreino = tamanho === 'treino';
  const destaque = noTreino ? teclasDoCaractere(caractere, esperandoVogal) : null;
  const acesas = new Set(destaque?.teclas ?? []);

  return (
    <div className={`teclado teclado-${tamanho}`} aria-hidden="true">
      <div className="teclado-fileiras">
        {FILEIRAS.map((fileira, i) => (
          <div className="teclado-fileira" key={i}>
            {fileira.map((tecla) => (
              <Tecla
                key={tecla.id}
                tecla={tecla}
                acesa={acesas.has(tecla.id)}
                guiaAcesa={!noTreino && LINHA_GUIA.has(tecla.id)}
              />
            ))}
          </div>
        ))}
      </div>
      {noTreino && <p className="teclado-legenda">{legendaDoDedo(destaque)}</p>}
    </div>
  );
});
