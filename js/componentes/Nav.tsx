// Nav.tsx
// Barra do topo em pílula + avatar com o menu da conta. Nasceu em
// js/professor/turmas.js e foi copiada em turma.js e alunos.js; a migração
// para React é o momento em que ela vira UMA peça. Mesmo HTML e mesmas
// classes de css/escola.css — nada aqui foi redesenhado.
//
// O conjunto de seções (rótulo da <nav>, nome do modo no menu, o item de
// troca de modo e os itens) vem por propriedade, para a mesma barra servir
// a outros mundos:
//
//   <Nav secoes={SECOES_PROFESSOR} ativo="turmas" />
//
// Os hrefs de cada item são relativos à página que monta a Nav: os de
// SECOES_PROFESSOR valem para pages/professor/.

import { useEffect, useRef, useState } from 'react';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { Modo } from '../nucleo/tipos.js';
import { ModalTrocarModoDoAluno } from './TopoAluno.js';

export interface ItemNav {
  /** O que a tela passa em `ativo` para marcar este item com aria-current. */
  chave: string;
  rotulo: string;
  href: string;
}

export interface SecoesNav {
  /** aria-label da <nav>, ex.: 'Seções do professor'. */
  rotulo: string;
  /** Texto abaixo do nome no menu da conta, ex.: 'Professor'. */
  modo: string;
  /** O item "Ir para ..." do menu: o outro modo da conta. null na
   *  entrada de aluno, que não abre Solo nem Professor. */
  outroModo: { rotulo: string; modo: Modo } | null;
  itens: ItemNav[];
  /** 'aluno': a sessão é a entrada de aluno (código da turma, nome e senha), e o
   *  menu muda — ver MenuDaConta. */
  sessao: 'conta' | 'aluno';
}

export type SecaoProfessor = 'turmas' | 'biblioteca' | 'relatorios';

/** As seções das telas do professor — exatamente as de turmas.html. */
export const SECOES_PROFESSOR: SecoesNav = {
  rotulo: 'Seções do professor',
  modo: 'Professor',
  outroModo: { rotulo: 'Ir para o Solo', modo: 'solo' },
  itens: [
    { chave: 'turmas', rotulo: 'Turmas', href: 'turmas.html' },
    { chave: 'biblioteca', rotulo: 'Biblioteca', href: 'biblioteca.html' },
    { chave: 'relatorios', rotulo: 'Relatórios', href: 'relatorios.html' },
  ],
  sessao: 'conta',
};

/** A entrada de aluno. Não tem barra no topo — só o menu da conta fixa,
 *  nas telas de pages/aluno/. Sem itens de barra, por isso. */
export const SECOES_ALUNO: SecoesNav = {
  rotulo: 'Seções do aluno',
  modo: 'Aluno',
  outroModo: null,
  itens: [],
  sessao: 'aluno',
};

interface PropsNav {
  secoes: SecoesNav;
  /** A chave do item da página atual. */
  ativo: string;
}

// Duas primeiras iniciais: "Henrique Lima" -> "HL". Uma palavra só rende
// uma letra; sem nome nenhum, some — melhor vazio que um placeholder.
function iniciais(nome: string | null | undefined): string {
  return String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palavra) => palavra[0].toUpperCase())
    .join('');
}

export function Nav({ secoes, ativo }: PropsNav) {
  return (
    <header className="barra">
      <nav className="nav vidro" aria-label={secoes.rotulo}>
        <a className="nav-marca" href="../../index.html" aria-label="Voltar para a página inicial">
          <span>TECLAR</span>
        </a>
        {secoes.itens.map((item) => (
          <a
            key={item.chave}
            className="nav-item tecla"
            href={item.href}
            aria-current={ativo === item.chave ? 'page' : undefined}
          >
            {item.rotulo}
          </a>
        ))}
      </nav>

      <MenuDaConta secoes={secoes} />
    </header>
  );
}

// O avatar com o menu da conta, sem a barra. A Nav usa no canto dela; a
// tela de turmas, que não tem barra no topo, usa sozinho, fixo no canto.
export function MenuDaConta({ secoes }: { secoes: SecoesNav }) {
  // Conta: o nome da tabela Users. Aluno: o nome da lista da turma.
  const nome = sessao.nomeExibicao();

  const [aberto, setAberto] = useState(false);
  // A confirmação de trocar de modo do aluno. Um número (e não true) para
  // cada abertura montar um modal novo, como o ModalReact pede.
  const [modalAluno, setModalAluno] = useState<number | null>(null);
  const avatar = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const btnSair = useRef<HTMLButtonElement>(null);

  // Só no Esc e na escolha de um item: quem fechou clicando lá fora já
  // está com o foco em outro lugar de propósito.
  function fechar({ devolverFoco = false } = {}) {
    setAberto(false);
    if (devolverFoco) avatar.current?.focus();
  }

  // Os listeners de documento só existem enquanto o menu está aberto —
  // exatamente como o abrir()/fechar() do turmas.js ligava e desligava.
  useEffect(() => {
    if (!aberto) return;
    btnSair.current?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        fechar({ devolverFoco: true });
      }
    }

    // `contains`, e não `=== avatar`: o clique costuma cair no <span> das
    // iniciais, dentro do botão. Comparando o elemento exato, este listener
    // fecharia o menu na fase de captura e o clique do avatar, logo depois,
    // reabriria — o menu nunca fecharia pelo próprio avatar.
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!menu.current?.contains(alvo) && !avatar.current?.contains(alvo)) fechar();
    }

    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('click', aoClicarFora, true);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('click', aoClicarFora, true);
    };
  }, [aberto]);

  return (
    <div className="conta">
      <button
        type="button"
        className="avatar vidro tecla"
        id="avatar"
        ref={avatar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls="menu-conta"
        onClick={() => {
          if (!aberto) setAberto(true);
          else fechar({ devolverFoco: true });
        }}
      >
        <span id="avatar-iniciais" aria-hidden="true">
          {iniciais(nome)}
        </span>
        <span className="sr-only" id="avatar-rotulo">
          Conta de {nome}
        </span>
      </button>

      <div
        className="menu-conta vidro"
        id="menu-conta"
        ref={menu}
        role="menu"
        aria-labelledby="avatar"
        hidden={!aberto}
      >
        <div className="menu-cabecalho">
          <p className="menu-nome" id="menu-nome">
            {nome}
          </p>
          <p className="menu-modo">{secoes.modo}</p>
        </div>
        {secoes.sessao === 'aluno' ? (
          <ItensDoAluno
            aoTrocarDeModo={() => {
              fechar({ devolverFoco: true });
              setModalAluno(Date.now());
            }}
          />
        ) : (
          <ItensDaConta secoes={secoes} aoEscolher={() => fechar()} />
        )}
        {/* Sair fecha o menu antes de navegar, para o menu não ficar
              aberto se a navegação demorar. */}
        <button
          type="button"
          className="menu-item"
          id="btn-sair"
          ref={btnSair}
          role="menuitem"
          onClick={() => {
            guarda.sair();
            fechar();
          }}
        >
          Sair
        </button>
      </div>

      {modalAluno !== null && <ModalTrocarModoDoAluno key={modalAluno} aoFechar={() => setModalAluno(null)} />}
    </div>
  );
}

// Os itens da CONTA (Professor): o atalho para o outro modo e a tela dos
// três cartões. O href é relativo às páginas que montam o menu,
// todas em pages/<mundo>/.
function ItensDaConta({ secoes, aoEscolher }: { secoes: SecoesNav; aoEscolher: () => void }) {
  return (
    <>
      {/* Troca de modo: sem logout, sem tela intermediária. A mesma conta
          abre os dois mundos. */}
      {secoes.outroModo && (
        <button
          type="button"
          className="menu-item"
          id="btn-trocar-modo"
          role="menuitem"
          onClick={() => {
            guarda.trocarModo(secoes.outroModo.modo);
            aoEscolher();
          }}
        >
          {secoes.outroModo.rotulo}
        </button>
      )}
      {/* A tela dos três cartões (Professor, Solo, Aluno). O item acima é o
          atalho direto para o outro modo; este é a escolha completa — é por
          aqui que a conta chega à entrada de aluno sem sair. */}
      <a className="menu-item" href="../modo.html" role="menuitem" onClick={aoEscolher}>
        Trocar de modo
      </a>
    </>
  );
}

// Os itens da entrada de ALUNO. "Trocar de modo" não pode ir direto para
// ../modo.html: a sessão de aluno não abre o Solo nem o Professor, que são
// da conta. Por isso pergunta antes e sai da sessão (ModalTrocarModoDoAluno).
function ItensDoAluno({ aoTrocarDeModo }: { aoTrocarDeModo: () => void }) {
  return (
    <>
      <a className="menu-item" href="historico.html" role="menuitem">
        Meu histórico
      </a>
      <button type="button" className="menu-item" role="menuitem" onClick={aoTrocarDeModo}>
        Trocar de modo
      </button>
    </>
  );
}
