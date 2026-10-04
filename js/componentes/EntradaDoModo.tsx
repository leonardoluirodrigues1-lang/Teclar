// EntradaDoModo.tsx
// As peças da tela de ENTRADA dos modos de escola: a de turmas do
// Professor (js/professor/Turmas.tsx) e a de salas do Aluno
// (js/aluno/Dashboard.tsx). Nasceram dentro de Turmas.tsx; saíram de lá
// quando a segunda tela precisou delas, para as duas não divergirem.
//
//   ContaFixa      nome, papel e o menu da conta, fixos no canto
//   Abertura       o horizonte de eventos com a marca TECLAR se digitando
//   Funcoes        as três teclas grandes entre duas linhas de 1px
//   CartaoDeTurma  capa gerada, nome e a linha em mono; o rodapé é de
//                  quem usa (contagens no professor, progresso no aluno)
//
// Desenho em css/escola.css. O vidro, o relevo de tecla e o grão são as
// classes de css/base/ e css/componentes/ (.vidro, .tecla): nenhuma
// receita é repetida aqui. O horizonte da abertura é o shader da landing
// (shaderBuracoNegro.ts).

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { sessao } from '../nucleo/sessao.js';
import { rng } from '../landing/letras.js';
import { MenuDaConta, type SecoesNav } from './Nav.js';
import { iniciarBuracoNegro } from './shaderBuracoNegro.js';

// ============================================================================
// Conta fixa no canto
// ============================================================================

interface PropsContaFixa {
  secoes: SecoesNav;
  /** A linha embaixo do nome: "Professor", ou o RP no modo Aluno. */
  papel: string;
}

// O texto é aria-hidden: o avatar já se anuncia como "Conta de <nome>", e
// o leitor de tela leria o nome duas vezes.
export function ContaFixa({ secoes, papel }: PropsContaFixa) {
  return (
    <div className="conta-fixa">
      <div className="conta-fixa-texto" aria-hidden="true">
        <p className="conta-fixa-nome">{sessao.nomeExibicao()}</p>
        <p className="conta-fixa-papel">{papel}</p>
      </div>
      <MenuDaConta secoes={secoes} />
    </div>
  );
}

// ============================================================================
// Abertura
// ============================================================================

// O horizonte é o buraco negro da landing, posto dentro da seção (ver
// .abertura em escola.css): ao rolar, vai embora junto com ela. A marca se
// digita com a MESMA animação da landing (.teclar-typed-word, em
// css/base/movimento.css). O leitor de tela lê só o "TECLAR" do sr-only, e
// não as letras surgindo.
export function Abertura() {
  return (
    <section className="abertura">
      <Horizonte />
      <p className="marca-abertura">
        <span className="sr-only">TECLAR</span>
        <span className="teclar-typed-word" aria-hidden="true">
          TECLAR
        </span>
        <span className="teclar-caret" aria-hidden="true"></span>
      </p>
    </section>
  );
}

// Aqui o buraco negro divide a tela com conteúdo, diferente da landing, em
// que ele é a tela. Por isso ele é mais contido: 30 quadros, para fora da
// tela e sem foco. E tem uma versão estática, a imagem de um quadro do
// mesmo shader (assets/img/buraco-negro.png, via .horizonte-estatico), que
// entra quando a animação não deve ou não pode rodar:
//   · menos movimento pedido (pelo sistema ou nas Configurações do Solo):
//     entra direto, o shader nem liga;
//   · sem WebGL (ou shader que não compila): o shader devolve null;
//   · máquina fraca: o medidor de quadros que já existe
//     (js/utils/respiracaoDaLuz.ts) põe .luz-parada no <html>. Daí em
//     diante fica a imagem, e a animação não volta até a próxima página.
const QUADROS_DA_ABERTURA = 30;

function querMenosMovimento(): boolean {
  if (document.documentElement.classList.contains('movimento-reduzido')) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function maquinaLenta(): boolean {
  return document.documentElement.classList.contains('luz-parada');
}

function Horizonte() {
  const [estatico, setEstatico] = useState(() => querMenosMovimento() || maquinaLenta());
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (estatico) return;

    const parar = iniciarBuracoNegro(canvas.current, {
      quadrosPorSegundo: QUADROS_DA_ABERTURA,
      area: canvas.current,
      pausarSemFoco: true,
    });
    if (!parar) {
      setEstatico(true);
      return;
    }

    // O medidor mede uns segundos depois de a página carregar, com o
    // shader já rodando, e marca o <html> se faltar quadro. Observar a
    // classe é esperar por esse veredito sem mexer no medidor.
    const observador = new MutationObserver(() => {
      if (maquinaLenta()) setEstatico(true);
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Ao trocar para a imagem, esta limpeza para o loop e solta o contexto
    // do WebGL: a GPU fica livre de vez.
    return () => {
      observador.disconnect();
      parar();
    };
  }, [estatico]);

  if (estatico) return <div className="horizonte horizonte-estatico" aria-hidden="true"></div>;
  return <canvas className="horizonte" ref={canvas} aria-hidden="true"></canvas>;
}

// ============================================================================
// Funções — as três teclas grandes
// ============================================================================

export function Funcoes({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <nav className="funcoes" aria-label={rotulo}>
      {children}
    </nav>
  );
}

interface PropsFuncao {
  href: string;
  nome: string;
  texto: string;
  /** A linha vermelha de alerta. Ausente (ou vazia): não aparece. */
  sinal?: string | null;
}

// São links: cada tecla leva a um lugar, às vezes a uma âncora da mesma
// página.
export function Funcao({ href, nome, texto, sinal }: PropsFuncao) {
  return (
    <a className="funcao tecla" href={href}>
      <span className="funcao-nome">{nome}</span>
      <span className="funcao-texto">{texto}</span>
      {sinal && <span className="funcao-sinal">{sinal}</span>}
    </a>
  );
}

// ============================================================================
// Cartão da turma
// ============================================================================

interface PropsCartao {
  id: string;
  nome: string;
  href: string;
  /** A linha em mono abaixo do nome (período ou professor). Vazia: some. */
  linha?: string | null;
  capaSemente?: number;
  /** Logo depois do nome, dentro do título (a estrela de conquista). */
  aposNome?: ReactNode;
  /** Classe a mais no <article> (ex.: a do menu aberto). */
  classe?: string;
  /** Fora do link: o que é clicável por conta própria, como o "⋯". */
  fora?: ReactNode;
  /** O rodapé do corpo: contagens, progresso. */
  children?: ReactNode;
}

export function CartaoDeTurma({ id, nome, href, linha, capaSemente, aposNome, classe, fora, children }: PropsCartao) {
  return (
    <article className={classe ? `cartao vidro ${classe}` : 'cartao vidro'}>
      <div className="cartao-capa" aria-hidden="true">
        <CapaDaTurma semente={sementeDaTurma(id, capaSemente)} />
      </div>

      <div className="cartao-corpo">
        {/* O cartão inteiro é clicável: o link se estica por cima dele pelo
            ::after (ver escola.css), e o anel de foco cerca o cartão todo.
            Enter já abre um link; Espaço não, e por isso o onKeyDown. */}
        <h2 className="cartao-nome">
          <a
            className="cartao-link"
            href={href}
            onKeyDown={(evento) => {
              if (evento.key === ' ') {
                // preventDefault: Espaço rolaria a página.
                evento.preventDefault();
                // click() em vez de mudar a URL direto: passa pela saída
                // animada de ativarSaidaAoNavegar, como o clique do mouse.
                evento.currentTarget.click();
              }
            }}
          >
            {nome}
          </a>
          {aposNome}
        </h2>
        {linha && <p className="cartao-periodo">{linha}</p>}
        {children}
      </div>

      {fora}
    </article>
  );
}

// ============================================================================
// Capa gerada — arcos de luz sobre preto
// ============================================================================

// A semente gravada pelo "Editar capa" do professor; sem ela, uma tirada
// do id. Assim toda turma tem um desenho próprio desde que nasce, o mesmo
// a cada recarga — e o mesmo nas telas do professor e do aluno.
export function sementeDaTurma(id: string, capaSemente?: number): number {
  if (Number.isInteger(capaSemente)) return capaSemente;
  return sementeDoId(id);
}

// Hash de texto simples (o de String.hashCode do Java): cada letra
// multiplica o que veio antes por 31. Ids parecidos ("turma-1", "turma-2")
// dão números bem diferentes, e é isso que importa aqui.
function sementeDoId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

// Cinco círculos de centro ABAIXO da capa: só o topo de cada um aparece,
// como arcos. Mais um brilho radial vindo de baixo. O sorteio usa o mesmo
// gerador com semente da landing e das estrelas (rng, de letras.ts): a
// mesma semente desenha sempre a mesma capa.
const ARCOS = 5;

export function CapaDaTurma({ semente }: { semente: number }) {
  // O id do gradiente precisa ser único na página (são vários cartões). O
  // useId do React tem ":" — tirados, para caber no url(#...) do SVG.
  const idBrilho = `brilho${useId().replace(/:/g, '')}`;
  const sorteio = rng(semente);

  const arcos = [];
  for (let i = 0; i < ARCOS; i++) {
    arcos.push(
      <circle
        key={i}
        cx={(40 + sorteio() * 260).toFixed(1)}
        cy={(110 + sorteio() * 60).toFixed(1)}
        r={(48 + sorteio() * 86).toFixed(1)}
        fill="none"
        stroke="#fff"
        strokeOpacity={(0.1 + sorteio() * 0.4).toFixed(2)}
        strokeWidth={(0.6 + sorteio() * 1.3).toFixed(2)}
      />,
    );
  }
  // Onde nasce o brilho também varia com a semente.
  const brilhoX = `${Math.round(20 + sorteio() * 60)}%`;

  return (
    <svg viewBox="0 0 340 104" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={idBrilho} cx={brilhoX} cy="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="340" height="104" fill={`url(#${idBrilho})`} />
      {arcos}
    </svg>
  );
}
