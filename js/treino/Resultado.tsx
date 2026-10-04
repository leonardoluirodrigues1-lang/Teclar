// Resultado.tsx — pages/treino/resultado.html
// Mostra o resultado da sessão que acabou de terminar.
//
// URL: resultado.html?sessao=<id>&mundo=solo
//
// De onde vem o dado, nesta ordem:
//   1. sessionStorage['teclar:ultimo_resultado'] — a tela de treino guarda
//      ali a resposta inteira do POST (xpGanho, xpTotal, nivelAtual,
//      subiuDeNivel, recordePessoal) mais as métricas e o exercício. É o
//      caminho normal. A chave é apagada logo depois de lida.
//   2. api.sessoes.obter(id) — quando a chave está vazia (F5, link direto).
//      Só métricas: sem animação de XP e sem aviso de nível, porque esses
//      números não vieram e não se inventa XP.
//   3. Tela de erro — sem ?sessao= ou busca falhou.
//
// Conversão de js/treino/resultado.js para React: mesmo markup, mesmas
// classes de css/resultado.css, mesmos textos. A barra de XP continua sendo
// animada por DOM direto (style.width + .sem-transicao + transitionend) num
// useLayoutEffect, porque a sequência depende de forçar reflow entre dois quadros
// — o React não escreve nada nela depois de montada.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { CONFIG } from '../config.js';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { Missao, Mundo, Sessao, SessaoSolo } from '../nucleo/tipos.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { ordemDoPercurso, progressoDoPercurso } from '../utils/percurso.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';
import { Estrela } from '../componentes/Estrela.js';
import { NumeroQueConta } from '../componentes/NumeroQueConta.js';
import { BlocoDeMetricas } from './BlocoDeMetricas.js';

const CHAVE_RESULTADO = 'teclar:ultimo_resultado';
const XP_POR_NIVEL = CONFIG.SOLO.XP_POR_NIVEL;

// O que a tela de treino guarda no sessionStorage (ver irParaResultado em
// Treino.tsx): a resposta do POST espalhada, mais metricas e exercicio.
interface Guardado {
  xpGanho?: number;
  xpTotal?: number;
  nivelAtual?: number;
  subiuDeNivel?: boolean;
  recordePessoal?: boolean;
  enfileirada?: boolean;
  pendentes?: number;
  metricas?: {
    wpm?: number;
    precisao?: number;
    acertos?: number;
    erros?: number;
    tempo_gasto_segundos?: number;
    concluida?: boolean;
    exercicio_id?: string;
    turma_id?: string | null;
  };
  exercicio?: { id: string; titulo: string };
  // Só quando a lição teve mais de uma repetição: o PPM de cada volta, na
  // ordem. Não é parte do corpo gravado — a sessão é uma linha só.
  repeticoes?: { ppmPorVolta?: number[] };
}

interface Xp {
  ganho: number;
  total: number;
  nivel: number;
  subiu: boolean;
}

// Forma única que o render entende, venha o dado de onde vier.
interface Resultado {
  mundo: Mundo | null;
  concluida: boolean;
  wpm: number;
  precisao: number;
  erros: number;
  // null quando o dado não veio: a linha some em vez de mostrar um número
  // inventado. Vem do treino (sessionStorage) ou da API depois de um F5.
  acertos: number | null;
  tempoSegundos: number | null;
  exercicioId: string | null;
  turmaId: string | null;
  enfileirada: boolean;
  xp: Xp | null;
  recorde: boolean;
  // Evolução dentro da lição (PPM da primeira volta contra o da última).
  // null com uma volta só ou quando o dado veio da API, que não o tem.
  evolucao: { voltas: number; primeira: number; ultima: number } | null;
}

type Tela = { fase: 'carregando' } | { fase: 'pronto'; resultado: Resultado } | { fase: 'erro'; detalhe: string };

// ============================================================================
// Leitura e normalização
// ============================================================================

// Devolve o objeto guardado pela tela de treino (ou null) e apaga a chave:
// o resultado é de uma sessão só, um F5 não deve reanimar o mesmo XP.
function lerEApagarGuardado(): Guardado | null {
  const bruto = sessionStorage.getItem(CHAVE_RESULTADO);
  if (bruto == null) return null;
  sessionStorage.removeItem(CHAVE_RESULTADO);
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

function normalizarGuardado(g: Guardado, mundo: Mundo | null): Resultado {
  const m = g.metricas ?? {};
  // Sem xpGanho (sessão caiu na fila por falta de rede) não há XP a mostrar.
  const temXp = typeof g.xpGanho === 'number' && typeof g.xpTotal === 'number';
  return {
    mundo,
    concluida: m.concluida !== false,
    wpm: m.wpm ?? 0,
    precisao: m.precisao ?? 0,
    erros: m.erros ?? 0,
    acertos: m.acertos ?? null,
    tempoSegundos: m.tempo_gasto_segundos ?? null,
    exercicioId: m.exercicio_id ?? g.exercicio?.id ?? null,
    turmaId: m.turma_id ?? null,
    enfileirada: g.enfileirada === true,
    xp: temXp
      ? {
          ganho: g.xpGanho,
          total: g.xpTotal,
          nivel: g.nivelAtual ?? nivelDe(g.xpTotal),
          subiu: g.subiuDeNivel === true,
        }
      : null,
    recorde: g.recordePessoal === true,
    evolucao: evolucaoDe(g.repeticoes?.ppmPorVolta),
  };
}

// Primeira volta contra a última. Menos de duas voltas: nada a comparar.
function evolucaoDe(ppmPorVolta: number[] | undefined): Resultado['evolucao'] {
  if (!Array.isArray(ppmPorVolta) || ppmPorVolta.length < 2) return null;
  return {
    voltas: ppmPorVolta.length,
    primeira: ppmPorVolta[0] ?? 0,
    ultima: ppmPorVolta[ppmPorVolta.length - 1] ?? 0,
  };
}

// GET /sessoes/:id traz só as métricas gravadas. XP e recorde ficam nulos
// de propósito: não vieram, não se inventa. Os nomes em snake_case são o
// fallback de sempre, caso o back responda assim.
type SessaoDaApi = (Sessao | SessaoSolo) & {
  turmaId?: string | null;
  exercicio_id?: string | null;
  turma_id?: string | null;
};

function normalizarDaApi(r: SessaoDaApi, mundo: Mundo | null): Resultado {
  return {
    mundo,
    concluida: r.concluida !== false,
    wpm: r.wpm ?? 0,
    precisao: r.precisao ?? 0,
    erros: r.erros ?? 0,
    // Gravado pelo treino no POST e devolvido pela leitura: é o mesmo
    // número de antes do F5, não uma conta feita aqui.
    acertos: r.acertos ?? null,
    tempoSegundos: r.tempoSegundos ?? null,
    exercicioId: r.exerciseId ?? r.exercicio_id ?? null,
    turmaId: r.turmaId ?? r.turma_id ?? null,
    enfileirada: false,
    xp: null,
    recorde: false,
    evolucao: null,
  };
}

// "+9", "−3" ou "=" — a diferença de PPM entre a última volta e a primeira.
function formatarDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return '=';
}

function nivelDe(xpTotal: number): number {
  return Math.floor(xpTotal / XP_POR_NIVEL) + 1;
}

// Posição dentro do nível atual, em %. O nível N vai de (N-1)*XP até N*XP,
// então o resto da divisão é o que já foi percorrido nele.
function porcentagemNoNivel(xpTotal: number): number {
  return ((xpTotal % XP_POR_NIVEL) / XP_POR_NIVEL) * 100;
}

// ============================================================================
// Tela
// ============================================================================

function ResultadoTela() {
  const [params] = useState(() => new URLSearchParams(location.search));
  const sessaoId = params.get('sessao');
  const mundo = (params.get('mundo') as Mundo | null) ?? sessao.mundo();
  const casa = guarda.casa();

  const [tela, setTela] = useState<Tela>({ fase: 'carregando' });

  const painel = useRef<HTMLElement>(null);
  const erro = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      // --- 1. sessionStorage ---------------------------------------------------
      const guardado = lerEApagarGuardado();
      if (guardado) {
        setTela({ fase: 'pronto', resultado: normalizarGuardado(guardado, mundo) });
        return;
      }

      // --- 2. API ---------------------------------------------------------------
      if (!sessaoId) {
        setTela({ fase: 'erro', detalhe: 'Abra o resultado a partir de uma sessão de treino.' });
        return;
      }

      let registro: SessaoDaApi;
      try {
        registro = await api.sessoes.obter(sessaoId);
      } catch (falha) {
        if (cancelado) return;
        setTela({
          fase: 'erro',
          detalhe:
            falha?.status === 404
              ? 'Esta sessão não foi encontrada.'
              : (falha?.message ?? 'Não foi possível buscar a sessão.'),
        });
        return;
      }
      if (cancelado) return;

      setTela({ fase: 'pronto', resultado: normalizarDaApi(registro, mundo) });
    }

    iniciar();
    return () => {
      cancelado = true;
    };
  }, []);

  // Foco ao aparecer: no painel, o leitor de tela anuncia o resultado ao
  // carregar; no erro, idem.
  useEffect(() => {
    if (tela.fase === 'pronto') painel.current?.focus();
    else if (tela.fase === 'erro') erro.current?.focus();
  }, [tela.fase]);

  if (tela.fase === 'carregando') return null;

  if (tela.fase === 'erro') {
    return (
      // Erro: sem ?sessao=, ou busca falhou. Mesmo formato da tela de treino.
      <section
        className="painel painel-erro vidro"
        id="erro"
        tabIndex={-1}
        aria-labelledby="erro-titulo"
        ref={erro}
      >
        <p className="rotulo">Não deu</p>
        <h1 className="titulo" id="erro-titulo">
          Nenhum resultado para mostrar.
        </h1>
        <p className="nota" id="erro-detalhe">
          {tela.detalhe}
        </p>
        <div className="acoes">
          <a className="btn btn-solido tecla tecla-clara" id="btn-voltar-erro" href={casa}>
            Voltar ao início
          </a>
        </div>
      </section>
    );
  }

  const r = tela.resultado;
  const solo = r.mundo === 'solo';

  // O "+N XP" é o único título que conta: é a conquista da sessão.
  let titulo: ReactNode;
  let nota: string | null = null;
  if (solo && r.xp) {
    titulo = (
      <>
        +<NumeroQueConta valor={r.xp.ganho} /> XP
      </>
    );
  } else if (solo) {
    // Solo sem XP: a sessão foi para a fila (rede) ou veio da API (F5).
    titulo = 'Sessão registrada.';
    if (r.enfileirada) nota = 'Sem conexão agora. O XP entra quando a rede voltar.';
  } else {
    titulo = 'Lição enviada.';
    if (r.enfileirada) nota = 'Sem conexão agora. Ela vai para o professor assim que a rede voltar.';
  }

  // "Repetir" só quando se sabe de onde a sessão veio.
  let hrefRepetir: string | null = null;
  if (r.exercicioId) {
    const q = new URLSearchParams({ exercicio: r.exercicioId });
    if (r.turmaId) q.set('turma', r.turmaId);
    hrefRepetir = `treino.html?${q}`;
  }

  return (
    // Painel do resultado. tabIndex -1 para receber foco ao carregar.
    <section className="painel vidro" id="painel" tabIndex={-1} aria-labelledby="titulo" ref={painel}>
      <p className="rotulo" id="rotulo">
        {r.concluida ? 'Sessão concluída' : 'Tempo esgotado'}
      </p>
      <h1 className="titulo" id="titulo">
        {titulo}
      </h1>
      <p className="nota" id="nota" hidden={nota == null}>
        {nota}
      </p>

      {/* Mesmo bloco do modal de fim da tela de treino. */}
      <BlocoDeMetricas
        wpm={r.wpm}
        precisao={r.precisao}
        erros={r.erros}
        acertos={r.acertos}
        tempoSegundos={r.tempoSegundos}
      />

      {/* Lição com repetições: a evolução dentro dela, discreta. Só existe
          quando o dado veio da tela de treino (sessionStorage). */}
      {r.evolucao && (
        <p className="evolucao" id="evolucao">
          {r.evolucao.voltas} repetições · {r.evolucao.primeira} PPM na primeira, {r.evolucao.ultima} na última
          <span className="evolucao-delta">{formatarDelta(r.evolucao.ultima - r.evolucao.primeira)}</span>
        </p>
      )}

      {/* Só no mundo Solo, e só quando o XP veio com a resposta. */}
      {solo && r.xp && <BarraXp xp={r.xp} />}

      {/* Estrela só aqui, com recorde: o selo inteiro já some sem ele.
          Sempre nasce com o pulso: o recorde só vem do sessionStorage, que
          é apagado ao ler — num F5 o dado vem da API, sem recorde, e o
          selo nem aparece. */}
      <p className="selo selo-recorde vidro" id="selo-recorde" hidden={!r.recorde}>
        <Estrela tamanho={12} nasce />
        Melhor marca até agora
      </p>

      {/* Solo: próxima lição, repetir, voltar ao caminho. A Escola fica
          como sempre foi: repetir e voltar. */}
      {solo ? (
        <AcoesDoSolo exercicioId={r.exercicioId} hrefRepetir={hrefRepetir} />
      ) : (
        <div className="acoes">
          <a className="btn btn-solido tecla tecla-clara" id="btn-repetir" href={hrefRepetir ?? 'treino.html'} hidden={hrefRepetir == null}>
            Repetir
          </a>
          <a className="btn btn-vidro vidro tecla" id="btn-voltar" href={casa}>
            Voltar
          </a>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Fim da lição no Solo: para onde ir
// ============================================================================
// Três caminhos, com peso diferente:
//   · principal (tecla clara): a próxima lição, com o nome dela;
//   · secundários (tecla escura): repetir esta lição e voltar ao caminho.
// Sem próxima, "Voltar ao caminho" vira o principal. Isso acontece quando
// a lição era a última do percurso, quando o percurso não carregou e
// quando a "próxima" seria esta mesma (tempo esgotado, ou a sessão ainda
// na fila sem rede). Voltar ao caminho sempre existe: a tela nunca fica
// sem saída.
//
// Só o fim da LIÇÃO inteira passa por aqui. A passagem entre uma
// repetição e outra é da tela de treino e não muda.

const ROTA_CAMINHO = '../solo/caminho.html';

type Proxima =
  | { estado: 'carregando' }
  | { estado: 'nenhuma' }
  | { estado: 'pronta'; licao: Missao };

// A próxima lição pela regra de sempre (utils/percurso.ts, a mesma do
// caminho e do dashboard), com as listas buscadas de novo: o histórico já
// traz a sessão que acabou de terminar.
function useProximaLicao(exercicioId: string | null): Proxima {
  const [proxima, setProxima] = useState<Proxima>({ estado: 'carregando' });

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      api.solo.missoes().then((m) => desembrulhar<Missao>(m)),
      api.solo.historico().then((h) => desembrulhar<SessaoSolo>(h)),
    ])
      .then(([licoes, sessoes]) => {
        if (cancelado) return;
        const progresso = progressoDoPercurso(ordemDoPercurso(licoes), sessoes);
        // `repetir`: tudo concluído, esta era a última do percurso.
        if (progresso == null || progresso.proxima.repetir || progresso.proxima.licao.exerciseId === exercicioId) {
          setProxima({ estado: 'nenhuma' });
        } else {
          setProxima({ estado: 'pronta', licao: progresso.proxima.licao });
        }
      })
      .catch((falha) => {
        console.error(falha);
        if (!cancelado) setProxima({ estado: 'nenhuma' });
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return proxima;
}

interface PropsAcoesDoSolo {
  exercicioId: string | null;
  hrefRepetir: string | null;
}

function AcoesDoSolo({ exercicioId, hrefRepetir }: PropsAcoesDoSolo) {
  const proxima = useProximaLicao(exercicioId);
  // Enquanto a próxima carrega, os dois secundários já estão na tela, e o
  // voltar continua escuro: só vira principal quando se sabe que não há
  // próxima.
  const voltarEhPrincipal = proxima.estado === 'nenhuma';

  const repetir = hrefRepetir && (
    <a className="btn btn-vidro vidro tecla" id="btn-repetir" href={hrefRepetir}>
      Repetir esta lição
    </a>
  );
  const voltar = (
    <a
      className={voltarEhPrincipal ? 'btn btn-solido tecla tecla-clara' : 'btn btn-vidro vidro tecla'}
      id="btn-voltar"
      href={ROTA_CAMINHO}
    >
      Voltar ao caminho
    </a>
  );

  return (
    <div className="acoes acoes-solo">
      {proxima.estado === 'pronta' && (
        <a
          className="btn btn-solido tecla tecla-clara btn-proxima"
          id="btn-proxima"
          href={`treino.html?${new URLSearchParams({ exercicio: proxima.licao.exerciseId })}`}
        >
          Próxima: {proxima.licao.titulo}
        </a>
      )}
      {/* O principal vem primeiro. */}
      {voltarEhPrincipal ? (
        <>
          {voltar}
          {repetir}
        </>
      ) : (
        <>
          {repetir}
          {voltar}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Barra de XP
// ============================================================================

interface PropsBarraXp {
  xp: Xp;
}

function BarraXp({ xp }: PropsBarraXp) {
  const barra = useRef<HTMLDivElement>(null);
  const [seloNivelVisivel, setSeloNivelVisivel] = useState(false);
  const alvo = xp.nivel * XP_POR_NIVEL;

  // A barra parte de onde estava ANTES desta sessão e cresce até o total.
  // O valor antigo é escrito sem transição no primeiro quadro; o novo, no
  // requestAnimationFrame seguinte — se os dois forem no mesmo quadro o CSS
  // não tem o que animar.
  // Subida de nível: enche até 100%, volta a 0 sem transição, e segue até o
  // excedente. O selo "NÍVEL N ALCANÇADO" aparece na virada.
  // useLayoutEffect, não useEffect: o valor antigo tem de ser escrito ANTES
  // do primeiro paint, como no resultado.js — senão a barra aparece em 0 por
  // um quadro e salta para o valor antigo sem transição.
  useLayoutEffect(() => {
    const antes = Math.max(0, xp.total - xp.ganho);
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    animarBarra(barra.current, {
      antes,
      depois: xp.total,
      subiu: xp.subiu,
      reduzido,
      aoSubirNivel: () => setSeloNivelVisivel(true),
    });
  }, []);

  return (
    <section className="xp" id="xp" aria-label="Progresso de nível">
      {/* O pulso roda quando o selo deixa de ser hidden, na virada do
          nível. Mesmo motivo do recorde: só existe logo depois da sessão. */}
      <p className="selo vidro" id="selo-nivel" hidden={!seloNivelVisivel}>
        <Estrela tamanho={13} nasce />
        Nível <span id="selo-nivel-num">{xp.nivel}</span> alcançado
      </p>
      <div className="xp-rotulos">
        <span>
          Nível <span id="xp-nivel">{xp.nivel}</span>
        </span>
        <span>
          <span id="xp-total">{xp.total}</span> / <span id="xp-alvo">{alvo}</span>
        </span>
      </div>
      <div className="xp-barra">
        <div className="xp-preenchimento" id="xp-preenchimento" ref={barra} />
      </div>
    </section>
  );
}

interface OpcoesAnimacao {
  antes: number;
  depois: number;
  subiu: boolean;
  reduzido: boolean;
  aoSubirNivel: () => void;
}

function animarBarra(
  barra: HTMLDivElement,
  { antes, depois, subiu, reduzido, aoSubirNivel }: OpcoesAnimacao
) {
  const final = porcentagemNoNivel(depois);

  if (reduzido) {
    barra.classList.add('sem-transicao');
    barra.style.width = `${final}%`;
    if (subiu) aoSubirNivel();
    return;
  }

  // Quadro 1: valor antigo, sem transição.
  fixar(barra, porcentagemNoNivel(antes));

  // Quadro 2: dispara o crescimento.
  proximoQuadro(() => {
    if (!subiu) {
      barra.style.width = `${final}%`;
      return;
    }

    barra.style.width = '100%';
    aoTerminarTransicao(barra, () => {
      aoSubirNivel();
      fixar(barra, 0);
      proximoQuadro(() => {
        barra.style.width = `${final}%`;
      });
    });
  });
}

// Escreve a largura sem animar e força o layout, para a próxima mudança
// partir deste valor.
function fixar(barra: HTMLDivElement, pct: number) {
  barra.classList.add('sem-transicao');
  barra.style.width = `${pct}%`;
  barra.getBoundingClientRect(); // força o reflow
  barra.classList.remove('sem-transicao');
}

// Dois quadros, não um: o primeiro rAF pode cair ainda no quadro em que o
// valor antigo foi escrito.
function proximoQuadro(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

// transitionend uma vez, com um teto de tempo caso o evento não venha
// (largura igual à anterior, aba em segundo plano).
function aoTerminarTransicao(elemento: HTMLElement, fn: () => void) {
  let feito = false;
  const concluir = () => {
    if (feito) return;
    feito = true;
    elemento.removeEventListener('transitionend', aoEvento);
    fn();
  };
  const aoEvento = (evento: TransitionEvent) => {
    if (evento.propertyName === 'width') concluir();
  };
  elemento.addEventListener('transitionend', aoEvento);
  setTimeout(concluir, 1100);
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Qualquer sessão logada vê o próprio resultado. Devolveu null,
// redirecionou: a tela para aqui e nada mais roda.
const usuario = guarda.qualquerLogado();

// O disco de luz entra pelo canto do mundo de quem treinou (ver
// css/base/luz.css): o HTML já o traz no canto do Solo, e aqui ele vai para
// o canto da Escola quando o treino foi de lá. Mesmo critério de mundo que
// a tela usa: o ?mundo= da URL, senão o da sessão.
function posicionarDisco(): void {
  const mundo = (new URLSearchParams(location.search).get('mundo') as Mundo | null) ?? sessao.mundo();
  if (mundo !== 'escola') {
    return;
  }
  const disco = document.querySelector('.disco');
  disco?.classList.replace('disco-canto-superior-direito', 'disco-canto-inferior-direito');
}

if (usuario) {
  guarda.aplicarMundo();
  posicionarDisco();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<ResultadoTela />);
}
