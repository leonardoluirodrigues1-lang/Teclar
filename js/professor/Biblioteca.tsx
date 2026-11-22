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
//     aba Atividades da mesma turma (que recarrega a lista).
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
import type { Dificuldade, Exercicio } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { Moldura, VOLTAR_TURMAS, type Voltar } from '../componentes/Moldura.js';
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
  | { estado: 'pronto'; exercicios: Exercicio[] };

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
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
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
        const [lista, turma, atribuicoes] = await Promise.all([
          api.exercicios.listar(),
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
        setCarga({ estado: 'pronto', exercicios: desembrulhar(lista) });
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

  function atualizarExercicios(transformar: (lista: Exercicio[]) => Exercicio[]) {
    setCarga((atual) =>
      atual.estado === 'pronto' ? { estado: 'pronto', exercicios: transformar(atual.exercicios) } : atual
    );
  }

  function alternar(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  function abrirCriar(opener: HTMLElement) {
    setModal({ chave: ++proximaChave, tipo: 'editar', exercicio: null, opener });
  }

  function limparFiltros() {
    setBusca('');
    setDificuldade('todas');
    campoBusca.current?.focus();
  }

  // --- atribuir (modo de seleção) -------------------------------------------

  async function atribuir() {
    if (atribuindo.current || selecionados.size === 0) return;
    atribuindo.current = true;
    setOcupado(true);
    setErroAtribuir(null);
    try {
      await api.turmas.atribuir(turmaDestino, [...selecionados]);
      // A turma recarrega as atribuições ao abrir e avisa quantas entraram.
      location.assign(hrefDaTurma({ atribuidos: String(selecionados.size) }));
    } catch (excecao) {
      setErroAtribuir(mensagemDaFalha(excecao));
      atribuindo.current = false;
      setOcupado(false);
    }
  }

  // --- colunas --------------------------------------------------------------

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
  ];

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

  const voltar: Voltar = selecao ? { href: hrefDaTurma(), rotulo: destino?.nome ?? 'Turma' } : VOLTAR_TURMAS;
  const filtrosVisiveis = carga.estado === 'pronto' && exercicios.length > 0;

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

        <Bloco titulo={selecao ? 'Exercícios da biblioteca' : 'Seus exercícios'}>
          {/* Busca por título e dificuldade, filtrados no cliente. Só fazem
              sentido com exercício na lista. */}
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

          {/* A tabela e os estados (carregando, vazio, erro, sem resultado)
              ocupam o mesmo lugar. */}
          <div id="conteudo" aria-busy={carga.estado === 'carregando'}>
            {renderizarConteudo()}
          </div>
        </Bloco>

        {/* A barra do modo de seleção: fica presa embaixo enquanto a lista rola. */}
        {selecao && (
          <div className="barra-selecao" role="region" aria-label="Atribuição">
            <p className="barra-selecao-contagem" aria-live="polite">
              {selecionados.size === 1 ? '1 selecionado' : `${selecionados.size} selecionados`}
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
              disabled={ocupado || selecionados.size === 0}
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

// Tamanho do texto contado no front: não existe coluna para isso no banco.
function tamanhoDoTexto(ex: Exercicio): number {
  return String(ex.texto ?? '').length;
}

// O começo do texto, numa linha, cortado com "…".
function trecho(texto: string | null | undefined): string {
  const limpo = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return limpo.length > TAMANHO_DO_TRECHO ? `${limpo.slice(0, TAMANHO_DO_TRECHO).trimEnd()}…` : limpo;
}

function filtrar(lista: Exercicio[], termo: string, dificuldade: FiltroDificuldade): Exercicio[] {
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
function valorOrdenavelExercicio(ex: Exercicio, campo: string): string | number | null {
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
