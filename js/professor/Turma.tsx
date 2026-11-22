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
//                       concluíram — e a lista de atribuídos, com a barra
//                       "X de Y alunos concluíram" e o "Retirar da turma".
//                       "Atribuir exercício" abre a Biblioteca em modo de
//                       seleção (biblioteca.html?atribuir=<turma>), que volta
//                       para cá com ?atribuidos=N;
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
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type {
  Aluno,
  AtribuicaoProfessor,
  ErroDaApi,
  SenhaProvisoriaGerada,
  Turma as TurmaDaLista,
  TurmaDetalhe,
} from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import {
  CascaDaTurma,
  focarAba,
  TrilhaDeExercicios,
  TurmaNaoEncontrada,
  useAbaDaUrl,
  type DefinicaoDeAba,
  type PedraDaTrilha,
} from '../componentes/TelaDaTurma.js';
import { MenuDeAcoes } from '../componentes/MenuDeAcoes.js';
import { RelatorioDaTurma } from './RelatorioDaTurma.js';
import { ModalArquivar, ModalCapa, ModalNome } from './modaisDaTurma.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { VOLTAR_TURMAS } from '../componentes/Moldura.js';
import { copiarComAviso } from '../utils/copiar.js';
import { imprimirSenhas } from '../utils/imprimirSenhas.js';
import { contagem, formatarData, formatarDataHora, rotuloDificuldade } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
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

// A Biblioteca em modo de seleção, com esta turma como destino.
const hrefAtribuir = turmaId ? `biblioteca.html?${new URLSearchParams({ atribuir: turmaId })}` : 'biblioteca.html';

// Tela

function Turma() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [aba, selecionarAba] = useAbaDaUrl(ABAS_DO_PROFESSOR);
  // Ordenação da tabela de participantes: só ela é ordenável. null = ordem
  // em que o back mandou.
  const [ordenacaoAlunos, setOrdenacaoAlunos] = useState<Ordenacao>({ campo: null, direcao: 'asc' });
  const [modal, setModal] = useState<ConfigModal | null>(null);

  // Volta da Biblioteca com ?atribuidos=N: avisa uma vez e tira da URL,
  // para o F5 não repetir o aviso.
  useEffect(() => {
    const url = new URL(window.location.href);
    const atribuidos = Number(url.searchParams.get('atribuidos'));
    if (!atribuidos) return;
    toasts.mostrar(atribuidos === 1 ? 'Exercício atribuído' : `${atribuidos} exercícios atribuídos`);
    url.searchParams.delete('atribuidos');
    window.history.replaceState(null, '', url);
  }, []);

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

    if (aba === 'relatorio') return <RelatorioDaTurma turmaId={turmaId} nomeDaTurma={turma.nome ?? 'turma'} toasts={toasts} />;
    if (aba === 'alunos') return renderizarAlunos();
    return renderizarAtividades();
  }

  function renderizarAtividades() {
    if (atribuicoes.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhum exercício atribuído"
          texto="Atribua o primeiro exercício da biblioteca para os alunos começarem."
        >
          <a className="btn btn-solido tecla tecla-clara" href={hrefAtribuir}>
            Atribuir exercício
          </a>
        </PainelEstado>
      );
    }
    // A trilha é a ordem que os alunos veem; a tabela embaixo é onde se
    // administra cada atribuição (data, dificuldade, remover).
    // A trilha é a ordem que os alunos veem; a lista embaixo é onde se
    // acompanha e administra cada atribuição.
    return (
      <>
        <TrilhaDeExercicios pedras={atribuicoes.map(pedraDaTurma)} />
        <Bloco
          titulo="Atividades da turma"
          texto="Os exercícios atribuídos e quantos alunos já concluíram cada um."
          acoes={
            <a className="btn btn-solido tecla tecla-clara" id="btn-atribuir" href={hrefAtribuir}>
              Atribuir exercício
            </a>
          }
        >
          <Tabela colunas={colunasExercicios} linhas={atribuicoes} chave={(item) => item.exercicioId} />
        </Bloco>
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
    { rotulo: 'Exercício', celula: (item) => <span className="celula-aluno-nome">{item.titulo ?? 'Sem título'}</span> },
    {
      rotulo: 'Dificuldade',
      celula: (item) => <span className={`etiqueta etiqueta-${item.dificuldade}`}>{rotuloDificuldade(item.dificuldade)}</span>,
    },
    { rotulo: 'Atribuído em', celula: (item) => (item.atribuidoEm ? formatarData(item.atribuidoEm) : '—') },
    { rotulo: 'Progresso', celula: (item) => <ProgressoDaAtividade item={item} /> },
    {
      rotulo: 'Ação',
      classe: 'col-acoes',
      celula: (item) => (
        <button
          type="button"
          className="btn btn-vidro vidro tecla btn-pequeno"
          aria-label={`Retirar “${item.titulo ?? 'este exercício'}” da turma`}
          onClick={() => setModal({ chave: ++proximaChave, tipo: 'remover-atribuicao', item })}
        >
          Retirar da turma
        </button>
      ),
    },
  ];

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
          titulo={`Remover ${aluno.nome} da turma?`}
          texto={
            'Por proteção de dados pessoais (LGPD), remover o aluno apaga todo o histórico dele nesta turma. ' +
            'Ele não conseguirá mais entrar com este código. Esta ação não pode ser desfeita.'
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
          eyebrow="Retirar da turma"
          titulo="Retirar esta atividade da turma?"
          texto={
            `Os alunos desta turma deixam de ver “${item.titulo ?? 'este exercício'}” na lista deles. ` +
            'O exercício continua na sua biblioteca, e as tentativas que os alunos já fizeram ficam guardadas ' +
            'no histórico e nos relatórios. Dá para atribuir de novo depois.'
          }
          rotuloAcao="Retirar da turma"
          // Sem id próprio de atribuição: a chave é o par (turma, exercício).
          enviar={() => api.turmas.removerAtribuicao(turmaId, item.exercicioId)}
          aoConcluir={() => {
            atualizarAtribuicoes((lista) => lista.filter((a) => a.exercicioId !== item.exercicioId));
            toasts.mostrar('Atividade retirada da turma');
            focarAba('atividades');
          }}
          aoFechar={fechar}
        />
      );
    }

    return null;
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

// "X de Y alunos concluíram", com a barra. Contagem que o back não mandou
// vira "—" e a barra fica vazia.
function ProgressoDaAtividade({ item }: { item: AtribuicaoProfessor }) {
  const feitos = Number.isFinite(item.concluidoPor) ? item.concluidoPor : null;
  const total = Number.isFinite(item.totalAlunos) ? item.totalAlunos : null;
  const fracao = feitos != null && total ? Math.min(1, feitos / total) : 0;
  return (
    <span className="progresso-atividade">
      <span className="barra-progresso" aria-hidden="true">
        <span style={{ width: `${Math.round(fracao * 100)}%` }} />
      </span>
      <span>
        {contagem(feitos)} de {contagem(total)} {total === 1 ? 'aluno concluiu' : 'alunos concluíram'}
      </span>
    </span>
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
