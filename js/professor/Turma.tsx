// Turma.tsx — pages/professor/turma.html?turma=<id>
// A tela da turma vista pelo PROFESSOR. A tela em si (casca, abas, trilha,
// painel de relatório) é a mesma do aluno e mora em
// ../componentes/TelaDaTurma.tsx; aqui fica só o que muda para o professor:
//
//   · o cabeçalho tem as ações (Convidar alunos, Atribuir exercício) e o
//     painel de métricas da turma;
//   EXERCÍCIOS     a trilha na visão da turma — cada pedra diz quantos
//                  alunos concluíram — e, embaixo, a tabela de atribuições
//                  com o "Remover atribuição";
//   PARTICIPANTES  a lista inteira, ativos e convidados, com nome e RP. O
//                  professor não tem anonimização: a turma é dele.
//   RELATÓRIO      os números da turma inteira (GET /turmas/:id/relatorio),
//                  com PDF, CSV e o link para o relatório completo.
//
// Sem ?turma=, ou com um id que o back não conhece, a tela mostra "Turma
// não encontrada" — nunca fica em branco.
//
// Convidado não é aluno da turma ainda: aparece apagado, com a data do
// convite e sem número nenhum, e fica de fora do contador e da média.

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type {
  AlunoAtivoDaTurma,
  AtribuicaoProfessor,
  ErroDaApi,
  Exercicio,
  LinhaDaTurma,
  RelatorioTurma,
  TurmaDetalhe,
} from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { SECOES_PROFESSOR } from '../componentes/Nav.js';
import {
  CascaDaTurma,
  focarAba,
  PainelDeRelatorio,
  TrilhaDeExercicios,
  TurmaNaoEncontrada,
  useAbaDaUrl,
  type PedraDaTrilha,
} from '../componentes/TelaDaTurma.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { contagem, formatarData, formatarDataHora, formatarRp, numero, porcentagem } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
import { baixarCsv, slug } from '../utils/csv.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Linhas de esqueleto enquanto turma, alunos e atribuições ainda não
// chegaram. Cinco cabem sem esticar a tela numa turma pequena.
const ESQUELETOS_LINHA = 5;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// ============================================================================
// Estado da tela
// ============================================================================

// `turma` é o detalhe; `alunos` e `atribuicoes` são as duas listas que
// Promise.all traz juntas. Tudo o que a tela mostra — inclusive as três
// métricas do topo — sai destes três. O relatório é à parte: só é pedido
// quando a aba dele abre.
type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'nao-encontrada' }
  | { estado: 'pronto'; turma: TurmaDetalhe; alunos: LinhaDaTurma[]; atribuicoes: AtribuicaoProfessor[] };

type ConfigModal =
  | { chave: number; tipo: 'remover-aluno'; aluno: LinhaDaTurma }
  | { chave: number; tipo: 'remover-atribuicao'; item: AtribuicaoProfessor }
  | { chave: number; tipo: 'atribuir'; opener: HTMLElement };

let proximaChave = 0;

const turmaId = new URLSearchParams(window.location.search).get('turma');

// ============================================================================
// Tela
// ============================================================================

function Turma() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [aba, selecionarAba] = useAbaDaUrl();
  // Ordenação da tabela de participantes: só ela é ordenável. null = ordem
  // em que o back mandou.
  const [ordenacaoAlunos, setOrdenacaoAlunos] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  const [modal, setModal] = useState<ConfigModal | null>(null);

  const btnAtribuir = useRef<HTMLButtonElement>(null);

  // --- carregamento — detalhe, alunos e atribuições numa tacada só ----------

  useEffect(() => {
    // Sem ?turma= não há o que carregar — nem vale a pena tentar.
    if (!turmaId) return;
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        const [detalhe, listaAlunos, listaAtribuicoes] = await Promise.all([
          api.turmas.obter(turmaId),
          api.alunos.daTurma(turmaId),
          api.turmas.atribuicoes(turmaId),
        ]);
        if (cancelado) return;
        setCarga({
          estado: 'pronto',
          turma: detalhe,
          alunos: desembrulhar(listaAlunos),
          atribuicoes: desembrulhar(listaAtribuicoes),
        });
      } catch (excecao) {
        if (cancelado) return;
        // Turma que não existe é o MESMO painel de quem não mandou ?turma=
        // nenhum — as duas coisas são "não há turma para mostrar aqui".
        if (ehErroApi(excecao) && excecao.status === 404) {
          setCarga({ estado: 'nao-encontrada' });
          return;
        }
        setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const turma = carga.estado === 'pronto' ? carga.turma : null;
  const alunos = carga.estado === 'pronto' ? carga.alunos : [];
  // Só os ativos contam: no número de alunos e na média de PPM.
  const ativos = alunos.filter((a): a is AlunoAtivoDaTurma => a.estado === 'ativo');
  const atribuicoes = carga.estado === 'pronto' ? carga.atribuicoes : [];

  useEffect(() => {
    if (turma) document.title = `Teclar — ${turma.nome ?? 'Turma'}`;
  }, [turma]);

  function atualizarAlunos(transformar: (lista: LinhaDaTurma[]) => LinhaDaTurma[]) {
    setCarga((atual) =>
      atual.estado === 'pronto' ? { ...atual, alunos: transformar(atual.alunos) } : atual
    );
  }

  function atualizarAtribuicoes(transformar: (lista: AtribuicaoProfessor[]) => AtribuicaoProfessor[]) {
    setCarga((atual) =>
      atual.estado === 'pronto' ? { ...atual, atribuicoes: transformar(atual.atribuicoes) } : atual
    );
  }

  if (!turmaId || carga.estado === 'nao-encontrada') {
    return (
      <TurmaNaoEncontrada
        secoes={SECOES_PROFESSOR}
        papel={SECOES_PROFESSOR.modo}
        texto="Ela pode ter sido removida, ou o link usado está incompleto."
        link={{ href: 'turmas.html', rotulo: 'Ver minhas turmas' }}
      />
    );
  }

  // --- conteúdo da aba ------------------------------------------------------

  function renderizarConteudo() {
    if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={ESQUELETOS_LINHA} />;

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar a turma"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    if (aba === 'relatorio') return <AbaRelatorio nomeDaTurma={turma.nome ?? 'turma'} />;
    if (aba === 'participantes') return renderizarParticipantes();
    return renderizarExercicios();
  }

  function renderizarExercicios() {
    if (atribuicoes.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhum exercício atribuído"
          texto="Atribua exercícios da sua biblioteca para esta turma treinar."
        >
          <button
            type="button"
            className="btn btn-solido tecla tecla-clara"
            onClick={(evento) => abrirAtribuir(evento.currentTarget)}
          >
            Atribuir exercício
          </button>
        </PainelEstado>
      );
    }
    // A trilha é a ordem que os alunos veem; a tabela embaixo é onde se
    // administra cada atribuição (data, dificuldade, remover).
    return (
      <>
        <TrilhaDeExercicios pedras={atribuicoes.map(pedraDaTurma)} />
        <Tabela colunas={colunasExercicios} linhas={atribuicoes} chave={(item) => item.exercicioId} />
      </>
    );
  }

  function renderizarParticipantes() {
    if (alunos.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhum aluno ainda"
          texto="Convide alunos pelo RP para acompanhar sessões, PPM e precisão deles nesta turma."
        >
          <a className="btn btn-solido tecla tecla-clara" href={`alunos.html?${new URLSearchParams({ turma: turmaId })}`}>
            Convidar alunos
          </a>
        </PainelEstado>
      );
    }

    return (
      <Tabela
        colunas={colunasAlunos}
        linhas={ordenar(alunos, ordenacaoAlunos, valorOrdenavelAluno)}
        chave={(aluno) => aluno.id}
        // Convidado, ou ativo que nunca treinou: a linha fica mais apagada,
        // para o olho ir direto a quem já tem alguma coisa para mostrar.
        classeLinha={(aluno) =>
          aluno.estado === 'convidado' || aluno.totalSessoes === 0 ? 'linha-sem-dado' : undefined
        }
        ordenacao={ordenacaoAlunos}
        aoOrdenar={setOrdenacaoAlunos}
      />
    );
  }

  // Colunas das duas tabelas. O RP É a identidade do aluno; o nome é o da
  // conta dele, e pode faltar. Veio nome: nome em cima, RP embaixo (mesma
  // célula dos relatórios). Não veio: só o RP, nunca um nome inventado.
  // Convidado não tem número nenhum: as colunas de desempenho ficam "—".
  const colunasAlunos: ColunaTabela<LinhaDaTurma>[] = [
    {
      rotulo: 'Aluno',
      campo: 'rp',
      celula: (a) =>
        a.nome ? (
          <span className="celula-aluno">
            <span className="celula-aluno-nome">{a.nome}</span>
            <span className="celula-aluno-matricula">{formatarRp(a.id)}</span>
          </span>
        ) : (
          <span className="celula-aluno-matricula celula-aluno-so-matricula">{formatarRp(a.id)}</span>
        ),
    },
    {
      rotulo: 'Estado',
      celula: (a) =>
        a.estado === 'ativo' ? 'Ativo' : `Convidado em ${formatarData(a.convidadoEm)}`,
    },
    { rotulo: 'Entrou em', celula: (a) => (a.estado === 'ativo' ? formatarData(a.entrouEm) : '—') },
    {
      rotulo: 'Sessões',
      classe: 'col-numero',
      celula: (a) => (a.estado === 'ativo' ? contagem(a.totalSessoes) : '—'),
    },
    {
      rotulo: 'PPM médio',
      campo: 'ppm',
      classe: 'col-numero',
      celula: (a) => (a.estado === 'ativo' ? contagem(a.wpmMedio) : '—'),
    },
    {
      rotulo: 'Precisão média',
      classe: 'col-numero',
      celula: (a) => (a.estado === 'ativo' && Number.isFinite(a.precisaoMedia) ? `${a.precisaoMedia}%` : '—'),
    },
    {
      rotulo: 'Última atividade',
      campo: 'ultimaAtividade',
      celula: (a) => (a.estado === 'ativo' && a.ultimaAtividade ? formatarDataHora(a.ultimaAtividade) : '—'),
    },
    {
      rotulo: 'Ação',
      celula: (aluno) => (
        <button
          type="button"
          className="tabela-acao"
          aria-label={`Remover ${formatarRp(aluno.id)} da turma`}
          onClick={() => setModal({ chave: ++proximaChave, tipo: 'remover-aluno', aluno })}
        >
          Remover da turma
        </button>
      ),
    },
  ];

  const colunasExercicios: ColunaTabela<AtribuicaoProfessor>[] = [
    { rotulo: 'Título', celula: (item) => item.titulo ?? 'Sem título' },
    { rotulo: 'Dificuldade', celula: (item) => item.dificuldade ?? '—' },
    { rotulo: 'Atribuído em', celula: (item) => (item.atribuidoEm ? formatarData(item.atribuidoEm) : '—') },
    {
      rotulo: 'Concluído',
      classe: 'col-numero',
      celula: (item) => `${contagem(item.concluidoPor)} de ${contagem(item.totalAlunos)}`,
    },
    {
      rotulo: 'Ação',
      celula: (item) => (
        <button
          type="button"
          className="tabela-acao"
          aria-label={`Remover atribuição de "${item.titulo ?? ''}"`.trim()}
          onClick={() => setModal({ chave: ++proximaChave, tipo: 'remover-atribuicao', item })}
        >
          Remover atribuição
        </button>
      ),
    },
  ];

  function abrirAtribuir(opener: HTMLElement) {
    setModal({ chave: ++proximaChave, tipo: 'atribuir', opener });
  }

  // --- modais ---------------------------------------------------------------

  function renderizarModal() {
    if (!modal) return null;
    const fechar = () => setModal(null);

    if (modal.tipo === 'remover-aluno') {
      const { aluno } = modal;
      const convidado = aluno.estado === 'convidado';
      return (
        <ModalRemover
          key={modal.chave}
          eyebrow="Remover aluno"
          titulo="Remover da turma?"
          texto={
            convidado
              ? `${formatarRp(aluno.id)} foi convidado e ainda não respondeu. O convite será cancelado e ` +
                'some da lista dele.'
              : `Remover ${formatarRp(aluno.id)} desta turma apaga também o histórico de sessões dele ` +
                'aqui. Essa ação não pode ser desfeita.'
          }
          rotuloAcao={convidado ? 'Cancelar convite' : 'Remover da turma'}
          // Convidado não está na turma ainda: o que se desfaz é o convite.
          enviar={() =>
            convidado ? api.alunos.cancelarConvite(turmaId, aluno.id) : api.alunos.remover(turmaId, aluno.id)
          }
          aoConcluir={() => {
            atualizarAlunos((lista) => lista.filter((a) => a.id !== aluno.id));
            toasts.mostrar(convidado ? 'Convite cancelado' : 'Aluno removido da turma');
            // A linha (e o botão que a pessoa clicou) acabou de sumir do DOM;
            // a aba é o próximo lugar estável para o foco pousar.
            focarAba('participantes');
          }}
          aoFechar={fechar}
        />
      );
    }

    if (modal.tipo === 'remover-atribuicao') {
      const { item } = modal;
      return (
        <ModalRemover
          key={modal.chave}
          eyebrow="Remover atribuição"
          titulo="Remover esta atribuição?"
          texto={`Os alunos desta turma deixam de ver "${item.titulo ?? 'este exercício'}" na lista deles.`}
          rotuloAcao="Remover atribuição"
          // Sem id próprio de atribuição: a chave é o par (turma, exercício).
          enviar={() => api.turmas.removerAtribuicao(turmaId, item.exercicioId)}
          aoConcluir={() => {
            atualizarAtribuicoes((lista) => lista.filter((a) => a.exercicioId !== item.exercicioId));
            toasts.mostrar('Atribuição removida');
            focarAba('exercicios');
          }}
          aoFechar={fechar}
        />
      );
    }

    return (
      <ModalAtribuir
        key={modal.chave}
        atribuicoes={atribuicoes}
        aoConcluir={(novas, quantidade) => {
          // flushSync: a tabela precisa estar redesenhada ANTES do teste abaixo.
          flushSync(() => atualizarAtribuicoes(() => novas));
          toasts.mostrar(quantidade === 1 ? 'Exercício atribuído' : `${quantidade} exercícios atribuídos`);
          if (!document.contains(modal.opener)) btnAtribuir.current?.focus();
        }}
        aoFechar={fechar}
      />
    );
  }

  // O que só o professor tem no cabeçalho: as duas ações e, embaixo do
  // título, o painel com os três números da turma.
  const acoes = (
    <>
      <a
        className="btn btn-vidro vidro tecla"
        id="btn-convidar"
        href={`alunos.html?${new URLSearchParams({ turma: turmaId })}`}
      >
        Convidar alunos
      </a>
      <button
        type="button"
        className="btn btn-solido tecla tecla-clara"
        id="btn-atribuir"
        ref={btnAtribuir}
        onClick={(evento) => abrirAtribuir(evento.currentTarget)}
      >
        Atribuir exercício
      </button>
    </>
  );

  // Métricas do topo — recalculadas no cliente sempre que a lista muda,
  // para remover aluno ou atribuição não precisar de outra ida ao back.
  const metricas = (
    <div className="metricas-turma vidro" id="metricas">
      <div className="metrica-item">
        <span className="metrica-rotulo">Alunos</span>
        <span className="metrica-valor">{turma ? contagem(ativos.length) : '—'}</span>
      </div>
      <div className="metrica-item">
        <span className="metrica-rotulo">Exercícios atribuídos</span>
        <span className="metrica-valor">{turma ? contagem(atribuicoes.length) : '—'}</span>
      </div>
      <div className="metrica-item">
        <span className="metrica-rotulo">PPM médio da turma</span>
        <span className="metrica-valor">{turma ? contagem(calcularPpmMedio(ativos)) : '—'}</span>
      </div>
    </div>
  );

  return (
    <>
      <CascaDaTurma
        secoes={SECOES_PROFESSOR}
        papel={SECOES_PROFESSOR.modo}
        voltar={{ href: 'turmas.html', rotulo: 'Turmas' }}
        titulo={turma ? turma.nome ?? 'Turma sem nome' : null}
        subtitulo={turma ? turma.periodo ?? '' : null}
        acoes={acoes}
        extra={metricas}
        aba={aba}
        aoSelecionarAba={selecionarAba}
        carregando={carga.estado === 'carregando'}
      >
        {renderizarConteudo()}
      </CascaDaTurma>

      {renderizarModal()}
    </>
  );
}

// Na visão do professor a pedra não tem "o seu" estado: é neutra, com o
// número, e a legenda diz quantos alunos ativos já concluíram.
function pedraDaTurma(item: AtribuicaoProfessor): PedraDaTrilha {
  return {
    id: item.exercicioId,
    titulo: item.titulo ?? 'Sem título',
    estado: 'turma',
    legenda: `${contagem(item.concluidoPor)} de ${contagem(item.totalAlunos)} concluíram`,
  };
}

// ============================================================================
// Aba Relatório — os números da turma inteira
// ============================================================================

type CargaRelatorio =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; relatorio: RelatorioTurma };

function AbaRelatorio({ nomeDaTurma }: { nomeDaTurma: string }) {
  const [carga, setCarga] = useState<CargaRelatorio>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    api.relatorios
      .turma(turmaId)
      .then((relatorio) => {
        if (!cancelado) setCarga({ estado: 'pronto', relatorio });
      })
      .catch((excecao) => {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={3} />;
  if (carga.estado === 'erro') {
    return (
      <PainelErro
        titulo="Não foi possível carregar o relatório"
        texto={carga.mensagem}
        aoTentarDeNovo={() => setTentativa((n) => n + 1)}
      />
    );
  }

  const r = carga.relatorio;
  // Tudo pronto do back. Média que ele não calculou chega null e vira "—".
  const grupos = [
    [
      { rotulo: 'Alunos ativos (7 dias)', valor: `${contagem(r.alunosAtivos)} de ${contagem(r.totalAlunos)}` },
      { rotulo: 'Exercícios concluídos', valor: contagem(r.exerciciosConcluidos) },
    ],
    [
      { rotulo: 'PPM médio', valor: numero(r.wpmMedio) },
      { rotulo: 'Precisão média', valor: porcentagem(r.precisaoMedia) },
    ],
  ];

  return (
    <>
      <PainelDeRelatorio
        rotulo="Relatório da turma"
        grupos={grupos}
        aoGerarCsv={() => baixarCsv(`relatorio-${slug(nomeDaTurma)}.csv`, linhasDoCsv(nomeDaTurma, r))}
      />
      <p className="nota">
        Aluno por aluno e exercício por exercício estão no{' '}
        <a className="tabela-link" href={`relatorios.html?${new URLSearchParams({ turma: turmaId })}`}>
          relatório completo
        </a>
        .
      </p>
    </>
  );
}

// Números crus no CSV: o Excel precisa de número, não de "94%".
function linhasDoCsv(nomeDaTurma: string, r: RelatorioTurma): (string | number)[][] {
  return [
    ['Turma', nomeDaTurma],
    ['Alunos', r.totalAlunos ?? ''],
    ['Alunos ativos (7 dias)', r.alunosAtivos ?? ''],
    ['Exercícios concluídos', r.exerciciosConcluidos ?? ''],
    ['PPM médio', r.wpmMedio ?? ''],
    ['Precisão média (%)', r.precisaoMedia ?? ''],
  ];
}

// ============================================================================
// Métricas e ordenação
// ============================================================================

// Média só entre quem já treinou — quem nunca treinou não entra na conta
// (nem para cima, nem para baixo). Uma casa decimal, igual ao que o mock
// devolve em /turmas/:id: um recálculo local que não bate com o formato
// do servidor seria pior que não recalcular nada.
function calcularPpmMedio(lista: AlunoAtivoDaTurma[]): number | null {
  const validos = lista.filter((a) => a.totalSessoes > 0 && Number.isFinite(a.wpmMedio));
  if (validos.length === 0) return null;
  const soma = validos.reduce((total, a) => total + a.wpmMedio, 0);
  return Math.round((soma / validos.length) * 10) / 10;
}

// contagem (zero é 0, travessão é "sem dado") e ordenar (nulo por último
// nas duas direções) vêm de utils/. A tabela só diz o que cada campo vale.
// Convidado não tem número: nas colunas de desempenho ele é nulo, e vai
// para o fim nas duas direções.
function valorOrdenavelAluno(aluno: LinhaDaTurma, campo: string): string | number | null {
  if (campo === 'rp') return aluno.id;
  if (aluno.estado === 'convidado') return null;
  if (campo === 'ppm') return aluno.wpmMedio;
  if (campo === 'ultimaAtividade') return aluno.ultimaAtividade;
  return null;
}

// ============================================================================
// Modal de confirmação — remover aluno e remover atribuição
// ============================================================================

interface PropsModalRemover {
  eyebrow: string;
  titulo: string;
  texto: string;
  rotuloAcao: string;
  enviar: () => Promise<unknown>;
  aoConcluir: () => void;
  aoFechar: () => void;
}

function ModalRemover({ eyebrow, titulo, texto, rotuloAcao, enviar, aoConcluir, aoFechar }: PropsModalRemover) {
  const modal = useRef<ModalHandle>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);

    try {
      await enviar();
      modal.current?.fechar();
      aoConcluir();
    } catch (excecao) {
      setErro(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  return (
    <Modal
      ref={modal}
      eyebrow={eyebrow}
      titulo={titulo}
      acoes={[
        {
          rotulo: ocupado ? 'Removendo…' : rotuloAcao,
          principal: true,
          fecha: false,
          aoClicar: confirmar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      aoFechar={aoFechar}
    >
      <div>
        <p>{texto}</p>
        <p className="erro-campo" aria-live="polite">
          {erro}
        </p>
      </div>
    </Modal>
  );
}

// ============================================================================
// Modal "Atribuir exercício" — biblioteca do professor, busca, seleção
// múltipla. Confirmar atribui todos os marcados de uma vez.
// ============================================================================

type Biblioteca =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; lista: Exercicio[] };

interface PropsModalAtribuir {
  atribuicoes: AtribuicaoProfessor[];
  aoConcluir: (atribuicoes: AtribuicaoProfessor[], quantidade: number) => void;
  aoFechar: () => void;
}

function ModalAtribuir({ atribuicoes, aoConcluir, aoFechar }: PropsModalAtribuir) {
  const modal = useRef<ModalHandle>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const linkCriar = useRef<HTMLAnchorElement>(null);

  const [biblioteca, setBiblioteca] = useState<Biblioteca>({ estado: 'carregando' });
  const [termo, setTermo] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function carregarBiblioteca() {
      try {
        const lista = desembrulhar(await api.exercicios.listar());
        if (!cancelado) setBiblioteca({ estado: 'pronto', lista });
      } catch (excecao) {
        if (!cancelado) setBiblioteca({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregarBiblioteca();
    return () => {
      cancelado = true;
    };
  }, []);

  // Foco depois de a biblioteca chegar: no erro, o Cancelar; sem exercício,
  // o link de criar; com lista, o campo de busca.
  useEffect(() => {
    if (biblioteca.estado === 'carregando') return;
    const quadro = requestAnimationFrame(() => {
      if (biblioteca.estado === 'erro') {
        modal.current?.el?.querySelector<HTMLElement>('.modal-botao-vidro')?.focus();
      } else if (biblioteca.lista.length === 0) {
        linkCriar.current?.focus();
      } else {
        campoBusca.current?.focus();
      }
    });
    return () => cancelAnimationFrame(quadro);
  }, [biblioteca]);

  const vazia = biblioteca.estado === 'pronto' && biblioteca.lista.length === 0;

  function alternar(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  async function confirmarAtribuicao() {
    if (enviando.current || selecionados.size === 0) return;
    enviando.current = true;
    setOcupado(true);

    try {
      await api.turmas.atribuir(turmaId, [...selecionados]);
      // A resposta do POST é a lista crua de atribuições (sem título,
      // sem concluidoPor); GET /atribuicoes é quem devolve a forma que a
      // tabela precisa, então busca de novo em vez de remontar à mão.
      const novas = desembrulhar(await api.turmas.atribuicoes(turmaId));
      modal.current?.fechar();
      aoConcluir(novas, selecionados.size);
    } catch (excecao) {
      setErro(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  function renderizarCorpo() {
    if (biblioteca.estado === 'carregando') {
      return <p className="modal-vazio-texto">Carregando biblioteca…</p>;
    }
    if (biblioteca.estado === 'erro') {
      return <p className="modal-vazio-texto">{biblioteca.mensagem}</p>;
    }
    if (biblioteca.lista.length === 0) {
      return (
        <>
          <p className="modal-vazio-texto">Você ainda não tem nenhum exercício na biblioteca.</p>
          <a className="btn btn-solido tecla tecla-clara" href="biblioteca.html" ref={linkCriar}>
            Criar exercício
          </a>
        </>
      );
    }

    const alvo = normalizar(termo.trim());
    const filtrados = alvo
      ? biblioteca.lista.filter((ex) => normalizar(ex.titulo).includes(alvo))
      : biblioteca.lista;

    return (
      <>
        <div className="modal-busca">
          <input
            type="search"
            ref={campoBusca}
            placeholder="Buscar pelo título"
            autoComplete="off"
            aria-label="Buscar exercício pelo título"
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
          />
        </div>
        <div className="lista-biblioteca">
          {filtrados.length === 0 ? (
            <p className="modal-vazio-texto">Nada com “{termo.trim()}” no título.</p>
          ) : (
            filtrados.map((ex) => {
              const jaAtribuido = atribuicoes.some((a) => a.exercicioId === ex.id);
              return (
                <label key={ex.id} className="item-biblioteca">
                  <input
                    type="checkbox"
                    value={ex.id}
                    checked={jaAtribuido || selecionados.has(ex.id)}
                    disabled={jaAtribuido}
                    onChange={(evento) => alternar(ex.id, evento.target.checked)}
                  />
                  <div className="item-biblioteca-texto">
                    <p className="item-biblioteca-titulo">{ex.titulo ?? 'Sem título'}</p>
                    <p className="item-biblioteca-meta">{ex.dificuldade ?? ''}</p>
                  </div>
                  {jaAtribuido && <span className="item-biblioteca-legenda">já atribuído</span>}
                </label>
              );
            })
          )}
        </div>
        <p className="erro-campo" aria-live="polite">
          {erro}
        </p>
      </>
    );
  }

  return (
    <Modal
      ref={modal}
      eyebrow="Atribuir exercício"
      titulo="Atribuir exercício"
      acoes={[
        // Nada para atribuir enquanto a biblioteca não chega, ou se nada foi
        // marcado ainda: o botão nasce desabilitado nos dois casos. Sem
        // exercício na biblioteca, some também (disabled além de hidden,
        // senão continuaria na lista de focáveis do modal).
        {
          rotulo: ocupado ? 'Atribuindo…' : 'Atribuir selecionados',
          principal: true,
          fecha: false,
          aoClicar: confirmarAtribuicao,
          disabled: ocupado || biblioteca.estado !== 'pronto' || vazia || selecionados.size === 0,
          hidden: vazia,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      aoFechar={aoFechar}
    >
      <div>{renderizarCorpo()}</div>
    </Modal>
  );
}

// Sem acento e em minúsculas dos dois lados — mesma receita da busca de
// Turmas.tsx, aqui para o título do exercício.
function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// ============================================================================
// Erros — mesmo critério de Turmas.tsx: decide pelo status, nunca pelo
// texto que o servidor mandou.
// ============================================================================

// Duck typing, não instanceof: o erro do mock tem a mesma forma do ErroApi
// do api.ts, mas não é instância dele.
function ehErroApi(excecao: unknown): excecao is ErroDaApi {
  return (excecao as ErroDaApi | null | undefined)?.name === 'ErroApi';
}

function mensagemDaFalha(excecao: unknown): string {
  if (!ehErroApi(excecao)) {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  // 401 não entra aqui: o api.ts já derruba a sessão e sai da tela.
  if (excecao.status === 0) return MENSAGENS.CONEXAO;
  if (excecao.status === 403) return MENSAGENS.PERMISSAO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de professor antes de montar. Devolveu null, redirecionou: a
// tela para aqui e nada mais roda.
const usuario = guarda.soConta('professor');

// O host dos toasts fica fora da raiz do React (ver turma.html), e o
// toast.js continua cuidando dele como nas telas em JS.
let toasts: Toasts;

if (usuario) {
  guarda.aplicarMundo();
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 2 });
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Turma />);
}
