// Tutorial.tsx
// A apresentação do Solo, na primeira vez que a conta abre o caminho. Três
// passos: o que é o TECLAR, como o caminho funciona e onde ficam o painel
// e o menu. À esquerda o texto e três itens com ícone; à direita, uma
// frase e o teclado ABNT2 montado com as teclas do projeto, com a
// linha-guia acesa. Embaixo, os pontinhos e os botões "Pular" e "Continuar".
//
// Quem usa: js/solo/Caminho.tsx, que mostra esta tela no lugar da trilha
// enquanto sessao.tutorialVisto() for false. "Pular" e o "Continuar" do
// último passo chamam aoTerminar(), e é o Caminho que grava a marca.

import { useEffect, useRef, useState, type ReactNode } from 'react';

// ============================================================================
// Ícones — SVG traçado em linha, feitos à mão
// ============================================================================

function IconeTeclado() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}

function IconeGrafico() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  );
}

function IconeEstrela() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z" />
    </svg>
  );
}

// Uma pedra da trilha: um círculo com um ponto no meio.
function IconePedra() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

// Um caminho que se abre para os lados: nenhuma lição trancada.
function IconeLivre() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21V9M12 9l-6-6M12 9l6-6M4 3h4M16 3h4" />
    </svg>
  );
}

function IconeRepetir() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M18 3v4h-4M6 21v-4h4" />
    </svg>
  );
}

function IconePessoa() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function IconeMenu() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconeSair() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

// ============================================================================
// Os passos
// ============================================================================
// Só o que o Solo já faz: nada aqui promete função que não existe.

interface Passo {
  /** A linha pequena acima do título. */
  antes: string;
  titulo: string;
  /** O título é a marca TECLAR, em mono e espaçada, como no preview. */
  tituloEhMarca: boolean;
  texto: string;
  itens: { icone: ReactNode; texto: string }[];
  /** A frase do painel da direita, em duas linhas. */
  frase: [string, string];
}

const PASSOS: Passo[] = [
  {
    antes: 'Bem-vindo ao',
    titulo: 'TECLAR',
    tituloEhMarca: true,
    texto:
      'Aqui você aprende a digitar no seu ritmo, com exercícios que ficam mais difíceis conforme você evolui.',
    itens: [
      { icone: <IconeTeclado />, texto: 'Pratique exercícios de digitação com desafios progressivos.' },
      { icone: <IconeGrafico />, texto: 'Acompanhe seu progresso e veja sua evolução.' },
      { icone: <IconeEstrela />, texto: 'Suba de nível a cada lição concluída.' },
    ],
    frase: ['A tecla certa,', 'no momento certo.'],
  },
  {
    antes: 'Passo 2',
    titulo: 'O caminho',
    tituloEhMarca: false,
    texto: 'As 76 lições ficam numa trilha, um nível por vez. As setas no topo trocam de nível.',
    itens: [
      {
        icone: <IconePedra />,
        texto: 'Cada pedra é uma lição. A que brilha, com o balão "Começar", é a próxima a fazer.',
      },
      { icone: <IconeLivre />, texto: 'Nenhuma lição fica trancada: pode escolher qualquer uma, a qualquer hora.' },
      { icone: <IconeRepetir />, texto: 'A pílula embaixo da pedra diz quantas vezes o texto se repete.' },
    ],
    frase: ['Dedos na linha-guia:', 'A S D F · J K L Ç'],
  },
  {
    antes: 'Passo 3',
    titulo: 'Seu painel',
    tituloEhMarca: false,
    texto: 'Tudo o que não é lição mora em dois botões.',
    itens: [
      {
        icone: <IconePessoa />,
        texto: 'Seu nome, no topo, abre o painel: XP, sequência de dias, ritmo e estatísticas.',
      },
      {
        icone: <IconeMenu />,
        texto: 'O botão redondo, no canto, abre o menu: configurações, ajuda e troca de modo.',
      },
      { icone: <IconeSair />, texto: 'No meio de uma lição, Esc sai do treino.' },
    ],
    frase: ['Precisão primeiro.', 'A velocidade vem com ela.'],
  },
];

// ============================================================================
// O teclado da direita
// ============================================================================

// O teclado ABNT2, o teclado do projeto, desenhado como um teclado de
// verdade: as fileiras desalinhadas (cada uma começa um pouco mais à
// direita que a de cima, porque as teclas de borda crescem) e teclas de
// larguras diferentes. A largura é medida em "unidades": 1 é uma tecla de
// letra, quadrada. Toda fileira soma 15 unidades, para as bordas da
// direita baterem.

interface TeclaDoDesenho {
  rotulo: string;
  /** Em unidades: 1 = tecla de letra. */
  largura: number;
  /** Fileira de casa (A S D F J K L Ç): a única acesa. */
  guia?: boolean;
  /** F e J: o risquinho que o dedo sente no teclado real. */
  marcaDeRelevo?: boolean;
  /** Espaço vazio ao lado da barra de espaço: ocupa lugar, não é tecla. */
  vazia?: boolean;
}

const LINHA_GUIA = new Set(['A', 'S', 'D', 'F', 'J', 'K', 'L', 'Ç']);
const MARCA_DE_RELEVO = new Set(['F', 'J']);

// As teclas de uma unidade, a partir das letras de uma fileira.
function teclasDeLetra(letras: string[]): TeclaDoDesenho[] {
  return letras.map((letra) => ({
    rotulo: letra,
    largura: 1,
    guia: LINHA_GUIA.has(letra),
    marcaDeRelevo: MARCA_DE_RELEVO.has(letra),
  }));
}

const FILEIRAS: TeclaDoDesenho[][] = [
  // 1,5 + 12 + 1,5 = 15
  [
    { rotulo: 'tab', largura: 1.5 },
    ...teclasDeLetra(['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '´', '[']),
    { rotulo: 'enter', largura: 1.5 },
  ],
  // 1,75 + 12 + 1,25 = 15. A última é a parte de baixo do Enter, que no
  // ABNT2 desce por duas fileiras.
  [
    { rotulo: 'caps', largura: 1.75 },
    ...teclasDeLetra(['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç', '~', ']']),
    { rotulo: '', largura: 1.25 },
  ],
  // 2,25 + 10 + 2,75 = 15
  [
    { rotulo: 'shift', largura: 2.25 },
    ...teclasDeLetra(['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', ';']),
    { rotulo: 'shift', largura: 2.75 },
  ],
  // 4 + 7 + 4 = 15: a barra de espaço, larga, no meio.
  [
    { rotulo: '', largura: 4, vazia: true },
    { rotulo: '', largura: 7 },
    { rotulo: '', largura: 4, vazia: true },
  ],
];

function classeDaTecla(tecla: TeclaDoDesenho): string {
  if (tecla.vazia) return 'tutorial-tecla-vazia';
  let classe = 'tutorial-tecla tecla';
  if (tecla.largura === 1) classe += ' tutorial-tecla-letra';
  if (tecla.guia) classe += ' tutorial-tecla-guia tecla-clara';
  if (tecla.marcaDeRelevo) classe += ' tutorial-tecla-relevo';
  return classe;
}

// Só desenho: nenhuma destas teclas se aperta nem recebe foco, e o leitor
// de tela não precisa delas (a frase já diz o que importa).
function TecladoDecorativo() {
  return (
    <div className="tutorial-teclado" aria-hidden="true">
      {FILEIRAS.map((fileira, i) => (
        <div className="tutorial-fileira" key={i}>
          {fileira.map((tecla, j) => (
            // A largura vai no flex-grow: a tecla cresce na proporção das
            // unidades dela.
            <span key={j} className={classeDaTecla(tecla)} style={{ flexGrow: tecla.largura }}>
              {tecla.rotulo}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// A tela
// ============================================================================

interface PropsTutorial {
  aoTerminar: () => void;
}

export function Tutorial({ aoTerminar }: PropsTutorial) {
  const [indice, setIndice] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);
  const passo = PASSOS[indice];
  const ultimo = indice === PASSOS.length - 1;

  // A cada passo o foco vai para o título: quem usa leitor de tela ouve o
  // passo novo, e quem usa Tab recomeça do texto, não do fim da página.
  useEffect(() => {
    titulo.current?.focus();
  }, [indice]);

  function continuar() {
    if (ultimo) aoTerminar();
    else setIndice(indice + 1);
  }

  return (
    <section className="tutorial" aria-label="Apresentação do Solo">
      <div className="tutorial-miolo">
        <div>
          <p className="tutorial-antes">{passo.antes}</p>
          {/* tabIndex -1: recebe o foco pelo código, mas não entra no Tab. */}
          <h1
            className={passo.tituloEhMarca ? 'tutorial-titulo tutorial-titulo-marca' : 'tutorial-titulo'}
            ref={titulo}
            tabIndex={-1}
          >
            {passo.titulo}
          </h1>
          <p className="tutorial-texto">{passo.texto}</p>
          <ul className="tutorial-itens">
            {passo.itens.map((item) => (
              <li key={item.texto}>
                <span className="tutorial-icone">{item.icone}</span>
                <p>{item.texto}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="vidro tutorial-visual">
          <p className="tutorial-frase">
            {passo.frase[0]}
            <br />
            {passo.frase[1]}
          </p>
          <TecladoDecorativo />
        </div>
      </div>

      <div className="tutorial-rodape">
        {/* Os pontinhos são desenho; o texto escondido diz a mesma coisa. */}
        <p className="tutorial-pontos">
          {PASSOS.map((_, i) => (
            <i key={i} className={i === indice ? 'tutorial-ponto-atual' : undefined} aria-hidden="true" />
          ))}
          <span className="sr-only">
            Passo {indice + 1} de {PASSOS.length}
          </span>
        </p>
        <div className="tutorial-acoes">
          <button type="button" className="tutorial-botao tecla" onClick={aoTerminar}>
            Pular
          </button>
          <button type="button" className="tutorial-botao tutorial-botao-claro tecla tecla-clara" onClick={continuar}>
            {ultimo ? 'Começar' : 'Continuar'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
