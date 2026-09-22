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
//   2. com campanha — nível, barra de XP e o botão de continuar.
// Quem decide qual é GET /solo/campanha: ele devolve null quando não há
// campanha, e null aqui é ESTADO, não falha (ver api.solo.campanhaAtual).
//
// Nada de personagem é inventado nesta tela: nem campo no formulário (não
// há formulário), nem chave no localStorage. O que fica guardado é o id da
// campanha, pelo sessao.definirCampanha(), porque campanhas.html e a tela
// de treino precisam dele — e id é coluna, existe no banco.
//
// Mesmo desenho de Campanhas.tsx e Dashboard.tsx: o painel de vidro com
// .cabecalho (rótulo, título, subtítulo e "Sair"). O que é só daqui — a
// barra de XP, o convite e o esqueleto — mora em css/solo.css.

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { Campanha, ErroDaApi } from '../nucleo/tipos.js';
import { PainelErro } from '../componentes/PainelErro.js';
import { BarraXp, progressoDe } from '../componentes/BarraXp.js';

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
// ver a nota lá.

// ============================================================================
// Esqueleto — a altura do painel final
// ============================================================================

// Os blocos têm a altura das peças que vão ocupar o lugar deles (nível,
// barra, legenda e botão), na mesma ordem: quando a campanha chega, nada
// pula. A medida é a do painel COM campanha, que é o caso de quem volta —
// o convite da primeira vez acontece uma única vez por conta.
function EsqueletoLobby() {
  return (
    <div className="lobby-esqueleto" aria-hidden="true">
      <div className="lobby-esqueleto-nivel" />
      <div className="lobby-esqueleto-barra" />
      <div className="lobby-esqueleto-legenda" />
      <div className="lobby-esqueleto-acao" />
    </div>
  );
}

// ============================================================================
// Estado da tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  // null é o estado 1 (ainda não começou), não um erro disfarçado.
  | { estado: 'pronto'; campanha: Campanha | null };

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
        const campanha = (await api.solo.campanhaAtual()) ?? null;
        if (cancelado) return;

        // O id da campanha vai para a sessão porque campanhas.html e a tela
        // de treino leem dela. Sem campanha, a chave é limpa: um id velho
        // (campanha apagada, outra conta no mesmo navegador) mandaria a
        // tela de missões pedir uma campanha que não existe mais.
        sessao.atualizarUsuario({ campanhaAtiva: campanha?.campanhaId ?? null });

        setCarga({ estado: 'pronto', campanha });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

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
      return <EsqueletoLobby />;
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
    if (carga.campanha == null) {
      return (
        <div className="lobby-convite">
          <h2 className="lobby-convite-titulo">Sua campanha começa aqui</h2>
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
        </div>
      );
    }

    // --- estado 2: já começou ---
    const progresso = progressoDe(carga.campanha);

    return (
      <div className="lobby-progresso">
        <p className="lobby-nivel">
          <span className="lobby-nivel-rotulo">Nível</span>
          <span className="lobby-nivel-valor">{progresso.nivel}</span>
        </p>

        <BarraXp progresso={progresso} />

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
    );
  }

  return (
    <section className="painel vidro lobby" aria-labelledby="titulo">
      <header className="cabecalho">
        <div>
          <p className="rotulo">Modo · Solo</p>
          <h1 className="titulo" id="titulo">
            Solo
          </h1>
          <p className="subtitulo" id="subtitulo">
            {nome}
          </p>
        </div>
        <div className="cabecalho-acoes">
          {/* Troca de modo: a mesma conta abre o Professor. Sem logout,
              sem tela intermediária. */}
          <button
            type="button"
            className="btn-sair vidro"
            id="btn-trocar-modo"
            onClick={() => guarda.trocarModo('professor')}
          >
            Ir para Professor
          </button>
          <button type="button" className="btn-sair vidro" id="btn-sair" onClick={() => guarda.sair()}>
            Sair
          </button>
        </div>
      </header>

      {/* Sem aria-live neste invólucro: o PainelErro já é role="status" e
          se anuncia sozinho, e a barra de XP tem o próprio rótulo. Uma
          região viva por fora faria o leitor de tela ler a mesma coisa
          duas vezes. */}
      <div className="lobby-corpo">{renderizarCorpo()}</div>
    </section>
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
  createRoot(document.getElementById('raiz')).render(<Lobby />);
}
