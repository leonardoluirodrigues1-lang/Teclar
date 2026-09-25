// TopoAluno.tsx
// O topo das telas do modo Aluno: a marca à esquerda e, à direita, o botão
// do nome (retrato com a inicial, nome e RP), que abre o menu com o RP em
// destaque, Convites, Meu histórico, Trocar de modo e Sair. Usado por
// js/aluno/Dashboard.tsx, Sala.tsx, Convites.tsx e Historico.tsx; o
// desenho está em css/aluno.css.
//
// O AVISO VERMELHO: com convite pendente, um ponto vermelho com o número
// aparece no retrato e de novo na linha "Convites" do menu. É o único
// vermelho destas telas, e está aí porque precisa ser notado.
//
// Os hrefs são relativos a pages/aluno/, onde moram as telas.

import { useEffect, useRef, useState } from 'react';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { ROTA_LOGIN } from '../config.js';
import { formatarRp } from '../utils/formato.js';
import { Modal } from './ModalReact.js';
import type { Usuario } from '../nucleo/tipos.js';

interface PropsTopoAluno {
  usuario: Usuario;
  /**
   * Quantos convites estão pendentes, quando a TELA já sabe: a de
   * convites passa o tamanho da lista dela, e o aviso recalcula a cada
   * aceitar ou recusar, sem pedir de novo. null: a tela ainda está
   * carregando. Ausente: o próprio topo pergunta ao back.
   */
  convites?: number | null;
}

// Trocar de modo: a sessão de aluno não abre o Solo nem o Professor, que
// são da conta. Então sai da sessão de aluno e vai para o login da conta
// (de lá, a tela de modo). Mesmo caminho do guarda.sair(), outro destino.
function sairParaConta() {
  api.auth.sair().catch(() => {});
  sessao.sair();
  window.location.replace(ROTA_LOGIN);
}

export function TopoAluno({ usuario, convites }: PropsTopoAluno) {
  // O id do aluno É o RP. O nome vem da conta dona; sem nome, a tela
  // mostra o RP no lugar dele e não repete o RP embaixo.
  const rp = formatarRp(usuario.id);
  const nome = usuario.nome || null;

  const [aberto, setAberto] = useState(false);
  // Chave do modal de trocar de modo (null = fechado), como o ModalReact pede.
  const [modal, setModal] = useState<number | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const pendentes = useConvitesPendentes(convites);

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
          {pendentes > 0 && <AvisoDeConvites quantidade={pendentes} classe="aluno-aviso-retrato" />}
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
        <a className="aluno-menu-item" href="convites.html" role="menuitem">
          Convites
          {pendentes > 0 && <AvisoDeConvites quantidade={pendentes} classe="aluno-aviso-linha" />}
        </a>
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

      {modal !== null && (
        <Modal
          key={modal}
          eyebrow="Aluno"
          titulo="Trocar de modo?"
          acoes={[
            { rotulo: 'Sair e ir para o login', principal: true, fecha: false, aoClicar: sairParaConta },
            { rotulo: 'Cancelar' },
          ]}
          aoFechar={() => setModal(null)}
        >
          <p>
            Você vai sair da entrada de aluno e voltar ao login. O Solo e o Professor abrem com o e-mail e a
            senha da sua conta.
          </p>
        </Modal>
      )}
    </header>
  );
}

// O ponto vermelho com o número. O texto escondido diz a quem ouve a tela
// o que o número é; o número em si fica aria-hidden para não ser lido duas
// vezes.
function AvisoDeConvites({ quantidade, classe }: { quantidade: number; classe: string }) {
  return (
    <span className={`aluno-aviso ${classe}`}>
      <span aria-hidden="true">{quantidade}</span>
      <span className="aluno-sr">
        {quantidade === 1 ? '1 convite pendente' : `${quantidade} convites pendentes`}
      </span>
    </span>
  );
}

// Quantos convites pendentes. Quando a tela informa (ver PropsTopoAluno),
// vale o dela; senão, pergunta ao back uma vez. Falhou: 0 — o aviso é
// ajuda, e a tela de convites continua a um clique no menu.
function useConvitesPendentes(daTela: number | null | undefined): number {
  const [doBack, setDoBack] = useState(0);
  const telaInforma = daTela !== undefined;

  useEffect(() => {
    if (telaInforma) return;
    let cancelado = false;
    api.aluno
      .convites()
      .then((lista) => {
        if (!cancelado) setDoBack(lista.length);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [telaInforma]);

  return telaInforma ? (daTela ?? 0) : doBack;
}
