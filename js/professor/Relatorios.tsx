// Relatorios.tsx — pages/professor/relatorios.html
// Onde o professor vê como a turma e cada aluno estão indo. Escolhe a turma
// no alto, lê as quatro métricas dela e desce para uma das duas abas: Por
// aluno (uma linha por aluno ativo, clicável, que abre o histórico de sessões)
// e Por exercício (uma linha por exercício atribuído à turma).
//
// A turma e a aba vivem na URL (?turma=<id>&aba=alunos|exercicios), como na
// tela de turma: o professor recarrega, manda o link para alguém e cai no
// mesmo lugar. Trocar qualquer uma das duas usa replaceState — não é uma
// "página" nova para o botão voltar.
//
// TUDO O QUE É NÚMERO VEM PRONTO DO BACK. As médias saem de SessionsProf com
// JOIN (ver api.relatorios e a seção 10 de tipos.ts); esta tela não soma,
// não divide e não infere nada — só formata, ordena e mostra "—" onde o
// back mandou null. Um número calculado aqui seria um segundo número, que
// discordaria do primeiro no dia em que o back mudasse a regra.
//
// Mesmo padrão de Turma.tsx e Biblioteca.tsx: Nav, Tabela, Esqueleto,
// PainelErro e ModalReact de ../componentes/, classes de css/escola.css,
// guarda de professor antes de montar.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as KeyboardEventReact, type MouseEvent as MouseEventReact } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type {
  Dificuldade,
  ErroDaApi,
  RelatorioAluno,
  RelatorioExercicio,
  RelatorioTurma,
  SessaoDoAluno,
  Turma,
} from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { gerarCsv } from '../utils/csv.js';
import { contagem, formatarDataHora, formatarDecimal, formatarRp, numero, porcentagem } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
import { Nav, SECOES_PROFESSOR } from '../componentes/Nav.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Linhas de esqueleto: a mesma altura que a tabela final terá numa turma de
// tamanho comum, para nada pular quando os dados chegam.
const ESQUELETOS_LINHA = 6;

// Abaixo disto a precisão média ganha tom mais forte. É informação, não
// acusação: nenhuma cor de alerta, nenhum ícone, nenhum aviso.
const PRECISAO_DESTAQUE = 85;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  NAO_ENCONTRADO: 'Esta turma não existe mais. Escolha outra na lista.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// Rótulo de cada valor do ENUM Dificuldade e o peso para ordenar. Mesma
// receita de Biblioteca.tsx, e pelo mesmo motivo: em ordem alfabética
// "dificil" vem antes de "facil", o que não é a ordem que se espera de uma
// coluna de dificuldade.
const DIFICULDADES: { valor: Dificuldade; rotulo: string }[] = [
  { valor: 'facil', rotulo: 'Fácil' },
  { valor: 'medio', rotulo: 'Médio' },
  { valor: 'dificil', rotulo: 'Difícil' },
];

function rotuloDificuldade(valor: string | null | undefined): string {
  return DIFICULDADES.find((d) => d.valor === valor)?.rotulo ?? '—';
}

function pesoDificuldade(valor: string | null | undefined): number {
  const i = DIFICULDADES.findIndex((d) => d.valor === valor);
  return i < 0 ? DIFICULDADES.length : i;
}

// ============================================================================
// Estado da tela
// ============================================================================

type Aba = 'alunos' | 'exercicios';

// A lista de turmas do seletor. Vem uma vez e não recarrega ao trocar de
// turma — o seletor precisa continuar ali mesmo quando o relatório falha.
type CargaTurmas =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; turmas: Turma[] };

// O relatório da turma escolhida: as três chamadas chegam juntas, porque a
// tela não serve de nada com uma só delas.
type CargaRelatorio =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | {
      estado: 'pronto';
      turma: RelatorioTurma;
      alunos: RelatorioAluno[];
      exercicios: RelatorioExercicio[];
    };

// O modal de histórico. `opener` é o botão da linha que abriu: é para lá que
// o foco volta ao fechar.
interface ConfigModal {
  chave: number;
  aluno: RelatorioAluno;
}

let proximaChave = 0;

function parametrosDaUrl(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function abaDaUrl(): Aba {
  return parametrosDaUrl().get('aba') === 'exercicios' ? 'exercicios' : 'alunos';
}

// Troca um parâmetro na URL sem empilhar histórico: escolher turma ou aba
// não é navegar para outra página, é mudar o que esta mostra.
function trocarNaUrl(chave: string, valor: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(chave, valor);
  window.history.replaceState(null, '', url);
}

// ============================================================================
// Tela
// ============================================================================

function Relatorios() {
  const [cargaTurmas, setCargaTurmas] = useState<CargaTurmas>({ estado: 'carregando' });
  const [tentativaTurmas, setTentativaTurmas] = useState(0);

  // null enquanto a lista de turmas não chegou: só aí se sabe qual é a
  // primeira, que é a turma de quem abriu a tela sem ?turma=.
  const [turmaId, setTurmaId] = useState<string | null>(() => parametrosDaUrl().get('turma'));
  const [carga, setCarga] = useState<CargaRelatorio>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  const [abaAtual, setAbaAtual] = useState<Aba>(abaDaUrl);
  // Uma ordenação por aba: voltar para a aba anterior encontra a tabela como
  // ela foi deixada. null = a ordem em que o back mandou.
  const [ordemAlunos, setOrdemAlunos] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  const [ordemExercicios, setOrdemExercicios] = useState<Ordenacao>({ campo: null, direcao: 'asc' });

  const [modal, setModal] = useState<ConfigModal | null>(null);

  const abaAlunos = useRef<HTMLButtonElement>(null);
  const abaExercicios = useRef<HTMLButtonElement>(null);

  // --- lista de turmas (uma vez) --------------------------------------------

  useEffect(() => {
    let cancelado = false;

    async function carregarTurmas() {
      setCargaTurmas({ estado: 'carregando' });
      try {
        const turmas = desembrulhar(await api.turmas.listar());
        if (cancelado) return;
        setCargaTurmas({ estado: 'pronto', turmas });
        // Sem ?turma= na URL, ou com um id que não é de nenhuma turma
        // desta lista, abre na primeira — e grava isso na URL, para o
        // link que o professor copiar já apontar para a turma certa.
        setTurmaId((atual) => {
          const valido = atual && turmas.some((t) => t.id === atual);
          const escolhida = valido ? atual : turmas[0]?.id ?? null;
          if (escolhida && escolhida !== atual) trocarNaUrl('turma', escolhida);
          return escolhida;
        });
      } catch (excecao) {
        if (!cancelado) setCargaTurmas({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregarTurmas();
    return () => {
      cancelado = true;
    };
  }, [tentativaTurmas]);

  // --- relatório da turma escolhida -----------------------------------------
  // Trocar de turma cai aqui: as três chamadas saem de novo, juntas.

  useEffect(() => {
    if (!turmaId) return;
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        const [turma, alunos, exercicios] = await Promise.all([
          api.relatorios.turma(turmaId),
          api.relatorios.porAluno(turmaId),
          api.relatorios.porExercicio(turmaId),
        ]);
        if (cancelado) return;
        setCarga({
          estado: 'pronto',
          turma,
          alunos: desembrulhar(alunos),
          exercicios: desembrulhar(exercicios),
        });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [turmaId, tentativa]);

  const turmas = cargaTurmas.estado === 'pronto' ? cargaTurmas.turmas : [];
  const turmaEscolhida = turmas.find((t) => t.id === turmaId) ?? null;
  const relatorio = carga.estado === 'pronto' ? carga : null;

  useEffect(() => {
    document.title = turmaEscolhida
      ? `Teclar — Relatórios · ${turmaEscolhida.nome}`
      : 'Teclar — Relatórios';
  }, [turmaEscolhida]);

  // As listas na ordem em que estão NA TELA. O CSV exporta exatamente
  // isto — por isso o useMemo, e não duas ordenações separadas que
  // poderiam discordar.
  const alunosVisiveis = useMemo(
    () => ordenar(relatorio?.alunos ?? [], ordemAlunos, valorOrdenavelAluno),
    [relatorio, ordemAlunos]
  );
  const exerciciosVisiveis = useMemo(
    () => ordenar(relatorio?.exercicios ?? [], ordemExercicios, valorOrdenavelExercicio),
    [relatorio, ordemExercicios]
  );

  // --- turma e aba ----------------------------------------------------------

  function selecionarTurma(id: string) {
    if (id === turmaId) return;
    setTurmaId(id);
    trocarNaUrl('turma', id);
    // A ordenação é da tabela, não da turma: outra turma começa na ordem
    // que o back mandou, como quem abre a tela agora.
    setOrdemAlunos({ campo: null, direcao: 'asc' });
    setOrdemExercicios({ campo: null, direcao: 'asc' });
  }

  function selecionarAba(aba: Aba) {
    if (aba === abaAtual) return;
    setAbaAtual(aba);
    trocarNaUrl('aba', aba);
  }

  // Roving tabindex: só a aba selecionada está na ordem do Tab; as setas é
  // que movem entre as duas. Igual à tela de turma.
  function aoTeclarNaAba(evento: KeyboardEventReact, indice: number) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const abas = [abaAlunos.current, abaExercicios.current];
    const proximo =
      evento.key === 'ArrowRight'
        ? abas[(indice + 1) % abas.length]
        : abas[(indice - 1 + abas.length) % abas.length];
    proximo?.focus();
    selecionarAba(proximo === abaAlunos.current ? 'alunos' : 'exercicios');
  }

  // --- exportar -------------------------------------------------------------

  function exportar() {
    if (!relatorio || !turmaEscolhida) return;
    const [nomes, linhas] =
      abaAtual === 'alunos'
        ? [COLUNAS_CSV_ALUNOS, alunosVisiveis.map(linhaCsvAluno)]
        : [COLUNAS_CSV_EXERCICIOS, exerciciosVisiveis.map(linhaCsvExercicio)];

    baixarCsv(`relatorio-${slug(turmaEscolhida.nome)}-${abaAtual}.csv`, [nomes, ...linhas]);
    toasts.mostrar('Relatório exportado');
  }

  // --- histórico do aluno ---------------------------------------------------

  function abrirHistorico(aluno: RelatorioAluno) {
    setModal({ chave: ++proximaChave, aluno });
  }

  // A linha inteira abre o histórico, mas quem faz isso de verdade é o botão
  // dentro da célula de identificação: um clique em qualquer lugar da linha
  // é redirecionado para ele. Assim existe um caminho só — e o foco tem
  // para onde voltar quando o modal fechar, inclusive para quem clicou com
  // o mouse (o Modal devolve o foco a quem estava ativo ao abrir).
  function aoClicarNaLinha(evento: MouseEventReact<HTMLDivElement>) {
    const alvo = evento.target as HTMLElement;
    if (alvo.closest('.relatorio-historico')) return; // o próprio botão
    const botao = alvo.closest('tr')?.querySelector<HTMLButtonElement>('.relatorio-historico');
    if (!botao) return;
    botao.focus();
    botao.click();
  }

  // --- colunas --------------------------------------------------------------

  const colunasAlunos: ColunaTabela<RelatorioAluno>[] = [
    {
      // A identidade do aluno é o RP; o nome é o da conta dele, e pode
      // faltar. Veio nome: nome em cima, RP embaixo em mono menor. Não
      // veio: só o RP. Nunca um nome inventado. Só ATIVOS chegam aqui:
      // quem foi convidado e não respondeu não é aluno da turma ainda.
      rotulo: 'Aluno',
      campo: 'aluno',
      celula: (a) => (
        <button
          type="button"
          className="tabela-link relatorio-historico"
          aria-label={`Ver histórico de ${identidade(a)} nesta turma`}
          onClick={() => abrirHistorico(a)}
        >
          {a.nome ? (
            <span className="celula-aluno">
              <span className="celula-aluno-nome">{a.nome}</span>
              <span className="celula-aluno-matricula">{formatarRp(a.id)}</span>
            </span>
          ) : (
            <span className="celula-aluno-matricula celula-aluno-so-matricula">{formatarRp(a.id)}</span>
          )}
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
      celula: (a) => numero(a.wpmMedio),
    },
    {
      rotulo: 'Precisão média',
      campo: 'precisao',
      // Abaixo de 85% a célula ganha tom mais forte — e só ela, não a linha.
      classe: (a) =>
        a.precisaoMedia != null && a.precisaoMedia < PRECISAO_DESTAQUE
          ? 'col-numero precisao-destaque'
          : 'col-numero',
      celula: (a) => porcentagem(a.precisaoMedia),
    },
    {
      rotulo: 'Exercícios concluídos',
      campo: 'concluidos',
      classe: 'col-numero',
      celula: (a) =>
        semSessao(a) ? '—' : `${contagem(a.exerciciosConcluidos)} de ${contagem(a.exerciciosAtribuidos)}`,
    },
    {
      rotulo: 'Última atividade',
      campo: 'ultimaAtividade',
      // "Nunca treinou" em vez de travessão: aqui o vazio tem nome, e
      // dizê-lo poupa o professor de adivinhar o que o "—" significa.
      celula: (a) => (a.ultimaAtividade ? formatarDataHora(a.ultimaAtividade) : 'Nunca treinou'),
    },
  ];

  const colunasExercicios: ColunaTabela<RelatorioExercicio>[] = [
    { rotulo: 'Título', campo: 'titulo', celula: (e) => e.titulo || 'Sem título' },
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
        e.precisaoMedia != null && e.precisaoMedia < PRECISAO_DESTAQUE
          ? 'col-numero precisao-destaque'
          : 'col-numero',
      celula: (e) => porcentagem(e.precisaoMedia),
    },
    {
      // Zero é 0: ninguém estourou, ou o exercício não tem tempo limite
      // (e aí o back manda 0 sempre). Não é "sem dado".
      rotulo: 'Estouraram o tempo',
      campo: 'estouraram',
      classe: 'col-numero',
      celula: (e) => contagem(e.estouraramTempo),
    },
  ];

  // --- conteúdo da aba ------------------------------------------------------

  function renderizarConteudo() {
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

    if (abaAtual === 'exercicios') {
      if (exerciciosVisiveis.length === 0) {
        return (
          <PainelEstado
            titulo="Nenhum exercício atribuído a esta turma"
            texto="Sem exercício atribuído não há o que medir por exercício. Atribua um na tela da turma."
          >
            <a className="btn btn-solido tecla tecla-clara" href={linkDaTurma(turmaId)}>
              Abrir a turma
            </a>
          </PainelEstado>
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
          texto="Convide alunos pelo RP. Quando aceitarem, as sessões, o PPM e a precisão de cada um aparecem aqui."
        >
          <a className="btn btn-solido tecla tecla-clara" href={`alunos.html?${new URLSearchParams({ turma: turmaId })}`}>
            Convidar alunos
          </a>
        </PainelEstado>
      );
    }

    return (
      <div className="relatorio-linhas-clicaveis" onClick={aoClicarNaLinha}>
        <Tabela
          colunas={colunasAlunos}
          linhas={alunosVisiveis}
          chave={(a) => a.id}
          // Nunca treinou: a linha inteira perde ênfase, para o olho ir
          // direto a quem já tem o que mostrar.
          classeLinha={(a) => (semSessao(a) ? 'linha-sem-dado' : undefined)}
          ordenacao={ordemAlunos}
          aoOrdenar={setOrdemAlunos}
        />
      </div>
    );
  }

  // --- a tela sem turma nenhuma ---------------------------------------------
  // Substitui tudo: métricas de nada e abas vazias não ajudariam quem ainda
  // não criou a primeira turma.

  if (cargaTurmas.estado === 'pronto' && turmas.length === 0) {
    return (
      <>
        <Nav secoes={SECOES_PROFESSOR} ativo="relatorios" />
        <main id="corpo">
          <PainelEstado
            titulo="Nenhuma turma para relatar"
            texto="Os relatórios nascem das sessões de uma turma. Crie a primeira, convide os alunos e atribua exercícios: os números aparecem sozinhos."
          >
            <a className="btn btn-solido tecla tecla-clara" href="turmas.html">
              Criar a primeira turma
            </a>
          </PainelEstado>
        </main>
      </>
    );
  }

  if (cargaTurmas.estado === 'erro') {
    return (
      <>
        <Nav secoes={SECOES_PROFESSOR} ativo="relatorios" />
        <main id="corpo">
          <PainelErro
            titulo="Não foi possível carregar suas turmas"
            texto={cargaTurmas.mensagem}
            aoTentarDeNovo={() => setTentativaTurmas((n) => n + 1)}
          />
        </main>
      </>
    );
  }

  // --- tela ------------------------------------------------------------------

  return (
    <>
      <Nav secoes={SECOES_PROFESSOR} ativo="relatorios" />

      <main id="corpo">
        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo" id="titulo">
              Relatórios
            </h1>

            {/* O seletor de turma fica sob o título porque é o que define
                TODO o resto da tela — não é um filtro entre outros. */}
            <div className="relatorio-turma">
              <label className="secao-rotulo" htmlFor="seletor-turma">
                Turma
              </label>
              <select
                className="seletor"
                id="seletor-turma"
                value={turmaId ?? ''}
                disabled={cargaTurmas.estado !== 'pronto'}
                onChange={(evento) => selecionarTurma(evento.target.value)}
              >
                {/* Enquanto a lista não chega existe uma opção só, com o
                    campo desabilitado: o seletor já ocupa o lugar dele e
                    nada pula quando as turmas aparecem. */}
                {cargaTurmas.estado === 'pronto' ? (
                  turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))
                ) : (
                  <option value="">Carregando turmas…</option>
                )}
              </select>
            </div>
          </div>

          <div className="cabecalho-acoes">
            {/* Exporta a aba aberta, com a ordenação que está na tela e sem
                pedir nada ao back de novo. */}
            <button
              type="button"
              className="btn btn-vidro vidro tecla"
              id="btn-exportar"
              disabled={!relatorio}
              onClick={exportar}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {/* As quatro métricas da turma, agregadas pelo back. Sem dado é "—";
            zero é 0. */}
        <div className="metricas-turma vidro" id="metricas">
          <div className="metrica-item">
            <span className="metrica-rotulo">Alunos ativos</span>
            <span className="metrica-valor" id="metrica-ativos">
              {relatorio ? ativos(relatorio.turma) : '—'}
            </span>
          </div>
          <div className="metrica-item">
            <span className="metrica-rotulo">PPM médio</span>
            <span className="metrica-valor" id="metrica-ppm">
              {relatorio ? numero(relatorio.turma.wpmMedio) : '—'}
            </span>
          </div>
          <div className="metrica-item">
            <span className="metrica-rotulo">Precisão média</span>
            <span className="metrica-valor" id="metrica-precisao">
              {relatorio ? porcentagem(relatorio.turma.precisaoMedia) : '—'}
            </span>
          </div>
          <div className="metrica-item">
            <span className="metrica-rotulo">Exercícios concluídos</span>
            <span className="metrica-valor" id="metrica-concluidos">
              {relatorio ? numero(relatorio.turma.exerciciosConcluidos) : '—'}
            </span>
          </div>
        </div>

        <div className="abas" role="tablist" aria-label="Visões do relatório">
          <button
            type="button"
            className="aba tecla"
            id="aba-alunos"
            ref={abaAlunos}
            role="tab"
            aria-selected={abaAtual === 'alunos'}
            aria-controls="conteudo"
            tabIndex={abaAtual === 'alunos' ? 0 : -1}
            onClick={() => selecionarAba('alunos')}
            onKeyDown={(evento) => aoTeclarNaAba(evento, 0)}
          >
            Por aluno
          </button>
          <button
            type="button"
            className="aba tecla"
            id="aba-exercicios"
            ref={abaExercicios}
            role="tab"
            aria-selected={abaAtual === 'exercicios'}
            aria-controls="conteudo"
            tabIndex={abaAtual === 'exercicios' ? 0 : -1}
            onClick={() => selecionarAba('exercicios')}
            onKeyDown={(evento) => aoTeclarNaAba(evento, 1)}
          >
            Por exercício
          </button>
        </div>

        {/* As duas abas apontam para o mesmo #conteudo (ele troca de tabela,
            não existem dois painéis escondidos); aria-labelledby segue a aba
            ativa para o leitor de tela anunciar de qual delas o conteúdo é. */}
        <div
          id="conteudo"
          role="tabpanel"
          aria-busy={carga.estado === 'carregando'}
          aria-labelledby={abaAtual === 'alunos' ? 'aba-alunos' : 'aba-exercicios'}
        >
          {renderizarConteudo()}
        </div>
      </main>

      {modal && (
        <ModalHistorico
          key={modal.chave}
          turmaId={turmaId}
          aluno={modal.aluno}
          aoFechar={() => setModal(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// Modal de histórico — as sessões do aluno NESTA turma
// ============================================================================
// Esc fecha, Tab não vaza e o foco volta ao botão da linha que o abriu:
// tudo isso é do ModalReact, que captura o elemento ativo na montagem.

interface PropsHistorico {
  turmaId: string;
  aluno: RelatorioAluno;
  aoFechar: () => void;
}

type CargaSessoes =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; sessoes: SessaoDoAluno[]; total: number };

function ModalHistorico({ turmaId, aluno, aoFechar }: PropsHistorico) {
  const modal = useRef<ModalHandle>(null);
  const [carga, setCarga] = useState<CargaSessoes>({ estado: 'carregando' });

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const resposta = await api.relatorios.sessoesDoAluno(turmaId, aluno.id);
        if (cancelado) return;
        const sessoes = desembrulhar(resposta);
        setCarga({
          estado: 'pronto',
          // A rota já entrega da mais recente para a mais antiga; a
          // ordenação aqui é só a garantia de que a tela cumpre o que
          // promete, mesmo se um dia o back esquecer o ORDER BY. Ordenar
          // não é calcular: nenhum número é produzido aqui.
          sessoes: [...sessoes].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)),
          total: (resposta as { total?: number })?.total ?? sessoes.length,
        });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  function renderizarCorpo() {
    if (carga.estado === 'carregando') {
      return <p className="modal-vazio-texto">Carregando histórico…</p>;
    }
    if (carga.estado === 'erro') {
      return <p className="modal-vazio-texto">{carga.mensagem}</p>;
    }
    if (carga.sessoes.length === 0) {
      return (
        <p className="modal-vazio-texto">
          Este aluno ainda não treinou nenhum exercício desta turma.
        </p>
      );
    }

    return (
      <>
        <div className="lista-sessoes entrada-escalonada">
          {carga.sessoes.map((s) => (
            <div key={s.id} className="item-sessao">
              <div className="item-sessao-texto">
                <p className="item-sessao-titulo">{s.tituloExercicio ?? 'Exercício removido'}</p>
                <p className="item-sessao-meta">{formatarDataHora(s.data)}</p>
              </div>
              <p className="item-sessao-numeros">
                <span>{numero(s.wpm)} PPM</span>
                <span>{porcentagem(s.precisao)}</span>
              </p>
              {/* "Concluiu" e "não concluiu" são as duas metades da mesma
                  informação: as duas aparecem, e nenhuma em cor de alerta. */}
              <p className="item-sessao-estado">{s.concluida ? 'Concluiu' : 'Não concluiu'}</p>
            </div>
          ))}
        </div>
        {carga.total > carga.sessoes.length && (
          <p className="lista-sessoes-rodape">
            Mostrando as {carga.sessoes.length} sessões mais recentes de {carga.total}.
          </p>
        )}
      </>
    );
  }

  return (
    <Modal
      ref={modal}
      eyebrow="Histórico do aluno"
      titulo={identidade(aluno)}
      acoes={[{ rotulo: 'Fechar' }]}
      aoFechar={aoFechar}
    >
      <div>{renderizarCorpo()}</div>
    </Modal>
  );
}

// ============================================================================
// Formatação — o front só apresenta o que o back agregou
// ============================================================================
// numero, porcentagem, contagem e formatarDataHora vêm de utils/formato.ts:
// null e undefined viram "—", zero é 0, e é por essas portas que todo
// número do back chega à tela. O "0 de 4" depende disso: o zero é um dado.

// "8 de 12" — quantos treinaram nos últimos 7 dias, de quantos alunos
// ativos (convidado que não respondeu não entra). O numerador pode faltar (o back ainda não contou) sem que o
// denominador falte, e vice-versa.
function ativos(turma: RelatorioTurma): string {
  return `${contagem(turma.alunosAtivos)} de ${contagem(turma.totalAlunos)}`;
}

// A identificação do aluno em uma linha, para aria-label e título do modal.
// Sem nome, é o RP — que é a identidade dele no banco.
function identidade(aluno: RelatorioAluno): string {
  return aluno.nome ? `${aluno.nome} (${formatarRp(aluno.id)})` : formatarRp(aluno.id);
}

// Nenhuma sessão nesta turma: os números da linha viram "—" e a linha fica
// apagada. É diferente de "média ainda não calculada" — aqui não há o que
// calcular.
function semSessao(aluno: RelatorioAluno): boolean {
  return !aluno.totalSessoes;
}

function linkDaTurma(turmaId: string): string {
  return `turma.html?${new URLSearchParams({ turma: turmaId })}`;
}

// ============================================================================
// Ordenação — utils/ordenacao.ts (nulo por último nas duas direções);
// cada tabela entrega só o valor de cada campo.
// ============================================================================

function valorOrdenavelAluno(aluno: RelatorioAluno, campo: string): string | number | null {
  // Ordena pelo que a coluna MOSTRA: com nome, pelo nome; sem nome, pelo
  // RP. Ordenar sempre pelo RP deixaria a coluna com o nome
  // visível em ordem aparentemente aleatória.
  if (campo === 'aluno') return (aluno.nome || aluno.id).toLowerCase();
  // Sem sessão a célula mostra "—", então o valor de ordenação é null —
  // senão o zero cairia no meio dos números de verdade.
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

// ============================================================================
// Exportar CSV
// ============================================================================
// Exporta O QUE ESTÁ NA TELA: a aba aberta, as linhas visíveis e a
// ordenação atual. Nenhuma requisição nova — os dados já estão aqui, e uma
// segunda busca poderia trazer números diferentes dos que o professor viu.
//
// As colunas e as linhas abaixo espelham, na mesma ordem, as de
// `colunasAlunos` e `colunasExercicios`. Mexer numa coluna da tabela pede
// mexer aqui: são duas apresentações do mesmo relatório.

const COLUNAS_CSV_ALUNOS = [
  'Nome',
  'RP',
  'Sessões',
  'PPM médio',
  'Precisão média (%)',
  'Exercícios concluídos',
  'Exercícios atribuídos',
  'Última atividade',
];

// Aqui o nome e o RP viram DUAS colunas, e "3 de 5" vira duas
// também: na tela o par junto economiza espaço, mas numa planilha uma
// célula "3 de 5" não soma nem filtra. É o mesmo dado, na forma que serve
// a cada lugar.
//
// Célula vazia para o que não existe, não "—": o travessão é um símbolo da
// tela, e o Excel o leria como texto numa coluna de números.
function linhaCsvAluno(aluno: RelatorioAluno): (string | number)[] {
  const vazio = semSessao(aluno);
  return [
    aluno.nome ?? '',
    aluno.id,
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

// Número para planilha: vírgula decimal (é o que o Excel em português lê
// como número) e vazio quando o back não mandou nada.
function celulaNumero(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '' : formatarDecimal(valor);
}

// Nome do arquivo: relatorio-<turma>-<aba>.csv, com o nome da turma em
// minúsculas e sem acento. Fora disso, o que não é letra nem número vira
// hífen — "9º Ano A — Manhã" tem espaço, ordinal e travessão, e um nome de
// arquivo com isso dentro é um convite a problema no download.
function slug(nome: string): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'turma';
}

// Ponto e vírgula como separador e BOM na frente: é o par que faz o Excel
// em português abrir o arquivo em colunas e em UTF-8, em vez de jogar tudo
// na coluna A com os acentos quebrados. O gerarCsv de utils/csv.ts já põe o
// BOM e já escapa a célula que contenha o separador.
function baixarCsv(nomeArquivo: string, linhas: (string | number)[][]): void {
  const csv = gerarCsv(linhas, { separador: ';', bom: true });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Um instante depois: revogar na hora cancela o download em alguns
  // navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// Erros — mesmo critério das outras telas: decide pelo status, nunca pelo
// texto que o servidor mandou.
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
  if (erro.status === 404) return MENSAGENS.NAO_ENCONTRADO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de professor antes de montar. Devolveu null, redirecionou: a tela
// para aqui e nada mais roda.
const usuario = guarda.soConta('professor');

// O host dos toasts fica fora da raiz do React (ver relatorios.html), e o
// toast.ts continua cuidando dele como nas outras telas.
let toasts: Toasts;

if (usuario) {
  guarda.aplicarMundo();
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 2 });
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Relatorios />);
}
