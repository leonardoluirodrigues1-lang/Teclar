// Turmas.tsx — pages/professor/turmas.html
// A tela de entrada do modo Professor: a abertura com a marca, as três
// funções do modo (Turmas, Biblioteca, Configurações) e a grade de turmas.
//
// Não tem barra no topo. O único elemento fixo é a conta, no canto superior
// direito. O horizonte de eventos vive DENTRO da abertura e vai embora com
// ela ao rolar; o fundo fixo da página só tem as estrelas e o grão (ver
// turmas.html). Conta, abertura, teclas e cartão são as peças de
// ../componentes/EntradaDoModo.tsx, as mesmas da tela de salas do aluno.
//
// O que cada cartão mostra vem pronto do back (GET /turmas): nome, período,
// semente da capa e as contagens, que são COUNT feito lá. O front não soma
// nada por turma — a única soma daqui é a dos convites de TODAS as turmas,
// para a tecla de Turmas.
//
// Turma se ARQUIVA, não se exclui: SessionsProf aponta para a turma com ON
// DELETE CASCADE, e excluir uma turma levaria junto o histórico de treino de
// todos os alunos dela. Por isso não existe "Excluir" em lugar nenhum aqui.
// E arquivar tem volta: "Mostrar arquivadas", abaixo da grade, lista as
// turmas com ativa = false, cada uma com o seu "Desarquivar".
//
// Na primeira vez que a conta abre o modo Professor, antes das turmas, vem
// o tutorial (./Tutorial.tsx). Enquanto ele está na tela, a conta não
// aparece: o menu levaria para fora do tutorial no meio dele.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import type { ErroDaApi, Turma } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { validarNomeTurma } from '../utils/validacao.js';
import { SECOES_PROFESSOR } from '../componentes/Nav.js';
import {
  Abertura,
  CapaDaTurma,
  CartaoDeTurma,
  ContaFixa,
  Funcao,
  Funcoes,
  sementeDaTurma,
} from '../componentes/EntradaDoModo.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { EsqueletoGrade } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';
import { TutorialDoProfessor } from './Tutorial.js';

// Guarda de professor antes de qualquer outra coisa. Devolveu null, já
// redirecionou: a montagem lá no fim do arquivo não acontece e a tela para.
const usuario = guarda.soConta('professor');

// A busca é ruído enquanto a grade cabe na tela de uma olhada só. A partir
// daqui, procurar pelo nome fica mais rápido que varrer com os olhos.
const MINIMO_PARA_BUSCA = 5;

// Quantos esqueletos desenhar enquanto a lista não chega. Duas fileiras de
// três: o suficiente para o layout já ter a altura que vai ter.
const ESQUELETOS = 6;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  NAO_ENCONTRADA: 'Essa turma não existe mais. Recarregue a página.',
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

// Qual modal está aberto, e para qual turma. `chave` muda a cada abertura
// (ver ModalReact.tsx): reabrir durante a saída do anterior monta um novo.
type ModalAberto =
  | { tipo: 'criar'; chave: number; opener: HTMLElement }
  | { tipo: 'renomear'; chave: number; turma: Turma }
  | { tipo: 'capa'; chave: number; turma: Turma }
  | { tipo: 'arquivar'; chave: number; turma: Turma };

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
  const [modal, setModal] = useState<ModalAberto | null>(null);
  // O id da turma cujo menu "⋯" está aberto. Um menu por vez: abrir o de
  // outro cartão fecha este.
  const [menuDe, setMenuDe] = useState<string | null>(null);
  // useCallback: o cartão usa esta função como dependência do efeito que
  // liga os listeners do menu. Uma função nova a cada render religaria os
  // listeners — e devolveria o foco ao primeiro item — a cada render.
  const fecharMenu = useCallback(() => setMenuDe(null), []);

  // As turmas com ativa = false. Vêm de uma chamada à parte, e uma falha
  // nela não derruba a tela: o controle de arquivadas só não aparece.
  const [arquivadas, setArquivadas] = useState<Turma[]>([]);
  // Fechado ao abrir a tela: as arquivadas são exceção, não o assunto dela.
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  const btnCriar = useRef<HTMLButtonElement>(null);
  const btnArquivadas = useRef<HTMLButtonElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  // Lido uma vez ao abrir a tela; quem termina ou pula o tutorial vira
  // "já visto" e cai nas turmas sem recarregar. As turmas carregam por
  // baixo enquanto isso, e já estão prontas quando ele acaba.
  const [mostrarTutorial, setMostrarTutorial] = useState(() => !sessao.tutorialVisto('professor'));

  function terminarTutorial() {
    sessao.marcarTutorialVisto('professor');
    setMostrarTutorial(false);
  }

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

    // Separada de carregar(): se só esta falhar, a grade aparece do mesmo
    // jeito. O erro vai para o console, e não para a tela, porque a pessoa
    // não pediu nada ainda — o controle simplesmente não aparece.
    async function carregarArquivadas() {
      try {
        const lista = desembrulhar(await api.turmas.listarArquivadas());
        if (!cancelado) setArquivadas(lista);
      } catch (excecao) {
        console.error(excecao);
      }
    }

    carregar();
    carregarArquivadas();
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
      atual.estado === 'pronto' ? { estado: 'pronto', turmas: transformar(atual.turmas) } : atual,
    );
  }

  // Troca os campos que o PATCH devolveu, só na turma daquele id. As
  // contagens ficam as que já estavam: o PATCH não as recalcula.
  function trocarNaLista(id: string, campos: Partial<Turma>) {
    atualizarTurmas((lista) => lista.map((t) => (t.id === id ? { ...t, ...campos } : t)));
  }

  // --- ações do cartão e do cabeçalho ---------------------------------------

  function abrirCriar(opener: HTMLElement) {
    setModal({ tipo: 'criar', chave: ++proximaChave, opener });
  }

  function aoCriar(nova: Turma, opener: HTMLElement) {
    // flushSync: a grade precisa estar redesenhada ANTES do teste abaixo.
    flushSync(() => atualizarTurmas((lista) => [...lista, nova]));
    toasts.mostrar('Turma criada');
    // Se o botão que abriu o modal era o do estado vazio, ele não existe
    // mais. O do cabeçalho existe sempre.
    if (!document.contains(opener)) btnCriar.current?.focus();
  }

  function aoArquivar(turma: Turma) {
    flushSync(() => {
      atualizarTurmas((lista) => lista.filter((t) => t.id !== turma.id));
      // Entra nas arquivadas sem ir ao servidor de novo: é a mesma turma,
      // com as contagens que já tinha, para voltar com elas se desarquivada.
      setArquivadas((lista) => [...lista, { ...turma, ativa: false }]);
    });
    toasts.mostrar('Turma arquivada');
    // O cartão sumiu, e com ele o "⋯" que tinha o foco.
    btnCriar.current?.focus();
  }

  function aoDesarquivar(turma: Turma) {
    // flushSync: o foco abaixo depende de o botão de arquivadas ainda
    // existir, e ele some junto com a última arquivada.
    flushSync(() => {
      setArquivadas((lista) => lista.filter((t) => t.id !== turma.id));
      atualizarTurmas((lista) => [...lista, { ...turma, ativa: true }]);
    });
    toasts.mostrar('Turma desarquivada');
    // O cartão arquivado sumiu, e com ele o botão que tinha o foco.
    (btnArquivadas.current ?? btnCriar.current)?.focus();
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
            className="btn btn-solido tecla tecla-clara"
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
            className="btn btn-vidro vidro tecla"
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
      <div className="grade entrada-escalonada">
        {visiveis.map((turma) => (
          <Cartao
            key={turma.id}
            turma={turma}
            menuAberto={menuDe === turma.id}
            aoAlternarMenu={() => setMenuDe((atual) => (atual === turma.id ? null : turma.id))}
            aoFecharMenu={fecharMenu}
            aoRenomear={() => setModal({ tipo: 'renomear', chave: ++proximaChave, turma })}
            aoEditarCapa={() => setModal({ tipo: 'capa', chave: ++proximaChave, turma })}
            aoArquivar={() => setModal({ tipo: 'arquivar', chave: ++proximaChave, turma })}
          />
        ))}
      </div>
    );
  }

  function renderizarModal() {
    if (!modal) return null;
    const fechar = () => setModal(null);

    if (modal.tipo === 'criar') {
      return (
        <ModalNome
          key={modal.chave}
          eyebrow="Nova turma"
          titulo="Criar turma"
          valor=""
          rotuloAcao="Criar turma"
          textoOcupado="Criando…"
          enviar={(nome) => api.turmas.criar(nome)}
          aoConcluir={(nova) => aoCriar(nova, modal.opener)}
          aoFechar={fechar}
        />
      );
    }
    if (modal.tipo === 'renomear') {
      const { turma } = modal;
      return (
        <ModalNome
          key={modal.chave}
          eyebrow="Turma"
          titulo="Renomear turma"
          valor={turma.nome ?? ''}
          rotuloAcao="Salvar"
          textoOcupado="Salvando…"
          enviar={(nome) => api.turmas.renomear(turma.id, nome)}
          aoConcluir={(resposta) => {
            trocarNaLista(turma.id, { nome: resposta?.nome ?? turma.nome });
            toasts.mostrar('Nome atualizado');
          }}
          aoFechar={fechar}
        />
      );
    }
    if (modal.tipo === 'capa') {
      const { turma } = modal;
      return (
        <ModalCapa
          key={modal.chave}
          turma={turma}
          aoConcluir={(semente) => {
            trocarNaLista(turma.id, { capaSemente: semente });
            toasts.mostrar('Capa atualizada');
          }}
          aoFechar={fechar}
        />
      );
    }
    return (
      <ModalArquivar
        key={modal.chave}
        turma={modal.turma}
        aoConcluir={() => aoArquivar(modal.turma)}
        aoFechar={fechar}
      />
    );
  }

  if (mostrarTutorial) {
    return <TutorialDoProfessor aoTerminar={terminarTutorial} />;
  }

  return (
    <>
      <ContaFixa secoes={SECOES_PROFESSOR} papel={SECOES_PROFESSOR.modo} />

      <main>
        <Abertura />

        <FuncoesDoProfessor convites={carga.estado === 'pronto' ? somarConvites(turmas) : 0} />

        <div className="cabecalho">
          <div className="cabecalho-texto">
            {/* tabIndex -1: a tecla de Turmas leva o foco até aqui. */}
            <h1 className="titulo" id="suas-turmas" tabIndex={-1}>
              Suas turmas
            </h1>
            <p className="subtitulo">
              Abra uma turma para ver exercícios, participantes e relatório.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-solido tecla tecla-clara"
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

        {/* Só com pelo menos uma arquivada: "0 arquivadas" é ruído. E só
            com a grade pronta, para não aparecer acima do esqueleto. */}
        {carga.estado === 'pronto' && arquivadas.length > 0 && (
          <section className="arquivadas" aria-label="Turmas arquivadas">
            <button
              type="button"
              className="btn btn-vidro vidro tecla"
              ref={btnArquivadas}
              aria-expanded={mostrarArquivadas}
              aria-controls="lista-arquivadas"
              onClick={() => setMostrarArquivadas((atual) => !atual)}
            >
              {mostrarArquivadas ? 'Ocultar arquivadas' : `Mostrar arquivadas (${arquivadas.length})`}
            </button>
            {mostrarArquivadas && (
              <div className="grade" id="lista-arquivadas">
                {arquivadas.map((turma) => (
                  <CartaoArquivado key={turma.id} turma={turma} aoDesarquivar={aoDesarquivar} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {renderizarModal()}
    </>
  );
}

// A soma de convitesPendentes de todas as turmas. Turma que veio sem o
// campo não entra na conta (não é zero: é não informado).
function somarConvites(turmas: Turma[]): number {
  let total = 0;
  for (const turma of turmas) {
    if (Number.isFinite(turma.convitesPendentes)) total += turma.convitesPendentes;
  }
  return total;
}

// ============================================================================
// Funções
// ============================================================================

// As três teclas do professor. A de Turmas leva para a grade logo abaixo,
// na mesma página.
function FuncoesDoProfessor({ convites }: { convites: number }) {
  return (
    <Funcoes rotulo="Funções do professor">
      <Funcao
        href="#suas-turmas"
        nome="Turmas"
        texto="Criar turma, convidar por RP e acompanhar quem entregou."
        // Zero convites: a linha não aparece. "0 convites" é ruído.
        sinal={
          convites === 0
            ? null
            : convites === 1
              ? '1 convite sem resposta'
              : `${convites} convites sem resposta`
        }
      />
      <Funcao
        href="biblioteca.html"
        nome="Biblioteca"
        texto="Os textos que você escreve uma vez e atribui a quantas turmas quiser."
      />
      <Funcao
        href="configuracoes.html"
        nome="Configurações"
        texto="Seu RP, a senha de aluno e o tutorial do modo Professor."
      />
    </Funcoes>
  );
}

// ============================================================================
// Cartão
// ============================================================================

interface PropsCartao {
  turma: Turma;
  menuAberto: boolean;
  aoAlternarMenu: () => void;
  aoFecharMenu: () => void;
  aoRenomear: () => void;
  aoEditarCapa: () => void;
  aoArquivar: () => void;
}

function Cartao({
  turma,
  menuAberto,
  aoAlternarMenu,
  aoFecharMenu,
  aoRenomear,
  aoEditarCapa,
  aoArquivar,
}: PropsCartao) {
  const mais = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = `menu-${turma.id}`;

  // Com o menu aberto: o foco vai para o primeiro item, qualquer clique
  // fora fecha, e Esc fecha devolvendo o foco ao "⋯". Os listeners só
  // existem enquanto o menu está aberto.
  useEffect(() => {
    if (!menuAberto) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    // O clique no próprio "⋯" não chega aqui (stopPropagation nele).
    function aoClicarFora(evento: MouseEvent) {
      if (!menu.current?.contains(evento.target as Node)) aoFecharMenu();
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        aoFecharMenu();
        mais.current?.focus();
      }
    }

    document.addEventListener('click', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('click', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAberto, aoFecharMenu]);

  // Escolher um item: fecha o menu e devolve o foco ao "⋯" ANTES de abrir
  // o modal. O modal guarda quem tinha o foco ao abrir e o devolve ao
  // fechar — e o item do menu não existe mais nessa hora.
  function escolher(acao: () => void) {
    aoFecharMenu();
    mais.current?.focus();
    acao();
  }

  const nome = turma.nome ?? 'Turma sem nome';

  // O "⋯" e o menu vão FORA do link: botão dentro de <a> é HTML inválido.
  const menuDoCartao = (
    <>
      {/* "Opções" sozinho se repete em toda a grade; o leitor de tela
          precisa saber qual turma. */}
      <button
        type="button"
        className="cartao-mais"
        ref={mais}
        aria-label={`Opções da turma ${nome}`}
        aria-haspopup="menu"
        aria-expanded={menuAberto}
        aria-controls={menuAberto ? idMenu : undefined}
        onClick={(evento) => {
          // Não navega e não chega ao listener de "clique fora".
          evento.stopPropagation();
          aoAlternarMenu();
        }}
      >
        ⋯
      </button>

      {menuAberto && (
        <div
          className="cartao-menu vidro"
          id={idMenu}
          ref={menu}
          role="menu"
          aria-label={`Opções de ${nome}`}
        >
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => escolher(aoRenomear)}
          >
            Renomear
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => escolher(aoEditarCapa)}
          >
            Editar capa
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => escolher(aoArquivar)}
          >
            Arquivar turma
          </button>
        </div>
      )}
    </>
  );

  return (
    <CartaoDeTurma
      id={turma.id}
      nome={nome}
      href={`turma.html?turma=${encodeURIComponent(turma.id)}`}
      linha={turma.periodo}
      capaSemente={turma.capaSemente}
      classe={menuAberto ? 'cartao-com-menu' : undefined}
      fora={menuDoCartao}
    >
      <div className="metricas">
        <Metrica rotulo="Alunos" valor={turma.totalAlunos} />
        <Metrica rotulo="Exercícios" valor={turma.totalExercicios} />
      </div>
    </CartaoDeTurma>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: unknown }) {
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
// Cartão arquivado
// ============================================================================

// Apagado de propósito (ver .cartao-arquivado em escola.css): está ali para
// ser desarquivado, não para ser usado. Por isso não é link, não tem "⋯" e
// não mostra contagens — o que importa é reconhecer a turma pelo nome e
// pela capa.
function CartaoArquivado({
  turma,
  aoDesarquivar,
}: {
  turma: Turma;
  aoDesarquivar: (turma: Turma) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nome = turma.nome ?? 'Turma sem nome';

  async function desarquivar() {
    setOcupado(true);
    setErro(null);
    try {
      await api.turmas.desarquivar(turma.id);
      // Daqui o cartão sai da tela: nada de mexer no estado dele depois.
      aoDesarquivar(turma);
    } catch (excecao) {
      setErro(mensagemDaFalha(excecao));
      setOcupado(false);
    }
  }

  return (
    <article className="cartao vidro cartao-arquivado">
      <div className="cartao-capa" aria-hidden="true">
        <CapaDaTurma semente={sementeDaTurma(turma.id, turma.capaSemente)} />
      </div>
      <div className="cartao-corpo">
        <h2 className="cartao-nome">{nome}</h2>
        {turma.periodo && <p className="cartao-periodo">{turma.periodo}</p>}
        <button
          type="button"
          className="btn btn-vidro vidro tecla cartao-desarquivar"
          // O nome no rótulo: "Desarquivar" sozinho se repete em toda a lista.
          aria-label={`Desarquivar a turma ${nome}`}
          disabled={ocupado}
          onClick={desarquivar}
        >
          {ocupado ? 'Desarquivando…' : 'Desarquivar'}
        </button>
        <p className="erro-campo" aria-live="polite">
          {erro}
        </p>
      </div>
    </article>
  );
}

// ============================================================================
// Capa — o desenho é o CapaDaTurma de EntradaDoModo.tsx
// ============================================================================

// Uma semente nova para o "Editar capa". Inteira e positiva: cabe no INT
// da coluna CapaSemente.
function sortearSemente(): number {
  return Math.floor(Math.random() * 1000000);
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
// Modal de nome — criar e renomear
// ============================================================================

interface PropsModalNome {
  eyebrow: string;
  titulo: string;
  valor: string;
  rotuloAcao: string;
  textoOcupado: string;
  enviar: (nome: string) => Promise<Turma>;
  aoConcluir: (resposta: Turma) => void;
  aoFechar: () => void;
}

function ModalNome({
  eyebrow,
  titulo,
  valor,
  rotuloAcao,
  textoOcupado,
  enviar,
  aoConcluir,
  aoFechar,
}: PropsModalNome) {
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
// Modal de capa — sorteia outro desenho e mostra antes de salvar
// ============================================================================

interface PropsModalCapa {
  turma: Turma;
  aoConcluir: (semente: number) => void;
  aoFechar: () => void;
}

function ModalCapa({ turma, aoConcluir, aoFechar }: PropsModalCapa) {
  const modal = useRef<ModalHandle>(null);
  // Começa na capa de hoje: "Outro desenho" é que troca. Salvar sem trocar
  // grava a mesma semente, o que não faz mal.
  const [semente, setSemente] = useState(() => sementeDaTurma(turma.id, turma.capaSemente));
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setErro(null);

    try {
      await api.turmas.trocarCapa(turma.id, semente);
      modal.current?.fechar();
      aoConcluir(semente);
    } catch (excecao) {
      setErro(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  return (
    <Modal
      ref={modal}
      eyebrow={turma.nome}
      titulo="Editar capa"
      acoes={[
        {
          rotulo: ocupado ? 'Salvando…' : 'Salvar capa',
          principal: true,
          fecha: false,
          aoClicar: salvar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      aoFechar={aoFechar}
    >
      {/* A prévia é o mesmo desenho do cartão: o que se vê aqui é o que vai
          para a grade. Não há upload — a capa é sempre gerada. */}
      <div className="capa-previa">
        <CapaDaTurma semente={semente} />
      </div>
      <button
        type="button"
        className="btn btn-vidro vidro tecla"
        disabled={ocupado}
        onClick={() => setSemente(sortearSemente())}
      >
        Outro desenho
      </button>
      <p className="erro-campo" aria-live="polite">
        {erro}
      </p>
    </Modal>
  );
}

// ============================================================================
// Modal de arquivar — confirmação simples
// ============================================================================

interface PropsModalArquivar {
  turma: Turma;
  aoConcluir: () => void;
  aoFechar: () => void;
}

function ModalArquivar({ turma, aoConcluir, aoFechar }: PropsModalArquivar) {
  const modal = useRef<ModalHandle>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function arquivar() {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setErro(null);

    try {
      await api.turmas.arquivar(turma.id);
      modal.current?.fechar();
      aoConcluir();
    } catch (excecao) {
      setErro(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  // Confirmação simples, sem digitar o nome: arquivar não apaga nada.
  return (
    <Modal
      ref={modal}
      eyebrow={turma.nome}
      titulo="Arquivar turma?"
      acoes={[
        {
          rotulo: ocupado ? 'Arquivando…' : 'Arquivar turma',
          principal: true,
          fecha: false,
          aoClicar: arquivar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      aoFechar={aoFechar}
    >
      <p>
        A turma some da sua lista. O histórico de treino dos alunos dela é mantido, e dá para
        desarquivar depois em “Mostrar arquivadas”, abaixo das turmas.
      </p>
      <p className="erro-campo" aria-live="polite">
        {erro}
      </p>
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
  if (erro.status === 404) return MENSAGENS.NAO_ENCONTRADA;
  if (erro.status === 409) return MENSAGENS.NOME_EM_USO;
  if (erro.status === 400) return MENSAGENS.NOME_INVALIDO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// O host dos toasts fica fora da raiz do React (ver turmas.html), e o
// toast.js continua cuidando dele como nas telas em JS.
let toasts: Toasts;

if (usuario) {
  // Marca o <body> com .mundo-escola. É essa classe que troca a densidade
  // e o raio de cartão no CSS — nenhum número de espaçamento é decidido
  // aqui no JS.
  guarda.aplicarMundo();
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 2 });
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Turmas />);
}
