// TelaDeTutorial.tsx
// A estrutura dos tutoriais de primeira vez: os passos, um de cada vez, com
// o texto e os itens à esquerda e um painel de vidro à direita; embaixo, os
// pontinhos e os botões "Pular" e "Continuar" (que vira "Começar" no
// último passo). Estilo em css/componentes/tutorial.css.
//
// Quem usa: js/solo/Tutorial.tsx e js/professor/Tutorial.tsx. Cada um só
// escreve os seus passos — texto, itens e o que vai no painel — e passa
// para esta tela. A marca de "já visto" não mora aqui: quem mostra o
// tutorial grava a marca quando aoTerminar() é chamado (sessao.ts).

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ItemDoTutorial {
  icone: ReactNode;
  texto: string;
}

export interface PassoDoTutorial {
  /** A linha pequena acima do título. */
  antes: string;
  /** ReactNode, e não string, para o título poder quebrar a linha com <br />. */
  titulo: ReactNode;
  /** O título é a marca TECLAR, em mono e espaçada (o 1º passo do Solo). */
  tituloEhMarca?: boolean;
  texto: string;
  itens: ItemDoTutorial[];
  /** O que vai dentro do painel de vidro da direita. */
  painel: ReactNode;
}

interface PropsTelaDeTutorial {
  /** O nome da seção para o leitor de tela, ex.: "Apresentação do Solo". */
  nome: string;
  passos: PassoDoTutorial[];
  aoTerminar: () => void;
}

export function TelaDeTutorial({ nome, passos, aoTerminar }: PropsTelaDeTutorial) {
  const [indice, setIndice] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

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
    <section className="tutorial" aria-label={nome}>
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

        <div className="vidro tutorial-visual">{passo.painel}</div>
      </div>

      <div className="tutorial-rodape">
        {/* Os pontinhos são desenho; o texto escondido diz a mesma coisa. */}
        <p className="tutorial-pontos">
          {passos.map((_, i) => (
            <i key={i} className={i === indice ? 'tutorial-ponto-atual' : undefined} aria-hidden="true" />
          ))}
          <span className="sr-only">
            Passo {indice + 1} de {passos.length}
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
