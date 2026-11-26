// Tentar de novo enquanto o back acorda. O back roda no plano grátis do
// Render, que desliga depois de ~15 min sem uso: a primeira requisição
// depois disso espera ele subir, e nesse meio-tempo a conexão pode cair ou
// voltar 502/503/504 (resposta do proxy, sem CORS, que o navegador vê como
// falha de rede). Quem chega para entrar ou criar conta é justamente quem
// pega o servidor dormindo.
//
// Só a falha "o back não respondeu" é repetida: status 0 (rede/CORS/tempo
// esgotado) e 502/503/504. Qualquer resposta do próprio back (400, 401,
// 409, 429, 500...) volta na hora, sem nova tentativa.
//
// Sem nada do navegador aqui: é testado em js/nucleo/insistir.check.mjs.

/** Até quando insistir, no total (a subida a frio do Render leva ~1 min). */
export const INSISTIR_MS = 60_000;
/** A partir de quanto tempo de espera a tela avisa que o servidor está acordando. */
export const AVISO_MS = 4_000;

const STATUS_DE_SERVIDOR_SUBINDO = [502, 503, 504];

export function servidorNaoRespondeu(erro: unknown): boolean {
  const status = (erro as { status?: number } | null)?.status;
  return status === 0 || STATUS_DE_SERVIDOR_SUBINDO.includes(status ?? -1);
}

interface Opcoes {
  /** Liga (true) e desliga (false) o aviso "acordando o servidor". */
  aoAcordar: (acordando: boolean) => void;
  limiteMs?: number;
  avisoMs?: number;
  agora?: () => number;
  dormir?: (ms: number) => Promise<void>;
}

/**
 * Chama `tentar(restanteMs)` até dar certo, até a falha não ser de servidor
 * dormindo, ou até `limiteMs`. `restanteMs` é o tempo que a tentativa pode
 * durar (quem chama aborta o fetch depois dele): assim uma requisição
 * pendurada também respeita o minuto, em vez de deixar a tela travada.
 */
export async function insistir<T>(
  tentar: (restanteMs: number) => Promise<T>,
  {
    aoAcordar,
    limiteMs = INSISTIR_MS,
    avisoMs = AVISO_MS,
    agora = Date.now,
    dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
  }: Opcoes,
): Promise<T> {
  const fim = agora() + limiteMs;
  // Demorou sem falhar (o Render segura o pedido enquanto sobe): avisa também.
  const aviso = setTimeout(() => aoAcordar(true), avisoMs);
  try {
    for (let espera = 2_000; ; espera = Math.min(espera * 2, 8_000)) {
      try {
        return await tentar(Math.max(1, fim - agora()));
      } catch (erro) {
        if (!servidorNaoRespondeu(erro) || agora() + espera >= fim) throw erro;
        aoAcordar(true);
        await dormir(espera);
      }
    }
  } finally {
    clearTimeout(aviso);
    aoAcordar(false);
  }
}
