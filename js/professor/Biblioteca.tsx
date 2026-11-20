// Biblioteca.tsx — pages/professor/biblioteca.html
// A biblioteca de exercícios do professor: onde ele escreve, edita e
// organiza os textos que depois atribui às turmas (tela de turma, modal
// "Atribuir exercício").
//
// Um exercício, no banco (ExerciciosProf), é: título, texto, dificuldade e
// tempo limite. Não tem categoria (não existe tabela para isso) nem coluna
// de tamanho: os "caracteres" da tabela saem do próprio texto, aqui. O
// "atribuído a" é o contrário — COUNT que o back faz em AtribuicoesProf; o
// front só mostra (e "—" quando não veio).
//
// Mesmo padrão de Turmas.tsx e Turma.tsx: Nav, Tabela, Esqueleto, PainelErro
// e ModalReact de ../componentes/, classes de css/escola.css, guarda antes
// de montar, busca e filtros no cliente.

import { Bloco } from '../componentes/Bloco.js';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { Dificuldade, Exercicio } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { Moldura, VOLTAR_TURMAS } from '../componentes/Moldura.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { ModalExercicio, formatarTempoLimite, mensagemDaFalha } from '../componentes/ModalExercicio.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { contagem, DIFICULDADES, normalizar, pesoDificuldade, rotuloDificuldade } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Linhas de esqueleto enquanto a lista não chega: a biblioteca tende a ser
// comprida, seis já dão a altura que a tabela vai ter.
const ESQUELETOS_LINHA = 6;

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

type FiltroDificuldade = 'todas' | Dificuldade;

// Criar e editar: o mesmo modal. `exercicio` presente = editar. `opener` é
// o botão que abriu, para o foco ter para onde voltar se ele sumir (o do
// estado vazio some depois de criar o primeiro).
type ConfigModal =
  | { chave: number; tipo: 'editar'; exercicio: Exercicio | null; opener: HTMLElement }
  | { chave: number; tipo: 'excluir'; exercicio: Exercicio };

let proximaChave = 0;

// Tela

function Biblioteca() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState('');
  const [dificuldade, setDificuldade] = useState<FiltroDificuldade>('todas');
  // null = ordem em que o back mandou.
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  const [modal, setModal] = useState<ConfigModal | null>(null);

  const btnNovo = useRef<HTMLButtonElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  // --- carregamento ---------------------------------------------------------

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        // O contrato é paginado; o desembrulhar tira a lista do envelope (e
        // aceita array puro, se o back mudar de ideia).
        const exercicios = desembrulhar(await api.exercicios.listar());
        if (!cancelado) setCarga({ estado: 'pronto', exercicios });
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

  // --- abrir modais ---------------------------------------------------------

  function abrirCriar(opener: HTMLElement) {
    setModal({ chave: ++proximaChave, tipo: 'editar', exercicio: null, opener });
  }

  function abrirEditar(exercicio: Exercicio, opener: HTMLElement) {
    setModal({ chave: ++proximaChave, tipo: 'editar', exercicio, opener });
  }

  function abrirExcluir(exercicio: Exercicio) {
    setModal({ chave: ++proximaChave, tipo: 'excluir', exercicio });
  }

  function limparFiltros() {
    setBusca('');
    setDificuldade('todas');
    campoBusca.current?.focus();
  }

  // --- colunas --------------------------------------------------------------

  const colunas: ColunaTabela<Exercicio>[] = [
    {
      rotulo: 'Título',
      campo: 'titulo',
      celula: (ex) => (
        <a className="tabela-link" href={urlDaPrevia(ex.id)} title="Abrir prévia no treino">
          {ex.titulo || 'Sem título'}
        </a>
      ),
    },
    { rotulo: 'Dificuldade', campo: 'dificuldade', celula: (ex) => rotuloDificuldade(ex.dificuldade) },
    {
      rotulo: 'Caracteres',
      campo: 'caracteres',
      classe: 'col-numero',
      celula: (ex) => String(tamanhoDoTexto(ex)),
    },
    { rotulo: 'Tempo limite', classe: 'col-numero', celula: (ex) => formatarTempoLimite(ex.tempoLimiteSegundos) },
    // Zero é 0 (não está em turma nenhuma); travessão é "o back não contou".
    { rotulo: 'Atribuído a', classe: 'col-numero', celula: (ex) => contagem(ex.atribuidoA) },
    {
      rotulo: 'Ação',
      celula: (ex) => (
        <span className="tabela-acoes">
          <button
            type="button"
            className="tabela-acao"
            aria-label={`Editar "${ex.titulo}"`}
            onClick={(evento) => abrirEditar(ex, evento.currentTarget)}
          >
            Editar
          </button>
          <button
            type="button"
            className="tabela-acao"
            aria-label={`Arquivar "${ex.titulo}"`}
            onClick={() => abrirExcluir(ex)}
          >
            Arquivar
          </button>
        </span>
      ),
    },
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
          <button
            type="button"
            className="btn btn-solido tecla tecla-clara"
            onClick={(evento) => abrirCriar(evento.currentTarget)}
          >
            Novo exercício
          </button>
        </PainelEstado>
      );
    }

    const visiveis = ordenar(filtrar(exercicios, busca.trim(), dificuldade), ordenacao, valorOrdenavelExercicio);
    if (visiveis.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhum exercício com esses filtros"
          texto="Confira a escrita do título ou mude a dificuldade."
        >
          <button type="button" className="btn btn-vidro vidro tecla" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </PainelEstado>
      );
    }

    return (
      <Tabela
        colunas={colunas}
        linhas={visiveis}
        chave={(ex) => ex.id}
        ordenacao={ordenacao}
        aoOrdenar={setOrdenacao}
      />
    );
  }

  // --- modais ---------------------------------------------------------------

  function renderizarModal() {
    if (!modal) return null;
    const fechar = () => setModal(null);

    if (modal.tipo === 'excluir') {
      const { exercicio } = modal;
      return (
        <ModalExcluir
          key={modal.chave}
          exercicio={exercicio}
          aoConcluir={() => {
            atualizarExercicios((lista) => lista.filter((e) => e.id !== exercicio.id));
            toasts.mostrar('Exercício arquivado');
            // A linha (e o botão que a pessoa clicou) acabou de sumir; o
            // botão do cabeçalho existe sempre.
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
          flushSync(() => atualizarExercicios((lista) => [...lista, salvo]));
          toasts.mostrar('Exercício criado');
          if (!document.contains(opener)) btnNovo.current?.focus();
        }}
        aoFechar={fechar}
      />
    );
  }

  return (
    <Moldura modo="professor" ativo="biblioteca" voltar={VOLTAR_TURMAS} classeDoConteudo="pagina">

      <main id="corpo">
        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo" id="titulo">
              Biblioteca
            </h1>
            <p className="subtitulo">Escreva exercícios uma vez e atribua a quantas turmas quiser.</p>
          </div>
          <button
            type="button"
            className="btn btn-solido tecla tecla-clara"
            id="btn-novo"
            ref={btnNovo}
            onClick={(evento) => abrirCriar(evento.currentTarget)}
          >
            Novo exercício
          </button>
        </div>

        <Bloco titulo="Seus exercícios">
        {/* Busca por título e dificuldade, filtrados no cliente. Só fazem
            sentido com exercício na lista. */}
        <div className="filtros" id="filtros" hidden={carga.estado !== 'pronto' || exercicios.length === 0}>
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

// Modal de criar/editar: componentes/ModalExercicio.tsx (a turma também usa).

// Modal de arquivar (a chamada continua sendo api.exercicios.excluir, o
// DELETE /exercicios/:id)
// O DELETE arquiva: o exercício some da biblioteca e de todas as turmas,
// mas as sessões que os alunos já fizeram nele ficam. O texto muda com o
// atribuidoA; contagem desconhecida (o back não mandou) recebe o aviso das
// turmas por precaução.

interface PropsModalExcluir {
  exercicio: Exercicio;
  aoConcluir: () => void;
  aoFechar: () => void;
}

function textoDaExclusao(exercicio: Exercicio): string {
  const titulo = `“${exercicio.titulo}”`;
  const turmas = exercicio.atribuidoA;
  if (Number.isFinite(turmas) && turmas === 0) {
    return `${titulo} sai da sua biblioteca. Essa ação não pode ser desfeita.`;
  }
  const onde = Number.isFinite(turmas)
    ? `está atribuído a ${turmas} ${turmas === 1 ? 'turma' : 'turmas'}`
    : 'pode estar atribuído a turmas';
  return (
    `${titulo} ${onde}. Arquivar tira o exercício da sua biblioteca e ` +
    (Number.isFinite(turmas) && turmas === 1 ? 'dessa turma' : 'dessas turmas') +
    '. As sessões que os alunos já fizeram nele continuam no histórico e nos relatórios. ' +
    'Essa ação não pode ser desfeita.'
  );
}

function ModalExcluir({ exercicio, aoConcluir, aoFechar }: PropsModalExcluir) {
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
        {
          rotulo: ocupado ? 'Arquivando…' : 'Arquivar',
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
        <p>{textoDaExclusao(exercicio)}</p>
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
