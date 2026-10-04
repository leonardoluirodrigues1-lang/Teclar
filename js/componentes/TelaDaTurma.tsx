// TelaDaTurma.tsx
// As peças da tela de UMA turma, iguais para os dois papéis: o professor
// (js/professor/Turma.tsx) e o aluno (js/aluno/Sala.tsx). Existe para o
// projeto ter uma tela de turma só: cada um daqueles arquivos guarda apenas
// o que muda por papel — de onde vêm os dados, quais colunas a tabela de
// participantes tem e quais ações aparecem.
//
//   CascaDaTurma        conta fixa, "← voltar", título, subtítulo, ações e
//                       as três abas (Exercícios, Participantes, Relatório)
//   useAbaDaUrl         a aba escolhida, guardada em ?aba= para o F5
//   TurmaNaoEncontrada  a tela inteira quando a turma não existe para ele
//   TrilhaDeExercicios  os exercícios como pedras, na ordem de atribuição
//   PainelDeRelatorio   os números, a barra de quanto falta e PDF/CSV
//
// A tabela de participantes é o componente Tabela (./Tabela.tsx); só as
// colunas mudam por papel, e por isso elas ficam em cada tela.
//
// Desenho em css/escola.css.

import { useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode } from 'react';
import type { SecoesNav } from './Nav.js';
import { ContaFixa } from './EntradaDoModo.js';
import { PainelEstado } from './PainelErro.js';

// ============================================================================
// Abas
// ============================================================================

export type AbaDaTurma = 'exercicios' | 'participantes' | 'relatorio';

const ABAS: { chave: AbaDaTurma; rotulo: string }[] = [
  { chave: 'exercicios', rotulo: 'Exercícios' },
  { chave: 'participantes', rotulo: 'Participantes' },
  { chave: 'relatorio', rotulo: 'Relatório' },
];

function abaDaUrl(): AbaDaTurma {
  const pedida = new URLSearchParams(window.location.search).get('aba');
  return ABAS.some((a) => a.chave === pedida) ? (pedida as AbaDaTurma) : 'exercicios';
}

// A aba atual e a função que troca. replaceState, e não pushState: trocar
// de aba não é uma "página" nova para o botão voltar — só o F5 precisa
// lembrar dela.
export function useAbaDaUrl(): [AbaDaTurma, (aba: AbaDaTurma) => void] {
  const [aba, setAba] = useState<AbaDaTurma>(abaDaUrl);

  function selecionar(nova: AbaDaTurma) {
    setAba(nova);
    const url = new URL(window.location.href);
    url.searchParams.set('aba', nova);
    window.history.replaceState(null, '', url);
  }

  return [aba, selecionar];
}

// Para quando o elemento com o foco some (uma linha removida, por
// exemplo): a aba é o próximo lugar estável para o foco pousar.
export function focarAba(aba: AbaDaTurma) {
  document.getElementById(`aba-${aba}`)?.focus();
}

// ============================================================================
// Casca
// ============================================================================

interface PropsCasca {
  secoes: SecoesNav;
  /** A linha embaixo do nome, na conta fixa. */
  papel: string;
  voltar: { href: string; rotulo: string };
  /** null enquanto a turma não chega: o título guarda a altura. */
  titulo: string | null;
  subtitulo: string | null;
  /** Os botões do lado direito do título (só o professor tem). */
  acoes?: ReactNode;
  /** Entre o título e as abas (as métricas do professor). */
  extra?: ReactNode;
  aba: AbaDaTurma;
  aoSelecionarAba: (aba: AbaDaTurma) => void;
  carregando: boolean;
  /** O conteúdo da aba atual. */
  children: ReactNode;
}

// O &nbsp; no título e no subtítulo enquanto a turma não chega: as linhas
// já têm a altura certa, e nada pula quando o texto aparece.
const NBSP = String.fromCharCode(0xa0);

export function CascaDaTurma(props: PropsCasca) {
  const { secoes, papel, voltar, titulo, subtitulo, acoes, extra, aba, aoSelecionarAba, carregando, children } = props;

  return (
    <>
      <ContaFixa secoes={secoes} papel={papel} />

      <main>
        <a className="voltar" href={voltar.href}>
          <span className="voltar-seta" aria-hidden="true">
            ←
          </span>
          {voltar.rotulo}
        </a>

        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo">{titulo ?? NBSP}</h1>
            <p className="subtitulo">{subtitulo ?? NBSP}</p>
          </div>
          {acoes && <div className="cabecalho-acoes">{acoes}</div>}
        </div>

        {extra}

        <AbasDaTurma aba={aba} aoSelecionar={aoSelecionarAba} />

        {/* As três abas apontam para o mesmo #conteudo, que troca de
            conteúdo; aria-labelledby segue a aba ativa para o leitor de
            tela anunciar de qual delas ele é. */}
        <div id="conteudo" role="tabpanel" aria-busy={carregando} aria-labelledby={`aba-${aba}`}>
          {children}
        </div>
      </main>
    </>
  );
}

// Roving tabindex: só a aba selecionada está na ordem do Tab; as setas
// esquerda e direita é que movem entre as três.
function AbasDaTurma({ aba, aoSelecionar }: { aba: AbaDaTurma; aoSelecionar: (aba: AbaDaTurma) => void }) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function aoTeclar(evento: KeyboardEventReact, indice: number) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const passo = evento.key === 'ArrowRight' ? 1 : -1;
    const proximo = (indice + passo + ABAS.length) % ABAS.length;
    botoes.current[proximo]?.focus();
    aoSelecionar(ABAS[proximo].chave);
  }

  return (
    <div className="abas" role="tablist" aria-label="Seções da turma">
      {ABAS.map((item, indice) => (
        <button
          key={item.chave}
          type="button"
          className="aba tecla"
          id={`aba-${item.chave}`}
          ref={(el) => {
            botoes.current[indice] = el;
          }}
          role="tab"
          aria-selected={aba === item.chave}
          aria-controls="conteudo"
          tabIndex={aba === item.chave ? 0 : -1}
          onClick={() => aoSelecionar(item.chave)}
          onKeyDown={(evento) => aoTeclar(evento, indice)}
        >
          {item.rotulo}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Turma não encontrada
// ============================================================================

interface PropsNaoEncontrada {
  secoes: SecoesNav;
  papel: string;
  texto: string;
  /** O caminho de volta: a lista de turmas (ou de salas). */
  link: { href: string; rotulo: string };
}

// Substitui a tela inteira (cabeçalho e abas incluídos): uma turma que não
// existe não tem o que essas peças mostrariam.
export function TurmaNaoEncontrada({ secoes, papel, texto, link }: PropsNaoEncontrada) {
  return (
    <>
      <ContaFixa secoes={secoes} papel={papel} />
      <main>
        <PainelEstado titulo="Turma não encontrada" texto={texto}>
          <a className="btn btn-solido tecla tecla-clara" href={link.href}>
            {link.rotulo}
          </a>
        </PainelEstado>
      </main>
    </>
  );
}

// ============================================================================
// Trilha de exercícios
// ============================================================================

/**
 * Uma pedra da trilha. O estado diz como ela é desenhada:
 *   feito   — sólida, com o visto (o aluno concluiu);
 *   agora   — acesa (o próximo do aluno);
 *   depois  — apagada (os seguintes do aluno);
 *   turma   — neutra, com o número (a visão do professor, que não tem
 *             "o seu" estado: a legenda diz quantos concluíram).
 */
export interface PedraDaTrilha {
  id: string;
  titulo: string;
  estado: 'feito' | 'agora' | 'depois' | 'turma';
  /** A linha em mono embaixo do título ("concluído", "3 de 4 concluíram"). */
  legenda: string;
  /** Presente: a pedra é link (o aluno vai treinar). */
  href?: string;
}

// Quatro pedras por fileira; a fileira seguinte volta da direita para a
// esquerda, como uma trilha que serpenteia (ver .trilha em escola.css).
const PEDRAS_POR_FILEIRA = 4;

export function TrilhaDeExercicios({ pedras }: { pedras: PedraDaTrilha[] }) {
  return (
    <ol className="trilha">
      {pedras.map((pedra, i) => (
        <Pedra key={pedra.id} pedra={pedra} posicao={i} />
      ))}
    </ol>
  );
}

function Pedra({ pedra, posicao }: { pedra: PedraDaTrilha; posicao: number }) {
  const fileira = Math.floor(posicao / PEDRAS_POR_FILEIRA);
  let coluna = posicao % PEDRAS_POR_FILEIRA;
  // Fileira ímpar volta: a trilha serpenteia em vez de recomeçar na esquerda.
  if (fileira % 2 === 1) coluna = PEDRAS_POR_FILEIRA - 1 - coluna;

  // Concluído é a tecla clara, de face branca: o mesmo relevo do botão
  // principal (.tecla-clara, css/base/luz.css).
  const classe = pedra.estado === 'feito' ? 'pedra tecla tecla-clara' : 'pedra tecla';
  const marca = pedra.estado === 'feito' ? '✓' : posicao + 1;
  // As variáveis de coluna e fileira são lidas pelo CSS só na tela larga.
  const estilo = { '--coluna': coluna + 1, '--fileira': fileira + 1 } as React.CSSProperties;

  // Com link, o rótulo do link diz tudo, e o texto embaixo é só visual.
  // Sem link, o próprio texto é o que o leitor de tela lê.
  if (pedra.href) {
    return (
      <li className={`no no-${pedra.estado}`} style={estilo}>
        <a
          className={classe}
          href={pedra.href}
          aria-label={`${posicao + 1}. ${pedra.titulo} — ${pedra.legenda}`}
          aria-current={pedra.estado === 'agora' ? 'step' : undefined}
        >
          <span aria-hidden="true">{marca}</span>
        </a>
        <span className="no-titulo" aria-hidden="true">
          {pedra.titulo}
        </span>
        <span className="no-estado" aria-hidden="true">
          {pedra.legenda}
        </span>
      </li>
    );
  }

  return (
    <li className={`no no-${pedra.estado}`} style={estilo}>
      <span className={classe} aria-hidden="true">
        {marca}
      </span>
      <span className="no-titulo">{pedra.titulo}</span>
      <span className="no-estado">{pedra.legenda}</span>
    </li>
  );
}

// ============================================================================
// Painel de relatório
// ============================================================================

export interface NumeroDoRelatorio {
  rotulo: string;
  /** Já formatado: "41", "94%", "—". */
  valor: string;
  /** A régua (a média da sala ao lado do número do aluno): um tom abaixo. */
  apagado?: boolean;
}

interface PropsPainel {
  rotulo: string;
  /** Cada grupo é uma fileira de números; entre fileiras, uma linha fina. */
  grupos: NumeroDoRelatorio[][];
  /**
   * Presente: ainda não há sessões bastantes, e o painel mostra quanto
   * falta no lugar dos números, com PDF e CSV desligados. Quem decide é
   * o back (manda as médias nulas); a tela só passa a contagem adiante.
   */
  falta?: { sessoes: number; minimo: number } | null;
  aoGerarCsv: () => void;
}

export function PainelDeRelatorio({ rotulo, grupos, falta, aoGerarCsv }: PropsPainel) {
  const semDados = Boolean(falta);
  return (
    <section className="painel-relatorio vidro" aria-label={rotulo}>
      {semDados ? <QuantoFalta sessoes={falta.sessoes} minimo={falta.minimo} /> : <Numeros grupos={grupos} />}

      <div className="relatorio-acoes">
        {/* "Gerar PDF" é a impressão do navegador, que salva em PDF. A folha
            de impressão (@media print, escola.css) deixa só o relatório,
            em preto no branco. */}
        <button
          type="button"
          className="btn btn-solido tecla tecla-clara"
          disabled={semDados}
          onClick={() => window.print()}
        >
          Gerar PDF
        </button>
        <button type="button" className="btn btn-vidro vidro tecla" disabled={semDados} onClick={aoGerarCsv}>
          Gerar CSV
        </button>
      </div>
    </section>
  );
}

function Numeros({ grupos }: { grupos: NumeroDoRelatorio[][] }) {
  return (
    <>
      {grupos.map((grupo, i) => (
        <div key={i} className="relatorio-numeros">
          {grupo.map((numero, j) => (
            <div key={j} className={numero.apagado ? 'metrica-item relatorio-apagado' : 'metrica-item'}>
              <span className="metrica-rotulo">{numero.rotulo}</span>
              <span className="metrica-valor">{numero.valor}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// Abaixo do mínimo: quanto falta, em número e em barra. Nenhuma média.
function QuantoFalta({ sessoes, minimo }: { sessoes: number; minimo: number }) {
  const falta = Math.max(0, minimo - sessoes);
  const fracao = Math.min(1, sessoes / minimo);
  return (
    <>
      <div className="relatorio-falta">
        <span>
          {sessoes} de {minimo} sessões concluídas nesta turma
        </span>
        <span
          className="barra-falta"
          role="progressbar"
          aria-label="Sessões concluídas para o relatório"
          aria-valuemin={0}
          aria-valuemax={minimo}
          aria-valuenow={Math.min(sessoes, minimo)}
        >
          <span style={{ width: `${Math.round(fracao * 100)}%` }} />
        </span>
      </div>
      <p className="relatorio-aviso">
        {falta === 1 ? 'Falta 1 sessão' : `Faltam ${falta} sessões`} para o relatório sair com média e comparação.
        Abaixo de {minimo}, o número não diz nada sobre como a pessoa está indo.
      </p>
    </>
  );
}
