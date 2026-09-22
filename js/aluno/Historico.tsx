// Historico.tsx — pages/aluno/historico.html
// A tela em que o ALUNO vê o próprio desempenho, e a última do mundo Escola.
//
// O tom aqui não é o do relatório do professor, e a diferença não é de
// enfeite: o professor precisa comparar alunos, o aluno precisa saber se
// está melhorando. Então nesta tela não existe — nem escondido, nem como
// campo opcional no contrato — média da turma, posição, ranking ou
// qualquer número de colega. Nenhum valor ganha cor de alerta, nenhuma
// frase diz que ele está abaixo de coisa nenhuma, e uma sessão em que o
// tempo acabou é "Tempo esgotado", nunca uma falha. O que a tela destaca
// é o que ele conquistou: melhor marca, sequência, evolução.
//
// A moldura é a mesma do dashboard do aluno (a <Nav> em pílula com
// SECOES_ALUNO no topo, e o header.cabecalho dentro de .painel.vidro com
// "Aluno", título e subtítulo), como em Dashboard.tsx. "Sair" mora no menu
// do avatar da nav, e não solto no cabeçalho: um lugar só para a ação.
//
// Do relatório do professor vêm reaproveitados, sem cópia: o tipo da
// sessão (SessaoDoHistorico estende SessaoDoAluno), a Tabela ordenável, o
// esqueleto, o PainelErro e o formato de data. O que esta tela calcula por
// conta são a SEQUÊNCIA de dias e a EVOLUÇÃO — as duas saem das datas e
// dos PPM da lista que ela já carregou, e é por isso que não há rota para
// elas (ver api.aluno e a seção 11 de tipos.ts). As duas contas, a
// formatação ("—" para o que não veio) e a regra de ordenação moram em
// js/utils/ (desempenho.ts, formato.ts, ordenacao.ts), compartilhadas com
// a tela de estatísticas do Solo; só a FRASE da evolução é desta tela.

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { ErroDaApi, ResumoDoAluno, SessaoDoHistorico, Usuario } from '../nucleo/tipos.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { Nav, SECOES_ALUNO } from '../componentes/Nav.js';
import {
  evolucaoDe,
  maisRecentesPrimeiro,
  sequenciaDeDias,
  type Evolucao,
} from '../utils/desempenho.js';
import { contagem, formatarDataHora, formatarDecimal, numero, porcentagem } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';

// Linhas de esqueleto: a altura que a tabela terá com um punhado de
// sessões, para nada pular de lugar quando os dados chegarem.
const ESQUELETOS_LINHA = 6;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Este histórico é seu, mas a sessão atual não tem acesso a ele. Entre de novo.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

const TODOS = 'todos';

// ============================================================================
// Estado da tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; sessoes: SessaoDoHistorico[]; total: number; resumo: ResumoDoAluno };

function filtroDaUrl(): string {
  return new URLSearchParams(window.location.search).get('exercicio') ?? TODOS;
}

// ============================================================================
// Tela
// ============================================================================

interface PropsHistorico {
  usuario: Usuario;
}

function Historico({ usuario }: PropsHistorico) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [filtro, setFiltro] = useState<string>(filtroDaUrl);
  // A tabela nasce pela data, da mais recente para a mais antiga — que é
  // também a ordem em que o back manda. A seta no cabeçalho já mostra isso.
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: 'data', direcao: 'desc' });

  // Em quantas turmas ele está. Já vem no usuário do login (o back manda
  // junto), então não custa requisição: é só isso que decide se a tabela
  // ganha a coluna de turma. Numa turma só, a coluna seria a mesma palavra
  // repetida em toda linha.
  const turmas = usuario.turmas ?? [];
  const mostrarTurma = turmas.length > 1;

  const subtitulo = [
    // Aluno não tem nome no banco (a tabela Alunos é matrícula e senha):
    // nomeExibicao() cai na matrícula em vez de escrever "undefined".
    sessao.nomeExibicao(),
    turmas.length > 1 ? `${turmas.length} turmas` : turmas[0]?.nome,
  ]
    .filter(Boolean)
    .join(' · ');

  // --- carregamento ---------------------------------------------------------
  // As duas chamadas juntas: a tela não serve de nada com uma só delas.

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        const [historico, resumo] = await Promise.all([api.aluno.historico(), api.aluno.resumo()]);
        if (cancelado) return;
        const sessoes = desembrulhar(historico);
        setCarga({
          estado: 'pronto',
          sessoes,
          total: historico?.total ?? sessoes.length,
          resumo,
        });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const sessoes = carga.estado === 'pronto' ? carga.sessoes : [];

  // --- filtro por exercício -------------------------------------------------

  // As opções saem das sessões: o seletor só oferece exercício que ele
  // realmente fez. Nada de listar a biblioteca inteira e deixar ele
  // escolher um texto que nunca abriu.
  const exercicios = useMemo(() => {
    const porId = new Map<string, string>();
    for (const s of sessoes) {
      if (s.exerciseId && !porId.has(s.exerciseId)) {
        porId.set(s.exerciseId, s.tituloExercicio ?? 'Exercício removido');
      }
    }
    return [...porId].map(([id, titulo]) => ({ id, titulo })).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [sessoes]);

  // ?exercicio= com um id que ele não fez (link velho, URL editada à mão)
  // vale como "todos" — e não como uma tela vazia sem explicação.
  const filtroValido = filtro !== TODOS && exercicios.some((e) => e.id === filtro) ? filtro : TODOS;
  const exercicioFiltrado = exercicios.find((e) => e.id === filtroValido) ?? null;

  function selecionarExercicio(valor: string) {
    setFiltro(valor);
    // replaceState: escolher um exercício não é navegar para outra página,
    // é mudar o que esta mostra. Mas fica na URL, para o F5 não perder.
    const url = new URL(window.location.href);
    if (valor === TODOS) url.searchParams.delete('exercicio');
    else url.searchParams.set('exercicio', valor);
    window.history.replaceState(null, '', url);
  }

  // As sessões que a tela considera, já com o filtro aplicado. Sempre da
  // mais recente para a mais antiga: é desta lista que saem a sequência e
  // a evolução, e as duas dependem da ORDEM CRONOLÓGICA — não da ordenação
  // que a pessoa escolheu na tabela.
  const doFiltro = useMemo(
    () =>
      maisRecentesPrimeiro(
        filtroValido === TODOS ? sessoes : sessoes.filter((s) => s.exerciseId === filtroValido)
      ),
    [sessoes, filtroValido]
  );

  // O que a tabela desenha: o filtro mais a ordenação escolhida.
  const visiveis = useMemo(
    () => ordenar(doFiltro, ordenacao, valorOrdenavel),
    [doFiltro, ordenacao]
  );

  // --- os quatro números ----------------------------------------------------
  // Sem filtro, vêm do /aluno/resumo: é o back que agrega, e ele conhece
  // todas as sessões, inclusive as que a paginação não trouxe.
  // Com filtro, saem da lista filtrada — e o que se tira dela é só CONTA e
  // MÁXIMO, nunca média: contar e achar o maior de uma lista que já está
  // na mão não é refazer no cliente uma conta do servidor.

  const resumo = carga.estado === 'pronto' ? carga.resumo : null;
  const numeros = useMemo(() => {
    if (!resumo) return null;
    if (filtroValido === TODOS) {
      return {
        feitos: resumo.sessoesConcluidas,
        melhorWpm: resumo.melhorWpm,
        melhorPrecisao: resumo.melhorPrecisao,
      };
    }
    const ppms = doFiltro.map((s) => s.wpm).filter((n) => Number.isFinite(n));
    const precisoes = doFiltro.map((s) => s.precisao).filter((n) => Number.isFinite(n));
    return {
      feitos: doFiltro.filter((s) => s.concluida).length,
      melhorWpm: ppms.length ? Math.max(...ppms) : null,
      melhorPrecisao: precisoes.length ? Math.max(...precisoes) : null,
    };
  }, [resumo, doFiltro, filtroValido]);

  const sequencia = useMemo(() => sequenciaDeDias(doFiltro), [doFiltro]);
  const evolucao = useMemo(() => evolucaoDe(doFiltro), [doFiltro]);

  // --- colunas --------------------------------------------------------------

  const colunas: ColunaTabela<SessaoDoHistorico>[] = [
    {
      rotulo: 'Exercício',
      celula: (s) => s.tituloExercicio ?? 'Exercício removido',
    },
    // Só entra quando ele está em mais de uma turma.
    ...(mostrarTurma
      ? [{ rotulo: 'Turma', celula: (s: SessaoDoHistorico) => s.nomeTurma ?? '—' }]
      : []),
    { rotulo: 'Data', campo: 'data', celula: (s) => formatarDataHora(s.data) },
    { rotulo: 'PPM', campo: 'ppm', classe: 'col-numero', celula: (s) => numero(s.wpm) },
    {
      rotulo: 'Precisão',
      campo: 'precisao',
      classe: 'col-numero',
      // Nenhum limiar, nenhum destaque, nenhuma cor: é o número dele.
      celula: (s) => porcentagem(s.precisao),
    },
    {
      // "Concluído" ou "Tempo esgotado" — as duas coisas que de fato
      // acontecem quando o treino termina. Nunca "falhou": quem tentou e
      // ficou sem tempo tentou.
      rotulo: 'Resultado',
      classe: (s) => (s.concluida ? undefined : 'resultado-parcial'),
      celula: (s) => (s.concluida ? 'Concluído' : 'Tempo esgotado'),
    },
  ];

  // --- corpo ----------------------------------------------------------------

  function renderizarCorpo() {
    if (carga.estado === 'carregando') {
      return (
        <>
          <h2 className="secao-rotulo">Suas sessões</h2>
          <EsqueletoTabela quantidade={ESQUELETOS_LINHA} />
        </>
      );
    }

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar seu histórico"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    // Nunca treinou: um painel e nada mais. Tabela vazia e quatro zeros
    // não diriam nada a quem ainda não começou — e "0 PPM" soaria como um
    // resultado ruim, quando é só a ausência de resultado.
    if (sessoes.length === 0) {
      return (
        <PainelEstado
          titulo="Seu histórico começa no primeiro treino"
          texto="Assim que você terminar um exercício, ele aparece aqui com seu PPM, sua precisão e sua evolução ao longo do tempo."
        >
          <a className="btn btn-solido" href="dashboard.html">
            Ver exercícios da turma
          </a>
        </PainelEstado>
      );
    }

    return (
      <>
        <h2 className="secao-rotulo">Seu desempenho</h2>

        {/* Quatro números, mesma receita de rótulo mono 9px e valor mono
            22px com tabular-nums das outras telas do mundo escola. */}
        <div className="historico-numeros">
          <div className="metrica-item">
            <span className="metrica-rotulo">Exercícios feitos</span>
            <span className="metrica-valor" id="metrica-feitos">
              {contagem(numeros?.feitos)}
            </span>
          </div>
          <div className="metrica-item">
            <span className="metrica-rotulo">Melhor PPM</span>
            <span className="metrica-valor" id="metrica-melhor-ppm">
              {numero(numeros?.melhorWpm)}
            </span>
          </div>
          <div className="metrica-item">
            <span className="metrica-rotulo">Melhor precisão</span>
            <span className="metrica-valor" id="metrica-melhor-precisao">
              {porcentagem(numeros?.melhorPrecisao)}
            </span>
          </div>
          <div className="metrica-item">
            <span className="metrica-rotulo">Sequência</span>
            <span className="metrica-valor" id="metrica-sequencia">
              {contagem(sequencia)}
              <span className="metrica-unidade">{sequencia === 1 ? 'dia' : 'dias'}</span>
            </span>
          </div>
        </div>

        {/* A linha discreta que diz a que os números acima se referem
            quando há filtro. Sem filtro ela não existe: o padrão não
            precisa de aviso. */}
        {exercicioFiltrado && (
          <p className="historico-nota">
            Os números acima são só de “{exercicioFiltrado.titulo}”.
          </p>
        )}

        <p className="historico-evolucao" id="evolucao">
          {textoDaEvolucao(evolucao)}
        </p>

        <h2 className="secao-rotulo">Suas sessões</h2>

        <div className="historico-filtro">
          <label htmlFor="filtro-exercicio">Exercício</label>
          <select
            className="seletor"
            id="filtro-exercicio"
            value={filtroValido}
            onChange={(evento) => selecionarExercicio(evento.target.value)}
          >
            <option value={TODOS}>Todos</option>
            {exercicios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </select>
        </div>

        <Tabela
          colunas={colunas}
          linhas={visiveis}
          chave={(s) => s.id}
          ordenacao={ordenacao}
          aoOrdenar={setOrdenacao}
          // A paginação é do contrato; o mock manda tudo na primeira
          // página. Se um dia vier cortado, o aluno lê aqui que a lista
          // não acabou — em vez de achar que perdeu sessões.
          rodape={
            filtroValido === TODOS && carga.total > sessoes.length ? (
              <p className="tabela-rodape">
                Mostrando as {sessoes.length} sessões mais recentes de {carga.total}.
              </p>
            ) : undefined
          }
        />
      </>
    );
  }

  return (
    <>
      <Nav secoes={SECOES_ALUNO} ativo="historico" />

      <main className="conteudo">
        <section className="painel vidro historico" aria-labelledby="titulo">
          <a className="voltar" href="dashboard.html">
            <span className="voltar-seta" aria-hidden="true">
              ←
            </span>
            Meus exercícios
          </a>

          <header className="cabecalho">
            <div>
              <p className="rotulo">Aluno</p>
              <h1 className="titulo" id="titulo">
                Seu histórico
              </h1>
              <p className="subtitulo" id="subtitulo">
                {subtitulo}
              </p>
            </div>
          </header>

          {renderizarCorpo()}
        </section>
      </main>
    </>
  );
}

// ============================================================================
// Evolução — a frase é desta tela; a conta é de utils/desempenho.ts
// ============================================================================
// Melhorou, mostra quanto. Não melhorou, a frase fala de constância e
// ponto — nenhuma tela do aluno vai dizer a ele que caiu.

function textoDaEvolucao(evolucao: Evolucao): string {
  if (evolucao.tipo === 'insuficiente') return 'Continue treinando para ver sua evolução.';
  if (evolucao.tipo === 'melhorou') {
    return `Você está ${formatarDecimal(evolucao.diferenca)} PPM mais rápido que no começo.`;
  }
  return 'Seu ritmo está constante nas últimas sessões — constância é o que faz o resultado durar.';
}

// ============================================================================
// Ordenação — data, PPM e precisão (a regra é a de utils/ordenacao.ts)
// ============================================================================

function valorOrdenavel(sessao: SessaoDoHistorico, campo: string): string | number | null {
  // A data crua, não a formatada: 'AAAA-MM-DD...' ordena como texto, e
  // 'DD/MM/AAAA' ordenaria por dia do mês.
  if (campo === 'data') return sessao.data;
  if (campo === 'ppm') return sessao.wpm;
  if (campo === 'precisao') return sessao.precisao;
  return null;
}

// ============================================================================
// Erros — decide pelo status, nunca pelo texto que o servidor mandou
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
  // 403 nestas rotas quer dizer que o token não é de aluno — é o mesmo
  // caminho que impede um aluno de ver o histórico de outro.
  if (erro.status === 403) return MENSAGENS.PERMISSAO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de aluno antes de montar. Devolveu null, redirecionou: a tela
// para aqui e nada mais roda.
const usuario = guarda.soAluno();

if (usuario) {
  guarda.aplicarMundo();
  createRoot(document.getElementById('raiz')).render(<Historico usuario={usuario} />);
}
