// MolduraSolo.tsx
// A moldura das telas do mundo Solo, no lugar da nav em pílula:
//   · topo à esquerda  — a marca TECLAR;
//   · topo à direita   — a pessoa (inicial, nome, nível e uma barra de XP
//                        fina). É uma tecla que leva ao dashboard do Solo;
//   · canto de baixo   — o botão redondo que abre a barra lateral;
//   · barra lateral    — Início, Configurações, Ajuda, Sobre e, separados,
//                        Ir para Professor,
//                        Trocar de modo e Sair.
//
// Quem usa: as telas de pages/solo/ (caminho, dashboard, configurações,
// ajuda, sobre).
// A <Nav> de componentes/Nav.tsx continua existindo para o mundo Escola.
//
//   <MolduraSolo ativo="caminho">...conteúdo da tela...</MolduraSolo>
//
// No dashboard, que é a tela para onde o botão da pessoa leva, o botão não
// aparece (levaria para onde ela já está) e o nome dela vira o título da
// tela, no topo à esquerda, no lugar da marca — que continua na barra
// lateral:
//
//   <MolduraSolo ativo={null} telaDaPessoa>...</MolduraSolo>
//
// A barra lateral NÃO escurece a tela nem cobre o conteúdo: ela ocupa a
// faixa da esquerda e o conteúdo anda para a direita, continuando visível.
// Quem faz isso é o CSS (.moldura-lateral-aberta em css/solo.css); aqui só
// se liga e desliga a classe.
//
// Os hrefs são relativos a pages/solo/, onde moram todas as telas que
// montam a moldura.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { CONFIG } from '../config.js';
import type { Campanha } from '../nucleo/tipos.js';
import { progressoDe } from './BarraXp.js';

/** Qual item da barra lateral é a tela atual. */
export type TelaSolo = 'caminho' | 'configuracoes' | 'ajuda' | 'sobre';

interface PropsMoldura {
  /** null: a tela não está na barra lateral (o dashboard). */
  ativo: TelaSolo | null;
  /** true enquanto o tutorial está na tela: o botão redondo cairia em cima
   *  dos pontinhos e dos botões do rodapé dele. */
  esconderMenu?: boolean;
  /** true só no dashboard: a tela da pessoa. Ver o comentário do topo. */
  telaDaPessoa?: boolean;
  children: ReactNode;
}

// ============================================================================
// Ícones — SVG traçado em linha, feitos à mão (os mesmos do preview)
// ============================================================================
// viewBox 24×24 e só traço: a cor e a espessura vêm do CSS
// (.barra-lateral-item svg), então o ícone acompanha a cor do texto.

function IconeInicio() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11l9-8 9 8M5 10v10h14V10" />
    </svg>
  );
}

function IconeConfiguracoes() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

function IconeAjuda() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 113.3 2.4c-.6.2-.8.7-.8 1.3v.5M12 17h.01" />
    </svg>
  );
}

function IconeSobre() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function IconeProfessor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function IconeTrocarModo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M18 3v4h-4M6 21v-4h4" />
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
// Topo à direita: a pessoa
// ============================================================================

// "Leonardo" -> "L". Sem nome, fica vazio: melhor que um placeholder.
function inicialDoNome(nome: string): string {
  return nome.trim().charAt(0).toUpperCase();
}

// A campanha só serve para o nível e a barra. Enquanto ela não chega, ou
// quando a pessoa ainda não tem campanha, o botão mostra só a inicial e o
// nome — ele leva ao dashboard do mesmo jeito.
//
// Nível e XP saem das MESMAS rotas e da MESMA conta que o dashboard usa
// (GET /solo/campanha, GET /parametros e progressoDe()), para o botão e o
// dashboard nunca mostrarem dois níveis diferentes.
interface PropsBotaoPessoa {
  campanha: Campanha | null;
  xpPorNivel: number;
}

function BotaoPessoa({ campanha, xpPorNivel }: PropsBotaoPessoa) {
  const nome = sessao.nomeExibicao();
  const progresso = campanha ? progressoDe(campanha, xpPorNivel) : null;
  const rotulo = progresso
    ? `Abrir seu painel: ${nome}, nível ${progresso.nivel}, ${progresso.noNivel} de ${progresso.porNivel} XP`
    : `Abrir seu painel: ${nome}`;

  return (
    <a className="moldura-pessoa tecla" href="dashboard.html" aria-label={rotulo}>
      <span className="moldura-pessoa-inicial" aria-hidden="true">
        {inicialDoNome(nome)}
      </span>
      <span className="moldura-pessoa-texto" aria-hidden="true">
        <span className="moldura-pessoa-nome">{nome}</span>
        {progresso && (
          <>
            <span className="moldura-pessoa-nivel">Nível {progresso.nivel}</span>
            <span className="moldura-pessoa-trilho">
              <span style={{ width: `${progresso.percentual}%` }} />
            </span>
          </>
        )}
      </span>
    </a>
  );
}

// ============================================================================
// Barra lateral
// ============================================================================

interface PropsBarraLateral {
  aberta: boolean;
  ativo: TelaSolo | null;
  aoFechar: () => void;
}

// Tudo o que recebe foco dentro da barra, na ordem da tela.
function focaveisDe(barra: HTMLElement): HTMLElement[] {
  return Array.from(barra.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'));
}

function BarraLateral({ aberta, ativo, aoFechar }: PropsBarraLateral) {
  const barra = useRef<HTMLElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);

  // Enquanto aberta: o foco começa no X, fica preso aqui dentro (Tab na
  // última volta para a primeira, Shift+Tab na primeira vai para a última)
  // e Esc fecha. O listener só existe enquanto ela está aberta.
  useEffect(() => {
    if (!aberta) return;
    botaoFechar.current?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        aoFechar();
        return;
      }
      if (evento.key !== 'Tab' || !barra.current) return;

      const focaveis = focaveisDe(barra.current);
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const atual = document.activeElement;
      // O foco fora da barra (um clique no conteúdo ao lado, que continua
      // visível) também volta para dentro no próximo Tab.
      const foraDaBarra = !barra.current.contains(atual);

      if (evento.shiftKey && (atual === primeiro || foraDaBarra)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (atual === ultimo || foraDaBarra)) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta, aoFechar]);

  function classeDoItem(tela: TelaSolo): string {
    return 'barra-lateral-item' + (tela === ativo ? ' barra-lateral-item-ativo' : '');
  }

  function atual(tela: TelaSolo): 'page' | undefined {
    return tela === ativo ? 'page' : undefined;
  }

  return (
    // Fechada, ela sai da tela e fica com visibility: hidden (css/solo.css):
    // assim nem o Tab nem o leitor de tela a encontram, sem tirá-la do DOM
    // — tirar mataria a animação de entrada e saída.
    <nav
      className={'vidro barra-lateral' + (aberta ? ' barra-lateral-aberta' : '')}
      id="barra-lateral"
      ref={barra}
      aria-label="Menu do Solo"
    >
      <div className="barra-lateral-cabeca">
        <span className="moldura-marca">TECLAR</span>
        <button
          type="button"
          className="barra-lateral-fechar tecla"
          ref={botaoFechar}
          onClick={aoFechar}
          aria-label="Fechar menu"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <a className={classeDoItem('caminho')} href="caminho.html" aria-current={atual('caminho')}>
        <IconeInicio /> Início
      </a>
      <a className={classeDoItem('configuracoes')} href="configuracoes.html" aria-current={atual('configuracoes')}>
        <IconeConfiguracoes /> Configurações
      </a>
      <a className={classeDoItem('ajuda')} href="ajuda.html" aria-current={atual('ajuda')}>
        <IconeAjuda /> Ajuda
      </a>
      <a className={classeDoItem('sobre')} href="sobre.html" aria-current={atual('sobre')}>
        <IconeSobre /> Sobre
      </a>

      <hr className="barra-lateral-divisoria" />

      {/* Os três que moravam no menu do avatar da <Nav>. Aqui eles são o
          ÚNICO caminho para sair do Solo: o botão da pessoa, no topo, leva
          ao dashboard. A troca de modo é a mesma do guarda.ts. */}
      <button type="button" className="barra-lateral-item" onClick={() => guarda.trocarModo('professor')}>
        <IconeProfessor /> Ir para Professor
      </button>
      <a className="barra-lateral-item" href="../modo.html">
        <IconeTrocarModo /> Trocar de modo
      </a>
      <button type="button" className="barra-lateral-item" onClick={() => guarda.sair()}>
        <IconeSair /> Sair
      </button>

      <span className="barra-lateral-versao">v{CONFIG.VERSAO}</span>
    </nav>
  );
}

// ============================================================================
// A moldura
// ============================================================================

export function MolduraSolo({ ativo, esconderMenu = false, telaDaPessoa = false, children }: PropsMoldura) {
  const [aberta, setAberta] = useState(false);
  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [xpPorNivel, setXpPorNivel] = useState(CONFIG.SOLO.XP_POR_NIVEL);
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  // Para não roubar o foco no primeiro desenho da tela: só devolve o foco
  // ao botão redondo quando a barra acabou de FECHAR.
  const jaAbriu = useRef(false);

  // A campanha e o custo do nível só alimentam o botão da pessoa, que não
  // existe na tela da pessoa: lá nada é pedido. Se uma das duas falhar, o
  // botão fica só com o nome (campanha) ou usa o espelho do config
  // (parâmetros); a tela não deve nada por isso.
  useEffect(() => {
    if (telaDaPessoa) return;
    let cancelado = false;
    api.solo
      .campanhaAtual()
      .then((resposta) => {
        if (!cancelado) setCampanha(resposta ?? null);
      })
      .catch((falha) => console.error(falha));
    api.admin
      .parametros()
      .then((parametros) => {
        if (!cancelado && parametros?.xpPorNivel) setXpPorNivel(parametros.xpPorNivel);
      })
      .catch((falha) => console.error(falha));
    return () => {
      cancelado = true;
    };
  }, [telaDaPessoa]);

  useEffect(() => {
    if (aberta) {
      jaAbriu.current = true;
    } else if (jaAbriu.current) {
      botaoAbrir.current?.focus();
    }
  }, [aberta]);

  // useRef + função estável: a BarraLateral põe aoFechar na lista do
  // useEffect dela, e uma função nova a cada render religaria o listener.
  const fechar = useRef(() => setAberta(false)).current;

  return (
    <div className={'moldura' + (aberta ? ' moldura-lateral-aberta' : '')}>
      {telaDaPessoa ? (
        <header className="moldura-topo">
          <h1 className="moldura-titulo-pessoa">{sessao.nomeExibicao()}</h1>
        </header>
      ) : (
        <header className="moldura-topo">
          <span className="moldura-marca">TECLAR</span>
          <BotaoPessoa campanha={campanha} xpPorNivel={xpPorNivel} />
        </header>
      )}

      <BarraLateral aberta={aberta} ativo={ativo} aoFechar={fechar} />

      {/* Some enquanto a barra está aberta: o X dela é quem fecha. */}
      {!esconderMenu && (
        <button
          type="button"
          className="moldura-abrir tecla"
          ref={botaoAbrir}
          onClick={() => setAberta(true)}
          aria-label="Abrir menu"
          aria-expanded={aberta}
          aria-controls="barra-lateral"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      )}

      {/* A entrada da página mora aqui, e não no #raiz do HTML: ver o
          comentário em pages/solo/caminho.html. */}
      <div className="moldura-conteudo entrada-da-pagina">{children}</div>
    </div>
  );
}
