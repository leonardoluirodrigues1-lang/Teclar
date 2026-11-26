// Biblioteca.tsx — pages/professor/biblioteca.html[?atribuir=<turmaId>]
// A "Biblioteca de exercícios": o acervo único do professor. Um exercício
// existe uma vez só e vai para quantas turmas ele quiser.
//
// Dois modos, na mesma tela:
//   · ACERVO (sem ?atribuir=): Criar exercício, busca por título, filtro por
//     dificuldade e a tabela — título (abre a prévia no treino) com um trecho
//     do texto, dificuldade, caracteres, tempo limite, em quantas turmas
//     está e o "⋯" com Editar e Arquivar.
//   · SELEÇÃO (?atribuir=<turmaId>, vindo do "Atribuir exercício" da turma):
//     a mesma busca, filtro e lista, com uma caixa de seleção por linha. Os
//     já atribuídos à turma vêm marcados e indisponíveis. Embaixo, "N
//     selecionados", "Atribuir à turma" e "Cancelar"; "+ Criar novo
//     exercício" cria e já deixa marcado. Confirmar ou cancelar volta para a
//     aba Atividades da mesma turma (que recarrega a lista). Os exercícios do
//     sistema aparecem numa seção separada, também com caixa: ao confirmar,
//     a cópia de cada lição marcada é criada (se ainda não existe) e entra
//     na mesma atribuição.
//
// Embaixo de "Meus exercícios", a seção "Exercícios do sistema": as lições
// do Solo (GET /exercicios/sistema), só de leitura — sem Editar nem Arquivar.
// Cada uma tem "Usar na minha biblioteca": a cópia entra em "Meus exercícios",
// pronta para editar e atribuir; com a cópia feita, o botão vira "Já está na
// sua biblioteca" (o back não duplica). A busca e o filtro de dificuldade
// valem para as duas seções.
//
// Um exercício, no banco (ExerciciosProf), é: título, texto, dificuldade e
// tempo limite. Não tem coluna de tamanho: os "caracteres" saem do texto,
// aqui. O "em quantas turmas" é COUNT que o back faz em AtribuicoesProf.

import { Bloco } from '../componentes/Bloco.js';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { Dificuldade, Exercicio, ExercicioDoSistema } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { Moldura, type Voltar } from '../componentes/Moldura.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { ModalExercicio, formatarTempoLimite, mensagemDaFalha } from '../componentes/ModalExercicio.js';
import { MenuDeAcoes } from '../componentes/MenuDeAcoes.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { contagem, DIFICULDADES, normalizar, pesoDificuldade, rotuloDificuldade } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Linhas de esqueleto enquanto a lista não chega: a biblioteca tende a ser
// comprida, seis já dão a altura que a tabela vai ter.
const ESQUELETOS_LINHA = 6;

// Quantos caracteres do texto aparecem embaixo do título.
const TAMANHO_DO_TRECHO = 70;

// A turma de destino do modo de seleção. Sem ela, o acervo.
const turmaDestino = new URLSearchParams(window.location.search).get('atribuir');

// A aba Atividades da turma de destino: para onde confirmar e cancelar levam.
function hrefDaTurma(extra?: Record<string, string>): string {
  return `turma.html?${new URLSearchParams({ turma: turmaDestino ?? '', aba: 'atividades', ...extra })}`;
}

// A prévia abre o exercício no treino. É o &previa=1 que manda: com ele,
// o Treino.tsx não grava sessão nenhuma (sessão de conta sem o parâmetro
// é treino do Solo, e grava).
function urlDaPrevia(id: string): string {
  return `../treino/treino.html?${new URLSearchParams({ exercicio: id, previa: '1' })}`;
}

// Estado da tela

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; exercicios: Exercicio[]; sistema: ExercicioDoSistema[] };

// No modo de seleção: o nome da turma e o que ela já tem atribuído.
// null fora dele (e enquanto não chega).
interface Destino {
  nome: string;
  jaAtribuidos: Set<string>;
}

type FiltroDificuldade = 'todas' | Dificuldade;

// Criar e editar: o mesmo modal. `exercicio` presente = editar. `opener` é
// o botão que abriu, para o foco ter para onde voltar se ele sumir (o do
// estado vazio some depois de criar o primeiro).
type ConfigModal =
  | { chave: number; tipo: 'editar'; exercicio: Exercicio | null; opener: HTMLElement }
  | { chave: number; tipo: 'arquivar'; exercicio: Exercicio };

let proximaChave = 0;

// Tela

function Biblioteca() {
  const selecao = turmaDestino != null;
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [busca, setBusca] = useState('');
  const [dificuldade, setDificuldade] = useState<FiltroDificuldade>('todas');
  // null = ordem em que o back mandou.
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  const [modal, setModal] = useState<ConfigModal | null>(null);
  // Modo de seleção: os marcados agora (os já atribuídos não entram aqui).
  // Os da biblioteca pelo id do exercício; os do sistema pelo id da lição.
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [selecionadosDoSistema, setSelecionadosDoSistema] = useState<Set<string>>(() => new Set());
  // Repetições de cada marcado (1 a 5; sem entrada = 1), pela mesma chave da seleção.
  const [repeticoes, setRepeticoes] = useState<Map<string, number>>(() => new Map());
  const [erroAtribuir, setErroAtribuir] = useState<string | null>(null);
  const atribuindo = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  const btnNovo = useRef<HTMLButtonElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  // --- carregamento ---------------------------------------------------------

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        // No modo de seleção a turma e as atribuições dela vêm junto: sem
        // elas não dá para dizer quais já estão lá.
        const [lista, sistema, turma, atribuicoes] = await Promise.all([
          api.exercicios.listar(),
          api.exercicios.sistema(),
          selecao ? api.turmas.obter(turmaDestino) : null,
          selecao ? api.turmas.atribuicoes(turmaDestino) : null,
        ]);
        if (cancelado) return;
        if (selecao) {
          setDestino({
            nome: turma?.nome ?? 'Turma sem nome',
            jaAtribuidos: new Set(desembrulhar(atribuicoes).map((a) => a.exercicioId)),
          });
          document.title = `Teclar — Atribuir exercício a ${turma?.nome ?? 'turma'}`;
        }
        setCarga({ estado: 'pronto', exercicios: desembrulhar(lista), sistema });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const exercicios = carga.estado === 'pronto' ? carga.exercicios : [];
  const sistema = carga.estado === 'pronto' ? carga.sistema : [];
  const [ordenacaoSistema, setOrdenacaoSistema] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  // As lições sendo copiadas agora: o botão delas fica ocupado.
  const [copiando, setCopiando] = useState<Set<string>>(() => new Set());

  function atualizarExercicios(transformar: (lista: Exercicio[]) => Exercicio[]) {
    setCarga((atual) => (atual.estado === 'pronto' ? { ...atual, exercicios: transformar(atual.exercicios) } : atual));
  }

  function alternar(id: string, marcado: boolean, doSistema = false) {
    (doSistema ? setSelecionadosDoSistema : setSelecionados)((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  // A lição já está na turma: a cópia dela é um dos atribuídos.
  function licaoJaAtribuida(licao: ExercicioDoSistema): boolean {
    return Boolean(licao.naBiblioteca && destino?.jaAtribuidos.has(licao.naBiblioteca));
  }

  function abrirCriar(opener: HTMLElement) {
    setModal({ chave: ++proximaChave, tipo: 'editar', exercicio: null, opener });
  }

  function limparFiltros() {
    setBusca('');
    setDificuldade('todas');
    campoBusca.current?.focus();
  }

  // --- usar na minha biblioteca (a cópia de uma lição do sistema) --------------

  function marcarCopiando(id: string, ligado: boolean) {
    setCopiando((atual) => {
      const proximo = new Set(atual);
      if (ligado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  // A cópia entra em "Meus exercícios" (uma vez só) e a lição passa a dizer
  // que já está lá.
  function guardarCopia(licaoId: string, copia: Exercicio) {
    setCarga((atual) =>
      atual.estado === 'pronto'
        ? {
            ...atual,
            exercicios: atual.exercicios.some((e) => e.id === copia.id) ? atual.exercicios : [...atual.exercicios, copia],
            sistema: atual.sistema.map((s) => (s.id === licaoId ? { ...s, naBiblioteca: copia.id } : s)),
          }
        : atual
    );
  }

  async function usarNaBiblioteca(licao: ExercicioDoSistema) {
    if (copiando.has(licao.id) || licao.naBiblioteca) return;
    marcarCopiando(licao.id, true);
    try {
      const { exercicio, jaExistia } = await api.exercicios.copiarDoSistema(licao.id);
      guardarCopia(licao.id, exercicio);
      toasts.mostrar(jaExistia ? 'Já estava em Meus exercícios' : 'Copiado para Meus exercícios');
    } catch (excecao) {
      toasts.mostrar(mensagemDaFalha(excecao));
    } finally {
      marcarCopiando(licao.id, false);
    }
  }

  // --- atribuir (modo de seleção) -------------------------------------------

  async function atribuir() {
    if (atribuindo.current || totalSelecionado === 0) return;
    atribuindo.current = true;
    setOcupado(true);
    setErroAtribuir(null);
    try {
      // As lições do sistema viram cópias na biblioteca primeiro (a que já
      // existe volta a mesma, sem duplicar), e tudo entra numa atribuição só.
      // Se a atribuição falhar, as cópias ficam e um novo "Atribuir" as reusa.
      const copias = await Promise.all([...selecionadosDoSistema].map((id) => api.exercicios.copiarDoSistema(id)));
      copias.forEach((copia, i) => guardarCopia([...selecionadosDoSistema][i], copia.exercicio));
      const ids = new Set([...selecionados, ...copias.map((copia) => copia.exercicio.id)]);
      // A lição do sistema entra pela cópia: a repetição dela vai no id da cópia.
      const porExercicio: Record<string, number> = {};
      for (const id of selecionados) porExercicio[id] = repeticoes.get(id) ?? 1;
      [...selecionadosDoSistema].forEach((id, i) => (porExercicio[copias[i].exercicio.id] = repeticoes.get(id) ?? 1));
      await api.turmas.atribuir(turmaDestino, [...ids], porExercicio);
      // A turma recarrega as atribuições ao abrir e avisa quantas entraram.
      location.assign(hrefDaTurma({ atribuidos: String(ids.size), ...(ids.size === 1 ? { post: [...ids][0] } : {}) }));
    } catch (excecao) {
      setErroAtribuir(mensagemDaFalha(excecao));
      atribuindo.current = false;
      setOcupado(false);
    }
  }

  // --- colunas --------------------------------------------------------------

  // Só os marcados agora têm o campo; a prévia é a conta do que o aluno digita.
  function celulaRepeticoes(id: string, titulo: string, caracteres: number, marcado: boolean) {
    if (!marcado) return <span aria-hidden="true">—</span>;
    const n = repeticoes.get(id) ?? 1;
    return (
      <span className="campo-repeticoes">
        <select
          className="seletor seletor-pequeno"
          aria-label={`Repetições de “${titulo}”`}
          aria-describedby={`previa-rep-${id}`}
          value={n}
          disabled={ocupado}
          onChange={(evento) => setRepeticoes((atual) => new Map(atual).set(id, Number(evento.target.value)))}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <span className="previa-repeticoes" id={`previa-rep-${id}`}>
          {n} × {caracteres} caracteres = {n * caracteres}
        </span>
      </span>
    );
  }

  const colunaTitulo: ColunaTabela<Exercicio> = {
    rotulo: 'Exercício',
    campo: 'titulo',
    celula: (ex) => (
      <>
        <a className="tabela-link" href={urlDaPrevia(ex.id)} title="Abrir prévia no treino">
          {ex.titulo || 'Sem título'}
        </a>
        <span className="celula-trecho">{trecho(ex.texto)}</span>
      </>
    ),
  };

  const colunasDeDados: ColunaTabela<Exercicio>[] = [
    {
      rotulo: 'Dificuldade',
      campo: 'dificuldade',
      celula: (ex) => <span className={`etiqueta etiqueta-${ex.dificuldade}`}>{rotuloDificuldade(ex.dificuldade)}</span>,
    },
    { rotulo: 'Caracteres', campo: 'caracteres', classe: 'col-numero', celula: (ex) => String(tamanhoDoTexto(ex)) },
    { rotulo: 'Tempo limite', classe: 'col-numero', celula: (ex) => formatarTempoLimite(ex.tempoLimiteSegundos) },
    // Zero é 0 (não está em turma nenhuma); travessão é "o back não contou".
    { rotulo: 'Turmas', classe: 'col-numero', celula: (ex) => contagem(ex.atribuidoA) },
  ];

  const colunasDoAcervo: ColunaTabela<Exercicio>[] = [
    colunaTitulo,
    ...colunasDeDados,
    {
      rotulo: 'Ações',
      classe: 'col-acoes',
      celula: (ex) => (
        <span className="acoes-da-atividade">
        <a className="btn btn-vidro vidro tecla btn-pequeno" href={urlDaPrevia(ex.id)} aria-label={`Praticar “${ex.titulo}” (modo prévia, não salva)`}>
          Praticar
        </a>
        <MenuDeAcoes
          rotulo={`Ações de “${ex.titulo}”`}
          acoes={[
            {
              rotulo: 'Editar',
              aoEscolher: () =>
                setModal({ chave: ++proximaChave, tipo: 'editar', exercicio: ex, opener: btnNovo.current }),
            },
            {
              rotulo: 'Arquivar',
              perigo: true,
              aoEscolher: () => setModal({ chave: ++proximaChave, tipo: 'arquivar', exercicio: ex }),
            },
          ]}
        />
        </span>
      ),
    },
  ];

  const colunasDaSelecao: ColunaTabela<Exercicio>[] = [
    {
      rotulo: 'Selecionar',
      classe: 'col-selecao',
      celula: (ex) => {
        const ja = destino?.jaAtribuidos.has(ex.id) ?? false;
        return (
          <input
            type="checkbox"
            className="caixa-selecao"
            aria-label={ja ? `“${ex.titulo}” já está atribuído a esta turma` : `Selecionar “${ex.titulo}”`}
            checked={ja || selecionados.has(ex.id)}
            disabled={ja || ocupado}
            onChange={(evento) => alternar(ex.id, evento.target.checked)}
          />
        );
      },
    },
    {
      ...colunaTitulo,
      celula: (ex) => (
        <>
          {colunaTitulo.celula(ex)}
          {destino?.jaAtribuidos.has(ex.id) && <span className="etiqueta etiqueta-espera">Já atribuído</span>}
        </>
      ),
    },
    ...colunasDeDados,
    {
      rotulo: 'Repetições',
      classe: 'col-repeticoes',
      celula: (ex) => celulaRepeticoes(ex.id, ex.titulo, tamanhoDoTexto(ex), selecionados.has(ex.id)),
    },
  ];

  // Exercícios do sistema: a etiqueta, o título (sem link: a lição não é do
  // professor, e a prévia no treino seria um treino do Solo) e o trecho; o
  // nível com a dificuldade por extenso; caracteres e tempo. Sem ações.
  const colunasDoSistema: ColunaTabela<ExercicioDoSistema>[] = [
    {
      rotulo: 'Exercício',
      campo: 'titulo',
      celula: (ex) => (
        <>
          <span className="etiqueta etiqueta-sistema">Do sistema</span>
          <span className="celula-titulo-sistema">{ex.titulo}</span>
          <span className="celula-trecho">{trecho(ex.texto)}</span>
        </>
      ),
    },
    {
      rotulo: 'Nível',
      campo: 'dificuldade',
      celula: (ex) => (
        <>
          <span className="celula-nivel">Nível {ex.nivel}</span>
          <span className={`etiqueta etiqueta-${ex.dificuldade}`}>{rotuloDificuldade(ex.dificuldade)}</span>
        </>
      ),
    },
    { rotulo: 'Caracteres', campo: 'caracteres', classe: 'col-numero', celula: (ex) => String(tamanhoDoTexto(ex)) },
    { rotulo: 'Tempo limite', classe: 'col-numero', celula: (ex) => formatarTempoLimite(ex.tempoLimiteSegundos) },
    {
      rotulo: 'Ações',
      classe: 'col-acoes',
      // Já copiada: aria-disabled, e não disabled, para o foco ficar no
      // botão (que acabou de mudar de texto) em vez de cair no começo da página.
      celula: (ex) =>
        ex.naBiblioteca ? (
          <button type="button" className="btn btn-vidro vidro btn-pequeno btn-ja-copiado" aria-disabled="true">
            Já está na sua biblioteca
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-vidro vidro tecla btn-pequeno"
            aria-label={`Usar “${ex.titulo}” na minha biblioteca`}
            disabled={copiando.has(ex.id)}
            onClick={() => usarNaBiblioteca(ex)}
          >
            {copiando.has(ex.id) ? 'Copiando…' : 'Usar na minha biblioteca'}
          </button>
        ),
    },
  ];

  // No modo de seleção: a caixa no lugar do botão, e o "Já atribuído".
  const colunasDoSistemaNaSelecao: ColunaTabela<ExercicioDoSistema>[] = [
    {
      rotulo: 'Selecionar',
      classe: 'col-selecao',
      celula: (ex) => {
        const ja = licaoJaAtribuida(ex);
        return (
          <input
            type="checkbox"
            className="caixa-selecao"
            aria-label={ja ? `“${ex.titulo}” já está atribuído a esta turma` : `Selecionar “${ex.titulo}”`}
            checked={ja || selecionadosDoSistema.has(ex.id)}
            disabled={ja || ocupado}
            onChange={(evento) => alternar(ex.id, evento.target.checked, true)}
          />
        );
      },
    },
    {
      ...colunasDoSistema[0],
      celula: (ex) => (
        <>
          {colunasDoSistema[0].celula(ex)}
          {licaoJaAtribuida(ex) && <span className="etiqueta etiqueta-espera">Já atribuído</span>}
        </>
      ),
    },
    // Nível, caracteres e tempo; sem a coluna de ações.
    ...colunasDoSistema.slice(1, -1),
    {
      rotulo: 'Repetições',
      classe: 'col-repeticoes',
      celula: (ex) => celulaRepeticoes(ex.id, ex.titulo, tamanhoDoTexto(ex), selecionadosDoSistema.has(ex.id)),
    },
  ];

  function renderizarSistema() {
    if (carga.estado !== 'pronto') return null;
    const visiveis = ordenar(filtrar(sistema, busca.trim(), dificuldade), ordenacaoSistema, valorOrdenavelExercicio);
    if (visiveis.length === 0) {
      return <PainelEstado titulo="Nenhum exercício do sistema com esses filtros" texto="Confira a escrita do título ou mude a dificuldade." />;
    }
    return (
      <Tabela
        colunas={selecao ? colunasDoSistemaNaSelecao : colunasDoSistema}
        linhas={visiveis}
        chave={(ex) => ex.id}
        classeLinha={(ex) => (selecao && licaoJaAtribuida(ex) ? 'linha-indisponivel' : undefined)}
        ordenacao={ordenacaoSistema}
        aoOrdenar={setOrdenacaoSistema}
      />
    );
  }

  // --- tabela e estados -----------------------------------------------------

  function renderizarConteudo() {
    if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={ESQUELETOS_LINHA} />;

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar a biblioteca"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    if (exercicios.length === 0) {
      return (
        <PainelEstado
          titulo="Sua biblioteca está vazia"
          texto="Escreva o primeiro exercício: um texto curto para os alunos digitarem. Depois é só atribuir às turmas."
        >
          <button type="button" className="btn btn-solido tecla tecla-clara" onClick={(evento) => abrirCriar(evento.currentTarget)}>
            {selecao ? '+ Criar novo exercício' : 'Criar exercício'}
          </button>
        </PainelEstado>
      );
    }

    const visiveis = ordenar(filtrar(exercicios, busca.trim(), dificuldade), ordenacao, valorOrdenavelExercicio);
    if (visiveis.length === 0) {
      return (
        <PainelEstado titulo="Nenhum exercício com esses filtros" texto="Confira a escrita do título ou mude a dificuldade.">
          <button type="button" className="btn btn-vidro vidro tecla" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </PainelEstado>
      );
    }

    return (
      <Tabela
        colunas={selecao ? colunasDaSelecao : colunasDoAcervo}
        linhas={visiveis}
        chave={(ex) => ex.id}
        classeLinha={(ex) => (selecao && destino?.jaAtribuidos.has(ex.id) ? 'linha-indisponivel' : undefined)}
        ordenacao={ordenacao}
        aoOrdenar={setOrdenacao}
      />
    );
  }

  // --- modais ---------------------------------------------------------------

  function renderizarModal() {
    if (!modal) return null;
    const fechar = () => setModal(null);

    if (modal.tipo === 'arquivar') {
      const { exercicio } = modal;
      return (
        <ModalArquivar
          key={modal.chave}
          exercicio={exercicio}
          aoConcluir={() => {
            atualizarExercicios((lista) => lista.filter((e) => e.id !== exercicio.id));
            toasts.mostrar('Exercício arquivado');
            // A linha (e o "⋯" que a pessoa clicou) acabou de sumir; o botão
            // do cabeçalho existe sempre.
            btnNovo.current?.focus();
          }}
          aoFechar={fechar}
        />
      );
    }

    const { exercicio, opener } = modal;
    return (
      <ModalExercicio
        key={modal.chave}
        exercicio={exercicio}
        rotuloCriar={selecao ? 'Criar e marcar' : 'Criar exercício'}
        aoConcluir={(salvo) => {
          if (exercicio) {
            // O back pode não devolver o atribuidoA no PATCH; a contagem
            // que já estava na linha continua valendo.
            atualizarExercicios((lista) =>
              lista.map((e) => (e.id === exercicio.id ? { ...e, ...salvo, atribuidoA: salvo.atribuidoA ?? e.atribuidoA } : e))
            );
            toasts.mostrar('Exercício atualizado');
            return;
          }
          // flushSync: a tabela precisa estar redesenhada ANTES do teste
          // abaixo — o botão do estado vazio deixa de existir ao criar.
          flushSync(() => {
            atualizarExercicios((lista) => [...lista, salvo]);
            // No modo de seleção o novo já entra marcado para atribuir.
            if (selecao) alternar(salvo.id, true);
          });
          toasts.mostrar(selecao ? 'Exercício criado e marcado' : 'Exercício criado');
          if (!document.contains(opener)) btnNovo.current?.focus();
        }}
        aoFechar={fechar}
      />
    );
  }

  const totalSelecionado = selecionados.size + selecionadosDoSistema.size;
  // Só o modo de seleção volta (para a turma de onde veio): a Biblioteca em
  // si é página do menu, e o menu é o caminho de volta.
  const voltar: Voltar | undefined = selecao ? { href: hrefDaTurma(), rotulo: destino?.nome ?? 'Turma' } : undefined;
  // Valem para as duas seções: só fazem sentido com algum exercício na tela.
  const filtrosVisiveis = carga.estado === 'pronto' && exercicios.length + sistema.length > 0;

  return (
    <Moldura modo="professor" ativo="biblioteca" voltar={voltar} classeDoConteudo="pagina">
      <main id="corpo">
        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo" id="titulo">
              {selecao ? 'Atribuir exercício' : 'Biblioteca de exercícios'}
            </h1>
            <p className="subtitulo">
              {selecao ? (
                <>
                  Escolha na biblioteca o que atribuir à turma <strong>{destino?.nome ?? '…'}</strong>.
                </>
              ) : (
                'Exercícios de digitação para atribuir às suas turmas. Escreva uma vez, use em quantas quiser.'
              )}
            </p>
          </div>
          <button
            type="button"
            className={selecao ? 'btn btn-vidro vidro tecla' : 'btn btn-solido tecla tecla-clara'}
            id="btn-novo"
            ref={btnNovo}
            onClick={(evento) => abrirCriar(evento.currentTarget)}
          >
            {selecao ? '+ Criar novo exercício' : 'Criar exercício'}
          </button>
        </div>

        {/* Busca por título e dificuldade, filtrados no cliente, nas duas
            seções (a sua biblioteca e a do sistema). */}
        <div className="filtros" id="filtros" hidden={!filtrosVisiveis}>
            <div className="busca">
              <span className="lupa" aria-hidden="true">
                /
              </span>
              <input
                type="search"
                id="campo-busca"
                ref={campoBusca}
                placeholder="Buscar pelo título"
                aria-label="Buscar exercício pelo título"
                autoComplete="off"
                spellCheck={false}
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
            </div>
            <select
              className="seletor"
              id="filtro-dificuldade"
              aria-label="Filtrar por dificuldade"
              value={dificuldade}
              onChange={(evento) => setDificuldade(evento.target.value as FiltroDificuldade)}
            >
              <option value="todas">Todas as dificuldades</option>
              {DIFICULDADES.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.rotulo}
                </option>
              ))}
            </select>
        </div>

        <Bloco titulo={selecao ? 'Exercícios da biblioteca' : 'Meus exercícios'}>
          {/* A tabela e os estados (carregando, vazio, erro, sem resultado)
              ocupam o mesmo lugar. */}
          <div id="conteudo" aria-busy={carga.estado === 'carregando'}>
            {renderizarConteudo()}
          </div>
        </Bloco>

        {carga.estado === 'pronto' && sistema.length > 0 && (
          <Bloco
            titulo="Exercícios do sistema"
            texto={
              selecao
                ? 'Textos prontos do TECLAR. Ao atribuir, cada um marcado entra também na sua biblioteca, para você editar depois.'
                : 'Textos prontos do TECLAR para você usar como base. Use na sua biblioteca para editar e atribuir às turmas.'
            }
          >
            {renderizarSistema()}
          </Bloco>
        )}

        {/* A barra do modo de seleção: fica presa embaixo enquanto a lista rola. */}
        {selecao && (
          <div className="barra-selecao" role="region" aria-label="Atribuição">
            <p className="barra-selecao-contagem" aria-live="polite">
              {totalSelecionado === 1 ? '1 selecionado' : `${totalSelecionado} selecionados`}
            </p>
            <p className="erro-campo" aria-live="polite">
              {erroAtribuir}
            </p>
            <a className="btn btn-vidro vidro tecla" href={hrefDaTurma()}>
              Cancelar
            </a>
            <button
              type="button"
              className="btn btn-solido tecla tecla-clara"
              disabled={ocupado || totalSelecionado === 0}
              onClick={atribuir}
            >
              {ocupado ? 'Atribuindo…' : 'Atribuir à turma'}
            </button>
          </div>
        )}
      </main>

      {renderizarModal()}
    </Moldura>
  );
}

// Formatação, filtro e ordenação

// Os dois tipos de linha (o seu e o do sistema) têm o que a busca, o filtro
// e a ordenação olham.
type ComTexto = Pick<Exercicio, 'titulo' | 'texto' | 'dificuldade'>;

// Tamanho do texto contado no front: não existe coluna para isso no banco.
function tamanhoDoTexto(ex: ComTexto): number {
  return String(ex.texto ?? '').length;
}

// O começo do texto, numa linha, cortado com "…".
function trecho(texto: string | null | undefined): string {
  const limpo = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return limpo.length > TAMANHO_DO_TRECHO ? `${limpo.slice(0, TAMANHO_DO_TRECHO).trimEnd()}…` : limpo;
}

function filtrar<T extends ComTexto>(lista: T[], termo: string, dificuldade: FiltroDificuldade): T[] {
  const alvo = normalizar(termo);
  return lista.filter(
    (ex) =>
      (dificuldade === 'todas' || ex.dificuldade === dificuldade) &&
      (!alvo || normalizar(ex.titulo).includes(alvo))
  );
}

// O que cada coluna vale para o ordenar de utils/ordenacao.ts. Título é
// texto (o ordenar compara em pt-BR, sem pesar acento nem caixa); a
// dificuldade entra pelo peso dela (fácil < média < difícil), não pelo
// rótulo.
function valorOrdenavelExercicio<T extends ComTexto>(ex: T, campo: string): string | number | null {
  if (campo === 'titulo') return ex.titulo;
  if (campo === 'dificuldade') return pesoDificuldade(ex.dificuldade);
  if (campo === 'caracteres') return tamanhoDoTexto(ex);
  return null;
}

// Modal de arquivar (a chamada é api.exercicios.excluir, o DELETE
// /exercicios/:id). O que o back faz (exercicios.service.ts, arquivar), numa
// transação: marca o exercício como arquivado — ele some da biblioteca e
// não volta, não há rota para desarquivar — e APAGA as atribuições dele em
// todas as turmas. As sessões que os alunos já fizeram ficam: histórico e
// relatórios não mudam. O texto diz isso com a contagem de turmas; contagem
// desconhecida (o back não mandou) recebe o aviso das turmas por precaução.

interface PropsModalArquivar {
  exercicio: Exercicio;
  aoConcluir: () => void;
  aoFechar: () => void;
}

function textoDoArquivamento(exercicio: Exercicio): string {
  const titulo = `“${exercicio.titulo}”`;
  const turmas = exercicio.atribuidoA;
  const final =
    ' As tentativas que os alunos já fizeram nele continuam guardadas, no histórico e nos relatórios. ' +
    'Não dá para desfazer: o exercício arquivado não volta para a biblioteca.';
  if (Number.isFinite(turmas) && turmas === 0) {
    return `${titulo} sai da sua biblioteca. Ele não está atribuído a nenhuma turma.` + final;
  }
  const onde = Number.isFinite(turmas)
    ? `Ele sai também ${turmas === 1 ? 'da turma em que está atribuído' : `das ${turmas} turmas em que está atribuído`}`
    : 'Ele sai também de todas as turmas em que estiver atribuído';
  return `${titulo} sai da sua biblioteca. ${onde}: os alunos deixam de vê-lo na lista deles.` + final;
}

function ModalArquivar({ exercicio, aoConcluir, aoFechar }: PropsModalArquivar) {
  const modal = useRef<ModalHandle>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);

    try {
      await api.exercicios.excluir(exercicio.id);
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
      eyebrow="Arquivar exercício"
      titulo="Arquivar este exercício?"
      acoes={[
        { rotulo: ocupado ? 'Arquivando…' : 'Arquivar', principal: true, fecha: false, aoClicar: confirmar, disabled: ocupado },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      aoFechar={aoFechar}
    >
      <div>
        <p>{textoDoArquivamento(exercicio)}</p>
        <p className="erro-campo" aria-live="polite">
          {erro}
        </p>
      </div>
    </Modal>
  );
}

// Montagem — guarda primeiro, React depois

// Guarda de professor antes de montar. Devolveu null, redirecionou: a
// tela para aqui e nada mais roda.
const usuario = guarda.soConta('professor');

// O host dos toasts fica fora da raiz do React (ver biblioteca.html), e o
// toast.ts continua cuidando dele como nas outras telas.
let toasts: Toasts;

if (usuario) {
  guarda.aplicarMundo();
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 2 });
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Biblioteca />);
}
