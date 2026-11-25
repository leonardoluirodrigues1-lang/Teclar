// RelatorioDaTurma.tsx — a aba "Relatório da turma" de Turma.tsx, presa à
// turma aberta. Saiu da antiga tela de relatórios (que virou "Relatórios
// gerais", ./Relatorios.tsx) e trouxe junto as duas visões dela:
//
//   · os cartões: PPM médio, Precisão média, Tentativas, Alunos ativos nos
//     últimos 7 dias e Exercícios concluídos (GET /turmas/:id/relatorio);
//   · a evolução da turma, dia a dia, num gráfico de linha com a tabela dos
//     mesmos números ao lado (GET /turmas/:id/relatorio/evolucao);
//   · "Por aluno" e "Por exercício", com Gerar CSV (a visão aberta, na
//     ordem da tela) e Gerar PDF (a impressão do navegador);
//   · o nome do aluno abre o histórico dele (data, exercício, PPM, precisão,
//     resultado) com o gráfico da evolução dele.
//
// TUDO O QUE É NÚMERO VEM PRONTO DO BACK: esta tela não soma nem divide, só
// formata, ordena e mostra "—" onde o back mandou null. Zero é zero.

import { comPpm } from '../componentes/Ppm.js';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as KeyboardEventReact, type MouseEvent as MouseEventReact } from 'react';
import { api } from '../nucleo/api.js';
import type {
  ErroDaApi,
  EvolucaoDoDia,
  RelatorioAluno,
  RelatorioExercicio,
  RelatorioTurma,
  SessaoDoAluno,
} from '../nucleo/tipos.js';
import type { Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { baixarCsv, slug } from '../utils/csv.js';
import { contagem, formatarData, formatarDataHora, formatarDecimal, numero, pesoDificuldade, porcentagem, rotuloDificuldade } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
import { Modal } from '../componentes/ModalReact.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { Bloco } from '../componentes/Bloco.js';
import { Estrela } from '../componentes/Estrela.js';
import { Grafico } from '../componentes/Grafico.js';
import { DICA_PPM_DAS_SESSOES } from '../componentes/TelaDaTurma.js';

// Linhas de esqueleto: a altura de uma turma de tamanho comum.
const ESQUELETOS_LINHA = 6;

// Abaixo disto a precisão média ganha tom mais forte. É informação, não
// acusação: nenhuma cor de alerta, nenhum ícone, nenhum aviso.
const PRECISAO_DESTAQUE = 85;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  NAO_ENCONTRADO: 'Esta turma não existe mais.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

type Visao = 'alunos' | 'exercicios';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | {
      estado: 'pronto';
      turma: RelatorioTurma;
      alunos: RelatorioAluno[];
      exercicios: RelatorioExercicio[];
      evolucao: EvolucaoDoDia[];
    };

// A visão aberta vive na URL (?visao=), ao lado do ?aba= da turma: o F5 e o
// link copiado caem no mesmo lugar.
function visaoDaUrl(): Visao {
  return new URLSearchParams(window.location.search).get('visao') === 'exercicios' ? 'exercicios' : 'alunos';
}

interface PropsRelatorioDaTurma {
  turmaId: string;
  nomeDaTurma: string;
  toasts: Toasts;
}

export function RelatorioDaTurma({ turmaId, nomeDaTurma, toasts }: PropsRelatorioDaTurma) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [visao, setVisao] = useState<Visao>(visaoDaUrl);
  // Uma ordenação por visão: voltar à anterior encontra a tabela como ficou.
  const [ordemAlunos, setOrdemAlunos] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  const [ordemExercicios, setOrdemExercicios] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  const [historicoDe, setHistoricoDe] = useState<{ chave: number; aluno: RelatorioAluno } | null>(null);
  const chaveModal = useRef(0);

  const visaoAlunos = useRef<HTMLButtonElement>(null);
  const visaoExercicios = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    Promise.all([
      api.relatorios.turma(turmaId),
      api.relatorios.porAluno(turmaId),
      api.relatorios.porExercicio(turmaId),
      api.relatorios.evolucao(turmaId),
    ])
      .then(([turma, alunos, exercicios, evolucao]) => {
        if (cancelado) return;
        setCarga({
          estado: 'pronto',
          turma,
          alunos: desembrulhar(alunos),
          exercicios: desembrulhar(exercicios),
          evolucao: desembrulhar(evolucao),
        });
      })
      .catch((excecao) => {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      });
    return () => {
      cancelado = true;
    };
  }, [turmaId, tentativa]);

  const relatorio = carga.estado === 'pronto' ? carga : null;

  // As listas na ordem em que estão NA TELA: o CSV exporta exatamente isto.
  const alunosVisiveis = useMemo(
    () => ordenar(relatorio?.alunos ?? [], ordemAlunos, valorOrdenavelAluno),
    [relatorio, ordemAlunos]
  );
  const exerciciosVisiveis = useMemo(
    () => ordenar(relatorio?.exercicios ?? [], ordemExercicios, valorOrdenavelExercicio),
    [relatorio, ordemExercicios]
  );
  // Quem tem o melhor número de cada coluna, sobre a lista inteira.
  const melhores = useMemo(() => melhoresDaTurma(relatorio?.alunos ?? []), [relatorio]);

  // --- visões ---------------------------------------------------------------

  function selecionarVisao(nova: Visao) {
    if (nova === visao) return;
    setVisao(nova);
    const url = new URL(window.location.href);
    url.searchParams.set('visao', nova);
    window.history.replaceState(null, '', url);
  }

  // Roving tabindex, como as abas da turma: setas ← → trocam.
  function aoTeclarNaVisao(evento: KeyboardEventReact) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const proxima = visao === 'alunos' ? 'exercicios' : 'alunos';
    (proxima === 'alunos' ? visaoAlunos : visaoExercicios).current?.focus();
    selecionarVisao(proxima);
  }

  function exportar() {
    if (!relatorio) return;
    const [nomes, linhas] =
      visao === 'alunos'
        ? [COLUNAS_CSV_ALUNOS, alunosVisiveis.map(linhaCsvAluno)]
        : [COLUNAS_CSV_EXERCICIOS, exerciciosVisiveis.map(linhaCsvExercicio)];
    baixarCsv(`relatorio-${slug(nomeDaTurma)}-${visao}.csv`, [nomes, ...linhas]);
    toasts.mostrar('Relatório exportado');
  }

  // A linha inteira abre o histórico, mas quem faz isso é o botão do nome:
  // o clique é redirecionado para ele, e o foco tem para onde voltar.
  function aoClicarNaLinha(evento: MouseEventReact<HTMLDivElement>) {
    const alvo = evento.target as HTMLElement;
    if (alvo.closest('.relatorio-historico')) return;
    const botao = alvo.closest('tr')?.querySelector<HTMLButtonElement>('.relatorio-historico');
    if (!botao) return;
    botao.focus();
    botao.click();
  }

  // --- colunas --------------------------------------------------------------

  const colunasAlunos: ColunaTabela<RelatorioAluno>[] = [
    {
      rotulo: 'Aluno',
      campo: 'aluno',
      celula: (a) => (
        <button
          type="button"
          className="tabela-link relatorio-historico"
          aria-label={`Ver histórico de ${a.nome} nesta turma`}
          onClick={() => setHistoricoDe({ chave: ++chaveModal.current, aluno: a })}
        >
          <span className="celula-aluno-nome">{a.nome}</span>
        </button>
      ),
    },
    {
      rotulo: 'Sessões',
      campo: 'sessoes',
      classe: 'col-numero',
      celula: (a) => (semSessao(a) ? '—' : contagem(a.totalSessoes)),
    },
    {
      rotulo: 'PPM médio',
      campo: 'ppm',
      classe: 'col-numero',
      celula: (a) => (
        <>
          {numero(a.wpmMedio)}
          {melhores.ppm === a.id && <MarcaDoMelhor />}
        </>
      ),
    },
    {
      rotulo: 'Precisão média',
      campo: 'precisao',
      classe: (a) =>
        a.precisaoMedia != null && a.precisaoMedia < PRECISAO_DESTAQUE ? 'col-numero precisao-destaque' : 'col-numero',
      celula: (a) => (
        <>
          {porcentagem(a.precisaoMedia)}
          {melhores.precisao === a.id && <MarcaDoMelhor />}
        </>
      ),
    },
    {
      rotulo: 'Exercícios concluídos',
      campo: 'concluidos',
      classe: 'col-numero',
      celula: (a) =>
        semSessao(a) ? (
          '—'
        ) : (
          <>
            {`${contagem(a.exerciciosConcluidos)} de ${contagem(a.exerciciosAtribuidos)}`}
            {melhores.concluidos === a.id && <MarcaDoMelhor />}
          </>
        ),
    },
    {
      rotulo: 'Última atividade',
      campo: 'ultimaAtividade',
      celula: (a) => (a.ultimaAtividade ? formatarDataHora(a.ultimaAtividade) : 'Nunca treinou'),
    },
  ];

  const colunasExercicios: ColunaTabela<RelatorioExercicio>[] = [
    { rotulo: 'Exercício', campo: 'titulo', celula: (e) => e.titulo || 'Sem título' },
    { rotulo: 'Dificuldade', campo: 'dificuldade', celula: (e) => rotuloDificuldade(e.dificuldade) },
    {
      rotulo: 'Concluíram',
      campo: 'concluiram',
      classe: 'col-numero',
      celula: (e) => `${contagem(e.concluidoPor)} de ${contagem(e.totalAlunos)}`,
    },
    { rotulo: 'PPM médio', campo: 'ppm', classe: 'col-numero', celula: (e) => numero(e.wpmMedio) },
    {
      rotulo: 'Precisão média',
      campo: 'precisao',
      classe: (e) =>
        e.precisaoMedia != null && e.precisaoMedia < PRECISAO_DESTAQUE ? 'col-numero precisao-destaque' : 'col-numero',
      celula: (e) => porcentagem(e.precisaoMedia),
    },
    // Zero é 0: ninguém estourou, ou o exercício não tem tempo limite.
    { rotulo: 'Estouraram o tempo', campo: 'estouraram', classe: 'col-numero', celula: (e) => contagem(e.estouraramTempo) },
  ];

  const colunasEvolucao: ColunaTabela<EvolucaoDoDia>[] = [
    { rotulo: 'Dia', celula: (d) => formatarData(d.dia) },
    { rotulo: 'Sessões concluídas', classe: 'col-numero', celula: (d) => contagem(d.sessoes) },
    { rotulo: 'PPM médio', classe: 'col-numero', celula: (d) => numero(d.wpmMedio) },
    { rotulo: 'Precisão média', classe: 'col-numero', celula: (d) => porcentagem(d.precisaoMedia) },
  ];

  // --- conteúdo -------------------------------------------------------------

  if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={ESQUELETOS_LINHA} />;
  if (carga.estado === 'erro') {
    return (
      <PainelErro
        titulo="Não foi possível carregar o relatório"
        texto={carga.mensagem}
        aoTentarDeNovo={() => setTentativa((n) => n + 1)}
      />
    );
  }

  const { turma, evolucao } = carga;

  function renderizarVisao() {
    if (visao === 'exercicios') {
      if (exerciciosVisiveis.length === 0) {
        return (
          <PainelEstado
            titulo="Nenhum exercício atribuído a esta turma"
            texto="Sem exercício atribuído não há o que medir por exercício. Atribua um na aba Atividades."
          />
        );
      }
      return (
        <Tabela
          colunas={colunasExercicios}
          linhas={exerciciosVisiveis}
          chave={(e) => e.exercicioId}
          ordenacao={ordemExercicios}
          aoOrdenar={setOrdemExercicios}
        />
      );
    }
    if (alunosVisiveis.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhum aluno na turma ainda"
          texto="Adicione os alunos na aba Alunos. Quando eles treinarem, as sessões, o PPM e a precisão de cada um aparecem aqui."
        />
      );
    }
    return (
      <div className="relatorio-linhas-clicaveis" onClick={aoClicarNaLinha}>
        <Tabela
          colunas={colunasAlunos}
          linhas={alunosVisiveis}
          chave={(a) => a.id}
          classeLinha={(a) => (semSessao(a) ? 'linha-sem-dado' : undefined)}
          ordenacao={ordemAlunos}
          aoOrdenar={setOrdemAlunos}
        />
      </div>
    );
  }

  return (
    <section className="relatorio-da-turma" aria-label={`Relatório da turma ${nomeDaTurma}`}>
      {/* Os cinco números da turma, prontos do back. Sem dado é "—"; zero é 0. */}
      <dl className="cartoes-numero">
        <CartaoNumero rotulo={comPpm('PPM médio')} valor={numero(turma.wpmMedio)} dica={DICA_PPM_DAS_SESSOES} />
        <CartaoNumero rotulo="Precisão média" valor={porcentagem(turma.precisaoMedia)} />
        <CartaoNumero rotulo="Tentativas" valor={contagem(turma.tentativas)} />
        <CartaoNumero
          rotulo="Alunos ativos (7 dias)"
          valor={`${contagem(turma.alunosAtivos)} de ${contagem(turma.totalAlunos)}`}
        />
        <CartaoNumero rotulo="Exercícios concluídos" valor={contagem(turma.exerciciosConcluidos)} />
      </dl>

      <Bloco titulo="Evolução da turma" texto="PPM médio das sessões concluídas, dia a dia.">
        {evolucao.length === 0 ? (
          <p className="estado-vazio-curto">Ainda não há sessão concluída nesta turma: o gráfico aparece com a primeira.</p>
        ) : (
          <>
            <Grafico
              tipo="line"
              rotulos={evolucao.map((d) => diaCurto(d.dia))}
              series={[{ rotulo: 'PPM médio', dados: evolucao.map((d) => d.wpmMedio) }]}
              unidades={['PPM']}
              descricao={`Gráfico de linha: PPM médio da turma em ${evolucao.length} ${evolucao.length === 1 ? 'dia' : 'dias'}. Os números estão na tabela logo abaixo.`}
            />
            <details className="grafico-tabela">
              <summary>Ver os números do gráfico</summary>
              <Tabela colunas={colunasEvolucao} linhas={evolucao} chave={(d) => d.dia} />
            </details>
          </>
        )}
      </Bloco>

      <Bloco
        titulo="Desempenho"
        texto="Por aluno (o nome abre o histórico) ou por exercício."
        acoes={
          <div className="relatorio-acoes">
            {/* "Gerar PDF" é a impressão do navegador, que salva em PDF. */}
            <button type="button" className="btn btn-solido tecla tecla-clara" onClick={() => window.print()}>
              Gerar PDF
            </button>
            <button type="button" className="btn btn-vidro vidro tecla" onClick={exportar}>
              Gerar CSV
            </button>
          </div>
        }
      >
        <div className="abas" role="tablist" aria-label="Visões do relatório">
          <button
            type="button"
            className="aba tecla"
            id="visao-alunos"
            ref={visaoAlunos}
            role="tab"
            aria-selected={visao === 'alunos'}
            aria-controls="visao-conteudo"
            tabIndex={visao === 'alunos' ? 0 : -1}
            onClick={() => selecionarVisao('alunos')}
            onKeyDown={aoTeclarNaVisao}
          >
            Por aluno
          </button>
          <button
            type="button"
            className="aba tecla"
            id="visao-exercicios"
            ref={visaoExercicios}
            role="tab"
            aria-selected={visao === 'exercicios'}
            aria-controls="visao-conteudo"
            tabIndex={visao === 'exercicios' ? 0 : -1}
            onClick={() => selecionarVisao('exercicios')}
            onKeyDown={aoTeclarNaVisao}
          >
            Por exercício
          </button>
        </div>
        <div id="visao-conteudo" role="tabpanel" aria-labelledby={visao === 'alunos' ? 'visao-alunos' : 'visao-exercicios'}>
          {renderizarVisao()}
        </div>
      </Bloco>

      {historicoDe && (
        <ModalHistorico
          key={historicoDe.chave}
          turmaId={turmaId}
          aluno={historicoDe.aluno}
          aoFechar={() => setHistoricoDe(null)}
        />
      )}
    </section>
  );
}

function CartaoNumero({ rotulo, valor, dica }: { rotulo: React.ReactNode; valor: string; dica?: string }) {
  return (
    <div className="cartao-numero" title={dica}>
      <dt className="cartao-numero-rotulo">{rotulo}</dt>
      <dd className="cartao-numero-valor">{valor}</dd>
    </div>
  );
}

// "2026-10-03" -> "03/10". O dia já vem do back como texto: nada de Date(),
// que poderia trocar o dia pelo fuso.
function diaCurto(dia: string): string {
  const [, mes, d] = dia.split('-');
  return `${d}/${mes}`;
}

// Modal de histórico — as sessões do aluno NESTA turma
// Esc fecha, Tab não vaza e o foco volta ao nome que o abriu (ModalReact).

type CargaSessoes =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; sessoes: SessaoDoAluno[] };

const colunasHistorico: ColunaTabela<SessaoDoAluno>[] = [
  { rotulo: 'Data', celula: (s) => formatarDataHora(s.data) },
  { rotulo: 'Exercício', celula: (s) => s.tituloExercicio ?? 'Exercício removido' },
  { rotulo: 'PPM', classe: 'col-numero', celula: (s) => numero(s.wpm) },
  { rotulo: 'Precisão', classe: 'col-numero', celula: (s) => porcentagem(s.precisao) },
  // "Concluiu" e "Não concluiu" são as duas metades da mesma informação:
  // as duas aparecem, e nenhuma em cor de alerta.
  {
    rotulo: 'Resultado',
    celula: (s) => (
      <>
        {s.concluida ? 'Concluiu' : 'Não concluiu'}
        {s.comAtraso && <span className="etiqueta etiqueta-espera etiqueta-atraso">Feita com atraso</span>}
      </>
    ),
  },
];

function ModalHistorico({ turmaId, aluno, aoFechar }: { turmaId: string; aluno: RelatorioAluno; aoFechar: () => void }) {
  const [carga, setCarga] = useState<CargaSessoes>({ estado: 'carregando' });

  useEffect(() => {
    let cancelado = false;
    api.relatorios
      .sessoesDoAluno(turmaId, aluno.id)
      .then((resposta) => {
        if (cancelado) return;
        // A rota já entrega da mais recente para a mais antiga; ordenar aqui
        // é só a garantia de que a tela cumpre o que promete.
        const sessoes = [...desembrulhar(resposta)].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
        setCarga({ estado: 'pronto', sessoes });
      })
      .catch((excecao) => {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function renderizarCorpo() {
    if (carga.estado === 'carregando') return <p className="modal-vazio-texto">Carregando histórico…</p>;
    if (carga.estado === 'erro') return <p className="modal-vazio-texto">{carga.mensagem}</p>;
    if (carga.sessoes.length === 0) {
      return <p className="modal-vazio-texto">Este aluno ainda não treinou nenhum exercício desta turma.</p>;
    }
    // O gráfico é da mais antiga para a mais recente, só com as concluídas
    // (a mesma regra das médias); a tabela mostra todas.
    const concluidas = carga.sessoes.filter((s) => s.concluida).reverse();
    return (
      <>
        {concluidas.length > 0 && (
          <Grafico
            tipo="line"
            rotulos={concluidas.map((s) => formatarData(s.data))}
            series={[{ rotulo: 'PPM', dados: concluidas.map((s) => s.wpm) }]}
            unidades={['PPM']}
            descricao={`Gráfico de linha: PPM de ${aluno.nome} nas ${concluidas.length} sessões concluídas. Os números estão na tabela abaixo.`}
          />
        )}
        <Tabela colunas={colunasHistorico} linhas={carga.sessoes} chave={(s) => s.id} />
      </>
    );
  }

  return (
    <Modal eyebrow="Histórico individual" titulo={aluno.nome} acoes={[{ rotulo: 'Fechar' }]} aoFechar={aoFechar}>
      <div className="historico-aluno">{renderizarCorpo()}</div>
    </Modal>
  );
}

// Formatação — numero, porcentagem, contagem e formatarDataHora vêm de
// utils/formato.ts: null vira "—", zero é 0.

// Nenhuma sessão nesta turma: os números da linha viram "—" e a linha fica
// apagada. É diferente de "média ainda não calculada".
function semSessao(aluno: RelatorioAluno): boolean {
  return !aluno.totalSessoes;
}

// O melhor da turma: uma estrela por coluna, ao lado do MAIOR número dela.
// Comparar não é calcular: o número continua sendo o do back.

interface MelhoresDaTurma {
  ppm: string | null;
  precisao: string | null;
  concluidos: string | null;
}

function melhoresDaTurma(alunos: RelatorioAluno[]): MelhoresDaTurma {
  return {
    ppm: idDoMelhor(alunos, (a) => a.wpmMedio),
    precisao: idDoMelhor(alunos, (a) => a.precisaoMedia),
    concluidos: idDoMelhor(alunos, (a) => (semSessao(a) ? null : a.exerciciosConcluidos)),
  };
}

// null quando não há um melhor de verdade: menos de dois com número, maior
// valor zero ou empate no topo.
function idDoMelhor(alunos: RelatorioAluno[], valorDe: (aluno: RelatorioAluno) => number | null): string | null {
  const comValor = alunos.filter((a) => valorDe(a) != null);
  if (comValor.length < 2) return null;
  const maior = Math.max(...comValor.map(valorDe));
  if (maior <= 0) return null;
  const noTopo = comValor.filter((a) => valorDe(a) === maior);
  if (noTopo.length > 1) return null;
  return noTopo[0].id;
}

// A estrela diz "o melhor da turma" só para quem vê; o sr-only, para quem ouve.
function MarcaDoMelhor() {
  return (
    <span className="marca-do-melhor">
      <Estrela tamanho={13} />
      <span className="sr-only">, o melhor da turma</span>
    </span>
  );
}

// Ordenação — utils/ordenacao.ts (nulo por último nas duas direções).

function valorOrdenavelAluno(aluno: RelatorioAluno, campo: string): string | number | null {
  if (campo === 'aluno') return aluno.nome.toLowerCase();
  // Sem sessão a célula mostra "—": o valor de ordenação é null, senão o
  // zero cairia no meio dos números de verdade.
  if (campo === 'sessoes') return aluno.totalSessoes || null;
  if (campo === 'ppm') return aluno.wpmMedio;
  if (campo === 'precisao') return aluno.precisaoMedia;
  if (campo === 'concluidos') return semSessao(aluno) ? null : aluno.exerciciosConcluidos;
  if (campo === 'ultimaAtividade') return aluno.ultimaAtividade;
  return null;
}

function valorOrdenavelExercicio(item: RelatorioExercicio, campo: string): string | number | null {
  if (campo === 'titulo') return (item.titulo ?? '').toLowerCase();
  if (campo === 'dificuldade') return pesoDificuldade(item.dificuldade);
  if (campo === 'concluiram') return item.concluidoPor;
  if (campo === 'ppm') return item.wpmMedio;
  if (campo === 'precisao') return item.precisaoMedia;
  if (campo === 'estouraram') return item.estouraramTempo;
  return null;
}

// Exportar CSV — exporta O QUE ESTÁ NA TELA: a visão aberta, na ordem atual.
// As colunas espelham as das tabelas; mexer numa pede mexer na outra.

const COLUNAS_CSV_ALUNOS = [
  'Nome',
  'Sessões',
  'PPM médio',
  'Precisão média (%)',
  'Exercícios concluídos',
  'Exercícios atribuídos',
  'Última atividade',
];

// "3 de 5" vira duas colunas, e o que não existe é célula vazia (o "—" é da
// tela; o Excel o leria como texto numa coluna de números).
function linhaCsvAluno(aluno: RelatorioAluno): (string | number)[] {
  const vazio = semSessao(aluno);
  return [
    aluno.nome,
    vazio ? '' : aluno.totalSessoes,
    celulaNumero(aluno.wpmMedio),
    celulaNumero(aluno.precisaoMedia),
    vazio ? '' : celulaNumero(aluno.exerciciosConcluidos),
    aluno.exerciciosAtribuidos,
    aluno.ultimaAtividade ? formatarDataHora(aluno.ultimaAtividade) : 'Nunca treinou',
  ];
}

const COLUNAS_CSV_EXERCICIOS = [
  'Título',
  'Dificuldade',
  'Concluíram',
  'Alunos na turma',
  'PPM médio',
  'Precisão média (%)',
  'Estouraram o tempo',
];

function linhaCsvExercicio(item: RelatorioExercicio): (string | number)[] {
  return [
    item.titulo ?? '',
    rotuloDificuldade(item.dificuldade),
    item.concluidoPor,
    item.totalAlunos,
    celulaNumero(item.wpmMedio),
    celulaNumero(item.precisaoMedia),
    item.estouraramTempo,
  ];
}

// Vírgula decimal (o que o Excel em português lê como número); vazio sem dado.
function celulaNumero(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '' : formatarDecimal(valor);
}

// Erros — decide pelo status, nunca pelo texto do servidor.
function mensagemDaFalha(excecao: unknown): string {
  const erro = excecao as ErroDaApi | null | undefined;
  if (erro?.name !== 'ErroApi') {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  if (erro.status === 0) return MENSAGENS.CONEXAO;
  if (erro.status === 403) return MENSAGENS.PERMISSAO;
  if (erro.status === 404) return MENSAGENS.NAO_ENCONTRADO;
  return MENSAGENS.GENERICA;
}
