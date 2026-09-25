// TopoAluno.tsx
// O topo das telas do modo Aluno: a marca à esquerda e, à direita, o botão
// do nome (retrato com a inicial, nome e RP), que abre o menu com o RP em
// destaque, Meu histórico, Trocar de modo e Sair. Usado por
// js/aluno/Dashboard.tsx, js/aluno/Sala.tsx e js/aluno/Historico.tsx; o
// desenho está em css/aluno.css.
//
// Os hrefs são relativos a pages/aluno/, onde moram as três telas.

import { useEffect, useRef, useState } from 'react';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { ROTA_LOGIN } from '../config.js';
import { formatarRp } from '../utils/formato.js';
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
  // O id do aluno É o RP. O nome vem da conta dona; sem nome, a tela
  // mostra o RP no lugar dele e não repete o RP embaixo.
  const rp = formatarRp(usuario.id);
  const nome = usuario.nome || null;

  const [aberto, setAberto] = useState(false);
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
        <span className="aluno-inicial" aria-hidden="true">
          {nome ? nome[0].toUpperCase() : '—'}
        </span>
        <span>
          <span className="aluno-chip-nome">{nome ?? rp}</span>
          {nome && <span className="aluno-chip-rp">{rp}</span>}
        </span>
      </button>

      <div className="aluno-menu vidro" id="menu-aluno" ref={menu} role="menu" hidden={!aberto}>
        <div className="aluno-menu-rp">
          <span className="aluno-rotulo">Seu RP</span>
          <b>{rp}</b>
        </div>
        <a className="aluno-menu-item" href="historico.html" role="menuitem">
          Meu histórico
        </a>
        <hr />
        <button type="button" className="aluno-menu-item" role="menuitem" onClick={sairParaConta}>
          Trocar de modo
        </button>
        <button type="button" className="aluno-menu-item" role="menuitem" onClick={() => guarda.sair()}>
          Sair
        </button>
      </div>
    </header>
  );
}
