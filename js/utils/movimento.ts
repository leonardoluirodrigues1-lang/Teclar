// movimento.ts
// O lado JavaScript das regras de css/base/movimento.css. Quem usa:
//   · ModalReact.tsx e toast.ts: duracaoDoToken, para esperar a animação
//     de saída terminar antes de tirar o elemento da tela;
//   · o script de entrada de cada página (exceto a landing e o treino):
//     ativarSaidaAoNavegar, para a tela sumir com um fade ao seguir um link.

/**
 * Lê um token de duração de css/base/movimento.css (ex.: '--t-medio') e
 * devolve o valor em milissegundos.
 *
 * Por que ler do CSS em vez de repetir o número aqui: com movimento
 * reduzido, o CSS zera as durações. Lendo o token, o JavaScript também
 * passa a esperar 0ms — e as duas pontas nunca ficam dessincronizadas.
 *
 * Os tokens são escritos sempre em ms. Se a folha não tiver carregado, o
 * token vem vazio e vale o `padraoMs`.
 */
export function duracaoDoToken(nome: string, padraoMs: number): number {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome);
  const milissegundos = parseFloat(valor);
  if (Number.isNaN(milissegundos)) {
    return padraoMs;
  }
  return milissegundos;
}

// ============================================================================
// Saída ao navegar
// ============================================================================

const CLASSE_SAINDO = 'saindo-da-pagina';

/**
 * Faz a tela sumir com um fade curto antes de seguir um link interno.
 * Chamar uma vez, no script de entrada da página.
 *
 * Só olha CLIQUES em links. Navegação feita por código (location.href,
 * location.replace, os redirecionamentos do guarda) não passa por aqui e
 * continua imediata.
 */
export function ativarSaidaAoNavegar(): void {
  document.addEventListener('click', aoClicar);

  // Voltar pelo botão do navegador pode restaurar esta página da memória
  // (bfcache) exatamente como ela ficou: apagada. Aqui ela volta a aparecer.
  window.addEventListener('pageshow', () => {
    document.body.classList.remove(CLASSE_SAINDO);
  });
}

function aoClicar(evento: MouseEvent): void {
  if (!ehCliqueSimples(evento)) {
    return;
  }
  const link = linkClicado(evento);
  if (!link) {
    return;
  }
  if (!levaParaOutraPaginaDoProjeto(link)) {
    return;
  }
  if (querMenosMovimento()) {
    return;
  }
  // Já está saindo: este segundo clique segue o comportamento normal do
  // navegador, que é navegar na hora.
  if (document.body.classList.contains(CLASSE_SAINDO)) {
    return;
  }

  evento.preventDefault();
  sairENavegar(link.href);
}

/**
 * Clique com o botão principal, sem Ctrl, Shift, Alt nem Meta. Os
 * modificadores abrem em nova aba ou janela, ou baixam o arquivo: a página
 * atual não vai embora, então não pode sumir. Também fica de fora o clique
 * que a própria tela já tratou (preventDefault num onClick do React).
 */
function ehCliqueSimples(evento: MouseEvent): boolean {
  if (evento.defaultPrevented) {
    return false;
  }
  if (evento.button !== 0) {
    return false;
  }
  if (evento.ctrlKey || evento.shiftKey || evento.altKey || evento.metaKey) {
    return false;
  }
  return true;
}

/** O <a href> em que o clique caiu, ou null. O clique costuma cair num
 *  <span> dentro do link, por isso o closest. */
function linkClicado(evento: MouseEvent): HTMLAnchorElement | null {
  if (!(evento.target instanceof Element)) {
    return null;
  }
  return evento.target.closest<HTMLAnchorElement>('a[href]');
}

function levaParaOutraPaginaDoProjeto(link: HTMLAnchorElement): boolean {
  // target="_blank" (ou qualquer outro alvo) abre em outro lugar.
  const alvo = link.getAttribute('target');
  if (alvo && alvo !== '_self') {
    return false;
  }
  if (link.hasAttribute('download')) {
    return false;
  }
  // Outro site, mailto:, tel:, javascript:. O protocolo entra na conta
  // porque, com o projeto aberto por file://, a origem de mailto: e a da
  // página são as duas "null".
  if (link.protocol !== window.location.protocol || link.origin !== window.location.origin) {
    return false;
  }
  // Mesma página, só mudando a âncora (#top): a tela não troca.
  const mesmaPagina =
    link.pathname === window.location.pathname && link.search === window.location.search;
  if (mesmaPagina) {
    return false;
  }
  return true;
}

// O sistema pediu, ou a pessoa pediu em Configurações do Solo (a classe
// que guarda.aplicarMundo põe no <html>).
function querMenosMovimento(): boolean {
  if (document.documentElement.classList.contains('movimento-reduzido')) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sairENavegar(endereco: string): void {
  // Primeiro garante a navegação, depois anima. A troca de página depende
  // só deste timer, não da animação: se a transição não rodar (navegador
  // sem suporte, aba em segundo plano), a página troca do mesmo jeito.
  const duracao = duracaoDoToken('--t-medio', 240);
  window.setTimeout(() => {
    window.location.assign(endereco);
  }, duracao);

  document.body.classList.add(CLASSE_SAINDO);
}
