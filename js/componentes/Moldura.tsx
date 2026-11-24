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
// No Professor a barra é a "Área do professor": em tela de 1024px ou mais
// ela fica FIXA à esquerda (sem botão de abrir nem X), com Minhas turmas,
// Biblioteca de exercícios e Relatórios gerais, e embaixo Configurações,
// Ajuda (o tutorial), a troca de modo, a saída e a conta logada. Abaixo de
// 1024px ela volta a abrir pelo botão ☰. Quem decide é o CSS (.moldura-professor).
//
// Os hrefs são absolutos (/pages/...): a mesma moldura serve a telas de
// pastas diferentes.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { CONFIG } from '../config.js';
import type { Campanha } from '../nucleo/tipos.js';
import { progressoDe } from './BarraXp.js';
import { IconeSair } from './IconesDoTutorial.js';
import { Avatar, useMinhaFoto, useUsuarioAtual } from './Avatar.js';

export type ModoDaMoldura = 'solo' | 'professor' | 'aluno';

/** Qual item da barra lateral é a tela atual. */
export type TelaDaMoldura =
  | 'caminho'
  | 'configuracoes'
  | 'ajuda'
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
export const VOLTAR_TURMAS: Voltar = { href: '/pages/professor/turmas.html', rotulo: 'Minhas turmas' };
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
  trocar: <Icone d="M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M18 3v4h-4M6 21v-4h4" />,
  turmas: <Icone d="M3 7h18v12H3zM8 7V5h8v2" />,
  biblioteca: <Icone d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1 -3.6 15 -3.8-1z" />,
  relatorios: <Icone d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
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
      { tela: 'turmas', rotulo: 'Minhas turmas', href: '/pages/professor/turmas.html', icone: ICONES.turmas },
      { tela: 'biblioteca', rotulo: 'Biblioteca de exercícios', href: '/pages/professor/biblioteca.html', icone: ICONES.biblioteca },
      { tela: 'relatorios', rotulo: 'Relatórios gerais', href: '/pages/professor/relatorios.html', icone: ICONES.relatorios },
    ];
  }
  if (modo === 'aluno') {
    return [
      // Direto na sala dele (com o ?id=): sem o id, sala.html acharia a sala e
      // trocaria de endereço logo ao abrir, e essa navegação no meio da
      // transição de página faz o Chrome abortar a transição (InvalidStateError).
      { tela: 'sala', rotulo: 'Minha sala', href: guarda.casa(), icone: ICONES.inicio },
      { tela: 'historico', rotulo: 'Meu histórico', href: '/pages/aluno/historico.html', icone: ICONES.historico },
    ];
  }
  return [
    { tela: 'caminho', rotulo: 'Início', href: '/pages/solo/caminho.html', icone: ICONES.inicio },
    { tela: 'ajuda', rotulo: 'Ajuda e sobre', href: '/pages/solo/ajuda.html', icone: ICONES.ajuda },
  ];
}

const ROTA_CONFIGURACOES: Record<ModoDaMoldura, string> = {
  solo: '/pages/solo/configuracoes.html',
  professor: '/pages/professor/configuracoes.html',
  aluno: '/pages/aluno/configuracoes.html',
};

const NOME_DO_MENU: Record<ModoDaMoldura, string> = {
  solo: 'Menu do Solo',
  professor: 'Menu do Professor',
  aluno: 'Menu do aluno',
};


// Topo à direita, no Solo: a pessoa, com nível e XP, levando ao painel.
// Nível e XP saem das MESMAS rotas e da MESMA conta que o painel usa
// (GET /solo/campanha, GET /parametros e progressoDe()).
function BotaoPessoaSolo({ campanha, xpPorNivel }: { campanha: Campanha | null; xpPorNivel: number }) {
  useUsuarioAtual();
  const foto = useMinhaFoto();
  const nome = sessao.nomeExibicao();
  const progresso = campanha ? progressoDe(campanha, xpPorNivel) : null;
  const rotulo = progresso
    ? `Abrir seu painel: ${nome}, nível ${progresso.nivel}, ${progresso.noNivel} de ${progresso.porNivel} XP`
    : `Abrir seu painel: ${nome}`;

  return (
    <a className="moldura-pessoa tecla" href="/pages/solo/dashboard.html" aria-label={rotulo}>
      <Avatar nome={nome} foto={foto} />
      <span className="moldura-pessoa-texto" aria-hidden="true">
        <span className="moldura-pessoa-nome">{nome}</span>
        {/* Embaixo do nome, a dica de que o nome abre o painel. Divide a linha
            com o nível para a etiqueta não crescer por cima da faixa do caminho. */}
        <span className="moldura-pessoa-linha">
          {progresso && <span className="moldura-pessoa-nivel">Nível {progresso.nivel}</span>}
          <span className="moldura-pessoa-dica">Ver meu painel →</span>
        </span>
        {progresso && (
          <span className="moldura-pessoa-trilho">
            <span style={{ width: `${progresso.percentual}%` }} />
          </span>
        )}
      </span>
    </a>
  );
}

// Topo à direita, no Professor e no Aluno: quem está logado e em que papel.
function Pessoa({ papel }: { papel: string }) {
  useUsuarioAtual();
  const foto = useMinhaFoto();
  const nome = sessao.nomeExibicao();
  return (
    <div className="moldura-pessoa moldura-pessoa-fixa">
      <Avatar nome={nome} foto={foto} />
      <span className="moldura-pessoa-texto">
        <span className="moldura-pessoa-nome">{nome}</span>
        <span className="moldura-pessoa-nivel">{papel}</span>
      </span>
    </div>
  );
}

// A pessoa logada, no pé da barra dos três modos: foto (ou inicial), nome
// e, embaixo, o e-mail da conta ou a turma do aluno.
function ContaDaBarra() {
  useUsuarioAtual();
  const foto = useMinhaFoto();
  const nome = sessao.nomeExibicao();
  const usuario = sessao.usuario();
  const detalhe = usuario?.email ?? usuario?.turmas?.[0]?.nome;
  return (
    <div className="barra-lateral-conta">
      <Avatar nome={nome} foto={foto} />
      <span className="moldura-pessoa-texto">
        <span className="moldura-pessoa-nome">{nome}</span>
        {detalhe && <span className="barra-lateral-email">{detalhe}</span>}
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
        {modo === 'professor' ? (
          <span className="barra-lateral-area">
            <span className="moldura-marca">TECLAR</span>
            <span className="barra-lateral-papel">Área do professor</span>
          </span>
        ) : (
          <span className="moldura-marca">TECLAR</span>
        )}
        <button
          type="button"
          className="barra-lateral-fechar tecla"
          ref={botaoFechar}
          onClick={aoFechar}
          aria-label="Fechar menu"
          title="Fechar menu"
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

      {/* Configurações: no MESMO lugar nos três modos, o primeiro item depois
          da divisória, logo acima das saídas. */}
      <a
        className={'barra-lateral-item' + (ativo === 'configuracoes' ? ' barra-lateral-item-ativo' : '')}
        href={ROTA_CONFIGURACOES[modo]}
        aria-current={ativo === 'configuracoes' ? 'page' : undefined}
      >
        {ICONES.configuracoes} Configurações
      </a>

      {/* Professor: a Ajuda é o tutorial do modo, o mesmo do "Rever" das
          Configurações: abre nas turmas. */}
      {modo === 'professor' && (
        <>
          <button
            type="button"
            className="barra-lateral-item"
            onClick={() => {
              sessao.esquecerTutorial('professor');
              window.location.href = '/pages/professor/turmas.html';
            }}
          >
            {ICONES.ajuda} Ajuda
          </button>
        </>
      )}

      {/* As saídas. Solo e professor trocam pela tela de modo; o aluno não
          tem outro modo: só sai. */}
      {modo !== 'aluno' && (
        <a className="barra-lateral-item" href="/pages/modo.html">
          {ICONES.trocar} Trocar de modo
        </a>
      )}
      <button type="button" className="barra-lateral-item" onClick={() => guarda.sair()}>
        <IconeSair /> Sair
      </button>

      {/* A pessoa logada, embaixo, nos três modos. */}
      <ContaDaBarra />

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

  const papel = sessao.usuario()?.turmas?.[0]?.nome ?? 'Aluno';

  return (
    <div className={`moldura moldura-${modo}` + (aberta ? ' moldura-lateral-aberta' : '')}>
      {/* Primeiro Tab da página: pula o topo e a barra (WCAG 2.4.1). */}
      <a className="moldura-pular" href="#moldura-corpo">
        Pular para o conteúdo
      </a>

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

      {/* É ele que rola (position: fixed), não a página: com tabIndex as setas e o
          PageDown rolam mesmo sem nada focável dentro (WCAG 2.1.1). O topo mora
          aqui dentro, e não fixo por cima: rola junto e nunca cobre o conteúdo
          (o bloco da pessoa cobria o "⋯" dos cartões). */}
      <div className="moldura-conteudo" id="moldura-conteudo" tabIndex={0}>
        <header className="moldura-topo">
          <div className="moldura-esquerda">
            {voltar ? (
              <a className="moldura-voltar tecla" href={voltar.href}>
                <span aria-hidden="true">←</span> {voltar.rotulo}
              </a>
            ) : (
              // No professor a marca fica só na barra lateral (que lá aparece
              // sempre aberta na tela larga): no topo seria a segunda.
              !telaDaPessoa && modo !== 'professor' && <span className="moldura-marca">TECLAR</span>
            )}
            {telaDaPessoa && <h1 className="moldura-titulo-pessoa">{sessao.nomeExibicao()}</h1>}
          </div>
          {telaDaPessoa || modo === 'professor' ? null : modo === 'solo' ? (
            <BotaoPessoaSolo campanha={campanha} xpPorNivel={xpPorNivel} />
          ) : (
            <Pessoa papel={papel} />
          )}
        </header>
        <div className="moldura-corpo entrada-da-pagina" id="moldura-corpo" tabIndex={-1}>
          {classeDoConteudo ? <div className={classeDoConteudo}>{children}</div> : children}
        </div>
      </div>
    </div>
  );
}
