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
//   PainelDeRelatorio   os números e a barra de quanto falta (o do aluno)
//
// A tabela de participantes é o componente Tabela (./Tabela.tsx); só as
// colunas mudam por papel, e por isso elas ficam em cada tela.
//
// Desenho em css/escola.css.

import { comPpm } from './Ppm.js';
import { useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode } from 'react';
import { Moldura } from './Moldura.js';
import { CapaOuImagem, sementeDaTurma } from './EntradaDoModo.js';
import { Bloco } from './Bloco.js';
import { IconeCadeado } from './IconesDoTutorial.js';
import { PainelEstado } from './PainelErro.js';
import { querMenosMovimento } from '../utils/movimento.js';

// Abas

// As do aluno (a sala) e as do professor, que têm outra ordem e outros
// rótulos: Atividades → Relatório da turma → Alunos.
export type AbaDaTurma = 'exercicios' | 'participantes' | 'relatorio' | 'atividades' | 'alunos';

export interface DefinicaoDeAba {
  chave: AbaDaTurma;
  rotulo: string;
  /** Uma linha curta embaixo do rótulo ("5 atribuídas"): a aba vira cartão. */
  detalhe?: string;
}

const ABAS: DefinicaoDeAba[] = [
  { chave: 'exercicios', rotulo: 'Exercícios' },
  { chave: 'participantes', rotulo: 'Participantes' },
  { chave: 'relatorio', rotulo: 'Relatório' },
];

// A pedida na URL, se for uma das abas da tela; senão a primeira.
function abaDaUrl(abas: { chave: AbaDaTurma }[]): AbaDaTurma {
  const pedida = new URLSearchParams(window.location.search).get('aba');
  return abas.some((a) => a.chave === pedida) ? (pedida as AbaDaTurma) : abas[0].chave;
}

// A aba atual e a função que troca. replaceState, e não pushState: trocar
// de aba não é uma "página" nova para o botão voltar — só o F5 precisa
// lembrar dela.
export function useAbaDaUrl(abas: { chave: AbaDaTurma }[] = ABAS): [AbaDaTurma, (aba: AbaDaTurma) => void] {
  const [aba, setAba] = useState<AbaDaTurma>(() => abaDaUrl(abas));

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

// Casca

interface PropsCasca {
  modo: 'professor' | 'aluno';
  /** Sem ele, a marca: a sala é a casa do aluno, não há de onde voltar. */
  voltar?: { href: string; rotulo: string };
  /** null enquanto a turma não chega: o título guarda a altura. */
  titulo: string | null;
  subtitulo: string | null;
  /** Uma frase curta: para que a tela serve. */
  descricao?: string;
  /** Os botões do lado direito do título (a ação principal em destaque). */
  acoes?: ReactNode;
  /** Entre o título e as abas (as métricas do professor). */
  extra?: ReactNode;
  /** A capa da turma, acima do título: a imagem enviada (temCapa) ou, sem
   *  ela, o desenho gerado pela semente. null: sem capa no topo. */
  capa?: { id: string; capaSemente?: number; temCapa?: boolean; daSala?: boolean } | null;
  aba: AbaDaTurma;
  aoSelecionarAba: (aba: AbaDaTurma) => void;
  /** Sem ela, as três da sala do aluno. */
  abas?: DefinicaoDeAba[];
  carregando: boolean;
  /** O conteúdo da aba atual. */
  children: ReactNode;
}

// O &nbsp; no título e no subtítulo enquanto a turma não chega: as linhas
// já têm a altura certa, e nada pula quando o texto aparece.
const NBSP = String.fromCharCode(0xa0);

export function CascaDaTurma(props: PropsCasca) {
  const { modo, voltar, titulo, subtitulo, descricao, acoes, extra, capa, aba, aoSelecionarAba, abas = ABAS, carregando, children } = props;

  // Troca de aba: o painel entra num fade de 150 ms. Pela Web Animations, e
  // não por `key`, para o conteúdo não remontar (e perder o estado).
  const painel = useRef<HTMLDivElement>(null);
  const primeiraAba = useRef(true);
  useEffect(() => {
    if (primeiraAba.current) {
      primeiraAba.current = false;
      return;
    }
    if (!querMenosMovimento()) painel.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
  }, [aba]);

  return (
    <Moldura
      modo={modo}
      ativo={modo === 'professor' ? 'turmas' : 'sala'}
      voltar={voltar}
      classeDoConteudo="pagina"
    >
      <main>
        {/* A mesma capa do cartão da lista: a imagem, ou o desenho gerado. */}
        {capa && (
          <div className="capa-topo" aria-hidden="true">
            <CapaOuImagem
              id={capa.id}
              semente={sementeDaTurma(capa.id, capa.capaSemente)}
              temCapa={capa.temCapa ?? true}
              daSala={capa.daSala}
            />
          </div>
        )}
        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo">{titulo ?? NBSP}</h1>
            <p className="subtitulo">{subtitulo ?? NBSP}</p>
            {descricao && <p className="descricao-tela">{descricao}</p>}
          </div>
          {acoes && <div className="cabecalho-acoes">{acoes}</div>}
        </div>

        {extra}

        <AbasDaTurma abas={abas} aba={aba} aoSelecionar={aoSelecionarAba} />

        {/* As três abas apontam para o mesmo #conteudo, que troca de
            conteúdo; aria-labelledby segue a aba ativa para o leitor de
            tela anunciar de qual delas ele é. */}
        <div id="conteudo" role="tabpanel" aria-busy={carregando} aria-labelledby={`aba-${aba}`} ref={painel}>
          {children}
        </div>
      </main>
    </Moldura>
  );
}

// Roving tabindex: só a aba selecionada está na ordem do Tab; as setas
// esquerda e direita é que movem entre as três.
interface PropsAbas {
  abas: DefinicaoDeAba[];
  aba: AbaDaTurma;
  aoSelecionar: (aba: AbaDaTurma) => void;
}

function AbasDaTurma({ abas: ABAS, aba, aoSelecionar }: PropsAbas) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const comoCartoes = ABAS.some((a) => a.detalhe != null);

  function aoTeclar(evento: KeyboardEventReact, indice: number) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const passo = evento.key === 'ArrowRight' ? 1 : -1;
    const proximo = (indice + passo + ABAS.length) % ABAS.length;
    botoes.current[proximo]?.focus();
    aoSelecionar(ABAS[proximo].chave);
  }

  return (
    <div className={comoCartoes ? 'abas abas-cartoes' : 'abas'} role="tablist" aria-label="Seções da turma">
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
          {comoCartoes ? (
            <>
              <span className="aba-rotulo">{item.rotulo}</span>
              <span className="aba-detalhe">{item.detalhe}</span>
            </>
          ) : (
            item.rotulo
          )}
        </button>
      ))}
    </div>
  );
}

// Turma não encontrada

interface PropsNaoEncontrada {
  modo: 'professor' | 'aluno';
  texto: string;
  /** O caminho de volta: a lista de turmas (ou de salas). */
  link: { href: string; rotulo: string };
}

// Substitui a tela inteira (cabeçalho e abas incluídos): uma turma que não
// existe não tem o que essas peças mostrariam.
export function TurmaNaoEncontrada({ modo, texto, link }: PropsNaoEncontrada) {
  return (
    <Moldura modo={modo} ativo={modo === 'professor' ? 'turmas' : 'sala'} classeDoConteudo="pagina">
      <main>
        <PainelEstado titulo="Turma não encontrada" texto={texto}>
          <a className="btn btn-solido tecla tecla-clara" href={link.href}>
            {link.rotulo}
          </a>
        </PainelEstado>
      </main>
    </Moldura>
  );
}

// Trilha de exercícios

/**
 * Uma pedra da trilha. O estado diz como ela é desenhada:
 *   feito   — sólida, com o visto (o aluno concluiu);
 *   agora   — acesa (o próximo do aluno);
 *   bloqueado — apagada, com cadeado e sem link (os seguintes do aluno);
 *   turma   — neutra, com o número (a visão do professor, que não tem
 *             "o seu" estado: a legenda diz quantos concluíram).
 */
export interface PedraDaTrilha {
  id: string;
  titulo: string;
  estado: 'feito' | 'agora' | 'bloqueado' | 'turma';
  /** A linha em mono embaixo do título ("concluído", "3 de 4 concluíram"). */
  legenda: string;
  /** Presente: a pedra é link (o aluno vai treinar). */
  href?: string;
}

// Quatro pedras por fileira; a fileira seguinte volta da direita para a
// esquerda, como uma trilha que serpenteia (ver .trilha em escola.css).
const PEDRAS_POR_FILEIRA = 4;

// Até 3 exercícios não há caminho para serpentear: nas quatro colunas,
// as pedras ficariam amontoadas à esquerda. Viram uma linha só,
// centralizada, com uma coluna por pedra (--quantas, ver .trilha-curta em
// escola.css). A posição de cada uma não muda: com menos de 4, todas já
// caem na primeira fileira, da esquerda para a direita.
const TRILHA_CURTA_ATE = 3;

// A legenda só lista os estados que aparecem na trilha.
const LEGENDA: { estado: PedraDaTrilha['estado']; rotulo: string }[] = [
  { estado: 'feito', rotulo: 'concluído' },
  { estado: 'agora', rotulo: 'próximo' },
  { estado: 'bloqueado', rotulo: 'bloqueado' },
];

export function TrilhaDeExercicios({ pedras }: { pedras: PedraDaTrilha[] }) {
  const curta = pedras.length <= TRILHA_CURTA_ATE;
  const classe = curta ? 'trilha trilha-curta' : 'trilha';
  const estilo = curta ? ({ '--quantas': pedras.length } as React.CSSProperties) : undefined;
  const estados = new Set(pedras.map((p) => p.estado));
  const legenda = LEGENDA.filter((item) => estados.has(item.estado));

  return (
    <Bloco
      titulo="Atividades da turma"
      texto={
        <>
          {estados.has('turma')
            ? 'Na ordem em que os alunos fazem: cada um abre a próxima ao concluir a anterior.'
            : 'Faça na ordem: a próxima abre quando você conclui a anterior.'}
          {legenda.length > 0 && (
            <span className="legenda">
              {legenda.map((item) => (
                <span key={item.estado} className={`legenda-item legenda-${item.estado}`}>
                  {item.rotulo}
                </span>
              ))}
            </span>
          )}
        </>
      }
    >
      <ol className={classe} style={estilo}>
        {pedras.map((pedra, i) => (
          <Pedra key={pedra.id} pedra={pedra} posicao={i} />
        ))}
      </ol>
    </Bloco>
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
  const marca = pedra.estado === 'feito' ? '✓' : pedra.estado === 'bloqueado' ? <IconeCadeado /> : posicao + 1;
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

// Painel de relatório

// Duas médias de PPM da turma, as duas certas, com contas diferentes: o
// topo da turma pesa cada aluno igual; o relatório pesa cada sessão igual.
export const DICA_PPM_POR_ALUNO = 'Média dos PPM médios de cada aluno que já treinou: cada aluno conta igual.';
export const DICA_PPM_DAS_SESSOES = 'Média do PPM de todas as sessões da turma: quem treinou mais pesa mais.';

export interface NumeroDoRelatorio {
  rotulo: string;
  /** Já formatado: "41", "94%", "—". */
  valor: string;
  /** A régua (a média da sala ao lado do número do aluno): um tom abaixo. */
  apagado?: boolean;
  /** Tooltip curto: como o número é calculado. */
  dica?: string;
  /** Ao lado do número: a estrela dos dias seguidos, por exemplo. */
  selo?: ReactNode;
}

interface PropsPainel {
  rotulo: string;
  /** Cada grupo é uma fileira de números; entre fileiras, uma linha fina. */
  grupos: NumeroDoRelatorio[][];
  /**
   * Presente: ainda não há sessões bastantes para as médias, e o painel
   * mostra quanto falta embaixo dos números que já valem (os grupos).
   * Quem decide é o back (manda as médias nulas); a tela só passa a
   * contagem adiante.
   */
  falta?: { sessoes: number; minimo: number } | null;
}

// É a visão do ALUNO (sala.html, aba Relatório): sem PDF nem CSV, que são
// coisa do professor (RelatorioDaTurma.tsx).
export function PainelDeRelatorio({ rotulo, grupos, falta }: PropsPainel) {
  const semDados = Boolean(falta);
  return (
    <section className="painel-relatorio vidro" aria-label={rotulo}>
      {/* Os números que não dependem de média (sessões, lições, dias
          seguidos com a estrela) aparecem sempre; o que falta, só embaixo. */}
      <Numeros grupos={grupos} />
      {semDados && <QuantoFalta sessoes={falta.sessoes} minimo={falta.minimo} />}
    </section>
  );
}

function Numeros({ grupos }: { grupos: NumeroDoRelatorio[][] }) {
  return (
    <>
      {grupos.map((grupo, i) => (
        <div key={i} className="relatorio-numeros">
          {grupo.map((numero, j) => (
            <div key={j} className={numero.apagado ? 'metrica-item relatorio-apagado' : 'metrica-item'} title={numero.dica}>
              <span className="metrica-rotulo">{comPpm(numero.rotulo)}</span>
              <span className="metrica-valor">{numero.valor}</span>
              {numero.selo}
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
          {sessoes} de {minimo} atividades concluídas nesta turma
        </span>
        <span
          className="barra-falta"
          role="progressbar"
          aria-label="Atividades concluídas para ver a sua média"
          aria-valuemin={0}
          aria-valuemax={minimo}
          aria-valuenow={Math.min(sessoes, minimo)}
        >
          <span style={{ width: `${Math.round(fracao * 100)}%` }} />
        </span>
      </div>
      <p className="relatorio-aviso">
        {/* Para criança: o que fazer, e não por que a conta não vale. */}
        Conclua mais {falta === 1 ? '1 atividade' : `${falta} atividades`} para ver sua média e comparar com a turma.
      </p>
    </>
  );
}
