// Turmas.tsx — pages/professor/turmas.html
// Primeira tela da gestão acadêmica: a grade de turmas do professor.
//
// O que uma turma é, no banco, é o que esta tela mostra: um nome e duas
// contagens (alunos e exercícios), que vêm prontas do back. Não há ano,
// semestre nem status para exibir, e excluir turma não está aqui de
// propósito — SessionsProf aponta para a turma com ON DELETE CASCADE, e
// apagar uma turma levaria junto o histórico de todos os alunos dela.
//
// Conversão de js/professor/turmas.js para React: mesmo markup, mesmas
// classes de css/escola.css, mesmos textos e estados. A barra do topo, que
// nasceu aqui e foi copiada nas outras telas, agora é ../componentes/Nav.tsx.

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { ErroDaApi, Turma } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { validarNomeTurma } from '../utils/validacao.js';
import { Nav, SECOES_PROFESSOR } from '../componentes/Nav.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { EsqueletoGrade } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';

// A busca é ruído enquanto a grade cabe na tela de uma olhada só. A partir
// daqui, procurar pelo nome fica mais rápido que varrer com os olhos.
const MINIMO_PARA_BUSCA = 5;

// Quantos esqueletos desenhar enquanto a lista não chega. Duas fileiras de
// três: o suficiente para o layout já ter a altura que vai ter.
const ESQUELETOS = 6;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  NOME_EM_USO: 'Você já tem uma turma com esse nome.',
  NOME_INVALIDO: 'Esse nome não foi aceito pelo servidor.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// ============================================================================
// Estado da tela
// ============================================================================

// `turmas` é a lista como o back mandou. Três estados excludentes, e não
// três booleanos soltos.
type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; turmas: Turma[] };

// Criar e renomear — o mesmo modal, com verbos diferentes. `chave` muda a
// cada abertura (ver Modal.tsx).
interface ConfigModalTurma {
  chave: number;
  eyebrow: string;
  titulo: string;
  valor: string;
  rotuloAcao: string;
  textoOcupado: string;
  enviar: (nome: string) => Promise<Turma>;
  aoConcluir: (resposta: Turma) => void;
}

let proximaChave = 0;

// ============================================================================
// Tela
// ============================================================================

function Turmas() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  // `tentativa` só serve para o botão "Tentar de novo" disparar o efeito
  // outra vez.
  const [tentativa, setTentativa] = useState(0);
  // O que está digitado na busca. Tudo o que a grade mostra sai de
  // `turmas` e daqui.
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<ConfigModalTurma | null>(null);

  const btnCriar = useRef<HTMLButtonElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  // --- carregamento ---------------------------------------------------------

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        // Lista curta: array direto. O desembrulhar cobre o dia em que o back
        // resolver paginar isto sem avisar.
        const turmas = desembrulhar(await api.turmas.listar());
        if (!cancelado) setCarga({ estado: 'pronto', turmas });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const turmas = carga.estado === 'pronto' ? carga.turmas : [];

  // A busca aparece e some conforme a lista cresce — inclusive logo depois
  // de criar a turma que cruza o limite. Busca escondida não pode continuar
  // filtrando por trás.
  const buscaVisivel = turmas.length >= MINIMO_PARA_BUSCA;
  const filtro = buscaVisivel ? busca.trim() : '';

  function atualizarTurmas(transformar: (lista: Turma[]) => Turma[]) {
    setCarga((atual) =>
      atual.estado === 'pronto' ? { estado: 'pronto', turmas: transformar(atual.turmas) } : atual
    );
  }

  // --- criar e renomear -----------------------------------------------------

  function abrirCriar(opener: HTMLElement) {
    setModal({
      chave: ++proximaChave,
      eyebrow: 'Nova turma',
      titulo: 'Criar turma',
      // Uma turma é um nome. O banco não guarda ano, semestre nem status,
      // então não há um segundo campo a pedir.
      valor: '',
      rotuloAcao: 'Criar turma',
      textoOcupado: 'Criando…',
      enviar: (nome) => api.turmas.criar(nome),
      aoConcluir: (nova) => {
        // flushSync: a grade precisa estar redesenhada ANTES do teste abaixo.
        flushSync(() => atualizarTurmas((lista) => [...lista, nova]));
        toasts.mostrar('Turma criada');
        // A grade foi redesenhada; se o botão que abriu o modal era o do
        // estado vazio, ele não existe mais. O do cabeçalho existe sempre.
        if (!document.contains(opener)) btnCriar.current?.focus();
      },
    });
  }

  function abrirRenomear(turma: Turma) {
    setModal({
      chave: ++proximaChave,
      eyebrow: 'Turma',
      titulo: 'Renomear turma',
      valor: turma.nome ?? '',
      rotuloAcao: 'Salvar',
      textoOcupado: 'Salvando…',
      enviar: (nome) => api.turmas.renomear(turma.id, nome),
      aoConcluir: (atualizada) => {
        const nome = atualizada?.nome ?? turma.nome;
        // O cartão tem key pelo id: o botão de renomear continua sendo o
        // mesmo elemento, e é para ele que o modal devolve o foco ao fechar.
        atualizarTurmas((lista) => lista.map((t) => (t.id === turma.id ? { ...t, nome } : t)));
        toasts.mostrar('Nome atualizado');
      },
    });
  }

  // --- grade e estados ------------------------------------------------------

  function renderizarConteudo() {
    if (carga.estado === 'carregando') return <EsqueletoGrade quantidade={ESQUELETOS} />;

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar suas turmas"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    if (turmas.length === 0) {
      return (
        <PainelEstado
          titulo="Crie sua primeira turma"
          texto={
            'A turma é onde os alunos entram e os exercícios são atribuídos. ' +
            'Comece pelo nome — dá para renomear depois.'
          }
        >
          <button
            type="button"
            className="btn btn-solido"
            onClick={(evento) => abrirCriar(evento.currentTarget)}
          >
            Criar turma
          </button>
        </PainelEstado>
      );
    }

    const visiveis = filtrar(turmas, filtro);
    if (visiveis.length === 0) {
      return (
        <PainelEstado
          titulo="Sem resultado para essa busca"
          texto={`Nada com “${filtro}” no nome. Confira a escrita ou limpe a busca.`}
        >
          <button
            type="button"
            className="btn btn-vidro vidro"
            onClick={() => {
              setBusca('');
              campoBusca.current?.focus();
            }}
          >
            Limpar busca
          </button>
        </PainelEstado>
      );
    }

    return (
      <div className="grade">
        {visiveis.map((turma) => (
          <Cartao key={turma.id} turma={turma} aoRenomear={() => abrirRenomear(turma)} />
        ))}
      </div>
    );
  }

  return (
    <>
      <Nav secoes={SECOES_PROFESSOR} ativo="turmas" />

      <main>
        <div className="cabecalho">
          <h1 className="titulo" id="titulo">
            Turmas
          </h1>
          <button
            type="button"
            className="btn btn-solido"
            id="btn-criar"
            ref={btnCriar}
            onClick={(evento) => abrirCriar(evento.currentTarget)}
          >
            Criar turma
          </button>
        </div>

        {/* Só aparece a partir de 5 turmas: até lá a grade se lê inteira.
            Filtra no cliente, sem ida ao servidor. */}
        <div className="busca" id="busca" hidden={!buscaVisivel}>
          <span className="lupa" aria-hidden="true">
            /
          </span>
          <input
            type="search"
            id="campo-busca"
            ref={campoBusca}
            placeholder="Buscar turma pelo nome"
            aria-label="Buscar turma pelo nome"
            autoComplete="off"
            spellCheck={false}
            value={buscaVisivel ? busca : ''}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>

        {/* A grade e os estados (carregando, vazio, erro) ocupam o mesmo lugar. */}
        <div id="conteudo" aria-busy={carga.estado === 'carregando'}>
          {renderizarConteudo()}
        </div>
      </main>

      {modal && (
        <ModalTurma key={modal.chave} {...modal} aoFechar={() => setModal(null)} />
      )}
    </>
  );
}

// ============================================================================
// Cartão
// ============================================================================

interface PropsCartao {
  turma: Turma;
  aoRenomear: () => void;
}

function Cartao({ turma, aoRenomear }: PropsCartao) {
  return (
    <article className="cartao vidro" data-turma={turma.id}>
      {/* O cartão inteiro é clicável: o link se estica por cima dele pelo
          ::after (ver escola.css). O botão de renomear fica FORA do link —
          botão dentro de <a> é HTML inválido e atrapalha o leitor de tela. */}
      <h2 className="cartao-nome">
        <a className="cartao-link" href={`turma.html?turma=${encodeURIComponent(turma.id)}`}>
          {turma.nome ?? 'Turma sem nome'}
        </a>
      </h2>
      {/* "Renomear" sozinho se repete em toda a grade; o leitor de tela precisa
          saber qual turma é. */}
      <button
        type="button"
        className="btn-renomear"
        aria-label={`Renomear turma ${turma.nome ?? ''}`.trim()}
        onClick={(evento) => {
          // preventDefault e stopPropagation: o link cobre o cartão todo, e sem
          // isto renomear também navegaria para a turma.
          evento.preventDefault();
          evento.stopPropagation();
          aoRenomear();
        }}
      >
        Renomear
      </button>
      <div className="metricas">
        <Metrica rotulo="Alunos" valor={turma.totalAlunos} />
        <Metrica rotulo="Exercícios" valor={turma.totalExercicios} />
      </div>
    </article>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <span className="metrica-rotulo">{rotulo}</span>
      <span className="metrica-valor">{contagem(valor)}</span>
    </div>
  );
}

// Zero e "o back não mandou" são coisas diferentes: uma turma com 0 alunos
// precisa de matrícula; uma contagem ausente é falha de contrato, e
// mostrá-la como 0 seria inventar um dado que ninguém contou.
function contagem(valor: unknown): string {
  return Number.isFinite(valor) ? String(valor) : '—';
}

// ============================================================================
// Busca — filtra no cliente, sem ida ao servidor
// ============================================================================

function filtrar(lista: Turma[], termo: string): Turma[] {
  if (!termo) return lista;
  const alvo = normalizar(termo);
  return lista.filter((turma) => normalizar(turma.nome).includes(alvo));
}

// Sem acento e em minúsculas dos dois lados: procurar "extensao" tem de
// achar "Projeto de Extensão".
function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// ============================================================================
// Modal de criar/renomear
// ============================================================================

interface PropsModalTurma extends ConfigModalTurma {
  aoFechar: () => void;
}

function ModalTurma({
  eyebrow,
  titulo,
  valor,
  rotuloAcao,
  textoOcupado,
  enviar,
  aoConcluir,
  aoFechar,
}: PropsModalTurma) {
  const modal = useRef<ModalHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const [id] = useState(() => `campo-turma-${Date.now().toString(36)}`);

  const [nome, setNome] = useState(valor);
  const [erro, setErro] = useState<string | null>(null);
  // Uma requisição por vez: segura o clique repetido e o Enter repetido.
  // O ref é a trava síncrona; o estado é o que o botão mostra.
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (enviando.current) return;

    const invalido = validarNomeTurma(nome);
    if (invalido) {
      setErro(invalido);
      input.current?.focus();
      return;
    }

    enviando.current = true;
    setOcupado(true);
    setErro(null);

    try {
      const resposta = await enviar(nome.trim());
      modal.current?.fechar();
      aoConcluir(resposta);
    } catch (excecao) {
      // O erro fica embaixo do campo, onde a pessoa está olhando.
      setErro(mensagemDaFalha(excecao));
      input.current?.focus();
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
        // fecha: false — quem fecha é o sucesso. Se o servidor recusar, o
        // modal fica de pé com o que foi digitado e o erro à vista.
        {
          rotulo: ocupado ? textoOcupado : rotuloAcao,
          principal: true,
          fecha: false,
          aoClicar: confirmar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      // O modal foca o botão principal sozinho; aqui o campo é o lugar certo
      // para começar.
      aoAbrir={() => {
        input.current?.focus();
        input.current?.select();
      }}
      aoFechar={aoFechar}
    >
      {/* Enter no campo envia, sem precisar ir até o botão. */}
      <form
        className="campo-modal"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          confirmar();
        }}
      >
        <label htmlFor={id}>Nome da turma</label>
        <input
          type="text"
          id={id}
          ref={input}
          value={nome}
          maxLength={100}
          autoComplete="off"
          aria-describedby={`${id}-erro`}
          aria-invalid={Boolean(erro)}
          className={erro ? 'invalido' : undefined}
          onChange={(evento) => setNome(evento.target.value)}
          // Validação no blur e no envio — nunca a cada tecla.
          onBlur={() => {
            if (nome === '') return; // em branco no blur não é erro ainda
            setErro(validarNomeTurma(nome));
          }}
        />
        <p className="erro-campo" id={`${id}-erro`} aria-live="polite">
          {erro}
        </p>
      </form>
    </Modal>
  );
}

// ============================================================================
// Erros
// ============================================================================

// A tela decide pelo status, nunca pelo texto do servidor: mensagem de
// back muda, vem em inglês, vem com detalhe técnico. O status também
// nunca aparece para a pessoa.
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
  if (erro.status === 409) return MENSAGENS.NOME_EM_USO;
  if (erro.status === 400) return MENSAGENS.NOME_INVALIDO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de professor antes de montar. Devolveu null, redirecionou: a
// tela para aqui e nada mais roda.
const usuario = guarda.soConta('professor');

// O host dos toasts fica fora da raiz do React (ver turmas.html), e o
// toast.js continua cuidando dele como nas telas em JS.
let toasts: Toasts;

if (usuario) {
  // Marca o <body> com .mundo-escola. É essa classe que troca a densidade
  // e o raio de cartão no CSS — nenhum número de espaçamento é decidido
  // aqui no JS.
  guarda.aplicarMundo();
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 2 });
  createRoot(document.getElementById('raiz')).render(<Turmas />);
}
