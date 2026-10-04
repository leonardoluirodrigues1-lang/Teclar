// Landing.tsx — index.html
// A página inicial em React. É a tela de MAIOR RISCO do projeto: o hero tem
// um shader WebGL escrito à mão (componentes/shaderBuracoNegro.ts), três camadas de DOM
// gerado com semente fixa (letras.ts) e o reveal por palavra no scroll
// (reveal.ts). Nada disso virou React. O componente faz só duas coisas:
//   1. renderiza o mesmo markup que o index.html tinha (mesmas classes,
//      mesmos ids, mesmos textos — css/landing.css não mudou);
//   2. entrega o <canvas> e as .layer para os módulos ES num
//      useLayoutEffect, e desfaz tudo ao desmontar.
//
// Sem estado, sem props, sem re-render: o loop de animação fala direto com
// o WebGL e as letras são nós com animação CSS. Um setState por frame
// destruiria a performance, e não há nada nesta tela que precise de
// reconciliação.

import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { iniciarBuracoNegro } from '../componentes/shaderBuracoNegro.js';
import { iniciarRaiosEParticulas, iniciarLetrasOrbitando, iniciarLetrasEspalhadas } from './letras.js';
import { useRevelacao } from './reveal.js';

// ============================================================================
// Hero: canvas + camadas de letras
// ============================================================================

// useLayoutEffect, não useEffect, nos três: o index.html rodava tudo num
// <script type="module"> antes da primeira pintura, então o hero nunca
// apareceu vazio. O useEffect roda depois da pintura e deixaria um frame
// sem letras (e o texto do reveal visível, ver reveal.ts). A ordem das
// chamadas é a mesma do <script> antigo.

function Hero() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motion = useRef<HTMLDivElement>(null);
  const letters = useRef<HTMLDivElement>(null);
  const scatter = useRef<HTMLDivElement>(null);

  // O WebGL: iniciarBuracoNegro devolve a própria limpeza (cancela o rAF,
  // desliga os observadores, solta o contexto). Sem WebGL ele devolve null
  // e esconde o canvas, como sempre fez. Aqui o shader tem a tela só para
  // ele: 40 quadros, pausa só quando o hero (#top) sai da tela, e segue
  // desenhando sem foco — o mesmo de antes de ele sair da landing.
  useLayoutEffect(
    () =>
      iniciarBuracoNegro(canvas.current, {
        quadrosPorSegundo: 40,
        area: document.getElementById('top'),
        pausarSemFoco: false,
      }) ?? undefined,
    [],
  );

  // As camadas: DOM direto dentro de hosts que o React não toca (não têm
  // filhos no JSX). Ao desmontar, esvazia os hosts.
  useLayoutEffect(() => {
    const hosts = [motion.current, letters.current, scatter.current];
    iniciarRaiosEParticulas(hosts[0]);
    iniciarLetrasOrbitando(hosts[1]);
    iniciarLetrasEspalhadas(hosts[2]);
    return () => hosts.forEach((h) => h.replaceChildren());
  }, []);

  return (
    <section className="hero" id="top">
      <canvas id="bh" aria-hidden="true" ref={canvas}></canvas>
      <div className="layer" id="horizon" aria-hidden="true"></div>
      <div className="layer" id="motion" aria-hidden="true" ref={motion}></div>
      <div className="layer" id="letters" aria-hidden="true" ref={letters}></div>
      <div className="layer" id="scatter" aria-hidden="true" ref={scatter}></div>
      <div className="hero-blur" aria-hidden="true"></div>
      <div className="hero-fade" aria-hidden="true"></div>

      <div className="hero-content">
        <div className="titulo-wrap">
          <h1 className="titulo" aria-label="TECLAR">
            <span className="teclar-typed-word" aria-hidden="true">
              TECLAR
            </span>
            <span className="teclar-caret" aria-hidden="true"></span>
          </h1>
        </div>
        <div className="cta-hero">
          <a className="btn" href="pages/login.html">
            Começar a treinar
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Barra fixa: marca + Entrar
// ============================================================================

// Não é a Nav.tsx: aquela é de tela com sessão (avatar, menu, troca de
// modo). Aqui só marca e um link, dentro de uma pílula de vidro que existe
// desde o primeiro quadro. No topo da página ela tem também a classe
// .barra-no-topo, que a deixa discreta; a classe sai quando o sentinela do
// topo sai da tela. IntersectionObserver, e não listener de scroll: o
// canvas WebGL divide o mesmo quadro, e o observer só dispara ao cruzar a
// linha. Classe direto no DOM, sem setState, pelo mesmo motivo do resto
// da tela.

function Barra() {
  const sentinela = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    // O sentinela é uma faixa de 24px no topo da página. Enquanto ela está
    // na tela, a pessoa ainda não rolou.
    const observador = new IntersectionObserver((entradas) => {
      const aindaNoTopo = entradas[0].isIntersecting;
      if (aindaNoTopo) {
        barra.current?.classList.add('barra-no-topo');
      } else {
        barra.current?.classList.remove('barra-no-topo');
      }
    });
    observador.observe(sentinela.current);
    return () => observador.disconnect();
  }, []);

  return (
    <>
      <div className="barra-sentinela" aria-hidden="true" ref={sentinela}></div>
      <header className="barra-landing vidro barra-no-topo" ref={barra}>
        <a className="barra-marca" href="#top" aria-label="TECLAR, voltar ao topo">
          <span>TECLAR</span>
        </a>
        <a className="btn barra-entrar" href="pages/login.html">
          Entrar
        </a>
      </header>
    </>
  );
}

// ============================================================================
// Conteúdo: intro, passos e CTA final
// ============================================================================

// data-split="" e não data-split: o React renderiza o atributo com valor
// vazio, exatamente como o HTML sem valor. O reveal só olha a presença.

interface Passo {
  numero: string;
  titulo: string;
  texto: string;
  flip?: boolean;
}

const PASSOS: Passo[] = [
  {
    numero: '01',
    titulo: 'COMECE',
    texto:
      'Você escolhe um caminho e recebe textos curtos para digitar. A cada sessão o sistema mede sua velocidade e sua precisão, e mostra exatamente onde a mão hesitou.',
  },
  {
    numero: '02',
    titulo: 'REPITA',
    flip: true,
    texto:
      'Os exercícios acompanham o seu ritmo: ficam mais longos e mais difíceis conforme você acerta. A repetição vai tirando o movimento da sua atenção, até digitar deixar de ser uma tarefa.',
  },
  {
    numero: '03',
    titulo: 'DOMINE',
    texto:
      'No fim não há prêmio para mostrar a ninguém. A recompensa é escrever na velocidade em que você pensa, sem o teclado no meio do caminho.',
  },
];

function Landing() {
  useRevelacao();

  return (
    <>
      <Barra />
      <Hero />

      <section className="wrap intro" id="teclar-pratica">
        <div className="col-a">
          <h2 data-split="">
            Digitar não é apertar teclas.
            <span className="linha2" data-split="">
              É transformar pensamento em movimento.
            </span>
          </h2>
        </div>
        <div className="col-b">
          <p className="eyebrow" data-split="" data-delay="120">
            SOBRE O TECLAR
          </p>
          <p className="body" data-split="" data-delay="180">
            O Teclar é um espaço de treino sem ruído: textos curtos, repetição deliberada e retorno
            imediato sobre precisão e ritmo. Nada de troféus barulhentos — apenas o silêncio
            necessário para o teclado virar reflexo.
          </p>
        </div>
      </section>

      <div id="steps">
        {PASSOS.map((p) => (
          <section className={p.flip ? 'wrap step flip' : 'wrap step'} key={p.numero}>
            <div className="grid">
              <div className="num reveal">
                <span>{p.numero}</span>
              </div>
              <div className="txt">
                <h3 data-split="">{p.titulo}</h3>
                <p data-split="" data-delay="140">
                  {p.texto}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="cta-final">
        <div className="glow" aria-hidden="true"></div>
        <div style={{ position: 'relative' }}>
          <p className="eyebrow" data-split="">
            COMECE · REPITA · DOMINE
          </p>
          <h2 data-split="" data-delay="140">
            O teclado desaparece. Só resta a ideia.
          </h2>
          <div className="reveal" data-delay="420">
            <a className="btn" href="pages/login.html">
              Começar a treinar
            </a>
          </div>
        </div>
      </section>

      <footer>
        <p className="eyebrow" data-split="">
          TECLAR
        </p>
      </footer>
    </>
  );
}

// ============================================================================
// Montagem
// ============================================================================

createRoot(document.getElementById('raiz')).render(<Landing />);
