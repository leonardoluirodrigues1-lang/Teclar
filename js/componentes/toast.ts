// toast.ts
// Avisos curtos que aparecem e somem sozinhos. Só texto, sem botão, sem
// foco: um toast nunca interrompe o que a pessoa está fazendo. O host
// deve ter aria-live="polite" para o leitor de tela anunciar sem cortar.
//
//   const toasts = criarToasts(document.getElementById('toasts'), { maximo: 1 });
//   toasts.mostrar('Turma criada');
//   toasts.mostrar('25 seguidos', { conquista: true });
//
// `conquista` põe a estrela (./Estrela.tsx) antes do texto. Só para o que
// foi conquistado — nunca em aviso nem em erro.

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { duracaoDoToken } from '../utils/movimento.js';
import { Estrela } from './Estrela.js';

const DURACAO_PADRAO_MS = 1800;

export interface Toasts {
  /** Mostra um toast e devolve o elemento criado. */
  mostrar(texto: string, opcoes?: { conquista?: boolean }): HTMLDivElement;
  limpar(): void;
}

// O toast guarda o próprio timer no elemento, como sempre fez.
// A raiz React da estrela, quando há, também: é desmontada junto com ele.
interface ElementoToast extends HTMLDivElement {
  _timer?: number;
  _raizDaEstrela?: Root;
}

export function criarToasts(
  host: HTMLElement | null,
  { duracaoMs = DURACAO_PADRAO_MS, maximo = Infinity }: { duracaoMs?: number; maximo?: number } = {}
): Toasts {
  if (!host) throw new Error('criarToasts: host obrigatório.');
  host.classList.add('toasts');
  if (!host.hasAttribute('aria-live')) host.setAttribute('aria-live', 'polite');

  const ativos = new Set<ElementoToast>();

  function remover(el: ElementoToast) {
    if (!ativos.has(el)) return;
    ativos.delete(el);
    clearTimeout(el._timer);
    el.classList.add('saindo');
    // Depois da transição de saída de toasts.css (--t-medio), tira do DOM.
    const saidaMs = duracaoDoToken('--t-medio', 240);
    setTimeout(() => {
      el._raizDaEstrela?.unmount();
      el.remove();
    }, saidaMs);
  }

  function mostrar(texto: string, { conquista = false }: { conquista?: boolean } = {}): HTMLDivElement {
    // Estourou o limite: o mais antigo sai na hora para dar lugar.
    while (ativos.size >= maximo) {
      const maisAntigo = ativos.values().next().value;
      remover(maisAntigo);
    }

    const el = document.createElement('div') as ElementoToast;
    el.className = 'toast vidro';
    el.textContent = texto;
    if (conquista) colocarEstrela(el);
    host.appendChild(el);
    ativos.add(el);

    // Um frame depois, para a transição de entrada acontecer.
    requestAnimationFrame(() => el.classList.add('visivel'));
    el._timer = setTimeout(() => remover(el), duracaoMs);
    return el;
  }

  // O toast é DOM puro, fora de qualquer tela React: a estrela entra
  // numa raiz própria, a mesma <Estrela> das telas.
  function colocarEstrela(el: ElementoToast) {
    const lugar = document.createElement('span');
    el.prepend(lugar);
    el._raizDaEstrela = createRoot(lugar);
    el._raizDaEstrela.render(createElement(Estrela, { tamanho: 13 }));
  }

  function limpar() {
    [...ativos].forEach(remover);
  }

  return { mostrar, limpar };
}
