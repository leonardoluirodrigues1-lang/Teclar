// MenuDeAcoes.tsx — o "⋯" discreto de uma linha de tabela, com as ações
// dela num menu suspenso. A mecânica é a do menu do cartão de turma
// (professor/Turmas.tsx), num componente só:
//   · abrir põe o foco no primeiro item; setas ↑ ↓ andam entre eles;
//   · Esc ou clique fora fecha, e o foco volta ao "⋯";
//   · escolher fecha, devolve o foco ao "⋯" e SÓ ENTÃO roda a ação — o
//     modal que ela abre guarda quem tinha o foco, e o item já não existe.
// A lista é position: fixed, medida pelo botão: a tabela rola na horizontal
// (overflow-x: auto) e cortaria um menu absoluto nas últimas linhas. Por
// isso rolar a página fecha o menu, em vez de deixá-lo solto no lugar.
// Desenho em css/escola.css (.menu-acoes).

import { useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact } from 'react';

export interface AcaoDoMenu {
  rotulo: string;
  aoEscolher: () => void;
  /** Ação que apaga alguma coisa: o item vem em vermelho. */
  perigo?: boolean;
}

interface PropsMenuDeAcoes {
  /** O que o leitor de tela ouve no "⋯": "Ações de Ana Pires". */
  rotulo: string;
  acoes: AcaoDoMenu[];
}

export function MenuDeAcoes({ rotulo, acoes }: PropsMenuDeAcoes) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });

    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setAberto(false);
        botao.current?.focus();
      }
    }
    function aoRolar() {
      setAberto(false);
    }
    document.addEventListener('click', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    // capture: a rolagem é de uma caixa (a moldura, a tabela), não da janela.
    document.addEventListener('scroll', aoRolar, true);
    window.addEventListener('resize', aoRolar);
    return () => {
      document.removeEventListener('click', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('resize', aoRolar);
    };
  }, [aberto]);

  function andar(evento: KeyboardEventReact) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    evento.preventDefault();
    const itens = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const passo = evento.key === 'ArrowDown' ? 1 : -1;
    itens[(atual + passo + itens.length) % itens.length]?.focus();
  }

  function escolher(acao: AcaoDoMenu) {
    setAberto(false);
    botao.current?.focus();
    acao.aoEscolher();
  }

  return (
    <div className="menu-acoes">
      <button
        type="button"
        className="menu-acoes-botao"
        ref={botao}
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => {
          const caixa = botao.current?.getBoundingClientRect();
          if (caixa) setPosicao({ top: caixa.bottom + 4, right: window.innerWidth - caixa.right });
          setAberto((atual) => !atual);
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {aberto && (
        <div className="menu-acoes-lista" ref={menu} role="menu" aria-label={rotulo} onKeyDown={andar} style={posicao}>
          {acoes.map((acao) => (
            <button
              key={acao.rotulo}
              type="button"
              role="menuitem"
              className={acao.perigo ? 'menu-item menu-item-perigo' : 'menu-item'}
              onClick={() => escolher(acao)}
            >
              {acao.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
