// Tutorial.tsx
// A apresentação do Solo, na primeira vez que a conta abre o caminho. Três
// passos: o que é o TECLAR, como o caminho funciona e onde ficam o painel
// e o menu. À esquerda o texto e três itens com ícone; à direita, uma
// frase e o teclado ABNT2 (componentes/TecladoAbnt2.tsx, o mesmo do
// treino), com a linha-guia acesa.
//
// Este arquivo só tem o CONTEÚDO. A estrutura — passos, pontinhos, "Pular"
// e "Continuar" — é a de componentes/TelaDeTutorial.tsx, a mesma do
// tutorial do Professor.
//
// Quem usa: js/solo/Caminho.tsx, que mostra esta tela no lugar da trilha
// enquanto sessao.tutorialVisto('solo') for false. "Pular" e o "Continuar"
// do último passo chamam aoTerminar(), e é o Caminho que grava a marca.

import { TecladoAbnt2 } from '../componentes/TecladoAbnt2.js';
import { TelaDeTutorial, type PassoDoTutorial } from '../componentes/TelaDeTutorial.js';
import { IconeEstrela, IconeGrafico, IconePessoa, IconeTeclado } from '../componentes/IconesDoTutorial.js';

// ============================================================================
// Ícones que só o Solo usa — SVG traçado em linha, feitos à mão
// (os comuns aos dois tutoriais estão em componentes/IconesDoTutorial.tsx)
// ============================================================================

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

// O painel da direita de todos os passos: a frase, em duas linhas, em cima
// do teclado com a linha-guia acesa.
function PainelDoTeclado({ frase }: { frase: [string, string] }) {
  return (
    <>
      <p className="tutorial-frase">
        {frase[0]}
        <br />
        {frase[1]}
      </p>
      <TecladoAbnt2 tamanho="tutorial" />
    </>
  );
}

const PASSOS: PassoDoTutorial[] = [
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
    painel: <PainelDoTeclado frase={['A tecla certa,', 'no momento certo.']} />,
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
      { icone: <IconeRepetir />, texto: 'O número pequeno dentro da pedra diz quantas vezes o texto se repete.' },
    ],
    painel: <PainelDoTeclado frase={['Dedos na linha-guia:', 'A S D F · J K L Ç']} />,
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
    painel: <PainelDoTeclado frase={['Precisão primeiro.', 'A velocidade vem com ela.']} />,
  },
];

// ============================================================================
// A tela
// ============================================================================

interface PropsTutorial {
  aoTerminar: () => void;
}

export function Tutorial({ aoTerminar }: PropsTutorial) {
  return <TelaDeTutorial nome="Apresentação do Solo" passos={PASSOS} aoTerminar={aoTerminar} />;
}
