// Caminho.tsx — pages/solo/caminho.html
// A casa do mundo Solo (ROTA_INICIAL.solo em js/config.ts): as lições como
// pedras numa trilha, UM NÍVEL POR VEZ. Substitui a antiga lista agrupada
// (a antiga campanhas.html).
//
// Por que um nível por vez: são 76 lições em 10 níveis, e todas de uma vez
// entulham a tela. A trilha serpenteia pela largura com as pedras do nível
// e termina num troféu; as setas da faixa do topo trocam de nível.
//
// Cada pedra é uma tecla redonda com o número da lição:
//   · concluída        — face clara, estrela escura no lugar do número e
//                        uma faísca menor na quina;
//   · a próxima a fazer — face clara, ícone de teclado, anel de luz e o
//                        balão "Começar" em cima;
//   · ainda não feita  — face escura, número apagado.
// NÃO existe bloqueio: toda pedra é um link para o treino, sempre. Não há
// nível mínimo na tabela ExerciciosSolo — trancar seria regra que o banco
// não tem.
//
// De onde vem cada dado (rotas que já existiam):
//   · campanha  — GET /solo/campanha. Sem campanha, a pessoa vai para o
//                 dashboard, que é quem oferece começar;
//   · lições    — GET /solo/missoes. São o conteúdo: se falharem, é erro;
//   · histórico — GET /solo/historico. Diz o que já foi feito e qual é a
//                 próxima (utils/percurso.ts, a mesma regra do dashboard).
//                 Se falhar, as pedras aparecem todas como "não feita".
//
// Na primeira vez da conta, antes da trilha, vem o tutorial (./Tutorial.tsx).
// Ele só aparece depois que os dados chegam e a campanha existe: quem não
// tem campanha é mandado ao dashboard, e mostrar o tutorial para em seguida
// trocar de tela no meio dele seria pior.
//
// A posição das pedras é calculada a partir do tamanho da área da trilha,
// e o tracejado entre elas a partir da posição das pedras. Isso só é
// recalculado quando essa área muda de tamanho — ao redimensionar a janela
// e ao abrir ou fechar a barra lateral, que empurra o conteúdo.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { ErroDaApi, Missao, SessaoSolo } from '../nucleo/tipos.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { PainelErro } from '../componentes/PainelErro.js';
import { MolduraSolo } from '../componentes/MolduraSolo.js';
import { Estrela } from '../componentes/Estrela.js';
import { Tutorial } from './Tutorial.js';
import {
  agruparPorNivel,
  ordemDoPercurso,
  progressoDoPercurso,
  type GrupoDoPercurso,
  type ProgressoDoPercurso,
} from '../utils/percurso.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Vizinho desta em pages/solo/: é lá que mora o convite de começar.
const ROTA_DASHBOARD = 'dashboard.html';

// Os dez nomes de nível. A listagem manda só o número do nível; se um
// nível novo aparecer sem nome aqui, a faixa escreve só "Nível N".
const NOMES_DE_NIVEL: Record<number, string> = {
  1: 'Linha-guia',
  2: 'Fileiras e pontuação',
  3: 'Vocabulário real',
  4: 'Maiúsculas e frases',
  5: 'Números e valores',
  6: 'Símbolos e código',
  7: 'Texto profissional',
  8: 'Pangramas e acentuação',
  9: 'Parágrafos corporativos',
  10: 'Textos longos',
};

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Estas lições são da conta individual, e a sessão atual não tem acesso a elas. Entre de novo.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// ============================================================================
// Geometria da trilha — as medidas do preview
// ============================================================================
// Em px, dentro da área da trilha. A trilha é uma senoide: vai da margem
// esquerda à direita subindo e descendo pouco mais de uma volta.

const MARGEM_ESQUERDA = 170;
const MARGEM_DIREITA = 150;
// Em tela estreita as margens encolhem junto, para sobrar lugar às pedras.
const MARGEM_MAXIMA_DA_LARGURA = 0.15;
// O meio da onda fica um pouco abaixo do centro: em cima mora a faixa do nível.
const ALTURA_DO_MEIO = 0.56;
const AMPLITUDE_MAXIMA = 150;
const AMPLITUDE_DA_ALTURA = 0.17;
// 2.1 meias-voltas de seno: termina subindo, com o troféu fora da linha reta.
const VOLTAS_DA_ONDA = 2.1;
// O tracejado começa e termina a esta distância do centro de cada pedra,
// para não passar por baixo delas nem do anel de luz.
const RECUO_DO_TRACEJADO = 58;

interface Ponto {
  x: number;
  y: number;
}

interface Ligacao {
  x: number;
  y: number;
  comprimento: number;
  anguloGraus: number;
}

// Um ponto por pedra, mais um para o troféu no fim.
function pontosDaTrilha(quantos: number, largura: number, altura: number): Ponto[] {
  const esquerda = Math.min(MARGEM_ESQUERDA, largura * MARGEM_MAXIMA_DA_LARGURA);
  const direita = largura - Math.min(MARGEM_DIREITA, largura * MARGEM_MAXIMA_DA_LARGURA);
  const meio = altura * ALTURA_DO_MEIO;
  const amplitude = Math.min(AMPLITUDE_MAXIMA, altura * AMPLITUDE_DA_ALTURA);

  const pontos: Ponto[] = [];
  for (let i = 0; i < quantos; i++) {
    const t = quantos === 1 ? 0 : i / (quantos - 1);
    pontos.push({
      x: esquerda + (direita - esquerda) * t,
      y: meio + Math.sin(t * Math.PI * VOLTAS_DA_ONDA) * amplitude,
    });
  }
  return pontos;
}

// Um traço reto de cada ponto ao seguinte, encurtado nas duas pontas.
function ligacoesEntre(pontos: Ponto[]): Ligacao[] {
  const ligacoes: Ligacao[] = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const de = pontos[i];
    const ate = pontos[i + 1];
    const angulo = Math.atan2(ate.y - de.y, ate.x - de.x);
    const distancia = Math.hypot(ate.x - de.x, ate.y - de.y);
    ligacoes.push({
      x: de.x + Math.cos(angulo) * RECUO_DO_TRACEJADO,
      y: de.y + Math.sin(angulo) * RECUO_DO_TRACEJADO,
      comprimento: Math.max(0, distancia - RECUO_DO_TRACEJADO * 2),
      anguloGraus: (angulo * 180) / Math.PI,
    });
  }
  return ligacoes;
}

// Largura e altura de um elemento, atualizadas só quando ele muda de
// tamanho (ResizeObserver): janela redimensionada ou barra lateral abrindo
// e fechando. Nada mais dispara o recálculo da trilha.
function useTamanho(elemento: React.RefObject<HTMLElement>): { largura: number; altura: number } {
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });

  useEffect(() => {
    const alvo = elemento.current;
    if (!alvo) return;
    const observador = new ResizeObserver(([entrada]) => {
      setTamanho({ largura: entrada.contentRect.width, altura: entrada.contentRect.height });
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [elemento]);

  return tamanho;
}

// ============================================================================
// Ícones
// ============================================================================

function IconeTeclado() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}

function IconeTrofeu() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 01-8 0zM8 5H5v2a3 3 0 003 3M16 5h3v2a3 3 0 01-3 3M9 20h6M12 13v7" />
    </svg>
  );
}

// ============================================================================
// Pedra
// ============================================================================

type EstadoDaPedra = 'feita' | 'proxima' | 'nova';

const TEXTO_DO_ESTADO: Record<EstadoDaPedra, string> = {
  feita: 'concluída',
  proxima: 'a próxima a fazer',
  nova: 'ainda não feita',
};

// Sem histórico (progresso null) nada é marcado: a tela não inventa
// progresso a partir de não saber. Com tudo concluído, o percurso manda
// "repetir a última" — aí não há próxima a fazer, e nenhuma pedra acende.
function estadoDaPedra(licao: Missao, progresso: ProgressoDoPercurso | null): EstadoDaPedra {
  if (progresso == null) return 'nova';
  const { proxima } = progresso;
  if (!proxima.repetir && proxima.licao.exerciseId === licao.exerciseId) return 'proxima';
  if (progresso.concluidas.has(licao.exerciseId)) return 'feita';
  return 'nova';
}

function hrefDoTreino(licao: Missao): string {
  return `../treino/treino.html?${new URLSearchParams({ exercicio: licao.exerciseId })}`;
}

// O número que a pedra mostra é a POSIÇÃO da lição dentro do nível (1 a
// 10 no nível 1), não a `ordem` do banco. O material do professor faz uma
// segunda passada pelos níveis — as lições 49 a 64 voltam aos níveis 1 a
// 8 —, e com a ordem a trilha do nível 1 mostraria 01…08, 49, 50. A ordem
// e o id continuam no dado e são o que abre o treino.
// 7 -> "07": sempre com dois dígitos, como no preview.
function numeroDaPosicao(posicao: number): string {
  return String(posicao).padStart(2, '0');
}

interface PropsConteudo {
  estado: EstadoDaPedra;
  posicao: number;
  repeticoes: number;
}

// O miolo da pedra: o número (ou o teclado, na da vez) e, embaixo dele, as
// repetições da lição. A concluída mostra só a estrela: a lição já foi
// feita, e quantas vezes ela repete não serve mais para nada.
function ConteudoDaPedra({ estado, posicao, repeticoes }: PropsConteudo) {
  if (estado === 'feita') return <Estrela tamanho={30} forma="escura" />;
  return (
    <>
      {estado === 'proxima' ? <IconeTeclado /> : <span aria-hidden="true">{numeroDaPosicao(posicao)}</span>}
      <Repeticoes quantas={repeticoes} />
    </>
  );
}

// "10×". Lição de uma vez só não mostra nada. Escondido do leitor de tela
// porque o rótulo da pedra já diz "10 repetições" por extenso.
function Repeticoes({ quantas }: { quantas: number }) {
  if (quantas <= 1) return null;
  return (
    <span className="pedra-repeticoes" aria-hidden="true">
      {quantas}×
    </span>
  );
}

interface PropsPedra {
  licao: Missao;
  /** 1, 2, 3… dentro do nível. */
  posicao: number;
  /** Quantas lições o nível tem, para o rótulo dizer "3 de 8". */
  totalNoNivel: number;
  estado: EstadoDaPedra;
  ponto: Ponto;
}

function Pedra({ licao, posicao, totalNoNivel, estado, ponto }: PropsPedra) {
  const repete = licao.repeticoes > 1;
  // Tudo o que a pedra mostra vai no rótulo: a posição, o nível, o estado e
  // as repetições ("10×" lido em voz alta vira "dez ex"). O título da lição
  // fica de fora: ele traz a ordem do banco ("Lição 49 — …"), justamente o
  // número que a pedra deixou de mostrar.
  const rotulo =
    `Lição ${posicao} de ${totalNoNivel} do nível ${licao.nivel}, ${TEXTO_DO_ESTADO[estado]}` +
    (repete ? `, ${licao.repeticoes} repetições` : '');
  // Face clara: o relevo claro de css/base/luz.css.
  const classeTecla = estado === 'nova' ? 'tecla' : 'tecla tecla-clara';

  return (
    <div className="caminho-passo" style={{ left: ponto.x, top: ponto.y }}>
      {estado === 'proxima' && (
        <>
          <span className="caminho-balao" aria-hidden="true">
            Começar
          </span>
          <span className="caminho-halo" aria-hidden="true" />
        </>
      )}
      {/* A pedra concluída troca o número pela estrela. Quem ouve não
          perde nada: o rótulo já diz a posição e "concluída". */}
      <a className={`pedra pedra-${estado} ${classeTecla}`} href={hrefDoTreino(licao)} aria-label={rotulo}>
        <ConteudoDaPedra estado={estado} posicao={posicao} repeticoes={licao.repeticoes} />
      </a>
      {estado === 'feita' && (
        <span className="caminho-faisca">
          <Estrela tamanho={14} />
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Nível: a faixa do topo e a trilha
// ============================================================================

// "8 lições" / "1 lição".
function contagemDeLicoes(quantas: number): string {
  return `${quantas} ${quantas === 1 ? 'lição' : 'lições'}`;
}

interface PropsFaixa {
  grupo: GrupoDoPercurso;
  temAnterior: boolean;
  temSeguinte: boolean;
  aoMudar: (passo: -1 | 1) => void;
}

function FaixaDoNivel({ grupo, temAnterior, temSeguinte, aoMudar }: PropsFaixa) {
  const nome = NOMES_DE_NIVEL[grupo.nivel];
  return (
    <header className="vidro caminho-faixa">
      <div>
        <p className="caminho-faixa-rotulo">
          Nível {grupo.nivel} · {contagemDeLicoes(grupo.licoes.length)}
        </p>
        {/* O h1 da tela: é o que muda quando a pessoa troca de nível. */}
        <h1 className="caminho-faixa-nome">{nome ?? `Nível ${grupo.nivel}`}</h1>
      </div>
      <div className="caminho-setas">
        <button
          type="button"
          className="caminho-seta tecla"
          onClick={() => aoMudar(-1)}
          disabled={!temAnterior}
          aria-label="Nível anterior"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          className="caminho-seta tecla"
          onClick={() => aoMudar(1)}
          disabled={!temSeguinte}
          aria-label="Próximo nível"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </header>
  );
}

interface PropsTrilha {
  grupo: GrupoDoPercurso;
  progresso: ProgressoDoPercurso | null;
}

function Trilha({ grupo, progresso }: PropsTrilha) {
  const area = useRef<HTMLDivElement>(null);
  const { largura, altura } = useTamanho(area);

  // +1: o troféu do fim do nível também é um ponto da trilha.
  const pontos = useMemo(
    () => pontosDaTrilha(grupo.licoes.length + 1, largura, altura),
    [grupo.licoes.length, largura, altura]
  );
  const ligacoes = useMemo(() => ligacoesEntre(pontos), [pontos]);
  const pontoDoTrofeu = pontos[pontos.length - 1];

  return (
    <div className="caminho-trilha" ref={area}>
      {/* Antes da primeira medida a área ainda não tem tamanho: não
          desenha nada, em vez de empilhar tudo no canto por um quadro. */}
      {largura > 0 && (
        <>
          {ligacoes.map((ligacao, i) => (
            <span
              key={i}
              className="caminho-ligacao"
              aria-hidden="true"
              style={{
                left: ligacao.x,
                top: ligacao.y,
                width: ligacao.comprimento,
                transform: `rotate(${ligacao.anguloGraus}deg)`,
              }}
            />
          ))}
          {/* <ol>: as lições do nível são uma sequência, e o leitor de tela
              diz quantas são. A ordem do DOM é a do percurso, então o Tab
              anda pela trilha da primeira pedra à última. */}
          <ol className="caminho-pedras" aria-label={`Lições do nível ${grupo.nivel}`}>
            {grupo.licoes.map((licao, i) => (
              <li key={licao.exerciseId}>
                <Pedra
                  licao={licao}
                  posicao={i + 1}
                  totalNoNivel={grupo.licoes.length}
                  estado={estadoDaPedra(licao, progresso)}
                  ponto={pontos[i]}
                />
              </li>
            ))}
          </ol>
          <div className="caminho-passo" style={{ left: pontoDoTrofeu.x, top: pontoDoTrofeu.y }}>
            <span className="pedra pedra-trofeu tecla" role="img" aria-label={`Fim do nível ${grupo.nivel}`}>
              <IconeTrofeu />
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Estado da tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  // sessoes null = o histórico falhou; a trilha abre sem marcas.
  | { estado: 'pronto'; licoes: Missao[]; sessoes: SessaoSolo[] | null };

// O nível que a tela abre: o da próxima lição a fazer. Sem histórico, o
// primeiro.
function indiceInicial(grupos: GrupoDoPercurso[], progresso: ProgressoDoPercurso | null): number {
  if (progresso == null) return 0;
  const indice = grupos.findIndex((g) => g.nivel === progresso.proxima.licao.nivel);
  return Math.max(0, indice);
}

function Caminho() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  // null até os dados chegarem: aí vira o nível da próxima lição, e dali em
  // diante só as setas mudam.
  const [indiceDoNivel, setIndiceDoNivel] = useState<number | null>(null);
  // Lido uma vez ao abrir a tela; quem termina ou pula o tutorial vira
  // false aqui e grava a marca na sessão.
  const [mostrarTutorial, setMostrarTutorial] = useState(() => !sessao.tutorialVisto());

  function terminarTutorial() {
    sessao.marcarTutorialVisto();
    setMostrarTutorial(false);
  }

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        const [campanha, licoes, sessoes] = await Promise.all([
          api.solo.campanhaAtual(),
          api.solo.missoes().then((m) => desembrulhar<Missao>(m)),
          api.solo
            .historico()
            .then((h) => desembrulhar<SessaoSolo>(h))
            .catch((falha) => {
              console.error(falha);
              return null;
            }),
        ]);
        if (cancelado) return;

        if (campanha == null) {
          // Sem campanha não há o que trilhar: o dashboard é quem oferece
          // começar. replace, para o voltar do navegador não cair aqui.
          window.location.replace(ROTA_DASHBOARD);
          return;
        }
        // O treino lê o id da campanha da sessão (ver sessao.campanhaAtiva).
        sessao.atualizarUsuario({ campanhaAtiva: campanha.campanhaId });
        setCarga({ estado: 'pronto', licoes, sessoes });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const pronto = carga.estado === 'pronto' ? carga : null;
  const grupos = useMemo(() => agruparPorNivel(pronto?.licoes ?? []), [pronto?.licoes]);
  const progresso = useMemo(() => {
    if (!pronto?.sessoes) return null;
    return progressoDoPercurso(ordemDoPercurso(pronto.licoes), pronto.sessoes);
  }, [pronto]);

  useEffect(() => {
    if (indiceDoNivel == null && grupos.length > 0) {
      setIndiceDoNivel(indiceInicial(grupos, progresso));
    }
  }, [grupos, progresso, indiceDoNivel]);

  function mudarNivel(passo: -1 | 1) {
    setIndiceDoNivel((atual) => Math.max(0, Math.min(grupos.length - 1, (atual ?? 0) + passo)));
  }

  function renderizarCorpo() {
    if (carga.estado === 'carregando') {
      return <div className="vidro caminho-faixa caminho-faixa-esqueleto" aria-hidden="true" />;
    }

    if (carga.estado === 'erro') {
      return (
        <div className="caminho-aviso">
          <PainelErro
            titulo="Não foi possível carregar o caminho"
            texto={carga.mensagem}
            aoTentarDeNovo={() => setTentativa((n) => n + 1)}
          />
        </div>
      );
    }

    if (mostrarTutorial) {
      return <Tutorial aoTerminar={terminarTutorial} />;
    }

    if (grupos.length === 0 || indiceDoNivel == null) {
      return <p className="caminho-aviso estado">Nenhuma lição disponível por enquanto.</p>;
    }

    const grupo = grupos[indiceDoNivel];
    return (
      <>
        <FaixaDoNivel
          grupo={grupo}
          temAnterior={indiceDoNivel > 0}
          temSeguinte={indiceDoNivel < grupos.length - 1}
          aoMudar={mudarNivel}
        />
        <Trilha grupo={grupo} progresso={progresso} />
      </>
    );
  }

  return (
    <MolduraSolo ativo="caminho" esconderMenu={mostrarTutorial && carga.estado === 'pronto'}>
      <main className="caminho">{renderizarCorpo()}</main>
    </MolduraSolo>
  );
}

// ============================================================================
// Erros — decide pelo status, nunca pelo texto que o servidor mandou
// ============================================================================

function mensagemDaFalha(excecao: unknown): string {
  // Duck typing, não instanceof: o erro do mock tem a mesma forma do
  // ErroApi do api.ts, mas não é instância dele.
  const erro = excecao as ErroDaApi | null | undefined;
  if (erro?.name !== 'ErroApi') {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  // 401 não entra aqui: o api.ts já derruba a sessão e sai da tela.
  if (erro.status === 0) return MENSAGENS.CONEXAO;
  if (erro.status === 403) return MENSAGENS.PERMISSAO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de conta (e grava o modo solo). Devolveu null, redirecionou: a
// tela para aqui. Quem não tem campanha é mandado ao dashboard no
// carregar(), depois de o back responder — a sessão local não sabe disso
// logo depois do login.
const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Caminho />);
}
