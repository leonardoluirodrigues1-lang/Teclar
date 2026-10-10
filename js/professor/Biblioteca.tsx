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

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { DadosExercicio, Dificuldade, ErroDaApi, Exercicio } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import {
  LIMITES,
  normalizarTextoExercicio,
  validarTempoLimite,
  validarTextoExercicio,
  validarTituloExercicio,
} from '../utils/validacao.js';
import { Nav, SECOES_PROFESSOR } from '../componentes/Nav.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { contagem } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Linhas de esqueleto enquanto a lista não chega: a biblioteca tende a ser
// comprida, seis já dão a altura que a tabela vai ter.
const ESQUELETOS_LINHA = 6;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  NAO_ENCONTRADO: 'Esse exercício não existe mais. Recarregue a biblioteca.',
  DADOS_INVALIDOS: 'O servidor não aceitou esses dados. Confira os campos.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// Rótulo de cada valor do ENUM Dificuldade, na ordem em que o seletor e a
// ordenação usam. A ordem importa: ordenar por dificuldade é ordenar por
// esta posição, não pelo nome ("dificil" < "facil" em ordem alfabética).
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

// A prévia abre o exercício no treino. É o &previa=1 que manda: com ele,
// o Treino.tsx não grava sessão nenhuma (sessão de conta sem o parâmetro
// é treino do Solo, e grava).
function urlDaPrevia(id: string): string {
  return `../treino/treino.html?${new URLSearchParams({ exercicio: id, previa: '1' })}`;
}

// ============================================================================
// Estado da tela
// ============================================================================

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

// ============================================================================
// Tela
// ============================================================================

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
    <>
      <Nav secoes={SECOES_PROFESSOR} ativo="biblioteca" />

      <main id="corpo">
        <div className="cabecalho">
          <h1 className="titulo" id="titulo">
            Biblioteca
          </h1>
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
      </main>

      {renderizarModal()}
    </>
  );
}

// ============================================================================
// Formatação, filtro e ordenação
// ============================================================================

// Tamanho do texto contado no front: não existe coluna para isso no banco.
function tamanhoDoTexto(ex: Exercicio): number {
  return String(ex.texto ?? '').length;
}

// 0 = sem limite; o resto em m:ss (90 -> "1:30", 3600 -> "60:00").
function formatarTempoLimite(segundos: number | null | undefined): string {
  if (!Number.isFinite(segundos)) return '—';
  if (segundos <= 0) return 'sem limite';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function filtrar(lista: Exercicio[], termo: string, dificuldade: FiltroDificuldade): Exercicio[] {
  const alvo = normalizar(termo);
  return lista.filter(
    (ex) =>
      (dificuldade === 'todas' || ex.dificuldade === dificuldade) &&
      (!alvo || normalizar(ex.titulo).includes(alvo))
  );
}

// Sem acento e em minúsculas dos dois lados — mesma receita da busca de
// Turmas.tsx: procurar "acentuacao" tem de achar "Acentuação em foco".
function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
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

// ============================================================================
// Modal de criar/editar
// ============================================================================

interface PropsModalExercicio {
  /** null = criar. */
  exercicio: Exercicio | null;
  aoConcluir: (salvo: Exercicio) => void;
  aoFechar: () => void;
}

interface ErrosFormulario {
  titulo?: string | null;
  texto?: string | null;
  tempo?: string | null;
}

function ModalExercicio({ exercicio, aoConcluir, aoFechar }: PropsModalExercicio) {
  const modal = useRef<ModalHandle>(null);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const campoTempo = useRef<HTMLInputElement>(null);
  const [id] = useState(() => `exercicio-${Date.now().toString(36)}`);

  const editando = exercicio !== null;

  const [titulo, setTitulo] = useState(exercicio?.titulo ?? '');
  const [texto, setTexto] = useState(exercicio?.texto ?? '');
  const [dificuldade, setDificuldade] = useState<Dificuldade>(exercicio?.dificuldade ?? 'facil');
  // Como string: é o que está no campo. Vira número só ao enviar.
  const [tempo, setTempo] = useState(String(exercicio?.tempoLimiteSegundos ?? 0));
  const [erros, setErros] = useState<ErrosFormulario>({});
  // Erro do servidor, embaixo do formulário inteiro.
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // Uma requisição por vez: o ref é a trava síncrona; o estado é o que o
  // botão mostra.
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  // Contador vivo: o tamanho que o texto vai ter quando salvo — já sem as
  // quebras (cada uma vira um espaço), mas sem aparar as pontas, senão
  // digitar um espaço no fim não moveria o número.
  const tamanho = texto.replace(/\r\n|\r|\n/g, ' ').length;
  const excedido = tamanho > LIMITES.EXERCICIO_TEXTO_MAX;
  // A quebra não é erro: o motor trabalha com uma linha contínua, então ao
  // salvar ela vira espaço. Aviso discreto enquanto houver alguma.
  const temQuebra = /[\r\n]/.test(texto);

  function marcarErro(campo: keyof ErrosFormulario, mensagem: string | null) {
    setErros((atual) => ({ ...atual, [campo]: mensagem }));
  }

  async function confirmar() {
    if (enviando.current) return;

    const invalidos: ErrosFormulario = {
      titulo: validarTituloExercicio(titulo),
      texto: validarTextoExercicio(texto),
      tempo: validarTempoLimite(tempo),
    };
    if (invalidos.titulo || invalidos.texto || invalidos.tempo) {
      setErros(invalidos);
      // Foco no primeiro campo com problema, de cima para baixo.
      if (invalidos.titulo) campoTitulo.current?.focus();
      else if (invalidos.texto) campoTexto.current?.focus();
      else campoTempo.current?.focus();
      return;
    }

    enviando.current = true;
    setOcupado(true);
    setErroEnvio(null);

    // Quebra de linha vira espaço AQUI, ao salvar — o aviso embaixo do campo
    // já disse que ia acontecer. O textarea acompanha, para o que a pessoa
    // vê ser o que foi gravado se o servidor recusar e o modal ficar.
    const textoFinal = normalizarTextoExercicio(texto);
    if (textoFinal !== texto) setTexto(textoFinal);

    const dados: DadosExercicio = {
      titulo: titulo.trim(),
      texto: textoFinal,
      dificuldade,
      tempoLimiteSegundos: Number(tempo.trim()),
    };

    try {
      const resposta = editando
        ? await api.exercicios.atualizar(exercicio.id, dados)
        : await api.exercicios.criar(dados);
      modal.current?.fechar();
      // Back que devolva só parte: o que a tela mandou preenche o resto.
      aoConcluir({ ...(exercicio ?? { id: '' }), ...dados, ...(resposta ?? {}) } as Exercicio);
    } catch (excecao) {
      setErroEnvio(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  return (
    <Modal
      ref={modal}
      eyebrow={editando ? 'Exercício' : 'Novo exercício'}
      titulo={editando ? 'Editar exercício' : 'Criar exercício'}
      acoes={[
        // fecha: false — quem fecha é o sucesso. Se o servidor recusar, o
        // modal fica de pé com o que foi digitado e o erro à vista.
        {
          rotulo: ocupado ? (editando ? 'Salvando…' : 'Criando…') : editando ? 'Salvar' : 'Criar exercício',
          principal: true,
          fecha: false,
          aoClicar: confirmar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      // O modal foca o botão principal sozinho; aqui o título é o lugar
      // certo para começar.
      aoAbrir={() => {
        campoTitulo.current?.focus();
        if (editando) campoTitulo.current?.select();
      }}
      aoFechar={aoFechar}
    >
      {/* Enter no título ou no tempo envia; no textarea, Enter é quebra de
          linha (que o aviso abaixo cobre). */}
      <form
        className="form-exercicio"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          confirmar();
        }}
      >
        <div className="campo-modal">
          <label htmlFor={`${id}-titulo`}>Título</label>
          <input
            type="text"
            id={`${id}-titulo`}
            ref={campoTitulo}
            value={titulo}
            maxLength={LIMITES.EXERCICIO_TITULO_MAX}
            autoComplete="off"
            aria-describedby={`${id}-titulo-erro`}
            aria-invalid={Boolean(erros.titulo)}
            className={erros.titulo ? 'invalido' : undefined}
            onChange={(evento) => setTitulo(evento.target.value)}
            // Validação no blur e no envio — nunca a cada tecla.
            onBlur={() => {
              if (titulo === '') return; // em branco no blur não é erro ainda
              marcarErro('titulo', validarTituloExercicio(titulo));
            }}
          />
          <p className="erro-campo" id={`${id}-titulo-erro`} aria-live="polite">
            {erros.titulo}
          </p>
        </div>

        <div className="campo-modal">
          <label htmlFor={`${id}-texto`}>Texto do exercício</label>
          <textarea
            id={`${id}-texto`}
            ref={campoTexto}
            value={texto}
            rows={6}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-texto-contador ${id}-texto-aviso ${id}-texto-erro`}
            aria-invalid={Boolean(erros.texto)}
            className={erros.texto ? 'invalido' : undefined}
            onChange={(evento) => setTexto(evento.target.value)}
            onBlur={() => {
              if (texto === '') return;
              marcarErro('texto', validarTextoExercicio(texto));
            }}
          />
          <p className={excedido ? 'contador-texto excedido' : 'contador-texto'} id={`${id}-texto-contador`}>
            {tamanho} / {LIMITES.EXERCICIO_TEXTO_MAX}
          </p>
          <p className="aviso-campo" id={`${id}-texto-aviso`} aria-live="polite">
            {temQuebra ? 'O texto tem quebras de linha: ao salvar, cada uma vira um espaço. O treino é uma linha contínua.' : ''}
          </p>
          <p className="erro-campo" id={`${id}-texto-erro`} aria-live="polite">
            {erros.texto}
          </p>
        </div>

        <div className="campos-lado-a-lado">
          <div className="campo-modal">
            <label htmlFor={`${id}-dificuldade`}>Dificuldade</label>
            <select
              id={`${id}-dificuldade`}
              value={dificuldade}
              onChange={(evento) => setDificuldade(evento.target.value as Dificuldade)}
            >
              {DIFICULDADES.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="campo-modal">
            <label htmlFor={`${id}-tempo`}>Tempo limite (s)</label>
            <input
              type="number"
              id={`${id}-tempo`}
              ref={campoTempo}
              value={tempo}
              min={0}
              max={LIMITES.EXERCICIO_TEMPO_MAX}
              step={1}
              inputMode="numeric"
              autoComplete="off"
              aria-describedby={`${id}-tempo-erro`}
              aria-invalid={Boolean(erros.tempo)}
              className={erros.tempo ? 'invalido' : undefined}
              onChange={(evento) => setTempo(evento.target.value)}
              onBlur={() => {
                if (tempo === '') return;
                marcarErro('tempo', validarTempoLimite(tempo));
              }}
            />
            <p className="aviso-campo">0 = sem limite.</p>
            <p className="erro-campo" id={`${id}-tempo-erro`} aria-live="polite">
              {erros.tempo}
            </p>
          </div>
        </div>

        <p className="erro-campo" aria-live="polite">
          {erroEnvio}
        </p>
      </form>
    </Modal>
  );
}

// ============================================================================
// Modal de arquivar (a chamada continua sendo api.exercicios.excluir, o
// DELETE /exercicios/:id)
// ============================================================================
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

// ============================================================================
// Erros — mesmo critério de Turmas.tsx: decide pelo status, nunca pelo
// texto que o servidor mandou.
// ============================================================================

function mensagemDaFalha(excecao: unknown): string {
  // Duck typing, não instanceof: o erro do mock tem a mesma forma do
  // ErroApi do api.ts, mas não é instância dele.
  const erro = excecao as ErroDaApi | null | undefined;
  const daApi = erro?.name === 'ErroApi';
  if (!daApi) {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  // 401 não entra aqui: o api.ts já derruba a sessão e sai da tela.
  if (erro.status === 0) return MENSAGENS.CONEXAO;
  if (erro.status === 403) return MENSAGENS.PERMISSAO;
  if (erro.status === 404) return MENSAGENS.NAO_ENCONTRADO;
  if (erro.status === 400 || erro.status === 422) return MENSAGENS.DADOS_INVALIDOS;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

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
