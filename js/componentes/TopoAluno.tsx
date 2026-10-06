// TopoAluno.tsx
// O topo da tela de histórico do Aluno: a marca à esquerda e, à direita, o
// botão do nome (retrato com a inicial, nome e turma), que abre o menu com
// a turma em destaque, Meu histórico, Trocar de modo e Sair. Usado por
// js/aluno/Historico.tsx; o desenho está em css/aluno.css. As salas e a
// sala usam a conta fixa no canto (componentes/EntradaDoModo.tsx).
//
// Os hrefs são relativos a pages/aluno/, onde moram as telas.

import { useEffect, useRef, useState } from 'react';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { ROTA_LOGIN } from '../config.js';
import { Modal } from './ModalReact.js';
import type { Usuario } from '../nucleo/tipos.js';

interface PropsTopoAluno {
  usuario: Usuario;
}

// Trocar de modo: a sessão de aluno não abre o Solo nem o Professor, que
// são da conta. Então sai da sessão de aluno e vai para o login da conta
// (de lá, a tela de modo). Mesmo caminho do guarda.sair(), outro destino.
function sairParaConta() {
  api.auth.sair().catch(() => {});
  sessao.sair();
  window.location.replace(ROTA_LOGIN);
}

export function TopoAluno({ usuario }: PropsTopoAluno) {
  // O nome é o da lista da turma; a turma é a do login (uma só, na v8).
  const nome = usuario.nome || null;
  const turma = usuario.turmas?.[0]?.nome ?? null;

  const [aberto, setAberto] = useState(false);
  // Chave do modal de trocar de modo (null = fechado), como o ModalReact pede.
  const [modal, setModal] = useState<number | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  // Esc e clique fora fecham. Os listeners só existem com o menu aberto.
  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLElement>('.aluno-menu-item')?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        fechar(true);
      }
    }
    // `contains`, e não `===`: o clique costuma cair num <span> dentro do
    // botão, e fechar aqui faria o clique do botão reabrir o menu.
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar(false);
    }

    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('click', aoClicarFora, true);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('click', aoClicarFora, true);
    };
  }, [aberto]);

  return (
    <header className="aluno-topo">
      <a className="aluno-marca" href="dashboard.html" aria-label="Suas salas">
        TECLAR
      </a>

      <button
        type="button"
        className="aluno-chip vidro tecla"
        ref={botao}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls="menu-aluno"
        onClick={() => (aberto ? fechar(true) : setAberto(true))}
      >
        <span className="aluno-inicial">
          <span aria-hidden="true">{nome ? nome[0].toUpperCase() : '—'}</span>
        </span>
        <span>
          <span className="aluno-chip-nome">{nome ?? 'Aluno'}</span>
          {turma && <span className="aluno-chip-rp">{turma}</span>}
        </span>
      </button>

      <div className="aluno-menu vidro" id="menu-aluno" ref={menu} role="menu" hidden={!aberto}>
        {turma && (
          <div className="aluno-menu-rp">
            <span className="aluno-rotulo">Sua turma</span>
            <b>{turma}</b>
          </div>
        )}
        <a className="aluno-menu-item" href="historico.html" role="menuitem">
          Meu histórico
        </a>
        <hr />
        <button
          type="button"
          className="aluno-menu-item"
          role="menuitem"
          onClick={() => {
            fechar(false);
            setModal(Date.now());
          }}
        >
          Trocar de modo
        </button>
        <button type="button" className="aluno-menu-item" role="menuitem" onClick={() => guarda.sair()}>
          Sair
        </button>
      </div>

      {modal !== null && <ModalTrocarModoDoAluno key={modal} aoFechar={() => setModal(null)} />}
    </header>
  );
}

// A confirmação de "Trocar de modo" da entrada de aluno. Exportada porque o
// menu da conta fixa (componentes/Nav.tsx, na tela de salas) pergunta a
// mesma coisa, do mesmo jeito.
export function ModalTrocarModoDoAluno({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Modal
      eyebrow="Aluno"
      titulo="Trocar de modo?"
      acoes={[
        { rotulo: 'Sair e ir para o login', principal: true, fecha: false, aoClicar: sairParaConta },
        { rotulo: 'Cancelar' },
      ]}
      aoFechar={aoFechar}
    >
      <p>
        Você vai sair da entrada de aluno e voltar ao login. O Solo e o Professor abrem com o e-mail e a
        senha da sua conta.
      </p>
    </Modal>
  );
}
