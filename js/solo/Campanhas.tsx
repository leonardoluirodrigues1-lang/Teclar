// Campanhas.tsx — pages/solo/campanhas.html
// As 76 lições do Solo: o percurso inteiro que o professor escreveu.
//
// Esta tela ASSUME que a campanha existe. Quem trata a primeira vez no
// Solo é o lobby (pages/solo/dashboard.html, js/solo/Lobby.tsx): é lá que
// mora o convite de começar e o botão que cria a campanha. Aqui, sem
// campanha, a tela redireciona para o lobby antes de montar.
//
// Por que agrupar: 76 lições numa lista corrida são uma parede. O nível é
// o corte natural — é como o professor montou o percurso —, então cada
// nível vira um grupo com cabeçalho, e só um nasce aberto: o da última
// lição feita, para quem voltou continuar de onde parou; o Nível 1 para
// quem nunca treinou.
//
// O que o agrupamento NÃO é: cadeado. Não existe nível mínimo na tabela
// ExerciciosSolo e a conta não guarda progresso por lição — toda lição é
// clicável, inclusive as do nível 10 na primeira visita. Recolher é
// arrumação da tela; trancar seria regra de negócio que o banco não tem.
//
// Onde a pessoa parou vem do histórico da campanha (GET /solo/historico,
// escopado pelo token), carregado em paralelo com as missões: lição
// concluída = ao menos uma sessão com concluida true. Com isso a tela
// marca cada lição feita com um sinal discreto, conta as feitas no
// cabeçalho do grupo e oferece o botão "Continuar", que leva à próxima
// lição não concluída na ordem do percurso. O histórico é enfeite útil,
// não requisito: se ele falhar e as missões carregarem, a tela abre sem as
// marcas e sem o botão, em vez de mostrar erro. O mesmo vale para a
// campanha (nível e barra de XP): sem ela, o cabeçalho fica sem a barra.
//
// A lista deixou de ser desenhada por componentes/listaExercicios.ts (que
// o dashboard do aluno ainda usa): aquele módulo faz lista plana, com
// cadeado e sem cabeçalho de grupo. Aqui o React desenha direto, reusando
// as mesmas classes .lista/.item/.item-titulo/.item-meta de dashboard.css
// e acrescentando as de grupo e de acabamento em css/solo.css.

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { Campanha, ErroDaApi, Missao, SessaoSolo, Usuario } from '../nucleo/tipos.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { PainelErro } from '../componentes/PainelErro.js';
import { Nav, SECOES_SOLO } from '../componentes/Nav.js';
import { BarraXp, progressoDe } from '../componentes/BarraXp.js';
import { maisRecentesPrimeiro } from '../utils/desempenho.js';

// Vizinha desta em pages/solo/: caminho relativo.
const ROTA_LOBBY = 'dashboard.html';

// Os dez nomes de nível, os mesmos do título de cada lição. Ficam aqui
// porque o cabeçalho do grupo precisa deles e a listagem não manda o nome
// do nível — manda o número. Se um nível novo aparecer sem nome aqui, o
// cabeçalho escreve só "Nível N" em vez de quebrar.
const NOMES_DE_NIVEL: Record<number, string> = {
  1: 'Linha-guia',
  2: 'Fileiras e pontuação',
  3: 'Vocabulário real',
  4: 'Maiúsculas e frases',
  5: 'Números e valores',
  6: 'Símbolos e código',
  7: 'Texto profissional',
  8: 'Pangramas e acentuação',
  9: 'Parágrafos corporativos',
  10: 'Textos longos',
};

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Estas lições são da conta individual, e a sessão atual não tem acesso a elas. Entre de novo.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// Quantos grupos o esqueleto desenha. Dez, porque são dez níveis e o
// percurso é fixo: a altura do carregamento é a altura do conteúdo.
const ESQUELETOS_GRUPO = 10;

// ============================================================================
// Agrupamento
// ============================================================================

interface GrupoDeNivel {
  nivel: number;
  nome: string;
  licoes: Missao[];
}

// Agrupa por nível e ordena tudo por `ordem`, sem confiar na ordem em que
// a resposta chegou: os grupos saem na ordem do menor `ordem` de cada um
// (que é a ordem dos níveis no percurso), e as lições dentro do grupo em
// ordem crescente. O percurso do professor intercala — o nível 1 tem as
// lições 1 a 8 e também a 49 e a 50 —, então ordenar é o que junta as
// duas pontas no mesmo grupo, na sequência certa.
function agrupar(licoes: Missao[]): GrupoDeNivel[] {
  const porNivel = new Map<number, Missao[]>();
  for (const licao of licoes) {
    const lista = porNivel.get(licao.nivel);
    if (lista) lista.push(licao);
    else porNivel.set(licao.nivel, [licao]);
  }

  return [...porNivel.entries()]
    .map(([nivel, doNivel]) => ({
      nivel,
      nome: NOMES_DE_NIVEL[nivel] ?? '',
      licoes: [...doNivel].sort((a, b) => a.ordem - b.ordem),
    }))
    .sort((a, b) => a.licoes[0].ordem - b.licoes[0].ordem);
}

// 186 -> '3:06'. Segundos sempre com dois dígitos, para a coluna não dançar.
function tempoEmMinutos(segundos: number): string {
  const total = Math.max(0, Math.round(segundos ?? 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// "7 lições" / "1 lição".
function contagem(quantas: number): string {
  return `${quantas} ${quantas === 1 ? 'lição' : 'lições'}`;
}

// "3 concluídas" / "1 concluída".
function contagemFeitas(quantas: number): string {
  return `${quantas} ${quantas === 1 ? 'concluída' : 'concluídas'}`;
}

function hrefDoTreino(licao: Missao): string {
  return `../treino/treino.html?${new URLSearchParams({ exercicio: licao.exerciseId })}`;
}

// ============================================================================
// Onde a pessoa parou — derivado do histórico
// ============================================================================

interface Progresso {
  /** Lições com ao menos uma sessão concluída. */
  concluidas: Set<string>;
  /** A lição da sessão mais recente (concluída ou não). null: nunca treinou. */
  ultimaFeita: Missao | null;
  /** Para onde "Continuar" leva, e como se chama. */
  proxima: { licao: Missao; repetir: boolean };
}

// `licoes` já na ordem do percurso (os grupos, achatados). A próxima é a
// primeira não concluída nessa ordem; com tudo concluído, o convite é
// repetir a última feita; sem sessão nenhuma, é a lição 01.
function progressoDoPercurso(licoes: Missao[], sessoes: SessaoSolo[]): Progresso {
  const concluidas = new Set(sessoes.filter((s) => s.concluida).map((s) => s.exerciseId));
  const porId = new Map(licoes.map((l) => [l.exerciseId, l]));

  const maisRecente = maisRecentesPrimeiro(sessoes).find((s) => porId.has(s.exerciseId));
  const ultimaFeita = maisRecente ? porId.get(maisRecente.exerciseId) : null;

  const primeiraPendente = licoes.find((l) => !concluidas.has(l.exerciseId));
  const proxima = primeiraPendente
    ? { licao: primeiraPendente, repetir: false }
    : { licao: ultimaFeita ?? licoes[0], repetir: true };

  return { concluidas, ultimaFeita, proxima };
}

// ============================================================================
// Estado da tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | {
      estado: 'pronto';
      licoes: Missao[];
      // null = a chamada falhou; a tela abre sem essa parte.
      campanha: Campanha | null;
      sessoes: SessaoSolo[] | null;
    };

interface PropsCampanhas {
  usuario: Usuario;
}

function Campanhas({ usuario }: PropsCampanhas) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  // Quais grupos estão abertos. Vive só enquanto a tela vive: não vai para
  // a URL nem para o localStorage. Abrir um grupo é um gesto de olhar, não
  // uma preferência — não merece sobreviver ao F5 nem virar link que
  // alguém manda para outra pessoa.
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  // Para o grupo inicial nascer aberto uma vez só: depois que a pessoa
  // mexeu, a tela não volta a decidir por ela.
  const [primeiroAberto, setPrimeiroAberto] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        // As missões são o conteúdo: falharam, é erro. Histórico e campanha
        // são o progresso em volta: falharam, viram null e a tela abre sem
        // eles. Por isso os dois têm o próprio catch e as missões não.
        const [licoes, sessoes, campanha] = await Promise.all([
          api.solo.missoes().then(desembrulhar),
          api.solo
            .historico()
            .then((h) => desembrulhar<SessaoSolo>(h))
            .catch((falha) => {
              console.error(falha);
              return null;
            }),
          api.solo.campanhaAtual().catch((falha) => {
            console.error(falha);
            return null;
          }),
        ]);
        if (cancelado) return;
        setCarga({ estado: 'pronto', licoes, campanha: campanha ?? null, sessoes });
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
  const licoes = pronto?.licoes ?? [];
  // Reagrupa só quando a lista muda, não a cada abrir e fechar de grupo.
  const grupos = useMemo(() => agrupar(licoes), [licoes]);

  // O progresso só existe com histórico. `null` aqui é "não sei", e a tela
  // não desenha marca nem botão a partir de não saber.
  const progresso = useMemo(() => {
    if (!pronto?.sessoes || grupos.length === 0) return null;
    return progressoDoPercurso(grupos.flatMap((g) => g.licoes), pronto.sessoes);
  }, [pronto?.sessoes, grupos]);

  // Um grupo nasce aberto: o da última lição feita, ou o primeiro do
  // percurso para quem nunca treinou (ou quando o histórico não veio).
  useEffect(() => {
    if (primeiroAberto || grupos.length === 0 || carga.estado !== 'pronto') return;
    const nivelInicial = progresso?.ultimaFeita?.nivel ?? grupos[0].nivel;
    setAbertos(new Set([nivelInicial]));
    setPrimeiroAberto(true);
  }, [grupos, progresso, primeiroAberto, carga.estado]);

  function alternar(nivel: number) {
    setAbertos((anteriores) => {
      // Set novo, não o mesmo mutado: o React compara por identidade e não
      // repintaria se o objeto fosse o mesmo.
      const novos = new Set(anteriores);
      if (!novos.delete(nivel)) novos.add(nivel);
      return novos;
    });
  }

  // --- cabeçalho da campanha: nível, barra e "Continuar" ---------------------

  function renderizarCampanha() {
    if (carga.estado === 'carregando') {
      return (
        <div className="campanha-progresso campanha-esqueleto" aria-hidden="true">
          <div className="campanha-esqueleto-nivel" />
          <div className="campanha-esqueleto-barra" />
          <div className="campanha-esqueleto-acao" />
        </div>
      );
    }
    if (carga.estado !== 'pronto') return null;

    const { campanha } = carga;
    // Sem campanha E sem progresso não há o que mostrar aqui.
    if (!campanha && !progresso) return null;

    return (
      <div className="campanha-progresso">
        {campanha && (
          <>
            <p className="campanha-nivel">
              <span className="campanha-nivel-rotulo">Nível</span>
              <span className="campanha-nivel-valor">{campanha.nivelAtual}</span>
            </p>
            <BarraXp progresso={progressoDe(campanha)} />
          </>
        )}

        {/* "Continuar" leva à próxima lição não concluída na ordem do
            percurso; com tudo concluído, convida a repetir a última. O
            título da lição vai junto para a pessoa saber onde vai cair. */}
        {progresso && (
          <a className="btn btn-solido campanha-acao" href={hrefDoTreino(progresso.proxima.licao)}>
            <span>{progresso.proxima.repetir ? 'Repetir a última' : progresso.ultimaFeita ? 'Continuar' : 'Começar'}</span>
            <span className="campanha-acao-licao">{progresso.proxima.licao.titulo}</span>
          </a>
        )}
      </div>
    );
  }

  // --- corpo ----------------------------------------------------------------

  function renderizarCorpo() {
    if (carga.estado === 'carregando') {
      return (
        <div className="grupos" aria-hidden="true">
          {Array.from({ length: ESQUELETOS_GRUPO }, (_, i) => (
            <div key={i} className="grupo-esqueleto" />
          ))}
        </div>
      );
    }

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar as lições"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    if (grupos.length === 0) {
      return <p className="estado">Nenhuma lição disponível por enquanto.</p>;
    }

    return (
      <div className="grupos">
        {grupos.map((grupo) => {
          const aberto = abertos.has(grupo.nivel);
          const idPainel = `grupo-${grupo.nivel}`;
          const feitas = progresso
            ? grupo.licoes.filter((l) => progresso.concluidas.has(l.exerciseId)).length
            : 0;

          return (
            <section className="grupo" key={grupo.nivel}>
              {/* Botão, e não <div> com onClick: assim o grupo abre pelo
                  teclado sem nenhum handler de tecla escrito à mão, e o
                  leitor de tela anuncia "recolhido/expandido" sozinho. */}
              <button
                type="button"
                className="grupo-cabecalho"
                aria-expanded={aberto}
                aria-controls={idPainel}
                onClick={() => alternar(grupo.nivel)}
              >
                <span className="grupo-seta" aria-hidden="true">
                  ▸
                </span>
                <span className="grupo-titulo">
                  Nível {grupo.nivel}
                  {grupo.nome && <> · {grupo.nome}</>} · {contagem(grupo.licoes.length)}
                  {/* Só quando há alguma: "0 concluídas" em nove grupos
                      seria ruído. */}
                  {feitas > 0 && <span className="grupo-feitas"> · {contagemFeitas(feitas)}</span>}
                </span>
              </button>

              {/* Some do DOM quando fechado, em vez de esconder com CSS:
                  são 76 cartões no total, e os fechados não precisam
                  existir para nada — nem para o leitor de tela, que
                  seguiria achando os links de um grupo recolhido. */}
              {aberto && (
                <ul className="lista" id={idPainel}>
                  {grupo.licoes.map((licao) => {
                    const feita = progresso?.concluidas.has(licao.exerciseId) ?? false;
                    return (
                      <li key={licao.exerciseId}>
                        {/* Mesma estrutura que componentes/listaExercicios.ts
                            monta (a.item > div.item-texto > p.item-titulo),
                            para as classes de dashboard.css valerem sem
                            nenhum ajuste de display aqui. O <a> É o cartão:
                            a área de clique é a caixa inteira. */}
                        <a className={`item licao${feita ? ' licao-feita' : ''}`} href={hrefDoTreino(licao)}>
                          <div className="item-texto">
                            <p className="item-titulo">{licao.titulo}</p>
                            <p className="item-meta">
                              <span className="licao-tempo">{tempoEmMinutos(licao.tempoLimiteSegundos)}</span>
                              {/* O sinal de concluída: um ✓ e a palavra, no
                                  tom do meta. Nada de medalha ou cor de
                                  conquista — é só "isto você já fez". */}
                              {feita && (
                                <span className="licao-marca">
                                  {' · '}
                                  <span aria-hidden="true">✓</span> concluída
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Só quando repetir de fato: "1×" em quase todo
                              cartão seria ruído sem informação. O aria-label
                              existe porque "10×" lido em voz alta vira
                              "dez ex". */}
                          {licao.repeticoes > 1 && (
                            <span
                              className="licao-repeticoes"
                              aria-label={`${licao.repeticoes} repetições`}
                            >
                              {licao.repeticoes}×
                            </span>
                          )}

                          <span className="item-seta" aria-hidden="true">
                            →
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* A mesma <Nav> do lobby, com as mesmas SECOES_SOLO — o componente é
          um só. "Sair" e "Ir para o Professor" moram no menu do avatar
          dela, e por isso saíram do cabeçalho do painel: dois lugares para
          a mesma ação é o que o desenho não quer. */}
      <Nav secoes={SECOES_SOLO} ativo="missoes" />

      <main className="conteudo">
        <section className="painel vidro campanhas" aria-labelledby="titulo">
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
                Lições
              </h1>
              <p className="subtitulo" id="subtitulo">
                {usuario.nome ?? sessao.nomeExibicao()}
              </p>
            </div>
          </header>

          {renderizarCampanha()}

          <h2 className="secao-rotulo">Percurso</h2>
          {renderizarCorpo()}
        </section>
      </main>
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
    // Sem campanha não há lição nenhuma para listar. Vai para o lobby, que
    // é quem oferece começar. replace, e não href, pelo mesmo motivo do
    // guarda.ts: o botão voltar não devolve a pessoa para esta tela vazia.
    // Caminho relativo: as duas telas moram em pages/solo/.
    window.location.replace(ROTA_LOBBY);
  } else {
    guarda.aplicarMundo();
    createRoot(document.getElementById('raiz')).render(<Campanhas usuario={usuario} />);
  }
}
