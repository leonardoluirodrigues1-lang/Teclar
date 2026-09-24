// Estatisticas.tsx — pages/solo/estatisticas.html
// As estatísticas da campanha: o link que o lobby já apontava para uma
// página vazia. Resolve o mesmo problema do histórico do aluno (sessões,
// sequência de dias, melhor marca, evolução), com outro tom — aqui não
// existe turma nem professor olhando. É treino pessoal, com XP e nível, e
// a linguagem é de progressão: o que já foi feito, o que falta para o
// próximo nível, o quanto o ritmo subiu. Uma sessão em que o tempo acabou
// é uma tentativa como qualquer outra, e a tela não a marca de jeito nenhum.
//
// De onde vem cada coisa (três chamadas, juntas):
//   · nível e XP           — api.solo.campanhaAtual(), a única verdade sobre
//                            a campanha; a barra é a mesma do lobby
//                            (componentes/BarraXp.tsx);
//   · agregado por lição   — api.solo.estatisticas(), que o back monta com o
//     e melhores marcas      JOIN em ExerciciosSolo; o front não agrega;
//   · sequência e evolução — derivadas das datas e dos PPM do histórico
//                            (api.solo.historico), como no histórico do
//                            aluno, com as MESMAS funções (utils/desempenho.ts).
//
// Esta tela ASSUME que a campanha existe, como caminho.html: sem
// campanha, redireciona para o lobby antes de montar. Quem nunca treinou
// (campanha sem sessão) vê um painel único convidando a começar — sem
// tabela e sem seis zeros.
//
// A tabela é a única superfície sólida da tela, como nas outras telas de
// dados do projeto: vidro é para painel, não para grade de números.

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type {
  Campanha,
  DesempenhoLicaoSolo,
  ErroDaApi,
  EstatisticasSolo,
  SessaoSolo,
  Usuario,
} from '../nucleo/tipos.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { Tabela, type ColunaTabela, type Ordenacao } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { BarraXp, progressoDe } from '../componentes/BarraXp.js';
import {
  evolucaoDe,
  maisRecentesPrimeiro,
  sequenciaDeDias,
  JANELA_EVOLUCAO,
  type Evolucao,
} from '../utils/desempenho.js';
import { contagem, formatarDataHora, formatarDecimal, numero, porcentagem } from '../utils/formato.js';
import { ordenar } from '../utils/ordenacao.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Vizinhas desta em pages/solo/: caminho relativo.
const ROTA_LOBBY = 'dashboard.html';
const ROTA_CAMINHO = 'caminho.html';

// Linhas de esqueleto: a altura que a tabela terá com um punhado de
// lições, para nada pular de lugar quando os dados chegarem.
const ESQUELETOS_LINHA = 5;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Estas estatísticas são da conta individual, e a sessão atual não tem acesso a elas. Entre de novo.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

const TODOS = 'todos';

// ============================================================================
// Estado da tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; campanha: Campanha; estatisticas: EstatisticasSolo; sessoes: SessaoSolo[] };

// ?nivel=3 sobrevive ao F5. Fora disso é "todos".
function filtroDaUrl(): string {
  return new URLSearchParams(window.location.search).get('nivel') ?? TODOS;
}

// ============================================================================
// Tela
// ============================================================================

interface PropsEstatisticas {
  usuario: Usuario;
}

function Estatisticas({ usuario }: PropsEstatisticas) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [filtro, setFiltro] = useState<string>(filtroDaUrl);
  // A tabela nasce pela última vez, da mais recente para a mais antiga: o
  // que a pessoa acabou de fazer fica em cima.
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: 'ultimaVez', direcao: 'desc' });

  // --- carregamento ---------------------------------------------------------
  // As três chamadas juntas: a tela não serve de nada com uma só delas.

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        // As três sem id: a campanha é a do token nas três.
        const [campanha, estatisticas, historico] = await Promise.all([
          api.solo.campanhaAtual(),
          api.solo.estatisticas(),
          api.solo.historico(),
        ]);
        if (cancelado) return;

        // A sessão tinha um id, mas a campanha não existe mais (apagada,
        // outra conta no mesmo navegador). Limpa e volta para o lobby, que
        // é quem oferece começar. O esqueleto fica no ar até a navegação:
        // nada de piscar uma tela vazia antes.
        if (!campanha) {
          sessao.atualizarUsuario({ campanhaAtiva: null });
          window.location.replace(ROTA_LOBBY);
          return;
        }

        setCarga({
          estado: 'pronto',
          campanha,
          estatisticas,
          // Da mais recente para a mais antiga: é desta ordem que saem a
          // sequência e a evolução.
          sessoes: maisRecentesPrimeiro(desembrulhar(historico)),
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

  const pronto = carga.estado === 'pronto' ? carga : null;
  const porLicao = pronto?.estatisticas.porLicao ?? [];
  const sessoes = pronto?.sessoes ?? [];

  // --- filtro por nível -----------------------------------------------------

  // As opções saem das lições tentadas: o seletor só oferece nível em que a
  // pessoa já pôs a mão. Os dez níveis existem, mas listar um nível vazio
  // seria oferecer uma tabela vazia.
  const niveis = useMemo(
    () => [...new Set(porLicao.map((l) => l.nivel))].sort((a, b) => a - b),
    [porLicao]
  );

  // ?nivel= com um nível que ela não tocou (link velho, URL editada à mão)
  // vale como "todos" — e não como uma tabela vazia sem explicação.
  const nivelFiltrado = niveis.find((n) => String(n) === filtro) ?? null;

  function selecionarNivel(valor: string) {
    setFiltro(valor);
    // replaceState: escolher um nível não é navegar para outra página, é
    // mudar o que esta mostra. Mas fica na URL, para o F5 não perder.
    const url = new URL(window.location.href);
    if (valor === TODOS) url.searchParams.delete('nivel');
    else url.searchParams.set('nivel', valor);
    window.history.replaceState(null, '', url);
  }

  // O que a tabela desenha: o filtro mais a ordenação escolhida. Os seis
  // números do topo NÃO passam por aqui — são sempre da campanha inteira.
  const visiveis = useMemo(() => {
    const doFiltro = nivelFiltrado == null ? porLicao : porLicao.filter((l) => l.nivel === nivelFiltrado);
    return ordenar(doFiltro, ordenacao, valorOrdenavel);
  }, [porLicao, nivelFiltrado, ordenacao]);

  // --- derivados das sessões ------------------------------------------------

  const sequencia = useMemo(() => sequenciaDeDias(sessoes), [sessoes]);
  const evolucao = useMemo(() => evolucaoDe(sessoes), [sessoes]);

  // --- colunas --------------------------------------------------------------

  const colunas: ColunaTabela<DesempenhoLicaoSolo>[] = [
    { rotulo: 'Lição', campo: 'titulo', celula: (l) => l.titulo },
    { rotulo: 'Nível', campo: 'nivel', classe: 'col-numero', celula: (l) => contagem(l.nivel) },
    { rotulo: 'Tentativas', campo: 'tentativas', classe: 'col-numero', celula: (l) => contagem(l.tentativas) },
    { rotulo: 'Melhor PPM', campo: 'melhorWpm', classe: 'col-numero', celula: (l) => numero(l.melhorWpm) },
    {
      rotulo: 'Melhor precisão',
      campo: 'melhorPrecisao',
      classe: 'col-numero',
      // Nenhum limiar, nenhuma cor: é a marca dela.
      celula: (l) => porcentagem(l.melhorPrecisao),
    },
    { rotulo: 'Última vez', campo: 'ultimaVez', celula: (l) => formatarDataHora(l.ultimaVez) },
  ];

  // --- corpo ----------------------------------------------------------------

  function renderizarCorpo() {
    if (carga.estado === 'carregando') {
      return <EsqueletoEstatisticas />;
    }

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar suas estatísticas"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    // Nunca treinou no Solo: um painel e nada mais. Seis zeros e uma tabela
    // vazia não diriam nada a quem ainda não começou.
    if (sessoes.length === 0) {
      return (
        <PainelEstado
          titulo="Sua campanha começa na primeira lição"
          texto="Cada lição concluída rende XP, o XP sobe de nível, e tudo o que você fizer aparece aqui: suas melhores marcas, sua sequência de dias e sua evolução."
        >
          <a className="btn btn-solido tecla tecla-clara" href={ROTA_CAMINHO}>
            Começar a primeira lição
          </a>
        </PainelEstado>
      );
    }

    const { campanha, estatisticas } = carga;
    const progresso = progressoDe(campanha);

    return (
      <>
        <h2 className="secao-rotulo">Sua campanha</h2>

        {/* Seis números em dois grupos de três: o que a campanha diz
            (nível, XP, lições) e o que as sessões dizem (marcas e
            sequência). Rótulo mono pequeno, número mono grande com
            tabular-nums — a mesma receita do dado em todo o projeto. */}
        <div className="estatisticas-numeros">
          <div className="estatisticas-grupo">
            <Numero rotulo="Nível" id="metrica-nivel" valor={contagem(campanha.nivelAtual)} />
            <Numero rotulo="XP total" id="metrica-xp" valor={contagem(campanha.xpTotal)} />
            <Numero
              rotulo="Lições concluídas"
              id="metrica-licoes"
              valor={contagem(estatisticas.licoesConcluidas)}
            />
          </div>
          <div className="estatisticas-grupo">
            <Numero rotulo="Melhor PPM" id="metrica-melhor-ppm" valor={numero(estatisticas.melhorWpm)} />
            <Numero
              rotulo="Melhor precisão"
              id="metrica-melhor-precisao"
              valor={porcentagem(estatisticas.melhorPrecisao)}
            />
            <Numero
              rotulo="Sequência"
              id="metrica-sequencia"
              valor={contagem(sequencia)}
              unidade={sequencia === 1 ? 'dia' : 'dias'}
            />
          </div>
        </div>

        {/* A barra do lobby, com quanto falta: a regra do XP é a de
            CONFIG.SOLO, dentro de progressoDe(). */}
        <div className="estatisticas-xp">
          <BarraXp progresso={progresso} />
        </div>

        <p className="estatisticas-evolucao" id="evolucao">
          {textoDaEvolucao(evolucao)}
        </p>

        <h2 className="secao-rotulo">Desempenho por lição</h2>

        <div className="estatisticas-filtro">
          <label htmlFor="filtro-nivel">Nível</label>
          <select
            className="seletor"
            id="filtro-nivel"
            value={nivelFiltrado == null ? TODOS : String(nivelFiltrado)}
            onChange={(evento) => selecionarNivel(evento.target.value)}
          >
            <option value={TODOS}>Todos</option>
            {niveis.map((n) => (
              <option key={n} value={String(n)}>
                Nível {n}
              </option>
            ))}
          </select>
        </div>

        {/* A linha discreta que diz o que o filtro alcança. Sem filtro ela
            não existe: o padrão não precisa de aviso. */}
        {nivelFiltrado != null && (
          <p className="estatisticas-nota">
            A tabela mostra só o nível {nivelFiltrado}; os números acima continuam sendo da campanha
            inteira.
          </p>
        )}

        <Tabela
          colunas={colunas}
          linhas={visiveis}
          chave={(l) => l.exerciseId}
          ordenacao={ordenacao}
          aoOrdenar={setOrdenacao}
        />
      </>
    );
  }

  return (
    <section className="painel vidro estatisticas" aria-labelledby="titulo">
      <a className="voltar" href={ROTA_LOBBY}>
        <span className="voltar-seta" aria-hidden="true">
          ←
        </span>
        Solo
      </a>

      <header className="cabecalho">
        <div>
          <p className="rotulo">Modo · Solo</p>
          <h1 className="titulo" id="titulo">
            Estatísticas
          </h1>
          <p className="subtitulo" id="subtitulo">
            {usuario.nome ?? sessao.nomeExibicao()}
          </p>
        </div>
        <button type="button" className="btn-sair vidro tecla" id="btn-sair" onClick={() => guarda.sair()}>
          Sair
        </button>
      </header>

      {renderizarCorpo()}
    </section>
  );
}

// ============================================================================
// Um dos seis números
// ============================================================================

interface PropsNumero {
  rotulo: string;
  id: string;
  valor: string;
  /** "dias", ao lado do número: o número continua sendo o número. */
  unidade?: string;
}

function Numero({ rotulo, id, valor, unidade }: PropsNumero) {
  return (
    <div className="estatisticas-metrica">
      <span className="estatisticas-metrica-rotulo">{rotulo}</span>
      <span className="estatisticas-metrica-valor" id={id}>
        {valor}
        {unidade && <span className="estatisticas-metrica-unidade">{unidade}</span>}
      </span>
    </div>
  );
}

// ============================================================================
// Esqueleto — a altura do conteúdo final
// ============================================================================
// Na ordem do painel pronto: rótulo de seção, os seis números em dois
// grupos, a barra de XP com legenda, a linha de evolução, outro rótulo, o
// filtro e a tabela. Quando os dados chegam, nada pula.

function EsqueletoEstatisticas() {
  return (
    <div className="estatisticas-esqueleto" aria-hidden="true">
      <div className="estatisticas-esqueleto-rotulo" />
      <div className="estatisticas-numeros">
        {[0, 1].map((grupo) => (
          <div key={grupo} className="estatisticas-grupo">
            {[0, 1, 2].map((i) => (
              <div key={i} className="estatisticas-esqueleto-metrica" />
            ))}
          </div>
        ))}
      </div>
      <div className="estatisticas-esqueleto-barra" />
      <div className="estatisticas-esqueleto-linha" />
      <div className="estatisticas-esqueleto-rotulo" />
      <div className="estatisticas-esqueleto-filtro" />
      <EsqueletoTabela quantidade={ESQUELETOS_LINHA} />
    </div>
  );
}

// ============================================================================
// Evolução — a frase é desta tela; a conta é de utils/desempenho.ts
// ============================================================================
// Tom de progressão, não de boletim: melhorou, diz quanto; manteve, fala de
// constância. Nunca diz que caiu.

function textoDaEvolucao(evolucao: Evolucao): string {
  if (evolucao.tipo === 'insuficiente') {
    return `Continue treinando: a partir de ${JANELA_EVOLUCAO + 1} sessões, sua evolução aparece aqui.`;
  }
  if (evolucao.tipo === 'melhorou') {
    return `Suas últimas ${JANELA_EVOLUCAO} sessões estão ${formatarDecimal(evolucao.diferenca)} PPM mais rápidas que as ${JANELA_EVOLUCAO} anteriores.`;
  }
  return 'Seu ritmo se manteve nas últimas sessões — o próximo nível vem com a constância.';
}

// ============================================================================
// Ordenação — o que cada campo vale numa linha (a regra é a de utils/ordenacao.ts)
// ============================================================================

function valorOrdenavel(licao: DesempenhoLicaoSolo, campo: string): string | number | null {
  if (campo === 'titulo') return licao.titulo;
  if (campo === 'nivel') return licao.nivel;
  if (campo === 'tentativas') return licao.tentativas;
  if (campo === 'melhorWpm') return licao.melhorWpm;
  if (campo === 'melhorPrecisao') return licao.melhorPrecisao;
  // A data crua, não a formatada: 'AAAA-MM-DD...' ordena como texto, e
  // 'DD/MM/AAAA' ordenaria por dia do mês.
  if (campo === 'ultimaVez') return licao.ultimaVez;
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
  // 403 nestas rotas quer dizer que o token não é de conta individual.
  if (erro.status === 403) return MENSAGENS.PERMISSAO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de conta antes de montar (e grava o modo solo). Devolveu null, redirecionou:
// a tela para aqui e nada mais roda.
const usuario = guarda.soConta('solo');

if (usuario) {
  if (!sessao.campanhaAtiva()) {
    // Sem campanha não há estatística nenhuma. Vai para o lobby, que é quem
    // oferece começar. replace, e não href, pelo mesmo motivo do guarda.ts:
    // o botão voltar não devolve a pessoa para esta tela vazia.
    window.location.replace(ROTA_LOBBY);
  } else {
    guarda.aplicarMundo();
    ativarSaidaAoNavegar();
    createRoot(document.getElementById('raiz')).render(<Estatisticas usuario={usuario} />);
  }
}
