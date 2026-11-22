// Turma.tsx — pages/professor/turma.html?turma=<id>[&aba=atividades|relatorio|alunos]
// "Detalhes da turma", vista pelo PROFESSOR. A casca (capa, título, abas,
// trilha, painel de relatório) é a mesma da sala do aluno e mora em
// ../componentes/TelaDaTurma.tsx; aqui fica só o que muda para o professor:
//
//   · no topo: Editar turma, Alterar capa e Arquivar turma (os modais de
//     ./modaisDaTurma.tsx, os mesmos da grade), o resumo (alunos e
//     atividades) e o CÓDIGO que os alunos digitam no login, com Copiar e
//     Renovar (para quando ele vazar);
//   · três cartões que funcionam como abas, nesta ordem:
//   ATIVIDADES          a trilha na visão da turma — cada pedra diz quantos
//                       concluíram —, a tabela de atribuições com o
//                       "Remover atribuição" e o "Atribuir exercício";
//   RELATÓRIO DA TURMA  os números da turma inteira (GET /turmas/:id/relatorio),
//                       com PDF, CSV e o link para o relatório completo;
//   ALUNOS              "Adicionar aluno" e "Importar CSV" (./Alunos.tsx) e a
//                       lista, com a situação do acesso. Cada linha tem um
//                       "⋯" com "Gerar nova senha provisória" (o aluno não tem
//                       e-mail: quem esqueceu a senha só volta por aqui) e
//                       "Remover da turma".
//
// Sem ?turma=, ou com um id que o back não conhece, a tela mostra "Turma
// não encontrada" — nunca fica em branco.

import { Bloco } from '../componentes/Bloco.js';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type {
  Aluno,
  AtribuicaoProfessor,
  ErroDaApi,
  Exercicio,
  RelatorioTurma,
  SenhaProvisoriaGerada,
  Turma as TurmaDaLista,
  TurmaDetalhe,
} from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import {
  CascaDaTurma,
  DICA_PPM_DAS_SESSOES,
  focarAba,
  PainelDeRelatorio,
  TrilhaDeExercicios,
  TurmaNaoEncontrada,
  useAbaDaUrl,
  type DefinicaoDeAba,
  type PedraDaTrilha,
} from '../componentes/TelaDaTurma.js';
import { MenuDeAcoes } from '../componentes/MenuDeAcoes.js';
import { ModalArquivar, ModalCapa, ModalNome } from './modaisDaTurma.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { ModalExercicio } from '../componentes/ModalExercicio.js';
import { VOLTAR_TURMAS } from '../componentes/Moldura.js';
import { copiarComAviso } from '../utils/copiar.js';
import { imprimirSenhas } from '../utils/imprimirSenhas.js';
import { contagem, formatarData, formatarDataHora, normalizar, numero, porcentagem, rotuloDificuldade } from '../utils/formato.js';
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

// Estado da tela

// `turma` é o detalhe; `alunos` e `atribuicoes` são as duas listas que
// Promise.all traz juntas. Tudo o que a tela mostra — inclusive as três
// métricas do topo — sai destes três. O relatório é à parte: só é pedido
// quando a aba dele abre.
type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'nao-encontrada' }
  | { estado: 'pronto'; turma: TurmaDetalhe; alunos: Aluno[]; atribuicoes: AtribuicaoProfessor[] };

type ConfigModal =
  | { chave: number; tipo: 'remover-aluno'; aluno: Aluno }
  | { chave: number; tipo: 'senha-provisoria'; aluno: Aluno }
  | { chave: number; tipo: 'mostrar-provisoria'; aluno: Aluno; gerada: SenhaProvisoriaGerada }
  | { chave: number; tipo: 'novo-codigo' }
  | { chave: number; tipo: 'remover-atribuicao'; item: AtribuicaoProfessor }
  | { chave: number; tipo: 'atribuir'; opener: HTMLElement }
  | { chave: number; tipo: 'criar-exercicio' }
  | { chave: number; tipo: 'renomear' }
  | { chave: number; tipo: 'capa' }
  | { chave: number; tipo: 'arquivar' };

// A ordem das abas do professor. Os rótulos e a linha de baixo de cada
// cartão saem no render, com as contagens.
const ABAS_DO_PROFESSOR: { chave: 'atividades' | 'relatorio' | 'alunos' }[] = [
  { chave: 'atividades' },
  { chave: 'relatorio' },
  { chave: 'alunos' },
];

let proximaChave = 0;

const turmaId = new URLSearchParams(window.location.search).get('turma');

// Tela

function Turma() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [aba, selecionarAba] = useAbaDaUrl(ABAS_DO_PROFESSOR);
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
  const atribuicoes = carga.estado === 'pronto' ? carga.atribuicoes : [];

  useEffect(() => {
    if (turma) document.title = `Teclar — ${turma.nome ?? 'Turma'}`;
  }, [turma]);

  function atualizarAlunos(transformar: (lista: Aluno[]) => Aluno[]) {
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
        modo="professor"
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
    if (aba === 'alunos') return renderizarAlunos();
    return renderizarAtividades();
  }

  function renderizarAtividades() {
    if (atribuicoes.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhum exercício atribuído"
          texto="Atribua o primeiro exercício para os alunos começarem."
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
        <div className="painel-barra">
          <button
            type="button"
            className="btn btn-solido tecla tecla-clara"
            id="btn-atribuir"
            ref={btnAtribuir}
            onClick={(evento) => abrirAtribuir(evento.currentTarget)}
          >
            Atribuir exercício
          </button>
        </div>
        <TrilhaDeExercicios pedras={atribuicoes.map(pedraDaTurma)} />
        <Tabela colunas={colunasExercicios} linhas={atribuicoes} chave={(item) => item.exercicioId} />
      </>
    );
  }

  // Os dois botões da aba Alunos: abrem ./Alunos.tsx já no fluxo certo, e o
  // "Voltar para a turma" de lá traz de volta para esta aba.
  const botoesDeAlunos = (
    <>
      <a className="btn btn-solido tecla tecla-clara" href={hrefDeAlunos('um')}>
        Adicionar aluno
      </a>
      <a className="btn btn-vidro vidro tecla" href={hrefDeAlunos('csv')}>
        Importar CSV
      </a>
    </>
  );

  function renderizarAlunos() {
    if (alunos.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhum aluno ainda"
          texto="Esta turma ainda não tem alunos. Adicione um por um ou importe a lista de nomes."
        >
          <div className="painel-barra-botoes">{botoesDeAlunos}</div>
        </PainelEstado>
      );
    }

    const semSenha = alunos.filter((a) => !a.senhaDefinida).length;
    return (
      <Bloco
        titulo="Alunos"
        texto="Quem está na lista da turma, como cada um vai e a situação do acesso."
        acoes={botoesDeAlunos}
      >
        {semSenha > 0 && (
          <p className="aviso-convite" role="note">
            {semSenha === 1 ? '1 aluno ainda não criou senha.' : `${semSenha} alunos ainda não criaram senha.`} Cada
            um entra a primeira vez com a senha provisória (vale uma vez, por 7 dias) e depois cria a sua. Perdeu a
            folha ou esqueceu a senha? Use "⋯" › "Gerar nova senha provisória" na linha do aluno.
          </p>
        )}
        <Tabela
          colunas={colunasAlunos}
          linhas={ordenar(alunos, ordenacaoAlunos, valorOrdenavelAluno)}
          chave={(aluno) => aluno.id}
          // Quem nunca treinou: a linha fica mais apagada, para o olho ir
          // direto a quem já tem alguma coisa para mostrar.
          classeLinha={(aluno) => (aluno.totalSessoes === 0 ? 'linha-sem-dado' : undefined)}
          ordenacao={ordenacaoAlunos}
          aoOrdenar={setOrdenacaoAlunos}
        />
      </Bloco>
    );
  }

  // Colunas das duas tabelas. O aluno é o nome da lista da turma; o id dele
  // não aparece (só existe dentro desta turma e não diz nada a ninguém).
  const colunasAlunos: ColunaTabela<Aluno>[] = [
    {
      rotulo: 'Aluno',
      campo: 'nome',
      celula: (a) => <span className="celula-aluno-nome">{a.nome}</span>,
    },
    { rotulo: 'Acesso', celula: (a) => <SituacaoDoAcesso aluno={a} /> },
    { rotulo: 'Na lista desde', celula: (a) => formatarData(a.entrouEm) },
    { rotulo: 'Sessões', classe: 'col-numero', celula: (a) => contagem(a.totalSessoes) },
    { rotulo: 'PPM médio', campo: 'ppm', classe: 'col-numero', celula: (a) => contagem(a.wpmMedio) },
    {
      rotulo: 'Precisão média',
      classe: 'col-numero',
      celula: (a) => (Number.isFinite(a.precisaoMedia) ? `${a.precisaoMedia}%` : '—'),
    },
    {
      rotulo: 'Última atividade',
      campo: 'ultimaAtividade',
      celula: (a) => (a.ultimaAtividade ? formatarDataHora(a.ultimaAtividade) : '—'),
    },
    {
      rotulo: 'Ações',
      classe: 'col-acoes',
      celula: (aluno) => (
        <MenuDeAcoes
          rotulo={`Ações de ${aluno.nome}`}
          acoes={[
            {
              rotulo: 'Gerar nova senha provisória',
              aoEscolher: () => setModal({ chave: ++proximaChave, tipo: 'senha-provisoria', aluno }),
            },
            {
              rotulo: 'Remover da turma',
              perigo: true,
              aoEscolher: () => setModal({ chave: ++proximaChave, tipo: 'remover-aluno', aluno }),
            },
          ]}
        />
      ),
    },
  ];

  const colunasExercicios: ColunaTabela<AtribuicaoProfessor>[] = [
    { rotulo: 'Título', celula: (item) => item.titulo ?? 'Sem título' },
    { rotulo: 'Dificuldade', celula: (item) => rotuloDificuldade(item.dificuldade) },
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
      return (
        <ModalRemover
          key={modal.chave}
          eyebrow="Remover aluno"
          titulo="Remover da turma?"
          texto={
            `Remover ${aluno.nome} desta turma apaga também o histórico de sessões dele aqui, e ele deixa ` +
            'de conseguir entrar. Essa ação não pode ser desfeita.'
          }
          rotuloAcao="Remover da turma"
          enviar={() => api.alunos.remover(turmaId, aluno.id)}
          aoConcluir={() => {
            atualizarAlunos((lista) => lista.filter((a) => a.id !== aluno.id));
            toasts.mostrar('Aluno removido da turma');
            // A linha (e o botão que a pessoa clicou) acabou de sumir do DOM;
            // a aba é o próximo lugar estável para o foco pousar.
            focarAba('alunos');
          }}
          aoFechar={fechar}
        />
      );
    }

    if (modal.tipo === 'senha-provisoria') {
      const { aluno } = modal;
      return (
        <ModalRemover
          key={modal.chave}
          eyebrow={aluno.nome}
          titulo="Gerar nova senha provisória?"
          texto={
            (aluno.senhaDefinida ? 'A senha atual dele deixa de valer. ' : '') +
            'A senha provisória aparece uma vez só, para você entregar ao aluno. Ela vale um login, por 7 dias; ' +
            'depois ele cria a dele. Se já havia outra provisória, ela deixa de valer. O histórico não muda.'
          }
          rotuloAcao="Gerar senha"
          rotuloOcupado="Gerando…"
          enviar={() => api.alunos.gerarSenhaProvisoria(turmaId, aluno.id)}
          aoConcluir={(resposta) => {
            const gerada = resposta as SenhaProvisoriaGerada;
            atualizarAlunos((lista) =>
              lista.map((a) => (a.id === aluno.id ? { ...a, senhaDefinida: false, provisoriaAte: gerada.expiraEm } : a))
            );
            setModal({ chave: ++proximaChave, tipo: 'mostrar-provisoria', aluno, gerada });
          }}
          aoFechar={fechar}
        />
      );
    }

    if (modal.tipo === 'mostrar-provisoria') {
      const { aluno, gerada } = modal;
      return (
        <Modal
          key={modal.chave}
          eyebrow={aluno.nome}
          titulo="Senha provisória"
          acoes={[
            {
              rotulo: 'Imprimir',
              fecha: false,
              aoClicar: () => {
                if (!imprimirSenhas({ nome: turma?.nome ?? '', codigo: turma?.codigo ?? '' }, [{ nome: aluno.nome, ...gerada }])) {
                  toasts.mostrar('O navegador bloqueou a janela de impressão');
                }
              },
            },
            { rotulo: 'Pronto', principal: true },
          ]}
          aoFechar={() => {
            fechar();
            focarAba('alunos');
          }}
        >
          <p className="senha-provisoria col-mono">{gerada.senhaProvisoria}</p>
          <p>
            Código da turma <strong className="col-mono">{turma?.codigo}</strong>. Vale um login, até{' '}
            {formatarData(gerada.expiraEm)}. Ela não aparece de novo: anote ou imprima agora.
          </p>
        </Modal>
      );
    }

    if (modal.tipo === 'novo-codigo') {
      return (
        <ModalRemover
          key={modal.chave}
          eyebrow="Código da turma"
          titulo="Renovar o código?"
          texto={
            `O código ${turma?.codigo ?? ''} deixa de valer na hora: quem tentar entrar com ele não consegue. ` +
            'As senhas que já existem continuam funcionando com o código novo — a pessoal e a provisória. ' +
            'Avise a turma do código novo. Use quando o código vazar para quem não é da turma.'
          }
          rotuloAcao="Renovar código"
          rotuloOcupado="Gerando…"
          enviar={() => api.turmas.novoCodigo(turmaId)}
          aoConcluir={(resposta) => {
            const { codigo } = resposta as { codigo: string };
            setCarga((atual) =>
              atual.estado === 'pronto' ? { ...atual, turma: { ...atual.turma, codigo } } : atual
            );
            toasts.mostrar(`Código novo: ${codigo}`);
          }}
          aoFechar={fechar}
        />
      );
    }

    if (modal.tipo === 'renomear') {
      return (
        <ModalNome
          key={modal.chave}
          eyebrow="Turma"
          titulo="Editar turma"
          valor={turma?.nome ?? ''}
          rotuloAcao="Salvar"
          textoOcupado="Salvando…"
          enviar={(nome) => api.turmas.renomear(turmaId, nome)}
          aoConcluir={(resposta) => {
            trocarNaTurma({ nome: resposta?.nome ?? turma?.nome });
            toasts.mostrar('Nome atualizado');
          }}
          aoFechar={fechar}
        />
      );
    }

    if (modal.tipo === 'capa') {
      return (
        <ModalCapa
          key={modal.chave}
          turma={turma as TurmaDaLista}
          aoConcluir={(campos) => {
            trocarNaTurma(campos);
            toasts.mostrar('Capa atualizada');
          }}
          aoFechar={fechar}
        />
      );
    }

    if (modal.tipo === 'arquivar') {
      return (
        <ModalArquivar
          key={modal.chave}
          turma={turma as TurmaDaLista}
          // A turma arquivada sai da lista: não há mais o que ver aqui.
          aoConcluir={() => location.assign('turmas.html')}
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
            focarAba('atividades');
          }}
          aoFechar={fechar}
        />
      );
    }

    if (modal.tipo === 'criar-exercicio') {
      // Cria na biblioteca e já atribui a esta turma. O modal de criar fecha
      // no sucesso da criação; a atribuição vem logo atrás.
      return (
        <ModalExercicio
          key={modal.chave}
          exercicio={null}
          rotuloCriar="Criar e atribuir"
          aoConcluir={async (salvo) => {
            try {
              await api.turmas.atribuir(turmaId, [salvo.id]);
              const novas = desembrulhar(await api.turmas.atribuicoes(turmaId));
              flushSync(() => atualizarAtribuicoes(() => novas));
              toasts.mostrar('Exercício criado e atribuído');
            } catch (excecao) {
              toasts.mostrar(`Exercício criado, mas não atribuído: ${mensagemDaFalha(excecao)}`);
            }
            btnAtribuir.current?.focus();
          }}
          aoFechar={fechar}
        />
      );
    }

    return (
      <ModalAtribuir
        key={modal.chave}
        atribuicoes={atribuicoes}
        // Troca de modal: o de atribuir desmonta e o de criar entra no lugar.
        aoCriarNovo={() => setModal({ chave: ++proximaChave, tipo: 'criar-exercicio' })}
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

  function trocarNaTurma(campos: Partial<TurmaDetalhe>) {
    setCarga((atual) => (atual.estado === 'pronto' ? { ...atual, turma: { ...atual.turma, ...campos } } : atual));
  }

  // As ações da turma, à direita do título. Discretas: a ação de todo dia
  // (atribuir, adicionar aluno) mora dentro de cada aba.
  const acoes = turma && (
    <>
      <button type="button" className="btn btn-vidro vidro tecla" onClick={() => setModal({ chave: ++proximaChave, tipo: 'renomear' })}>
        Editar turma
      </button>
      <button type="button" className="btn btn-vidro vidro tecla" onClick={() => setModal({ chave: ++proximaChave, tipo: 'capa' })}>
        Alterar capa
      </button>
      <button type="button" className="btn btn-vidro vidro tecla" onClick={() => setModal({ chave: ++proximaChave, tipo: 'arquivar' })}>
        Arquivar turma
      </button>
    </>
  );

  // O código da turma, em destaque: é o que os alunos digitam no login,
  // junto com o nome e a senha.
  const codigo = (
    <section className="codigo-turma vidro" aria-labelledby="codigo-turma-rotulo">
      <div>
        <h2 className="codigo-turma-rotulo" id="codigo-turma-rotulo">
          Código da turma
        </h2>
        <p className="codigo-turma-valor col-mono">{turma?.codigo ?? '—'}</p>
      </div>
      <p className="codigo-turma-texto">
        Os alunos entram com este código, o próprio nome e a senha. Compartilhe só com quem é da turma.
      </p>
      {turma && (
        <div className="codigo-turma-acoes">
          <button
            type="button"
            className="btn btn-vidro vidro tecla"
            aria-label={`Copiar o código ${turma.codigo}`}
            onClick={() => copiarComAviso(turma.codigo, toasts, 'Código copiado')}
          >
            Copiar código
          </button>
          <button type="button" className="btn btn-vidro vidro tecla" onClick={() => setModal({ chave: ++proximaChave, tipo: 'novo-codigo' })}>
            Renovar código
          </button>
        </div>
      )}
    </section>
  );

  // Os três cartões-aba, com a linha de baixo contada aqui: remover aluno
  // ou atribuição muda o número sem outra ida ao back.
  const abas: DefinicaoDeAba[] = [
    { chave: 'atividades', rotulo: 'Atividades', detalhe: turma ? porExtenso(atribuicoes.length, 'atribuída', 'atribuídas') : '—' },
    { chave: 'relatorio', rotulo: 'Relatório da turma', detalhe: 'Desempenho da turma' },
    { chave: 'alunos', rotulo: 'Alunos', detalhe: turma ? porExtenso(alunos.length, 'aluno', 'alunos') : '—' },
  ];

  const resumo = turma
    ? `${turma.periodo ?? 'Período não informado'} · ${porExtenso(alunos.length, 'aluno', 'alunos')} · ` +
      porExtenso(atribuicoes.length, 'atividade atribuída', 'atividades atribuídas')
    : null;

  return (
    <>
      <CascaDaTurma
        modo="professor"
        voltar={VOLTAR_TURMAS}
        titulo={turma ? turma.nome ?? 'Turma sem nome' : null}
        subtitulo={resumo}
        acoes={acoes}
        extra={codigo}
        capa={turma?.temCapa ? { id: turma.id, capaSemente: turma.capaSemente } : null}
        aba={aba}
        aoSelecionarAba={selecionarAba}
        abas={abas}
        carregando={carga.estado === 'carregando'}
      >
        {renderizarConteudo()}
      </CascaDaTurma>

      {renderizarModal()}
    </>
  );
}

// "1 aluno", "28 alunos", "0 alunos".
function porExtenso(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

// alunos.html já no fluxo pedido ('um' = Adicionar aluno, 'csv' = Importar CSV).
function hrefDeAlunos(fluxo: 'um' | 'csv'): string {
  return `alunos.html?${new URLSearchParams({ turma: turmaId, aba: fluxo })}`;
}

// A situação do acesso, como os dados da API dizem:
//   senhaDefinida            -> a pessoal já foi criada (bcrypt no banco);
//   provisoriaAte no futuro  -> a provisória ainda vale um login;
//   nenhuma das duas         -> primeiro acesso pendente: precisa de uma
//                               provisória nova (o "⋯" da linha).
function SituacaoDoAcesso({ aluno }: { aluno: Aluno }) {
  if (aluno.senhaDefinida) return <span className="etiqueta etiqueta-ok">Senha pessoal criada</span>;
  if (aluno.provisoriaAte) {
    return <span className="etiqueta etiqueta-espera">Provisória válida até {formatarData(aluno.provisoriaAte)}</span>;
  }
  return <span className="etiqueta etiqueta-alerta">Primeiro acesso pendente</span>;
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

// Aba Relatório — os números da turma inteira

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
      { rotulo: 'PPM médio das sessões', valor: numero(r.wpmMedio), dica: DICA_PPM_DAS_SESSOES },
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
    ['PPM médio das sessões', r.wpmMedio ?? ''],
    ['Precisão média (%)', r.precisaoMedia ?? ''],
  ];
}

// Métricas e ordenação

// contagem (zero é 0, travessão é "sem dado") e ordenar (nulo por último
// nas duas direções) vêm de utils/. A tabela só diz o que cada campo vale.
function valorOrdenavelAluno(aluno: Aluno, campo: string): string | number | null {
  if (campo === 'nome') return aluno.nome;
  if (campo === 'ppm') return aluno.wpmMedio;
  if (campo === 'ultimaAtividade') return aluno.ultimaAtividade;
  return null;
}

// Modal de confirmação — remover aluno, senha provisória, código novo e remover
// atribuição

interface PropsModalRemover {
  eyebrow: string;
  titulo: string;
  texto: string;
  rotuloAcao: string;
  /** O que o botão diz enquanto envia. Padrão: "Removendo…". */
  rotuloOcupado?: string;
  enviar: () => Promise<unknown>;
  /** Recebe o que enviar() devolveu (o código novo, por exemplo). */
  aoConcluir: (resposta: unknown) => void;
  aoFechar: () => void;
}

function ModalRemover({
  eyebrow,
  titulo,
  texto,
  rotuloAcao,
  rotuloOcupado = 'Removendo…',
  enviar,
  aoConcluir,
  aoFechar,
}: PropsModalRemover) {
  const modal = useRef<ModalHandle>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);

    try {
      const resposta = await enviar();
      modal.current?.fechar();
      aoConcluir(resposta);
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
          rotulo: ocupado ? rotuloOcupado : rotuloAcao,
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

// Modal "Atribuir exercício" — biblioteca do professor, busca, seleção
// múltipla. Confirmar atribui todos os marcados de uma vez.

type Biblioteca =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; lista: Exercicio[] };

interface PropsModalAtribuir {
  atribuicoes: AtribuicaoProfessor[];
  aoConcluir: (atribuicoes: AtribuicaoProfessor[], quantidade: number) => void;
  aoCriarNovo: () => void;
  aoFechar: () => void;
}

function ModalAtribuir({ atribuicoes, aoConcluir, aoCriarNovo, aoFechar }: PropsModalAtribuir) {
  const modal = useRef<ModalHandle>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const linkCriar = useRef<HTMLButtonElement>(null);

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
          <button type="button" className="btn btn-solido tecla tecla-clara" ref={linkCriar} onClick={aoCriarNovo}>
            + Criar novo exercício
          </button>
        </>
      );
    }

    const alvo = normalizar(termo.trim());
    const filtrados = alvo
      ? biblioteca.lista.filter((ex) => normalizar(ex.titulo).includes(alvo))
      : biblioteca.lista;

    return (
      <>
        <button type="button" className="btn btn-vidro vidro tecla modal-criar-novo" onClick={aoCriarNovo}>
          + Criar novo exercício
        </button>
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
                    <p className="item-biblioteca-meta">{rotuloDificuldade(ex.dificuldade)}</p>
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

// Erros — mesmo critério de Turmas.tsx: decide pelo status, nunca pelo
// texto que o servidor mandou.

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

// Montagem — guarda primeiro, React depois

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
