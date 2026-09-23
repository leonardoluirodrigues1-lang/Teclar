// Lobby.tsx — pages/solo/dashboard.html
// A porta de entrada do mundo Solo, e a casa da conta em modo solo (ver
// ROTA_INICIAL em js/config.ts).
//
// O lobby NÃO é uma lista de campanhas, e isso vem do banco, não de gosto:
// a tabela CampanhasSolo tem quatro colunas — CampanhaID, JogadorID,
// NivelAtual e XPTotal. Sem nome de personagem, sem avatar, sem nome de
// campanha e sem data de criação, duas campanhas do mesmo jogador
// apareceriam na tela como duas linhas idênticas, e escolher entre elas
// seria adivinhação. Então o jogador tem UMA campanha, e esta tela é a
// porta dela.
//
// Dois estados, e a tela mostra um só:
//   1. sem campanha — primeira vez no Solo: o convite e o botão que cria.
//   2. com campanha — o painel do personagem, a sequência e o botão.
// Quem decide qual é GET /solo/campanha: ele devolve null quando não há
// campanha, e null aqui é ESTADO, não falha (ver api.solo.campanhaAtual).
//
// Nada de personagem é inventado nesta tela: nem campo no formulário (não
// há formulário), nem chave no localStorage. O que fica guardado é o id da
// campanha, pelo sessao.definirCampanha(), porque campanhas.html e a tela
// de treino precisam dele — e id é coluna, existe no banco.
//
// O DESENHO é o do painel da campanha: nav em pílula de vidro no topo,
// duas colunas de altura igual (personagem à esquerda, sequência à
// direita) e, abaixo, a ação. A grade de missões que o desenho traz NÃO
// mora aqui: as lições vivem em campanhas.html, agrupadas por nível. O
// lugar delas é ocupado pelo que o lobby sempre fez — o botão grande e os
// dois atalhos —, com a lógica intacta e só o acabamento novo.
//
// Uma coisa do desenho não sobrevive ao banco: o "Campanha iniciada em 2
// de setembro". A tabela CampanhasSolo não tem data de criação, e inventar
// uma aqui seria escrever na tela um dado que não existe.

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { Campanha, ErroDaApi, SessaoSolo } from '../nucleo/tipos.js';
import { PainelErro } from '../componentes/PainelErro.js';
import { BarraXp, progressoDe } from '../componentes/BarraXp.js';
import { Nav, SECOES_SOLO } from '../componentes/Nav.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { semanaDeDias, sequenciaDeDias, type DiaDaSemana } from '../utils/desempenho.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// A tela de missões, vizinha desta em pages/solo/. Caminho relativo: as
// duas moram na mesma pasta.
const ROTA_MISSOES = 'campanhas.html';
// A tela de estatísticas (js/solo/Estatisticas.tsx), vizinha desta.
const ROTA_ESTATISTICAS = 'estatisticas.html';

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Esta é a área da conta individual, e a sessão atual não tem acesso a ela. Entre de novo.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// ============================================================================
// XP — a regra é a do config, não uma segunda conta feita aqui
// ============================================================================
// progressoDe() e a <BarraXp> moram em componentes/BarraXp.tsx desde que a
// tela de estatísticas passou a mostrar a mesma barra. O NÍVEL continua
// vindo pronto na campanha (campanha.nivelAtual), como o back o gravou —
// ver a nota lá. O painel do personagem usa a MESMA barra: o que muda é
// só onde a legenda dela aparece, e isso é css/solo.css, não outro
// componente.

// A inicial do retrato. Uma letra, como no desenho — a Nav usa duas no
// avatar dela, e as duas coisas continuam sendo o que já eram.
function inicial(nome: string): string {
  return nome.trim().slice(0, 1).toUpperCase();
}

// ============================================================================
// Esqueleto — a altura dos painéis finais
// ============================================================================

// Os dois painéis já ocupam o lugar que terão, na mesma grade: quando a
// campanha chega, nada pula. A medida é a do estado COM campanha, que é o
// caso de quem volta — o convite da primeira vez acontece uma única vez
// por conta.
function EsbocoLobby() {
  return (
    <div className="lobby-topo" aria-hidden="true">
      <article className="painel vidro lobby-esboco">
        <div className="lobby-esboco-retrato" />
        <div className="lobby-esboco-linhas">
          <div className="lobby-esboco-nome" />
          <div className="lobby-esboco-barra" />
        </div>
      </article>
      <article className="painel vidro lobby-esboco">
        <div className="lobby-esboco-rotulo" />
        <div className="lobby-esboco-dias" />
        <div className="lobby-esboco-frase" />
      </article>
    </div>
  );
}

// ============================================================================
// Painel do personagem
// ============================================================================

function PainelPersonagem({ nome, campanha }: { nome: string; campanha: Campanha }) {
  const progresso = progressoDe(campanha);

  return (
    <article className="painel vidro lobby-personagem">
      <div className="lobby-quem">
        <div className="lobby-retrato" aria-hidden="true">
          {inicial(nome)}
        </div>
        <div className="lobby-identidade">
          <div className="lobby-linha-nome">
            <h1 className="lobby-nome">{nome}</h1>
            <span className="lobby-selo">Nível {progresso.nivel}</span>
          </div>
        </div>
      </div>

      {/* O rótulo e a barra dividem a mesma grade: a legenda que a
          <BarraXp> já escreve sobe para a direita do rótulo (ver
          .lobby-experiencia em css/solo.css). Nenhuma segunda barra, e
          nenhum segundo texto de XP. */}
      <div className="lobby-experiencia">
        <span className="lobby-rotulo">Experiência</span>
        <BarraXp progresso={progresso} />
      </div>
    </article>
  );
}

// ============================================================================
// Painel de sequência
// ============================================================================
// O dado não existe em tabela: sai das datas de GET /solo/historico, pela
// semanaDeDias() de utils/desempenho.ts — a mesma aritmética de dia que a
// sequência já usava. Se o histórico falhar, este painel simplesmente não
// é montado e o resto da tela abre normalmente: é a regra do Solo, e o
// lobby não vale menos sem os sete quadrados.

function fraseDaSequencia(sequencia: number): string {
  if (sequencia === 0) return 'Comece hoje.';
  if (sequencia === 1) return '1 dia seguido. Não quebre agora.';
  return `${sequencia} dias seguidos. Não quebre agora.`;
}

function PainelSequencia({ dias, sequencia }: { dias: DiaDaSemana[]; sequencia: number }) {
  return (
    <article className="painel vidro lobby-sequencia">
      <span className="lobby-rotulo">Sequência</span>

      {/* <ul> e não um monte de <div>: são sete itens de uma lista, e o
          leitor de tela anuncia quantos são. A letra embaixo do quadrado
          é ambígua de propósito no desenho (S T Q Q S S D), então cada
          item carrega o dia por extenso e o estado em texto só para quem
          ouve. */}
      <ul className="lobby-dias" aria-label="Seus dias de treino nesta semana">
        {dias.map((dia) => (
          <li className="lobby-dia" key={dia.dia}>
            <span
              className={
                'lobby-quad' + (dia.treinou ? ' lobby-quad-cheio' : '') + (dia.futuro ? ' lobby-quad-futuro' : '')
              }
              aria-hidden="true"
            />
            <b className="lobby-dia-inicial" aria-hidden="true">
              {dia.inicial}
            </b>
            <span className="sr-only">
              {dia.nome}: {dia.treinou ? 'treinou' : dia.futuro ? 'ainda não chegou' : 'sem treino'}
            </span>
          </li>
        ))}
      </ul>

      <p className="lobby-frase">{fraseDaSequencia(sequencia)}</p>
    </article>
  );
}

// ============================================================================
// Estado da tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  // null é o estado 1 (ainda não começou), não um erro disfarçado.
  // `sessoes` é null quando o histórico falhou: o painel de sequência some
  // e o resto da tela continua de pé.
  | { estado: 'pronto'; campanha: Campanha | null; sessoes: SessaoSolo[] | null };

function Lobby() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [criando, setCriando] = useState(false);
  const [falhaAoCriar, setFalhaAoCriar] = useState<string | null>(null);

  // Conta individual tem nome (a tabela Users tem a coluna); nomeExibicao()
  // ainda assim é o caminho certo, porque nunca devolve "undefined".
  const nome = sessao.nomeExibicao();

  // --- carregamento ---------------------------------------------------------

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        // As duas juntas, e a campanha manda: sem ela não há o que mostrar.
        // O histórico vem no mesmo ida-e-volta, mas com a própria rede de
        // segurança — ele alimenta só o painel de sequência, e uma falha
        // ali não pode derrubar a tela inteira. Por isso o catch local em
        // vez de deixar o Promise.all rejeitar por ele.
        const [campanha, sessoes] = await Promise.all([
          api.solo.campanhaAtual(),
          api.solo
            .historico()
            .then((historico) => desembrulhar(historico))
            .catch((excecao) => {
              console.error(excecao);
              return null;
            }),
        ]);
        if (cancelado) return;

        // O id da campanha vai para a sessão porque campanhas.html e a tela
        // de treino leem dela. Sem campanha, a chave é limpa: um id velho
        // (campanha apagada, outra conta no mesmo navegador) mandaria a
        // tela de missões pedir uma campanha que não existe mais.
        sessao.atualizarUsuario({ campanhaAtiva: campanha?.campanhaId ?? null });

        setCarga({ estado: 'pronto', campanha: campanha ?? null, sessoes });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const sessoes = carga.estado === 'pronto' ? carga.sessoes : null;
  const dias = useMemo(() => (sessoes == null ? null : semanaDeDias(sessoes)), [sessoes]);
  const sequencia = useMemo(() => (sessoes == null ? 0 : sequenciaDeDias(sessoes)), [sessoes]);

  // --- começar a campanha ---------------------------------------------------

  async function comecar() {
    // Clique duplo, Enter repetido, dois toques: o segundo não passa daqui.
    // O back também protege (quem já tem campanha recebe a que existe, e
    // nenhuma segunda nasce), mas a trava local evita a segunda requisição
    // antes de ela sair.
    if (criando) return;
    setCriando(true);
    setFalhaAoCriar(null);

    try {
      const campanha = await api.solo.criarCampanha();
      sessao.definirCampanha(campanha.campanhaId);
      // Sai do lobby direto para as missões. O botão fica em "criando…"
      // até a navegação acontecer: soltá-lo aqui piscaria "Começar
      // campanha" de novo numa tela que já está indo embora.
      window.location.href = ROTA_MISSOES;
    } catch (excecao) {
      // A falha não apaga o convite: o painel continua de pé, com o aviso
      // ao lado do botão e o botão clicável de novo. Trocar a tela inteira
      // por um painel de erro tiraria da frente justamente a única ação
      // que a pessoa veio fazer.
      setCriando(false);
      setFalhaAoCriar(mensagemDaFalha(excecao));
    }
  }

  // --- corpo ----------------------------------------------------------------

  function renderizarCorpo() {
    if (carga.estado === 'carregando') {
      return <EsbocoLobby />;
    }

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível abrir o Solo"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    // --- estado 1: ainda não começou ---
    // Painel único, o mesmo texto de sempre, no acabamento novo. Sem
    // sequência: não há campanha, e portanto não há histórico nenhum.
    if (carga.campanha == null) {
      return (
        <div className="lobby-topo lobby-topo-unico">
          <article className="painel vidro lobby-convite">
            <span className="lobby-rotulo">Modo · Solo</span>
            <h1 className="lobby-convite-titulo">Sua campanha começa aqui</h1>
            <p className="lobby-convite-texto">
              No Solo você treina no seu ritmo: cada missão concluída rende XP, o XP sobe de
              nível e o nível abre missões novas.
            </p>
            <button
              type="button"
              className="btn btn-solido lobby-acao"
              onClick={comecar}
              disabled={criando}
            >
              {criando ? 'Criando…' : 'Começar campanha'}
            </button>
            {falhaAoCriar && (
              <p className="lobby-falha" role="alert">
                {falhaAoCriar}
              </p>
            )}
          </article>
        </div>
      );
    }

    // --- estado 2: já começou ---
    return (
      <>
        <div className={'lobby-topo' + (dias == null ? ' lobby-topo-unico' : '')}>
          <PainelPersonagem nome={nome} campanha={carga.campanha} />
          {/* Histórico falhou: o painel some e o do personagem ocupa a
              largura toda. Nenhum aviso — a tela não deve nada aqui. */}
          {dias && <PainelSequencia dias={dias} sequencia={sequencia} />}
        </div>

        {/* A ação e os dois atalhos: mesma lógica de sempre. */}
        <div className="lobby-rodape">
          <a className="btn btn-solido lobby-acao" href={ROTA_MISSOES}>
            Continuar
          </a>

          <nav className="lobby-atalhos" aria-label="Mais do Solo">
            <a className="lobby-atalho" href={ROTA_ESTATISTICAS}>
              Estatísticas
            </a>
            <a className="lobby-atalho" href={ROTA_MISSOES}>
              Missões
            </a>
          </nav>
        </div>
      </>
    );
  }

  return (
    <>
      {/* A mesma Nav do mundo Escola, com as seções do Solo. Ela já traz o
          menu da conta — "Ir para o Professor" e "Sair" moram lá dentro,
          que é onde o desenho os coloca. */}
      <Nav secoes={SECOES_SOLO} ativo="campanha" />

      {/* Sem aria-live neste invólucro: o PainelErro já é role="status" e
          se anuncia sozinho, e a barra de XP tem o próprio rótulo. Uma
          região viva por fora faria o leitor de tela ler a mesma coisa
          duas vezes. */}
      <main className="lobby-conteudo">{renderizarCorpo()}</main>
    </>
  );
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
// a tela para aqui e nada mais roda. Esta tela não tem guarda de campanha,
// ao contrário de campanhas.html: ela é o destino de quem não tem.
const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Lobby />);
}
