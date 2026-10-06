// Tutorial.tsx — o tutorial de primeira vez do modo Professor
// Três passos: o que o modo faz (salas e alunos), como o aluno entra (pelo
// código da sala e pelo nome) e o que os relatórios mostram. À esquerda o texto e três
// itens com ícone; à direita, um desenho em SVG escrito à mão.
//
// Este arquivo só tem o CONTEÚDO. A estrutura — passos, pontinhos, "Pular"
// e "Continuar" — é a de componentes/TelaDeTutorial.tsx, a mesma do
// tutorial do Solo. As classes dos desenhos (.desenho-*) estão em
// css/componentes/tutorial.css.
//
// Quem usa: js/professor/Turmas.tsx, que mostra esta tela no lugar das
// turmas enquanto sessao.tutorialVisto('professor') for false.
//
// Os desenhos são aria-hidden: o texto ao lado já diz o que eles mostram.
// Os rótulos em mono dentro deles foram postos longe das formas, para
// nenhum cair por cima de uma linha, de um bonequinho ou de uma barra.

import { Estrela } from '../componentes/Estrela.js';
import { TelaDeTutorial, type PassoDoTutorial } from '../componentes/TelaDeTutorial.js';
import { IconeEstrela, IconeGrafico, IconePessoa, IconeTeclado } from '../componentes/IconesDoTutorial.js';

// ============================================================================
// Ícones que só o Professor usa — SVG traçado em linha, feitos à mão
// (os comuns aos dois tutoriais estão em componentes/IconesDoTutorial.tsx)
// ============================================================================

// Uma sala: a moldura com as divisões de uma planta.
function IconeSala() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v16" />
    </svg>
  );
}

function IconeArquivo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 3v4a1 1 0 001 1h4M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconeAceito() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// Uma linha de pulsação: o ritmo sessão a sessão.
function IconeRitmo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}

function IconeExportar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

// ============================================================================
// O bonequinho
// ============================================================================
// Cabeça e ombros, nada mais: um círculo e um arco, em traço fino. É um
// pictograma do mesmo peso dos ícones do site, não um desenho de gente —
// por isso não tem braço, perna nem rosto.

interface PropsBoneco {
  /** O centro do bonequinho, nas coordenadas do desenho. */
  x: number;
  y: number;
  escala: number;
  /** Traço forte: o professor, ou o aluno de quem o desenho fala. */
  forte?: boolean;
}

function Boneco({ x, y, escala, forte = false }: PropsBoneco) {
  const classe = forte ? 'desenho-traco desenho-traco-forte' : 'desenho-traco';
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <circle className={classe} cx="0" cy="-7" r="4.4" />
      <path className={classe} d="M -7.5 8 Q -7.5 -0.5 0 -0.5 Q 7.5 -0.5 7.5 8" />
    </g>
  );
}

// Os pontos de uma volta em torno de (cx, cy), começando em cima e seguindo
// no sentido do relógio. É onde os alunos se sentam em volta de uma sala.
function pontosEmVolta(cx: number, cy: number, raio: number, quantos: number): { x: number; y: number }[] {
  const pontos = [];
  for (let i = 0; i < quantos; i++) {
    const angulo = (i / quantos) * Math.PI * 2 - Math.PI / 2;
    pontos.push({ x: cx + Math.cos(angulo) * raio, y: cy + Math.sin(angulo) * raio });
  }
  return pontos;
}

// ============================================================================
// Desenho 1 — as salas em volta do professor
// ============================================================================

// O professor fica no meio do desenho.
const CENTRO = { x: 230, y: 200 };

// Cada sala é uma mesa redonda com alunos sentados em volta.
const SALAS = [
  { cx: 112, cy: 106, raio: 50, alunos: 6 },
  { cx: 352, cy: 124, raio: 44, alunos: 4 },
  { cx: 216, cy: 318, raio: 44, alunos: 5 },
];

// Distância entre a borda da mesa e o bonequinho de cada aluno.
const FOLGA_DOS_ALUNOS = 19;

function DesenhoSalas() {
  return (
    <svg className="desenho" viewBox="0 0 460 400" aria-hidden="true">
      {SALAS.map((sala) => (
        <g key={`${sala.cx}-${sala.cy}`}>
          <line
            className="desenho-traco desenho-traco-fraco"
            x1={CENTRO.x}
            y1={CENTRO.y}
            x2={sala.cx}
            y2={sala.cy}
            strokeDasharray="4 6"
          />
          <circle className="desenho-traco" cx={sala.cx} cy={sala.cy} r={sala.raio} />
          {pontosEmVolta(sala.cx, sala.cy, sala.raio + FOLGA_DOS_ALUNOS, sala.alunos).map((ponto, i) => (
            <Boneco key={i} x={ponto.x} y={ponto.y} escala={0.82} />
          ))}
        </g>
      ))}

      <circle className="desenho-traco desenho-traco-fraco" cx={CENTRO.x} cy={CENTRO.y} r="30" />
      <Boneco x={CENTRO.x} y={CENTRO.y} escala={1.5} forte />
      {/* Em cima do professor, e não embaixo como no preview: embaixo o
          rótulo caía na cabeça de um aluno da sala de baixo e na linha
          tracejada que vai até ela. Em cima, entre as duas salas de cima,
          não há forma nenhuma. */}
      <text className="desenho-rotulo" x={CENTRO.x} y="156" textAnchor="middle">
        VOCÊ
      </text>
    </svg>
  );
}

// ============================================================================
// Desenho 2 — o aluno entra pelo código da sala
// ============================================================================

const SALA_DO_CONVITE = { cx: 140, cy: 200, raio: 66 };

function DesenhoConvite() {
  const { cx, cy, raio } = SALA_DO_CONVITE;
  return (
    <svg className="desenho" viewBox="0 0 460 400" aria-hidden="true">
      {/* a sala, com quem já está nela */}
      <circle className="desenho-traco" cx={cx} cy={cy} r={raio} />
      {pontosEmVolta(cx, cy, raio + FOLGA_DOS_ALUNOS, 5).map((ponto, i) => (
        <Boneco key={i} x={ponto.x} y={ponto.y} escala={0.82} />
      ))}
      <text className="desenho-rotulo" x={cx} y={cy + 4} textAnchor="middle">
        SALA
      </text>

      {/* a seta do código, indo até o aluno que está fora */}
      <line className="desenho-traco" x1="252" y1="200" x2="318" y2="200" strokeDasharray="5 7" />
      <path className="desenho-traco desenho-traco-forte" d="M312 193 L322 200 L312 207" />

      {/* o aluno de fora, com o código da sala */}
      <Boneco x={368} y={172} escala={1.25} forte />
      <rect className="desenho-traco desenho-traco-forte" x="306" y="214" width="124" height="40" rx="11" />
      <text className="desenho-rotulo desenho-rotulo-forte" x="368" y="238" textAnchor="middle">
        K7M2QX
      </text>
      <text className="desenho-rotulo" x="368" y="282" textAnchor="middle">
        O CÓDIGO DA SALA
      </text>
    </svg>
  );
}

// ============================================================================
// Desenho 3 — o desempenho da turma
// ============================================================================

// O PPM de dez sessões seguidas, da mais antiga para a mais recente.
const RITMO_DA_TURMA = [26, 34, 30, 44, 38, 52, 46, 58, 54, 66];
// Cada ponto de PPM vira 2,6 unidades de altura no desenho.
const ALTURA_POR_PPM = 2.6;
const BASE_DAS_BARRAS = 300;

function DesenhoDesempenho() {
  const ultima = RITMO_DA_TURMA.length - 1;
  return (
    <svg className="desenho" viewBox="0 0 460 400" aria-hidden="true">
      {RITMO_DA_TURMA.map((ppm, i) => {
        const altura = ppm * ALTURA_POR_PPM;
        return (
          <rect
            key={i}
            className={i === ultima ? 'desenho-barra desenho-barra-forte' : 'desenho-barra'}
            x={96 + i * 28}
            y={BASE_DAS_BARRAS - altura}
            width="12"
            height={altura}
            rx="6"
          />
        );
      })}
      <line className="desenho-traco desenho-traco-fraco" x1="88" y1="308" x2="380" y2="308" />

      {/* O aluno que está indo melhor, com a estrela de conquista ao lado.
          O grupo todo fica 26 unidades mais alto que no preview: lá o
          "MELHOR DA TURMA" cruzava a barra mais alta. */}
      <Boneco x={352} y={70} escala={1.3} forte />
      {/* A estrela é o componente de sempre; o translate põe o centro dela
          em (390, 52). */}
      <g transform="translate(379 41)">
        <Estrela tamanho={22} />
      </g>
      <text className="desenho-rotulo" x="360" y="112" textAnchor="middle">
        MELHOR DA TURMA
      </text>
      <text className="desenho-rotulo" x="96" y="346">
        RITMO DA TURMA
      </text>
    </svg>
  );
}

// ============================================================================
// Os passos
// ============================================================================
// Só o que o modo Professor já faz: nada aqui promete função que não existe.

const PASSOS: PassoDoTutorial[] = [
  {
    antes: 'Modo Professor · 1 de 3',
    titulo: (
      <>
        Suas salas,
        <br />
        seus alunos
      </>
    ),
    texto: 'Aqui você cria salas, escolhe o que cada uma vai treinar e acompanha quem está evoluindo.',
    itens: [
      { icone: <IconeSala />, texto: 'Crie quantas salas quiser, uma para cada turma.' },
      { icone: <IconePessoa />, texto: 'Adicione os alunos e veja quem já entrou.' },
      { icone: <IconeGrafico />, texto: 'Acompanhe o desempenho de cada um.' },
    ],
    painel: <DesenhoSalas />,
  },
  {
    antes: 'Modo Professor · 2 de 3',
    titulo: (
      <>
        O aluno entra
        <br />
        pelo código
      </>
    ),
    texto:
      'Cada sala tem um código. Você sobe a lista de nomes, passa o código, e cada aluno entra com ele, o próprio nome e uma senha que cria na primeira vez.',
    itens: [
      { icone: <IconeArquivo />, texto: 'Para uma turma inteira, suba um CSV com os nomes.' },
      { icone: <IconeTeclado />, texto: 'Passe o código da sala: ele está no topo da turma.' },
      { icone: <IconeAceito />, texto: 'Esqueceu a senha? Você zera, e ele cria outra.' },
    ],
    painel: <DesenhoConvite />,
  },
  {
    antes: 'Modo Professor · 3 de 3',
    titulo: (
      <>
        Veja quem
        <br />
        está evoluindo
      </>
    ),
    texto: 'Os relatórios mostram o ritmo de cada aluno e da turma inteira, e apontam quem precisa de atenção.',
    itens: [
      { icone: <IconeRitmo />, texto: 'Ritmo e precisão de cada aluno, sessão a sessão.' },
      { icone: <IconeEstrela />, texto: 'A estrela marca o melhor da turma em cada medida.' },
      { icone: <IconeExportar />, texto: 'Exporte tudo em CSV quando precisar.' },
    ],
    painel: <DesenhoDesempenho />,
  },
];

// ============================================================================
// A tela
// ============================================================================

interface PropsTutorialDoProfessor {
  aoTerminar: () => void;
}

export function TutorialDoProfessor({ aoTerminar }: PropsTutorialDoProfessor) {
  return <TelaDeTutorial nome="Apresentação do modo Professor" passos={PASSOS} aoTerminar={aoTerminar} />;
}
