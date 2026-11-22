// Turmas.tsx — pages/professor/turmas.html
// "Minhas turmas", a tela de entrada do modo Professor: título, a frase do
// que ela serve, "Criar turma" e a grade de cartões. A navegação é a barra
// lateral da Moldura (Minhas turmas, Biblioteca, Relatórios gerais). O
// cartão é o de ../componentes/EntradaDoModo.tsx, o mesmo das salas do
// aluno; aqui ele leva o código de entrada e a quantidade de alunos.
//
// O que cada cartão mostra vem pronto do back (GET /turmas): nome, período,
// semente da capa e as contagens, que são COUNT feito lá. O front não soma
// nada por turma.
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

import { Moldura } from '../componentes/Moldura.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import type { Turma } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { normalizar } from '../utils/formato.js';
import { CapaOuImagem, CartaoDeTurma, sementeDaTurma } from '../componentes/EntradaDoModo.js';
import { Modal } from '../componentes/ModalReact.js';
import { mensagemDaFalha, ModalArquivar, ModalCapa, ModalNome } from './modaisDaTurma.js';
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


// Estado da tela

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
  | { tipo: 'arquivar'; chave: number; turma: Turma }
  | { tipo: 'criada'; chave: number; turma: Turma };

let proximaChave = 0;

// Tela

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
    // Se o botão que abriu o modal era o do estado vazio, ele não existe
    // mais. O do cabeçalho existe sempre.
    if (!document.contains(opener)) btnCriar.current?.focus();
    // O que o back devolveu: o período e o código que os alunos digitam.
    setModal({ tipo: 'criada', chave: ++proximaChave, turma: nova });
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
          comSemestre
          enviar={(nome, semestre) => api.turmas.criar(nome, semestre)}
          aoConcluir={(nova) => aoCriar(nova, modal.opener)}
          aoFechar={fechar}
        />
      );
    }
    if (modal.tipo === 'criada') {
      const { turma } = modal;
      return (
        <Modal
          key={modal.chave}
          eyebrow="Turma criada"
          titulo={turma.nome ?? 'Turma'}
          acoes={[
            { rotulo: 'Abrir a turma', principal: true, aoClicar: () => location.assign(hrefDaTurma(turma)) },
            { rotulo: 'Fechar' },
          ]}
          aoFechar={fechar}
        >
          <p>{turma.periodo ?? SEM_PERIODO}</p>
          <p className="codigo-criado col-mono" aria-label={`Código da turma: ${turma.codigo.split('').join(' ')}`}>
            {turma.codigo}
          </p>
          <p>Os alunos entram com este código, o próprio nome e a senha. Ele fica também na página da turma.</p>
        </Modal>
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
          aoConcluir={(campos) => {
            trocarNaLista(turma.id, campos);
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
    <Moldura modo="professor" ativo="turmas" classeDoConteudo="pagina">

      <main>
        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo">Minhas turmas</h1>
            <p className="subtitulo">Gerencie suas turmas e acompanhe o progresso dos alunos.</p>
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
    </Moldura>
  );
}

// Cartão

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
        title="Opções da turma: renomear, editar capa, arquivar"
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
      href={hrefDaTurma(turma)}
      linha={turma.periodo ?? SEM_PERIODO}
      capaSemente={turma.capaSemente}
      temCapa={turma.temCapa}
      classe={menuAberto ? 'cartao-com-menu' : undefined}
      fora={menuDoCartao}
    >
      <p className="cartao-rodape">
        <span className="cartao-codigo">
          Código: <strong className="col-mono">{turma.codigo}</strong>
        </span>
        <span>{alunosPorExtenso(turma.totalAlunos)}</span>
      </p>
    </CartaoDeTurma>
  );
}

function hrefDaTurma(turma: Turma): string {
  return `turma.html?${new URLSearchParams({ turma: turma.id })}`;
}

// "28 alunos", "1 aluno". Contagem que o back não mandou é "—", não 0.
function alunosPorExtenso(total: unknown): string {
  if (!Number.isFinite(total)) return '— alunos';
  return total === 1 ? '1 aluno' : `${total} alunos`;
}

// Turma antiga (Semestre NULL) chega com periodo null.
const SEM_PERIODO = 'Período não informado';

// Cartão arquivado

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
        <CapaOuImagem id={turma.id} semente={sementeDaTurma(turma.id, turma.capaSemente)} temCapa={turma.temCapa} />
      </div>
      <div className="cartao-corpo">
        <h2 className="cartao-nome">{nome}</h2>
        <p className="cartao-periodo">{turma.periodo ?? SEM_PERIODO}</p>
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

// Busca — filtra no cliente, sem ida ao servidor

function filtrar(lista: Turma[], termo: string): Turma[] {
  if (!termo) return lista;
  const alvo = normalizar(termo);
  return lista.filter((turma) => normalizar(turma.nome).includes(alvo));
}

// Montagem — guarda primeiro, React depois

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
