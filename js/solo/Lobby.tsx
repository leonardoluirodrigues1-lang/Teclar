// Lobby.tsx — pages/solo/dashboard.html
// O dashboard do Solo. Deixou de ser a casa do modo (ROTA_INICIAL em
// js/config.ts agora é o caminho): chega-se aqui pelo botão da pessoa, no
// topo do caminho, e é para cá que o caminho manda quem ainda não tem
// campanha.
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
// campanha, pelo sessao.definirCampanha(), porque caminho.html e a tela
// de treino precisam dele — e id é coluna, existe no banco.
//
// O DESENHO é o do frame "06 — B+C: Solo · Lobby": nav em pílula de vidro
// no topo, duas colunas de altura igual e, abaixo, a faixa "continuar de
// onde parou" e o rodapé com a linha-guia do teclado.
//   · painel do personagem — o anel de XP em volta do número do nível, o
//     nome com o XP ao lado e três métricas (melhor PPM, precisão média,
//     lições concluídas);
//   · painel da sequência  — os sete dias e, embaixo, o ritmo das últimas
//     12 sessões em barrinhas;
//   · faixa                — a próxima lição, com a mesma regra do botão
//     pedra acesa de caminho.html (utils/percurso.ts);
//   · rodapé               — a linha-guia e o link para as lições.
// A grade de missões que o desenho traz NÃO mora aqui: as lições vivem em
// caminho.html, um nível por vez.
//
// De onde vem cada dado (todas rotas que já existiam; nenhuma nova):
//   · campanha      — GET /solo/campanha: nível e XP. É a única que manda:
//                     se ela falhar, a tela é erro;
//   · histórico     — GET /solo/historico: sequência, ritmo e onde parou;
//   · estatísticas  — GET /solo/estatisticas (a da tela de estatísticas):
//                     melhor PPM e lições concluídas;
//   · indicadores   — GET /solo/indicadores: a precisão MÉDIA. Ela não está
//                     em /solo/estatisticas (lá só há a melhor precisão), e
//                     o front não calcula média — quem faz a conta é o back;
//   · lições        — GET /solo/missoes: nome, nível, repetições e tempo da
//                     próxima lição, e a contagem do rodapé.
// As quatro últimas são enfeite útil: cada uma que falhar vira null e só a
// parte dela some (ou vira "—"), e o resto da tela abre.
//
// Uma coisa do desenho não sobrevive ao banco: o "Campanha iniciada em 2
// de setembro". A tabela CampanhasSolo não tem data de criação, e inventar
// uma aqui seria escrever na tela um dado que não existe.

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type {
  Campanha,
  ErroDaApi,
  EstatisticasSolo,
  IndicadoresSolo,
  Missao,
  SessaoSolo,
} from '../nucleo/tipos.js';
import { PainelErro } from '../componentes/PainelErro.js';
import { progressoDe, type ProgressoXp } from '../componentes/BarraXp.js';
import { MolduraSolo } from '../componentes/MolduraSolo.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import {
  maisRecentesPrimeiro,
  semanaDeDias,
  sequenciaDeDias,
  type DiaDaSemana,
} from '../utils/desempenho.js';
import {
  ordemDoPercurso,
  progressoDoPercurso,
  textoDoBotao,
  type ProgressoDoPercurso,
} from '../utils/percurso.js';
import { contagem, numero, porcentagem } from '../utils/formato.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// O caminho das lições, vizinho desta em pages/solo/. Caminho relativo: as
// duas moram na mesma pasta.
const ROTA_CAMINHO = 'caminho.html';
// A tela de estatísticas, também vizinha. Chega-se a ela só por aqui.
const ROTA_ESTATISTICAS = 'estatisticas.html';

// Quantas sessões o gráfico de ritmo mostra, e a partir de quantas ele
// aparece: com duas barrinhas não há ritmo nenhum para ler.
const SESSOES_NO_RITMO = 12;
const MINIMO_PARA_O_RITMO = 3;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Esta é a área da conta individual, e a sessão atual não tem acesso a ela. Entre de novo.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// ============================================================================
// XP — a regra é a do config, não uma segunda conta feita aqui
// ============================================================================
// progressoDe() mora em componentes/BarraXp.tsx e é a mesma conta que a
// barra das outras telas usa. Aqui o progresso vira ANEL em vez de barra;
// a <BarraXp> continua existindo para estatisticas.html.
// O NÍVEL continua vindo pronto na campanha (campanha.nivelAtual), como o
// back o gravou — ver a nota em BarraXp.tsx.

// Medidas do anel, no sistema de coordenadas do SVG (viewBox 0 0 100 100).
const ANEL_CENTRO = 50;
const ANEL_RAIO = 44;
const ANEL_CIRCUNFERENCIA = 2 * Math.PI * ANEL_RAIO;

// Onde fica a ponta acesa do arco. O arco começa no topo (12 horas) e anda
// no sentido do relógio; o ângulo sai da fração percorrida do nível.
function pontaDoAnel(percentual: number): { x: number; y: number } {
  const angulo = (percentual / 100) * 2 * Math.PI;
  return {
    x: ANEL_CENTRO + ANEL_RAIO * Math.sin(angulo),
    y: ANEL_CENTRO - ANEL_RAIO * Math.cos(angulo),
  };
}

function AnelXp({ progresso }: { progresso: ProgressoXp }) {
  // stroke-dasharray = a volta inteira; o dashoffset esconde a parte que
  // falta. Com 0%, o offset é a volta inteira e nada é pintado.
  const falta = ANEL_CIRCUNFERENCIA * (1 - progresso.percentual / 100);
  const ponta = pontaDoAnel(progresso.percentual);

  return (
    // Os mesmos atributos de progressbar da <BarraXp>: quem ouve a tela
    // recebe "69 de 200 XP", o número que está escrito ao lado do nome.
    <div
      className="lobby-anel"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progresso.porNivel}
      aria-valuenow={progresso.noNivel}
      aria-valuetext={`${progresso.noNivel} de ${progresso.porNivel} XP`}
      aria-label={`Progresso para o nível ${progresso.nivel + 1}`}
    >
      <svg className="lobby-anel-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          {/* Do canto inferior esquerdo (fraco) para o superior direito
              (forte): é de lá que vem a luz da tela (css/base/luz.css).
              userSpaceOnUse: com o padrão (objectBoundingBox) a direção
              seguiria a caixa do arco, que gira junto com o rotate. */}
          <linearGradient
            id="lobby-anel-gradiente"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="100"
            x2="100"
            y2="0"
          >
            <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle className="lobby-anel-trilho" cx={ANEL_CENTRO} cy={ANEL_CENTRO} r={ANEL_RAIO} />
        {/* O círculo do SVG começa às 3 horas; o anel começa às 12, como
            um relógio. Por isso o arco é um <path> que já nasce no topo, e
            não um <circle> girado — girar levaria o degradê junto. */}
        <path
          className="lobby-anel-arco"
          d={`M ${ANEL_CENTRO} ${ANEL_CENTRO - ANEL_RAIO} a ${ANEL_RAIO} ${ANEL_RAIO} 0 1 1 0 ${2 * ANEL_RAIO} a ${ANEL_RAIO} ${ANEL_RAIO} 0 1 1 0 ${-2 * ANEL_RAIO}`}
          stroke="url(#lobby-anel-gradiente)"
          strokeDasharray={ANEL_CIRCUNFERENCIA}
          strokeDashoffset={falta}
        />
        {/* O brilho na ponta acesa. Com 0% não há arco, e portanto não há
            ponta para acender. */}
        {progresso.percentual > 0 && (
          <circle className="lobby-anel-ponta" cx={ponta.x} cy={ponta.y} r="3.5" />
        )}
      </svg>
      <span className="lobby-anel-nivel">
        <b>{progresso.nivel}</b>
        <span>Nível</span>
      </span>
    </div>
  );
}

// ============================================================================
// Esqueleto — a altura dos painéis finais
// ============================================================================

// Os dois painéis e a faixa já ocupam o lugar que terão: quando a
// campanha chega, nada pula. A medida é a do estado COM campanha, que é o
// caso de quem volta — o convite da primeira vez acontece uma única vez
// por conta.
function EsbocoLobby() {
  return (
    <div aria-hidden="true">
      <div className="lobby-topo">
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
      <div className="painel vidro lobby-esboco-faixa" />
    </div>
  );
}

// ============================================================================
// Painel do personagem
// ============================================================================

interface PropsMetrica {
  rotulo: string;
  valor: string;
}

// Uma das três métricas: número grande em mono, rótulo mono miúdo embaixo.
function Metrica({ rotulo, valor }: PropsMetrica) {
  return (
    <div className="lobby-metrica">
      <span className="lobby-metrica-valor">{valor}</span>
      <span className="lobby-metrica-rotulo">{rotulo}</span>
    </div>
  );
}

interface PropsPersonagem {
  nome: string;
  campanha: Campanha;
  // null = a rota falhou; a métrica dela mostra "—".
  estatisticas: EstatisticasSolo | null;
  indicadores: IndicadoresSolo | null;
}

function PainelPersonagem({ nome, campanha, estatisticas, indicadores }: PropsPersonagem) {
  const progresso = progressoDe(campanha);

  return (
    <article className="painel vidro lobby-personagem">
      <AnelXp progresso={progresso} />

      <div className="lobby-identidade">
        <h1 className="lobby-nome">{nome}</h1>
        {/* aria-hidden: o anel já diz isto a quem ouve a tela. */}
        <p className="lobby-xp-texto" aria-hidden="true">
          <strong>{progresso.noNivel}</strong> / {progresso.porNivel} XP · faltam {progresso.falta}
        </p>
      </div>

      {/* numero(), porcentagem() e contagem() já escrevem "—" quando o
          valor é null — inclusive quando a rota inteira falhou. */}
      <div className="lobby-metricas">
        <Metrica rotulo="Melhor PPM" valor={numero(estatisticas?.melhorWpm)} />
        <Metrica rotulo="Precisão média" valor={porcentagem(indicadores?.precisaoMedia)} />
        <Metrica rotulo="Lições concluídas" valor={contagem(estatisticas?.licoesConcluidas)} />
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

// Cada dia é uma tecla (css/base/luz.css): clara quando treinou — a
// tecla acesa é o que faz a sequência ser lida de relance —, escura nos
// outros dias.
function classeDoQuadrado(dia: DiaDaSemana): string {
  let classe = 'lobby-quad tecla';
  if (dia.treinou) {
    classe += ' lobby-quad-cheio tecla-clara';
  }
  if (dia.futuro) {
    classe += ' lobby-quad-futuro';
  }
  return classe;
}

// As últimas sessões, da mais antiga para a mais recente: no gráfico o
// tempo anda da esquerda para a direita, e a última fica na ponta.
function sessoesDoRitmo(sessoes: SessaoSolo[]): SessaoSolo[] {
  return maisRecentesPrimeiro(sessoes).slice(0, SESSOES_NO_RITMO).reverse();
}

// O ritmo: uma barrinha por sessão, altura proporcional ao PPM. A mais alta
// do trecho vale 100%; as outras, a fração dela.
function GraficoRitmo({ sessoes }: { sessoes: SessaoSolo[] }) {
  const recentes = sessoesDoRitmo(sessoes);
  if (recentes.length < MINIMO_PARA_O_RITMO) return null;

  // Math.max(1, ...) para um trecho todo em 0 PPM não dividir por zero.
  const maior = Math.max(1, ...recentes.map((s) => s.wpm));
  const ultima = recentes.length - 1;
  const numeros = recentes.map((s) => numero(s.wpm)).join(', ');
  const descricao = `PPM das últimas ${recentes.length} sessões, da mais antiga para a mais recente: ${numeros}`;

  return (
    <div className="lobby-ritmo">
      <span className="lobby-rotulo">Ritmo</span>
      {/* role="img" com a lista de números: as barrinhas são desenho, e o
          que elas dizem vai inteiro no rótulo. */}
      <div className="lobby-ritmo-barras" role="img" aria-label={descricao}>
        {recentes.map((sessao, i) => (
          <span
            key={sessao.id}
            className={'lobby-ritmo-barra' + (i === ultima ? ' lobby-ritmo-barra-acesa' : '')}
            style={{ height: `${(sessao.wpm / maior) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

interface PropsSequencia {
  dias: DiaDaSemana[];
  sequencia: number;
  sessoes: SessaoSolo[];
}

function PainelSequencia({ dias, sequencia, sessoes }: PropsSequencia) {
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
            <span className={classeDoQuadrado(dia)} aria-hidden="true" />
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

      <GraficoRitmo sessoes={sessoes} />
    </article>
  );
}

// ============================================================================
// Faixa "continuar de onde parou"
// ============================================================================
// Qual lição e qual verbo (Continuar / Começar / Repetir a última) vêm de
// utils/percurso.ts — a mesma regra da pedra acesa de caminho.html, então as
// duas telas sempre apontam para a mesma lição com o mesmo texto.

// O mesmo endereço que a pedra da lição usa em caminho.html.
function hrefDoTreino(licao: Missao): string {
  return `../treino/treino.html?${new URLSearchParams({ exercicio: licao.exerciseId })}`;
}

// 186 -> '3:06'. Segundos sempre com dois dígitos.
function tempoEmMinutos(segundos: number): string {
  const total = Math.max(0, Math.round(segundos ?? 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function FaixaContinuar({ progresso }: { progresso: ProgressoDoPercurso | null }) {
  // Sem lições ou sem histórico não dá para saber a próxima. A faixa fica,
  // com o botão levando às lições — que é o que o lobby sempre fez.
  if (progresso == null) {
    return (
      <section className="painel vidro lobby-faixa" aria-label="Continuar">
        <div className="lobby-faixa-texto">
          <span className="lobby-rotulo">Continuar de onde parou</span>
          <p className="lobby-faixa-titulo">Suas lições</p>
        </div>
        <a className="btn btn-solido tecla tecla-clara lobby-faixa-acao" href={ROTA_CAMINHO}>
          Continuar
        </a>
      </section>
    );
  }

  const { licao } = progresso.proxima;
  const nuncaTreinou = progresso.ultimaFeita == null;
  const tempo = tempoEmMinutos(licao.tempoLimiteSegundos);
  return (
    <section className="painel vidro lobby-faixa" aria-label="Continuar de onde parou">
      <div className="lobby-faixa-texto">
        <span className="lobby-rotulo">
          {nuncaTreinou ? 'Sua primeira lição' : 'Continuar de onde parou'}
        </span>
        <p className="lobby-faixa-titulo">{licao.titulo}</p>
        <ul className="lobby-pilulas">
          <li className="lobby-pilula">Nível {licao.nivel}</li>
          {/* O aria-label existe porque "10×" lido em voz alta vira "dez ex". */}
          <li className="lobby-pilula" aria-label={`${licao.repeticoes} repetições`}>
            {licao.repeticoes}×
          </li>
          <li className="lobby-pilula" aria-label={`Tempo: ${tempo}`}>
            {tempo}
          </li>
        </ul>
      </div>
      <a className="btn btn-solido tecla tecla-clara lobby-faixa-acao" href={hrefDoTreino(licao)}>
        {textoDoBotao(progresso)}
      </a>
    </section>
  );
}

// ============================================================================
// Rodapé — a linha-guia do teclado
// ============================================================================
// A linha acende no meio e tem a marca central, como o relevo das teclas F
// e J. Embaixo, a fileira de casa à esquerda e a contagem de lições à
// direita, que leva a elas.

function RodapeLinhaGuia({ licoes }: { licoes: Missao[] | null }) {
  let textoDoLink = 'Lições';
  if (licoes != null) {
    textoDoLink = `${licoes.length} ${licoes.length === 1 ? 'lição' : 'lições'}`;
  }

  return (
    <footer className="lobby-guia">
      <div className="lobby-guia-linha" aria-hidden="true">
        <span className="lobby-guia-marca" />
      </div>
      <div className="lobby-guia-legenda">
        <span className="lobby-guia-casa" aria-hidden="true">
          asdf jklç
        </span>
        <a className="lobby-guia-link" href={ROTA_CAMINHO}>
          {textoDoLink}
        </a>
      </div>
    </footer>
  );
}

// ============================================================================
// Estado da tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  // null é o estado 1 (ainda não começou), não um erro disfarçado.
  // Os outros quatro são null quando a rota deles falhou: só a parte que
  // eles alimentam some (ou vira "—"), e o resto da tela continua de pé.
  | {
      estado: 'pronto';
      campanha: Campanha | null;
      sessoes: SessaoSolo[] | null;
      estatisticas: EstatisticasSolo | null;
      indicadores: IndicadoresSolo | null;
      licoes: Missao[] | null;
    };

// A rede de segurança das rotas que não mandam na tela: se a chamada
// falhar, o erro vai para o console e o valor vira null, em vez de
// derrubar o Promise.all inteiro.
function nullSeFalhar<T>(promessa: Promise<T>): Promise<T | null> {
  return promessa.catch((excecao) => {
    console.error(excecao);
    return null;
  });
}

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
        // Todas juntas, e a campanha manda: sem ela não há o que mostrar.
        // As outras vêm no mesmo ida-e-volta, cada uma com a própria rede de
        // segurança (nullSeFalhar) — elas alimentam partes da tela, e uma
        // falha numa delas não pode derrubar a tela inteira. Sem campanha,
        // as quatro respondem 404 (a campanha é a do token) e viram null,
        // que o estado 1 nem olha.
        const [campanha, sessoes, estatisticas, indicadores, licoes] = await Promise.all([
          api.solo.campanhaAtual(),
          nullSeFalhar(api.solo.historico().then((historico) => desembrulhar<SessaoSolo>(historico))),
          nullSeFalhar(api.solo.estatisticas()),
          nullSeFalhar(api.solo.indicadores()),
          nullSeFalhar(api.solo.missoes().then((missoes) => desembrulhar<Missao>(missoes))),
        ]);
        if (cancelado) return;

        // O id da campanha vai para a sessão porque caminho.html e a tela
        // de treino leem dela. Sem campanha, a chave é limpa: um id velho
        // (campanha apagada, outra conta no mesmo navegador) mandaria a
        // tela de missões pedir uma campanha que não existe mais.
        sessao.atualizarUsuario({ campanhaAtiva: campanha?.campanhaId ?? null });

        setCarga({
          estado: 'pronto',
          campanha: campanha ?? null,
          sessoes,
          estatisticas,
          indicadores,
          licoes,
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

  const sessoes = carga.estado === 'pronto' ? carga.sessoes : null;
  const dias = useMemo(() => (sessoes == null ? null : semanaDeDias(sessoes)), [sessoes]);
  const sequencia = useMemo(() => (sessoes == null ? 0 : sequenciaDeDias(sessoes)), [sessoes]);
  const licoes = carga.estado === 'pronto' ? carga.licoes : null;
  // Sem lições ou sem histórico não há como saber a próxima: null, e a
  // faixa mostra só o caminho para as lições.
  const progresso = useMemo(
    () => (licoes == null || sessoes == null ? null : progressoDoPercurso(ordemDoPercurso(licoes), sessoes)),
    [licoes, sessoes]
  );

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
      // Sai do lobby direto para o caminho. O botão fica em "criando…"
      // até a navegação acontecer: soltá-lo aqui piscaria "Começar
      // campanha" de novo numa tela que já está indo embora.
      window.location.href = ROTA_CAMINHO;
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
              className="btn btn-solido tecla tecla-clara lobby-acao"
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
          <PainelPersonagem
            nome={nome}
            campanha={carga.campanha}
            estatisticas={carga.estatisticas}
            indicadores={carga.indicadores}
          />
          {/* Histórico falhou: o painel some (e o ritmo com ele) e o do
              personagem ocupa a largura toda. Nenhum aviso — a tela não
              deve nada aqui. */}
          {dias && sessoes && <PainelSequencia dias={dias} sequencia={sequencia} sessoes={sessoes} />}
        </div>

        <FaixaContinuar progresso={progresso} />

        <RodapeLinhaGuia licoes={licoes} />
      </>
    );
  }

  return (
    // A moldura do Solo no lugar da nav em pílula. Nenhum item da barra
    // lateral fica marcado: o dashboard não está nela, chega-se aqui pelo
    // botão da pessoa, no topo.
    <MolduraSolo ativo={null}>
      <div className="lobby-pagina">
        <nav className="lobby-caminhos" aria-label="Voltar ou ver mais">
          <a className="lobby-caminhos-link" href={ROTA_CAMINHO}>
            <span aria-hidden="true">←</span> Voltar ao caminho
          </a>
          <a className="lobby-caminhos-link" href={ROTA_ESTATISTICAS}>
            Estatísticas <span aria-hidden="true">→</span>
          </a>
        </nav>

        {/* Sem aria-live neste invólucro: o PainelErro já é role="status" e
            se anuncia sozinho, e o anel de XP tem o próprio rótulo. Uma
            região viva por fora faria o leitor de tela ler a mesma coisa
            duas vezes. */}
        <main className="lobby-conteudo">{renderizarCorpo()}</main>
      </div>
    </MolduraSolo>
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
// ao contrário de caminho.html: ela é o destino de quem não tem.
const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Lobby />);
}
