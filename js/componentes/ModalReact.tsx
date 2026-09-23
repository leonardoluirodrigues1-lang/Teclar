// ModalReact.tsx
// O modal de vidro em React (substituiu o antigo modal.ts em JS puro,
// já apagado). Mesmo markup,
// mesmas classes de css/componentes/modais.css e as mesmas três coisas que
// todo modal precisa fazer direito:
//   1. fecha com Esc;
//   2. prende o foco dentro enquanto está aberto (Tab não vaza para a tela);
//   3. devolve o foco ao elemento que estava ativo antes de abrir.
//
// O modal.js continua existindo para as telas em JS puro. Este arquivo é a
// versão para as telas React — o papel é o mesmo, a forma de usar é a de
// um componente. O nome do ARQUIVO não é Modal.tsx de propósito: o tsc
// gera o .js ao lado do .tsx, e em sistema de arquivos sem distinção de
// caixa (Windows, macOS) "Modal.js" e "modal.js" são o mesmo arquivo — o
// gerado sobrescreveria o modal.js das telas em JS. O export é `Modal`.
//
//   import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
//   const modal = useRef<ModalHandle>(null);
//   <Modal
//     key={chave}                       // ver "chave" abaixo
//     ref={modal}
//     eyebrow="Nova turma"
//     titulo="Criar turma"
//     acoes={[
//       { rotulo: 'Criar turma', principal: true, fecha: false, aoClicar: confirmar },
//       { rotulo: 'Cancelar' },
//     ]}
//     aoFechar={() => setModal(null)}   // desmonta DEPOIS da transição de saída
//   >
//     ...conteúdo...
//   </Modal>
//   modal.current?.fechar();            // fecha por código (ex.: no sucesso)
//
// Diferenças de mecânica em relação ao modal.js, e só de mecânica:
//   · o overlay entra no <body> por createPortal, no mesmo lugar em que o
//     modal.js fazia document.body.appendChild;
//   · aoFechar é chamado ao FIM da transição de saída (--t-medio), porque é
//     ele que a tela usa para desmontar o componente — se desmontasse na
//     hora, a saída não animaria;
//   · a tela deve trocar a `key` a cada abertura. Uma instância fechada não
//     reabre; com a key, abrir de novo durante a saída da anterior monta um
//     modal novo em vez de reaproveitar o que está saindo.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent as MouseEventReact,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { duracaoDoToken } from '../utils/movimento.js';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AcaoModal {
  rotulo: string;
  principal?: boolean;
  aoClicar?: () => void;
  /** false: o botão não fecha o modal sozinho (quem fecha é o sucesso). */
  fecha?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export interface ModalHandle {
  fechar: () => void;
  /** A caixa do modal (.modal), para quem precisa achar um botão dentro. */
  el: HTMLDivElement | null;
}

interface PropsModal {
  eyebrow?: string;
  titulo?: string;
  acoes?: AcaoModal[];
  fecharComEsc?: boolean;
  fecharAoClicarFora?: boolean;
  /** Roda no mesmo frame em que o modal ganha a classe .aberto e o foco
   *  inicial — é onde a tela decide focar um campo em vez do botão. */
  aoAbrir?: () => void;
  /** Chamado ao fim da transição de saída. É o sinal para desmontar. */
  aoFechar?: () => void;
  children?: ReactNode;
}

export const Modal = forwardRef<ModalHandle, PropsModal>(function Modal(
  {
    eyebrow = '',
    titulo = '',
    acoes = [],
    fecharComEsc = true,
    fecharAoClicarFora = false,
    aoAbrir,
    aoFechar,
    children,
  },
  ref
) {
  const overlay = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // Classe .aberto: entra um frame depois da montagem, para a transição de
  // entrada acontecer; sai no fechar.
  const [aberto, setAberto] = useState(false);

  // Capturados na primeira renderização — antes de qualquer foco mudar.
  const [focoAnterior] = useState(() => document.activeElement);
  const [idTitulo] = useState(() => `modal-titulo-${Date.now().toString(36)}`);

  const fechado = useRef(false);
  const timer = useRef<number | null>(null);

  // As props mais recentes, para os listeners de documento (ligados uma
  // vez) não ficarem presos à primeira renderização.
  const props = useRef({ fecharComEsc, aoAbrir, aoFechar });
  props.current = { fecharComEsc, aoAbrir, aoFechar };

  function focaveis(): HTMLElement[] {
    return caixa.current ? [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)] : [];
  }

  function fechar() {
    if (fechado.current) return;
    fechado.current = true;
    setAberto(false);

    // Devolve o foco a quem tinha antes, se ainda estiver na página.
    if (focoAnterior instanceof HTMLElement && document.contains(focoAnterior)) {
      focoAnterior.focus();
    }
    // Espera a saída de modais.css (--t-medio) terminar antes de desmontar.
    const saidaMs = duracaoDoToken('--t-medio', 240);
    timer.current = window.setTimeout(() => props.current.aoFechar?.(), saidaMs);
  }

  useImperativeHandle(ref, () => ({
    fechar,
    get el() {
      return caixa.current;
    },
  }));

  useEffect(() => {
    // Foco inicial: o botão principal, senão o primeiro focável, senão a caixa.
    const quadro = requestAnimationFrame(() => {
      setAberto(true);
      const principal = caixa.current?.querySelector<HTMLElement>('.modal-botao-solido');
      (principal ?? focaveis()[0] ?? caixa.current)?.focus();
      props.current.aoAbrir?.();
    });

    function aoTeclar(evento: KeyboardEvent) {
      // Depois de fechar, o modal ainda está no DOM pela transição de
      // saída; o modal.js já tinha desligado os listeners neste ponto.
      if (fechado.current) return;

      if (evento.key === 'Escape' && props.current.fecharComEsc) {
        evento.preventDefault();
        evento.stopPropagation();
        fechar();
        return;
      }
      if (evento.key !== 'Tab') return;

      // Prende o foco: Tab no último volta ao primeiro, Shift+Tab no primeiro
      // vai ao último.
      const lista = focaveis();
      if (lista.length === 0) {
        evento.preventDefault();
        caixa.current?.focus();
        return;
      }
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const ativo = document.activeElement;
      if (evento.shiftKey && (ativo === primeiro || !caixa.current?.contains(ativo))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && ativo === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    // Se algo fora do modal ganhar foco (clique na tela por trás), puxa de volta.
    function aoFocar(evento: FocusEvent) {
      if (fechado.current) return;
      if (!caixa.current?.contains(evento.target as Node)) {
        evento.stopPropagation();
        (focaveis()[0] ?? caixa.current)?.focus();
      }
    }

    // capture: pega a tecla antes de qualquer listener da tela.
    document.addEventListener('keydown', aoTeclar, true);
    document.addEventListener('focus', aoFocar, true);

    return () => {
      cancelAnimationFrame(quadro);
      document.removeEventListener('keydown', aoTeclar, true);
      document.removeEventListener('focus', aoFocar, true);
      // Desmontado antes de a saída terminar (a tela abriu outro modal):
      // o aoFechar deste não pode disparar em cima do novo.
      if (timer.current != null) clearTimeout(timer.current);
    };
  }, []);

  function aoClicarOverlay(evento: MouseEventReact) {
    if (fecharAoClicarFora && evento.target === overlay.current) fechar();
  }

  return createPortal(
    <div
      className={`modal-overlay${aberto ? ' aberto' : ''}`}
      ref={overlay}
      onClick={aoClicarOverlay}
    >
      <div
        className="modal vidro"
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        tabIndex={-1} // recebe o foco inicial se não houver botão
      >
        {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
        {titulo && (
          <h2 className="modal-titulo" id={idTitulo}>
            {titulo}
          </h2>
        )}
        {children != null && <div className="modal-corpo">{children}</div>}
        {acoes.length > 0 && (
          <div className="modal-acoes">
            {acoes.map((acao, indice) => (
              <button
                key={indice}
                type="button"
                className={`modal-botao ${acao.principal ? 'modal-botao-solido' : 'modal-botao-vidro'}`}
                disabled={acao.disabled}
                hidden={acao.hidden}
                onClick={() => {
                  acao.aoClicar?.();
                  if (acao.fecha !== false) fechar();
                }}
              >
                {acao.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
});
