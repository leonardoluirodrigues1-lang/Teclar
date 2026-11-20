// A moldura de TODAS as telas logadas (Solo, Professor e Aluno). Nasceu
// como a moldura do Solo e virou a única navegação do site:
//   · topo à esquerda  — "← voltar" para o nível de cima, nas telas
//                        internas; a marca TECLAR nas telas de início;
//   · topo à direita   — a pessoa. No Solo é uma tecla que leva ao painel
//                        (inicial, nome, nível e barra de XP); no Professor
//                        e no Aluno, só a inicial, o nome e o papel;
//   · canto de baixo   — o botão redondo que abre a barra lateral;
//   · barra lateral    — os itens do modo, o atual destacado, e, separados,
//                        as saídas (outro modo, trocar de modo, sair).
// O título da tela (o <h1>, com a frase do que ela serve) continua dentro
// do conteúdo de cada tela.
//
//   <Moldura modo="professor" ativo="biblioteca" voltar={VOLTAR_TURMAS}>
//     ...conteúdo...
//   </Moldura>
//
// A barra lateral NÃO escurece a tela nem cobre o conteúdo: ela ocupa a
// faixa da esquerda e o conteúdo anda para a direita, continuando visível
// (.moldura-lateral-aberta, em css/componentes/moldura.css).
//
// Os hrefs são absolutos (/pages/...): a mesma moldura serve a telas de
// pastas diferentes.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { CONFIG, ROTA_INICIAL } from '../config.js';
import type { Campanha } from '../nucleo/tipos.js';
import { progressoDe } from './BarraXp.js';
import { IconeSair } from './IconesDoTutorial.js';

export type ModoDaMoldura = 'solo' | 'professor' | 'aluno';

/** Qual item da barra lateral é a tela atual. */
export type TelaDaMoldura =
  | 'caminho'
  | 'configuracoes'
  | 'ajuda'
  | 'sobre'
  | 'turmas'
  | 'biblioteca'
  | 'relatorios'
  | 'sala'
  | 'historico';

/** Para onde o "← voltar" do topo leva. */
export interface Voltar {
  href: string;
  rotulo: string;
}

// Os "voltar" mais comuns, para as telas não repetirem o texto.
export const VOLTAR_TURMAS: Voltar = { href: '/pages/professor/turmas.html', rotulo: 'Turmas' };
export const VOLTAR_INICIO_SOLO: Voltar = { href: '/pages/solo/caminho.html', rotulo: 'Início' };

interface PropsMoldura {
  modo?: ModoDaMoldura;
  /** null: a tela não está na barra lateral. */
  ativo: TelaDaMoldura | null;
  /** Telas internas: o nível de cima. Sem ele, o topo mostra a marca. */
  voltar?: Voltar;
  /** true enquanto o tutorial está na tela: o botão redondo cairia em cima
   *  dos pontinhos e dos botões do rodapé dele. */
  esconderMenu?: boolean;
  /** Só no painel do Solo: o nome da pessoa é o título, no topo. */
  telaDaPessoa?: boolean;
  /** Classes da caixa do conteúdo (as telas da Escola passam "pagina"). */
  classeDoConteudo?: string;
  children: ReactNode;
}

// Ícones — SVG traçado em linha, feitos à mão. viewBox 24×24 e só traço: a
// cor e a espessura vêm do CSS (.barra-lateral-item svg).
function Icone({ d, circulo }: { d: string; circulo?: [number, number, number] }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {circulo && <circle cx={circulo[0]} cy={circulo[1]} r={circulo[2]} />}
      <path d={d} />
    </svg>
  );
}
const ICONES = {
  inicio: <Icone d="M3 11l9-8 9 8M5 10v10h14V10" />,
  configuracoes: (
    <Icone circulo={[12, 12, 3.2]} d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  ),
  ajuda: <Icone circulo={[12, 12, 9]} d="M9.5 9.5a2.5 2.5 0 113.3 2.4c-.6.2-.8.7-.8 1.3v.5M12 17h.01" />,
  sobre: <Icone circulo={[12, 12, 9]} d="M12 11v5M12 8h.01" />,
  pessoa: <Icone circulo={[12, 8, 4]} d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2" />,
  trocar: <Icone d="M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M18 3v4h-4M6 21v-4h4" />,
  turmas: <Icone d="M3 7h18v12H3zM8 7V5h8v2" />,
  biblioteca: <Icone d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1 -3.6 15 -3.8-1z" />,
  relatorios: <Icone d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  teclado: <Icone d="M3 7h18v10H3zM6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M8 14h8" />,
  historico: <Icone circulo={[12, 12, 9]} d="M12 7v5l3 2" />,
};

interface Item {
  tela: TelaDaMoldura;
  rotulo: string;
  href: string;
  icone: ReactNode;
}

// Os itens de cada modo, na ordem da barra.
function itensDo(modo: ModoDaMoldura): Item[] {
  if (modo === 'professor') {
    return [
      { tela: 'turmas', rotulo: 'Turmas', href: '/pages/professor/turmas.html', icone: ICONES.turmas },
      { tela: 'biblioteca', rotulo: 'Biblioteca', href: '/pages/professor/biblioteca.html', icone: ICONES.biblioteca },
      { tela: 'relatorios', rotulo: 'Relatórios', href: '/pages/professor/relatorios.html', icone: ICONES.relatorios },
      { tela: 'configuracoes', rotulo: 'Configurações', href: '/pages/professor/configuracoes.html', icone: ICONES.configuracoes },
    ];
  }
  if (modo === 'aluno') {
    return [
      { tela: 'sala', rotulo: 'Minha sala', href: ROTA_INICIAL.aluno, icone: ICONES.inicio },
      { tela: 'historico', rotulo: 'Meu histórico', href: '/pages/aluno/historico.html', icone: ICONES.historico },
    ];
  }
  return [
    { tela: 'caminho', rotulo: 'Início', href: '/pages/solo/caminho.html', icone: ICONES.inicio },
    { tela: 'configuracoes', rotulo: 'Configurações', href: '/pages/solo/configuracoes.html', icone: ICONES.configuracoes },
    { tela: 'ajuda', rotulo: 'Ajuda', href: '/pages/solo/ajuda.html', icone: ICONES.ajuda },
    { tela: 'sobre', rotulo: 'Sobre', href: '/pages/solo/sobre.html', icone: ICONES.sobre },
  ];
}

const NOME_DO_MENU: Record<ModoDaMoldura, string> = {
  solo: 'Menu do Solo',
  professor: 'Menu do Professor',
  aluno: 'Menu do aluno',
};

// "Leonardo" -> "L". Sem nome, fica vazio: melhor que um placeholder.
function inicialDoNome(nome: string): string {
  return nome.trim().charAt(0).toUpperCase();
}

// Topo à direita, no Solo: a pessoa, com nível e XP, levando ao painel.
// Nível e XP saem das MESMAS rotas e da MESMA conta que o painel usa
// (GET /solo/campanha, GET /parametros e progressoDe()).
function BotaoPessoaSolo({ campanha, xpPorNivel }: { campanha: Campanha | null; xpPorNivel: number }) {
  const nome = sessao.nomeExibicao();
  const progresso = campanha ? progressoDe(campanha, xpPorNivel) : null;
  const rotulo = progresso
    ? `Abrir seu painel: ${nome}, nível ${progresso.nivel}, ${progresso.noNivel} de ${progresso.porNivel} XP`
    : `Abrir seu painel: ${nome}`;

  return (
    <a className="moldura-pessoa tecla" href="/pages/solo/dashboard.html" aria-label={rotulo}>
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

// Topo à direita, no Professor e no Aluno: quem está logado e em que papel.
function Pessoa({ papel }: { papel: string }) {
  const nome = sessao.nomeExibicao();
  return (
    <div className="moldura-pessoa moldura-pessoa-fixa">
      <span className="moldura-pessoa-inicial" aria-hidden="true">
        {inicialDoNome(nome)}
      </span>
      <span className="moldura-pessoa-texto">
        <span className="moldura-pessoa-nome">{nome}</span>
        <span className="moldura-pessoa-nivel">{papel}</span>
      </span>
    </div>
  );
}

// Tudo o que recebe foco dentro da barra, na ordem da tela.
function focaveisDe(barra: HTMLElement): HTMLElement[] {
  return Array.from(barra.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'));
}

interface PropsBarraLateral {
  modo: ModoDaMoldura;
  aberta: boolean;
  ativo: TelaDaMoldura | null;
  aoFechar: () => void;
}

function BarraLateral({ modo, aberta, ativo, aoFechar }: PropsBarraLateral) {
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

  return (
    // Fechada, ela sai da tela e fica com visibility: hidden: nem o Tab nem
    // o leitor de tela a encontram, sem tirá-la do DOM (tirar mataria a
    // animação de entrada e saída).
    <nav
      className={'vidro barra-lateral' + (aberta ? ' barra-lateral-aberta' : '')}
      id="barra-lateral"
      ref={barra}
      aria-label={NOME_DO_MENU[modo]}
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

      {itensDo(modo).map((item) => (
        <a
          key={item.tela}
          className={'barra-lateral-item' + (item.tela === ativo ? ' barra-lateral-item-ativo' : '')}
          href={item.href}
          aria-current={item.tela === ativo ? 'page' : undefined}
        >
          {item.icone} {item.rotulo}
        </a>
      ))}

      <hr className="barra-lateral-divisoria" />

      {/* As saídas. O aluno não tem outro modo: só sai. */}
      {modo === 'solo' && (
        <button type="button" className="barra-lateral-item" onClick={() => guarda.trocarModo('professor')}>
          {ICONES.pessoa} Ir para Professor
        </button>
      )}
      {modo === 'professor' && (
        <button type="button" className="barra-lateral-item" onClick={() => guarda.trocarModo('solo')}>
          {ICONES.teclado} Ir para o Solo
        </button>
      )}
      {modo !== 'aluno' && (
        <a className="barra-lateral-item" href="/pages/modo.html">
          {ICONES.trocar} Trocar de modo
        </a>
      )}
      <button type="button" className="barra-lateral-item" onClick={() => guarda.sair()}>
        <IconeSair /> Sair
      </button>

      <span className="barra-lateral-versao">v{CONFIG.VERSAO}</span>
    </nav>
  );
}

export function Moldura({
  modo = 'solo',
  ativo,
  voltar,
  esconderMenu = false,
  telaDaPessoa = false,
  classeDoConteudo = '',
  children,
}: PropsMoldura) {
  const [aberta, setAberta] = useState(false);
  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [xpPorNivel, setXpPorNivel] = useState(CONFIG.SOLO.XP_POR_NIVEL);
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  // Para não roubar o foco no primeiro desenho da tela: só devolve o foco
  // ao botão redondo quando a barra acabou de FECHAR.
  const jaAbriu = useRef(false);

  // Só o botão da pessoa do Solo usa a campanha e o custo do nível. Se uma
  // das duas falhar, ele fica só com o nome ou usa o espelho do config.
  useEffect(() => {
    if (modo !== 'solo' || telaDaPessoa) return;
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
  }, [modo, telaDaPessoa]);

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

  const papel = modo === 'professor' ? 'Professor' : (sessao.usuario()?.turmas?.[0]?.nome ?? 'Aluno');

  return (
    <div className={`moldura moldura-${modo}` + (aberta ? ' moldura-lateral-aberta' : '')}>
      <header className="moldura-topo">
        <div className="moldura-esquerda">
          {voltar ? (
            <a className="moldura-voltar tecla" href={voltar.href}>
              <span aria-hidden="true">←</span> {voltar.rotulo}
            </a>
          ) : (
            !telaDaPessoa && <span className="moldura-marca">TECLAR</span>
          )}
          {telaDaPessoa && <h1 className="moldura-titulo-pessoa">{sessao.nomeExibicao()}</h1>}
        </div>
        {telaDaPessoa ? null : modo === 'solo' ? (
          <BotaoPessoaSolo campanha={campanha} xpPorNivel={xpPorNivel} />
        ) : (
          <Pessoa papel={papel} />
        )}
      </header>

      <BarraLateral modo={modo} aberta={aberta} ativo={ativo} aoFechar={fechar} />

      {/* Some enquanto a barra está aberta: o X dela é quem fecha. */}
      {!esconderMenu && (
        <button
          type="button"
          className="moldura-abrir tecla"
          ref={botaoAbrir}
          onClick={() => setAberta(true)}
          aria-label="Abrir menu"
          title="Menu"
          aria-expanded={aberta}
          aria-controls="barra-lateral"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      )}

      <div className="moldura-conteudo entrada-da-pagina">
        {classeDoConteudo ? <div className={classeDoConteudo}>{children}</div> : children}
      </div>
    </div>
  );
}
