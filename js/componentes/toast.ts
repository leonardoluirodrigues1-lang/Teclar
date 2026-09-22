// toast.ts
// Avisos curtos que aparecem e somem sozinhos. Só texto, sem botão, sem
// foco: um toast nunca interrompe o que a pessoa está fazendo. O host
// deve ter aria-live="polite" para o leitor de tela anunciar sem cortar.
//
//   const toasts = criarToasts(document.getElementById('toasts'), { maximo: 1 });
//   toasts.mostrar('25 seguidos');

const DURACAO_PADRAO_MS = 1800;
const SAIDA_MS = 240; // igual a --dur-normal em toasts.css

export interface Toasts {
  /** Mostra um toast e devolve o elemento criado. */
  mostrar(texto: string): HTMLDivElement;
  limpar(): void;
}

// O toast guarda o próprio timer no elemento, como sempre fez.
interface ElementoToast extends HTMLDivElement {
  _timer?: number;
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
    // Depois da transição de saída, tira do DOM.
    setTimeout(() => el.remove(), SAIDA_MS);
  }

  function mostrar(texto: string): HTMLDivElement {
    // Estourou o limite: o mais antigo sai na hora para dar lugar.
    while (ativos.size >= maximo) {
      const maisAntigo = ativos.values().next().value;
      remover(maisAntigo);
    }

    const el = document.createElement('div') as ElementoToast;
    el.className = 'toast vidro';
    el.textContent = texto;
    host.appendChild(el);
    ativos.add(el);

    // Um frame depois, para a transição de entrada acontecer.
    requestAnimationFrame(() => el.classList.add('visivel'));
    el._timer = setTimeout(() => remover(el), duracaoMs);
    return el;
  }

  function limpar() {
    [...ativos].forEach(remover);
  }

  return { mostrar, limpar };
}
