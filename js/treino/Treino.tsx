// Treino.tsx — pages/treino/treino.html
// A tela de treino. O motor (typingEngine.ts) faz a conta; aqui só se pinta
// o estado, se avisa a pessoa com toasts e se decide o que acontece no fim
// conforme o modo de treino (a conclusão correta oferece continuar ou
// refazer; tentativas incompletas seguem para o resultado/modal existente).
//
// URL: treino.html?exercicio=<id>[&turma=<id>][&previa=1]
//
// O modo de treino sai da sessão e da URL, nunca de um perfil:
//   sessão de aluno                        -> 'aluno'  (grava em /sessoes)
//   sessão de conta com ?previa=1          -> 'previa' (não grava nada; é
//                                             o professor testando o
//                                             próprio exercício)
//   sessão de conta sem ?previa=1          -> 'solo'   (grava no Solo)
//
// Conversão de js/treino/treino.js para React: mesmo markup, mesmas classes
// de css/treino.css, mesmos textos e estados. O que NÃO mudou de mecânica:
//   · o motor continua sendo um módulo puro guardado em ref — não virou hook
//     nem foi reescrito;
//   · a captura continua sendo o evento 'input' no <input> invisível, ligado
//     pelo próprio motor (motor.anexar). Nada de onKeyDown: o teclado ABNT2
//     compõe acentos com teclas mortas e keydown nunca enxerga o "á";
//   · o <input> é não controlado: o React não escreve `value` nele — quem
//     escreve é o motor (modo bloqueante) e o SO (acentos);
//   · os toasts continuam com toast.ts num host FORA da raiz do React.
//
// Uma atividade, uma passada: a lição do Solo já chega com as repetições
// dentro do texto, num bloco só (ver montarLicao em nucleo/licoes.ts), e o
// tempo dela é o do bloco inteiro. Um motor, um cronômetro, uma sessão.
//
// Teclado guia (componentes/TecladoAbnt2.tsx): abaixo do texto, acende a
// tecla do PRÓXIMO caractere — o da posição do cursor, que a tela já recebe
// do motor em estado.posicao. Nada de keydown: a tecla sai do texto que
// vem, não do que foi apertado. A única coisa que a tela precisa saber
// além disso é se a tecla morta de um acento já foi digitada (para passar
// a acender a vogal), e isso vem dos eventos de composição do próprio
// <input> de captura (compositionstart / compositionend), não de keydown.
// O motor não muda. A pessoa pode esconder o teclado em Configurações
// (preferencias.ler().tecladoGuia); vale igual para Solo, aluno e prévia.
// Tecla errada toca um som curto (utils/somDoErro.ts), que também desliga lá.
//
// Pintura do texto: o motor emite a lista inteira de caracteres a cada tecla
// e a cada tick do relógio (100 ms). A lista de <span> não é recriada: os
// caracteres são guardados uma vez (nunca mudam) e a lista de status só vira estado novo quando algum status
// mudou de verdade — num tick, nada muda, e <Caracteres> (memo) nem
// renderiza. Numa tecla, mudam dois ou três, e cada <Caractere> (memo) só
// re-renderiza se o próprio status mudou.

import { comPpm } from '../componentes/Ppm.js';
import {
  memo,
  useEffect,
  useRef,
  useState,
  type MouseEvent as MouseEventReact,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { CONFIG, ROTA_INICIAL, rotaInicial } from '../config.js';
import { api, filaSessoes } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type {
  DadosSessaoTreino,
  ExercicioDetalhe,
  MissaoDetalhe,
  Mundo,
  ResultadoEnvio,
  SessaoSolo,
  Usuario,
} from '../nucleo/tipos.js';
import { MotorDigitacao, type EstadoMotor, type StatusCaractere } from './typingEngine.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { Modal, type AcaoModal } from '../componentes/ModalReact.js';
import { TecladoAbnt2 } from '../componentes/TecladoAbnt2.js';
import { preferencias } from '../nucleo/preferencias.js';
import { tocarErro } from '../utils/somDoErro.js';
import { BlocoDeMetricas, formatarTempo } from './BlocoDeMetricas.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { ordemDoPercurso, progressoDoPercurso } from '../utils/percurso.js';

// Onde o resultado da sessão espera a tela de resultado (sessionStorage).
const CHAVE_RESULTADO = 'teclar:ultimo_resultado';

// Limiares dos avisos. A precisão mínima é a mesma do banco (precisao_minima).
const PRECISAO_MINIMA = CONFIG.METAS.PRECISAO_ALVO;
const SEQUENCIA_AVISO = 25; // acertos seguidos
const TEMPO_AVISO_S = 10; // segundos restantes
const TEMPO_MAXIMO_BUSCA_PROXIMA_MS = 8000;

// O &nbsp; do hud-contexto no HTML original: mantém a altura da linha vazia.
const NBSP = String.fromCharCode(0xa0);

const PLACEHOLDER_TEXTO =
  'Enquanto o exercício carrega, este texto apenas marca o lugar onde ele vai aparecer. ' +
  'Respire, ajuste a postura e deixe as mãos na linha de base do teclado.';
const DICA_INICIAL = 'Comece a digitar para iniciar o cronômetro';

// Solo tem rota própria (missão, com XP); Escola usa o detalhe do exercício.
// tempoLimiteSegundos só existe na missão; no exercício da Escola cai em 0.
type ExercicioTreino = (MissaoDetalhe | ExercicioDetalhe) & {
  tempoLimiteSegundos?: number;
};

type Fase = 'carregando' | 'pronto' | 'erro';

interface ErroCarga {
  titulo: string;
  detalhe: string;
}

// O que o HUD pinta a cada emissão do motor.
interface Hud {
  wpm: number;
  precisao: number;
  tempo: string;
  urgente: boolean;
  progresso: number; // 0..100
  pausada: boolean;
}

const HUD_INICIAL: Hud = {
  wpm: 0,
  precisao: 100,
  tempo: '0:00',
  urgente: false,
  progresso: 0,
  pausada: false,
};

// Contadores de que os toasts derivam. Zeram ao refazer.
const AVISOS_INICIAIS = {
  acertos: 0,
  erros: 0,
  sequencia: 0,
  marco: 0, // quantos blocos de SEQUENCIA_AVISO já foram avisados
  precisaoAnterior: 100,
  tempoAvisado: false,
};

// Um modal por vez, com chave nova a cada abertura (ver ModalReact.tsx).
interface ConfigModal {
  chave: number;
  eyebrow: string;
  titulo: string;
  conteudo: ReactNode;
  acoes: AcaoModal[];
  /** Esc com o modal aberto. Sem ele, o Esc só fecha o modal. */
  aoEsc?: () => void;
}

interface OpcoesModalFim {
  metricas: DadosSessaoTreino;
  eyebrow: string;
  titulo: string;
  mensagem: string;
  recorde?: boolean;
}

interface DestinoProximaAtividade {
  titulo: string;
  href: string;
}

interface PropsTreino {
  usuario: Usuario;
}

/** Ver o cabeçalho do arquivo. */
type ModoTreino = 'aluno' | 'previa' | 'solo';

function modoTreinoDe(usuario: Usuario, params: URLSearchParams): ModoTreino {
  if (usuario.tipo === 'aluno') return 'aluno';
  return params.get('previa') === '1' ? 'previa' : 'solo';
}

// Quem decide é o back: a prévia do professor não grava e não tem bloqueio.
async function atividadeBloqueada(modo: ModoTreino, exercicioId: string, turmaId: string | null): Promise<boolean> {
  if (modo === 'solo') {
    const licoes = await api.solo.missoes();
    return licoes.some((licao) => licao.exerciseId === exercicioId && licao.bloqueada);
  }
  if (modo === 'aluno') {
    const sala = await api.escola.aluno.sala(turmaId);
    return sala.lista.some((ex) => ex.id === exercicioId && ex.bloqueada);
  }
  return false;
}

// O host dos toasts fica fora da raiz do React (ver treino.html), e o
// toast.ts continua cuidando dele como na tela em JS.
let toasts: Toasts;

function Treino({ usuario }: PropsTreino) {
  const [params] = useState(() => new URLSearchParams(location.search));
  const modoTreino = modoTreinoDe(usuario, params);
  // Para a fila de sessões: aluno e prévia gravam (ou gravariam) em
  // /sessoes; só o Solo grava em /solo/.
  const mundo: Mundo = modoTreino === 'solo' ? 'solo' : 'escola';
  const exercicioId = params.get('exercicio');
  const turmaId = params.get('turma') || sessao.turmaAtiva();

  // --- refs: o que o motor e os callbacks tocam sem passar pelo render ---
  const captura = useRef<HTMLInputElement>(null);
  const btnVoltar = useRef<HTMLButtonElement>(null);
  const motor = useRef<MotorDigitacao | null>(null);
  const exercicio = useRef<ExercicioTreino | null>(null);
  const charsMontados = useRef(false);
  const statusAtual = useRef<StatusCaractere[]>([]); // último status pintado
  const modalAberto = useRef(false); // o papel do modalAberto() do modal.ts
  const chaveModal = useRef(0);
  const avisos = useRef({ ...AVISOS_INICIAIS });

  // Os "corrigidos": só a tela mostra (a sessão gravada não tem a coluna).
  const corrigidos = useRef(0);

  // --- estado pintado ---
  const [fase, setFase] = useState<Fase>('carregando');
  const [titulo, setTitulo] = useState('Carregando exercício…');
  const [contexto, setContexto] = useState(NBSP);
  const [erroCarga, setErroCarga] = useState<ErroCarga>({
    titulo: 'Exercício não encontrado.',
    detalhe: '',
  });
  const [chars, setChars] = useState<string[] | null>(null); // um por caractere do alvo
  const [status, setStatus] = useState<StatusCaractere[]>([]);
  const [hud, setHud] = useState<Hud>(HUD_INICIAL);
  const [dica, setDica] = useState(DICA_INICIAL);
  const [dicaOculta, setDicaOculta] = useState(false);
  const [semFoco, setSemFoco] = useState(false);
  const [modal, setModal] = useState<ConfigModal | null>(null);

  // --- teclado guia ---
  const [mostrarTeclado] = useState(() => preferencias.ler().tecladoGuia);
  // Lida uma vez, ao abrir: como o teclado, vale a partir do próximo treino.
  const [comSom] = useState(() => preferencias.ler().sonsDoTreino);
  const errosAtual = useRef(0);
  // A posição do cursor no texto: o índice do próximo caractere a digitar.
  const [posicao, setPosicao] = useState(0);
  // A mesma posição, lida pelo evento de composição (que não passa pelo
  // render).
  const posicaoAtual = useRef(0);
  // Caracteres digitados (acertos + erros): decide se a
  // saída pede confirmação.
  const digitadosAtual = useRef(0);
  // Enquanto um acento está sendo composto (a tecla morta já foi, falta a
  // vogal): o índice do caractere acentuado. null fora disso.
  const [indiceDoAcento, setIndiceDoAcento] = useState<number | null>(null);

  // --- navegação -------------------------------------------------------------

  // Para o relógio antes de ir: o limite de tempo não pode disparar (e
  // gravar) enquanto a página troca. replace: o voltar do navegador não cai
  // num treino com o motor já destruído.
  function sair() {
    motor.current?.destruir();
    motor.current = null;
    location.replace(modoTreino === 'solo' ? ROTA_INICIAL.solo : guarda.casa());
  }

  // Atividade bloqueada: volta para o caminho ou a sala, que mostram o aviso
  // (componentes/AvisoBloqueada.tsx).
  function voltarBloqueada() {
    const destino = new URL(modoTreino === 'solo' ? ROTA_INICIAL.solo : guarda.casa(), location.origin);
    destino.searchParams.set('bloqueada', '1');
    location.replace(destino);
  }

  // Sair pelo Esc ou pelo botão "← Sair" do HUD: os dois chamam esta, e
  // nenhum dos dois grava nada — lição incompleta não conta. Enquanto um
  // modal está aberto, a saída é dele (os botões do modal chamam sair()
  // direto), e esta não faz nada.
  // Com algo digitado, pergunta antes
  // (modal do app, nunca window.confirm). "Continuar treinando" é o padrão e
  // o Esc dentro do modal faz o mesmo (só fecha); o foco volta à captura.
  function sairSeNenhumModalAberto() {
    if (modalAberto.current) return;
    if (digitadosAtual.current === 0) {
      sair();
      return;
    }
    abrirModal({
      eyebrow: 'Sair do treino',
      titulo: 'Sair agora?',
      conteudo: <p>O progresso desta atividade será perdido.</p>,
      acoes: [
        { rotulo: 'Continuar treinando', principal: true },
        { rotulo: 'Sair', aoClicar: sair },
      ],
    });
  }

  // Esc SAI da tela (não pausa): nada parcial é gravado.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !modalAberto.current) {
        evento.preventDefault();
        sairSeNenhumModalAberto();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  // --- teclado guia: acento em composição -----------------------------------
  // A tecla morta (´ ~) começa uma composição no <input>; a vogal a
  // termina. É o que o teclado guia usa para trocar da tecla morta para a
  // vogal. Só estes dois eventos: a digitação continua chegando ao motor
  // pelo 'input', como sempre.
  useEffect(() => {
    const campo = captura.current;
    if (!campo) return;
    function aoComecarAcento() {
      setIndiceDoAcento(posicaoAtual.current);
    }
    function aoTerminarAcento() {
      setIndiceDoAcento(null);
    }
    campo.addEventListener('compositionstart', aoComecarAcento);
    campo.addEventListener('compositionend', aoTerminarAcento);
    return () => {
      campo.removeEventListener('compositionstart', aoComecarAcento);
      campo.removeEventListener('compositionend', aoTerminarAcento);
    };
  }, []);

  // --- foco ------------------------------------------------------------------
  // Clicar no texto ou no aviso de pausa devolve o foco ao input invisível;
  // o motor retoma sozinho ao ganhar foco.

  function aoPressionarTexto(evento: MouseEventReact) {
    evento.preventDefault(); // não deixa a seleção de texto roubar o foco
    captura.current?.focus();
  }

  function focarCaptura() {
    captura.current?.focus();
  }

  // --- carga do exercício ----------------------------------------------------

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      if (!exercicioId) {
        mostrarErroCarga('Nenhum exercício informado.', 'Abra o treino a partir da lista de exercícios.');
        return;
      }

      let carregado: ExercicioTreino;
      try {
        // Solo tem rota própria (missão, com XP); Escola usa o detalhe do exercício.
        carregado =
          modoTreino === 'solo'
            ? await api.solo.missao(exercicioId)
            : await api.exercicios.obter(exercicioId, turmaId);
        // A pessoa não digita o texto inteiro para ouvir o 403 só ao gravar.
        if (await atividadeBloqueada(modoTreino, exercicioId, turmaId)) {
          if (!cancelado) voltarBloqueada();
          return;
        }
      } catch (erro) {
        if (cancelado) return;
        mostrarErroCarga(
          erro?.status === 404 ? 'Exercício não encontrado.' : 'Não foi possível carregar o exercício.',
          erro?.message ?? ''
        );
        return;
      }
      if (cancelado) return;

      if (!carregado?.texto) {
        mostrarErroCarga('Exercício sem texto.', 'Este exercício não tem conteúdo para digitar.');
        return;
      }

      exercicio.current = carregado;
      montarHud(carregado);
      setFase('pronto');
      criarMotor();
    }

    carregar();

    return () => {
      cancelado = true;
      motor.current?.destruir();
      motor.current = null;
    };
  }, []);

  // Um motor novo na carga e a cada "Refazer". O texto é montado a partir da
  // lista de caracteres que o motor devolve no primeiro atualizar(): ele
  // normaliza (aspas, travessão, quebras) antes de comparar, e essa lista é
  // a fonte da verdade. Ao refazer a lista é a mesma e não é remontada.
  function criarMotor() {
    const carregado = exercicio.current;
    if (!carregado || !captura.current) return;

    // O input não é controlado: o que a tentativa anterior deixou nele sai
    // daqui, antes de o motor novo ler qualquer coisa.
    captura.current.value = '';

    // Os toasts derivam do delta entre estados: zeram com o motor.
    avisos.current = { ...AVISOS_INICIAIS };
    statusAtual.current = [];
    setDica(DICA_INICIAL);
    setIndiceDoAcento(null);

    motor.current = new MotorDigitacao({
      texto: carregado.texto,
      modo: CONFIG.TREINO.MODO_PADRAO, // preferência do sistema, não do exercício
      // Um cronômetro só, para o bloco inteiro. 0 = sem limite.
      tempoLimiteSegundos: carregado.tempoLimiteSegundos ?? 0,
      aoAtualizar: atualizar,
      aoTerminar: terminar,
    });
    motor.current.anexar(captura.current);
    motor.current.iniciar();
  }

  function mostrarErroCarga(tituloErro: string, detalhe: string) {
    setTitulo('Treino');
    setErroCarga({ titulo: tituloErro, detalhe });
    setFase('erro');
  }

  // Foco no botão de voltar assim que o erro aparece, como antes.
  useEffect(() => {
    if (fase === 'erro') btnVoltar.current?.focus();
  }, [fase]);

  function montarHud(carregado: ExercicioTreino) {
    setTitulo(carregado.titulo ?? 'Exercício');
    setContexto(contextoDoHud(carregado));
    document.title = `Teclar — ${carregado.titulo ?? 'Treino'}`;
  }

  // "SOLO · NÍVEL N" / "TURMA · NOME" / "PRÉVIA · CATEGORIA"
  function contextoDoHud(carregado: ExercicioTreino): string {
    if (modoTreino === 'aluno') {
      const turma = usuario.turmas?.find((t) => t.id === turmaId);
      return `Turma · ${turma?.nome ?? 'sem turma'}`;
    }
    // A lição do Solo não tem categoria: ExerciciosSolo não tem a coluna, e
    // o que ela tem no lugar é o nível. Antes o HUD escrevia
    // "Solo · Palavras comuns", categoria que só existia no mock.
    if (modoTreino === 'solo') {
      const nivel = (carregado as MissaoDetalhe).nivel;
      return nivel == null ? 'Solo' : `Solo · Nível ${nivel}`;
    }
    const categoria = (carregado as ExercicioDetalhe).categoria ?? 'Exercício';
    return `Prévia · ${categoria}`;
  }

  // --- pintura ---------------------------------------------------------------

  function atualizar(estado: EstadoMotor) {
    // Os caracteres nunca mudam: guardados uma vez, no primeiro atualizar().
    if (!charsMontados.current) {
      charsMontados.current = true;
      setChars(estado.caracteres.map((c) => c.char));
    }

    // Só vira estado novo se algum status mudou: a cada tecla mudam dois ou
    // três; num tick do relógio, nenhum — e a lista não re-renderiza.
    const novoStatus = estado.caracteres.map((c) => c.status);
    if (!mesmoStatus(statusAtual.current, novoStatus)) {
      statusAtual.current = novoStatus;
      setStatus(novoStatus);
    }

    // Para o teclado guia. Num tick do relógio a posição é a mesma, e o
    // React não re-renderiza por um valor igual.
    posicaoAtual.current = estado.posicao;
    digitadosAtual.current = estado.digitados;
    // Erro novo desde a última atualização: o som (um por tecla errada).
    if (estado.erros > errosAtual.current && comSom) tocarErro();
    errosAtual.current = estado.erros;
    setPosicao(estado.posicao);

    // Com limite mostra o restante; sem limite, o decorrido.
    const comLimite = estado.tempoRestanteSegundos != null;
    const total = estado.caracteres.length || 1;
    setHud({
      wpm: estado.wpm,
      precisao: estado.precisao,
      tempo: formatarTempo(comLimite ? estado.tempoRestanteSegundos : estado.tempoDecorridoSegundos),
      urgente: comLimite && estado.iniciada && estado.tempoRestanteSegundos <= TEMPO_AVISO_S,
      progresso: (estado.posicao / total) * 100,
      pausada: estado.pausada,
    });

    setDicaOculta(estado.iniciada);

    observarAvisos(estado);
  }

  // --- toasts ----------------------------------------------------------------
  // O motor não expõe "acertos seguidos": a sequência é derivada aqui, dos
  // deltas de acertos e erros entre dois estados. Cada aviso dispara uma vez
  // por marco; a fila mostra no máximo um por vez.

  function observarAvisos(estado: EstadoMotor) {
    if (!estado.iniciada || estado.motivoFim) return;
    const a = avisos.current;

    // 1. "25 seguidos": zera no erro, soma no acerto.
    if (estado.erros > a.erros) {
      a.sequencia = 0;
      a.marco = 0;
    } else {
      a.sequencia += estado.acertos - a.acertos;
    }
    a.acertos = estado.acertos;
    a.erros = estado.erros;

    const marco = Math.floor(a.sequencia / SEQUENCIA_AVISO);
    if (marco > a.marco) {
      a.marco = marco;
      toasts.mostrar(`${SEQUENCIA_AVISO} seguidos`, { conquista: true });
    }

    // 2. "precisão caindo": só ao CRUZAR o limiar para baixo, não a cada tecla.
    if (
      estado.digitados > 0 &&
      a.precisaoAnterior >= PRECISAO_MINIMA &&
      estado.precisao < PRECISAO_MINIMA
    ) {
      toasts.mostrar('precisão caindo');
    }
    a.precisaoAnterior = estado.precisao;

    // 3. "10 segundos": uma vez, quando há limite.
    if (
      !a.tempoAvisado &&
      estado.tempoRestanteSegundos != null &&
      estado.tempoRestanteSegundos <= TEMPO_AVISO_S
    ) {
      a.tempoAvisado = true;
      toasts.mostrar(`${TEMPO_AVISO_S} segundos`);
    }
  }

  // --- fim ------------------------------------------------------------------
  // O motor chama isto quando o texto acabou ou o tempo esgotou. O motor é
  // destruído aqui para nada do que for teclado depois chegar a ele.

  function terminar(estado: EstadoMotor) {
    toasts.limpar();
    setHud((atual) => ({ ...atual, pausada: false }));
    const corpo = motor.current.montarCorpoSessao();
    motor.current.destruir();
    motor.current = null;
    corrigidos.current = estado.corrigidos;
    finalizar(corpo);
  }

  // --- fim de sessão ---------------------------------------------------------
  // Uma sessão por lição.

  async function finalizar(corpoBase: DadosSessaoTreino) {
    setDica('Salvando sessão…');
    setDicaOculta(false);

    // Professor testando o próprio exercício: prévia, não conta como sessão.
    if (modoTreino === 'previa') {
      setDicaOculta(true);
      if (corpoBase.concluida) {
        abrirModalConclusao(corpoBase, null);
      } else {
        abrirModalFim({
          metricas: corpoBase,
          eyebrow: 'Prévia concluída',
          titulo: 'Nada foi registrado.',
          mensagem: 'A prévia do professor não conta como sessão de aluno.',
        });
      }
      return;
    }

    const corpo: DadosSessaoTreino = { ...corpoBase, exercicio_id: exercicioId };
    if (modoTreino === 'aluno') corpo.turma_id = turmaId;

    let resultado: ResultadoEnvio;
    try {
      // Falha de rede não sobe: a sessão entra na fila e a tela segue em
      // frente — o resultado é calculado no front e não pode se perder.
      resultado = await filaSessoes.enviar(corpo, mundo);
    } catch (erro) {
      // Bloqueou depois de abrir (o professor mudou a sala, outra aba...):
      // "tentar de novo" daria o mesmo 403.
      if (erro?.codigo === 'ATIVIDADE_BLOQUEADA') {
        voltarBloqueada();
        return;
      }
      setDicaOculta(true);
      abrirModal({
        eyebrow: 'Não deu',
        titulo: 'Não foi possível salvar a sessão.',
        conteudo: erro?.message ?? 'Erro inesperado.',
        acoes: [
          { rotulo: 'Tentar de novo', principal: true, aoClicar: () => finalizar(corpoBase) },
          { rotulo: 'Voltar ao início', aoClicar: sair },
        ],
      });
      return;
    }

    // Token vencido: a sessão ficou na fila, e o api.ts já está indo para o login.
    if (!sessao.logado()) return;

    setDicaOculta(true);

    if (corpo.concluida) {
      abrirModalConclusao(corpo, resultado);
      return;
    }

    if (mundo === 'solo') irParaResultado(resultado, corpo);
    else abrirModalAluno(resultado, corpo);
  }

  async function buscarProximaAtividade(): Promise<DestinoProximaAtividade | null> {
    if (modoTreino === 'solo') {
      const [missoes, historico] = await Promise.all([api.solo.missoes(), api.solo.historico()]);
      const progresso = progressoDoPercurso(
        ordemDoPercurso(desembrulhar(missoes)),
        desembrulhar<SessaoSolo>(historico)
      );
      if (
        progresso == null ||
        progresso.proxima.repetir ||
        progresso.proxima.licao.exerciseId === exercicioId
      ) {
        return null;
      }

      return {
        titulo: progresso.proxima.licao.titulo,
        href: `treino.html?${new URLSearchParams({ exercicio: progresso.proxima.licao.exerciseId })}`,
      };
    }

    if (modoTreino === 'aluno') {
      if (!turmaId) throw new Error('Não foi possível identificar a turma desta atividade.');
      const sala = await api.escola.aluno.sala(turmaId);
      const indiceAtual = sala.lista.findIndex((atividade) => atividade.id === exercicioId);
      if (indiceAtual < 0) throw new Error('A atividade atual não foi encontrada na sequência da turma.');

      const proxima = sala.lista
        .slice(indiceAtual + 1)
        .find((atividade) => !atividade.bloqueada && atividade.estado !== 'feito');
      if (!proxima) return null;

      return {
        titulo: proxima.titulo,
        href: `treino.html?${new URLSearchParams({ exercicio: proxima.id, turma: turmaId })}`,
      };
    }

    return null;
  }

  function abrirModalConclusao(
    metricas: DadosSessaoTreino,
    resultado: ResultadoEnvio | null
  ) {
    const recompensa =
      modoTreino === 'solo' &&
      resultado?.ok === true &&
      'xpGanho' in resultado.resposta
        ? resultado.resposta
        : null;
    const recorde = resultado?.ok === true && resultado.resposta.recordePessoal === true;
    // Aluno: nível escolar que o POST /sessoes devolve (o do Solo vem na recompensa).
    const novoNivel =
      modoTreino === 'aluno' && resultado?.ok === true && resultado.resposta.subiuDeNivel === true
        ? resultado.resposta.nivelAtual
        : null;
    const mensagemResultado =
      resultado?.enfileirada === true
        ? 'Sem conexão agora. A sessão foi guardada e será enviada quando a rede voltar.'
        : modoTreino === 'previa'
          ? 'A prévia do professor não conta como sessão de aluno.'
          : '';
    const consultaPendente = modoTreino !== 'previa' && resultado?.enfileirada !== true;
    const consultaIndisponivel = resultado?.enfileirada === true;

    // Solo: o caminho. Aluno: a sala da turma de onde veio. Prévia: a página
    // que abriu a prévia (Biblioteca, turma...), se for deste site.
    const voltarParaAtividades = () => {
      motor.current?.destruir();
      motor.current = null;
      location.replace(
        modoTreino === 'solo'
          ? ROTA_INICIAL.solo
          : modoTreino === 'aluno'
            ? rotaInicial('aluno', null, turmaId)
            : paginaDeOrigem() ?? guarda.casa()
      );
    };

    function conteudoConclusao(
      proxima: DestinoProximaAtividade | null,
      pendente: boolean,
      falha: boolean
    ): ReactNode {
      return (
        <div>
          {mensagemResultado && <p>{mensagemResultado}</p>}
          {pendente && <p>Verificando a próxima atividade…</p>}
          {falha && (
            <p>Não foi possível verificar a próxima atividade agora. Você pode voltar à lista de atividades.</p>
          )}
          {modoTreino !== 'previa' && !pendente && !falha && proxima == null && (
            <p>Você concluiu a sequência de atividades.</p>
          )}
          {recompensa && (
            <p>
              +{recompensa.xpGanho} XP · Nível {recompensa.nivelAtual}
              {recompensa.subiuDeNivel ? ' · Novo nível alcançado' : ''}
            </p>
          )}
          {recorde && <p>Novo recorde!</p>}
          {novoNivel != null && <p>Você subiu para o Nível {novoNivel}!</p>}
          <BlocoDeMetricas
            wpm={metricas.wpm}
            precisao={metricas.precisao}
            erros={metricas.erros}
            acertos={metricas.acertos}
            corrigidos={corrigidos.current}
            tempoSegundos={metricas.tempo_gasto_segundos}
          />
          {proxima && <p className="modal-proxima">A seguir: {proxima.titulo}</p>}
        </div>
      );
    }

    function acoesConclusao(
      proxima: DestinoProximaAtividade | null,
      pendente: boolean,
      falha: boolean
    ): AcaoModal[] {
      // "Voltar às atividades" está sempre lá: discreto ao lado da próxima
      // (ou enquanto ela é buscada); principal quando não há próxima.
      const semProxima = !proxima && !pendente;
      return [
        ...(proxima
          ? [{ rotulo: 'Próxima lição', principal: true, aoClicar: () => location.replace(proxima.href) }]
          : []),
        { rotulo: 'Refazer atividade', aoClicar: reiniciarAtividade },
        {
          rotulo: 'Voltar às atividades',
          principal: semProxima,
          discreta: !semProxima,
          aoClicar: voltarParaAtividades,
        },
      ];
    }

    const chaveConclusao = abrirModal({
      eyebrow: modoTreino === 'previa' ? 'Prévia concluída' : 'Atividade concluída',
      titulo: consultaPendente
        ? 'Atividade concluída.'
        : consultaIndisponivel
          ? 'Não foi possível verificar a sequência.'
          : modoTreino === 'previa'
            ? 'Prévia concluída.'
            : 'Sequência concluída.',
      conteudo: conteudoConclusao(null, consultaPendente, consultaIndisponivel),
      acoes: acoesConclusao(null, consultaPendente, consultaIndisponivel),
      aoEsc: voltarParaAtividades,
    });

    if (!consultaPendente) return;

    let temporizadorBusca: ReturnType<typeof setTimeout> | null = null;
    const buscaComLimite = Promise.race([
      buscarProximaAtividade(),
      new Promise<never>((_, rejeitar) => {
        temporizadorBusca = setTimeout(
          () => rejeitar(new Error('A busca pela próxima atividade excedeu o tempo limite.')),
          TEMPO_MAXIMO_BUSCA_PROXIMA_MS
        );
      }),
    ]);

    buscaComLimite
      .then((proxima) => {
        setModal((atual) =>
          atual?.chave === chaveConclusao
            ? {
                ...atual,
                titulo: proxima ? 'Muito bem!' : 'Sequência concluída.',
                conteudo: conteudoConclusao(proxima, false, false),
                acoes: acoesConclusao(proxima, false, false),
              }
            : atual
        );
      })
      .catch((erro) => {
        console.error(erro);
        setModal((atual) =>
          atual?.chave === chaveConclusao
            ? {
                ...atual,
                titulo: 'Não foi possível verificar a sequência.',
                conteudo: conteudoConclusao(null, false, true),
                acoes: acoesConclusao(null, false, true),
              }
            : atual
        );
      })
      .finally(() => {
        if (temporizadorBusca != null) clearTimeout(temporizadorBusca);
      });
  }

  function reiniciarAtividade() {
    toasts.limpar();
    motor.current?.destruir();
    motor.current = null;
    corrigidos.current = 0;
    setHud(HUD_INICIAL);
    setPosicao(0);
    posicaoAtual.current = 0;
    digitadosAtual.current = 0;
    setStatus([]);
    statusAtual.current = [];
    avisos.current = { ...AVISOS_INICIAIS };
    setDica(DICA_INICIAL);
    setDicaOculta(false);
    setSemFoco(false);
    setIndiceDoAcento(null);
    criarMotor();
  }

  // Solo: guarda a resposta inteira (xpGanho, xpTotal, nivelAtual,
  // subiuDeNivel, recordePessoal) para a tela de resultado animar a barra,
  // e passa só o id e o mundo na URL. Sem resposta (fila), guarda o que o
  // front sabe: as métricas locais.
  function irParaResultado(resultado: ResultadoEnvio, corpo: DadosSessaoTreino) {
    // `=== true` (e não só `resultado.ok`): sem strictNullChecks o tsc não
    // estreita a união pelo discriminante na forma curta.
    const registro: Record<string, unknown> =
      resultado.ok === true
        ? { ...resultado.resposta, enfileirada: false }
        : { enfileirada: true, pendentes: resultado.pendentes };
    registro.metricas = corpo;
    registro.exercicio = { id: exercicioId, titulo: exercicio.current?.titulo ?? '' };
    sessionStorage.setItem(CHAVE_RESULTADO, JSON.stringify(registro));

    const query = new URLSearchParams();
    const sessaoId = resultado.ok === true ? resultado.resposta.id : null;
    if (sessaoId) query.set('sessao', sessaoId);
    query.set('mundo', 'solo');
    // replace: o voltar do navegador não deve cair numa sessão já encerrada.
    location.replace(`resultado.html?${query}`);
  }

  // Aluno: modal rápido com PPM e erros; "Voltar ao início" vai para a casa
  // da sessão.
  function abrirModalAluno(resultado: ResultadoEnvio, corpo: DadosSessaoTreino) {
    abrirModalFim({
      metricas: corpo,
      eyebrow: corpo.concluida ? 'Sessão concluída' : 'Tempo esgotado',
      titulo: resultado.enfileirada
        ? 'Lição guardada.'
        : 'Lição enviada ao professor!',
      mensagem: resultado.enfileirada
        ? 'Sem conexão agora. Ela vai para o professor assim que a rede voltar.'
        : '',
      // Na fila não há resposta, então não há recorde para mostrar.
      recorde: resultado.ok === true && resultado.resposta.recordePessoal === true,
    });
  }

  function abrirModalFim({ metricas, eyebrow, titulo: tituloModal, mensagem, recorde }: OpcoesModalFim) {
    abrirModal({
      eyebrow,
      titulo: tituloModal,
      conteudo: (
        <div>
          {mensagem && <p>{mensagem}</p>}
          {recorde && <p>Novo recorde!</p>}
          {/* Mesmo bloco da tela de resultado do Solo. */}
          <BlocoDeMetricas
            wpm={metricas.wpm}
            precisao={metricas.precisao}
            erros={metricas.erros}
            acertos={metricas.acertos}
            corrigidos={corrigidos.current}
            tempoSegundos={metricas.tempo_gasto_segundos}
          />
        </div>
      ),
      acoes: [{ rotulo: 'Voltar ao início', principal: true, aoClicar: sair }],
    });
  }

  function abrirModal(config: Omit<ConfigModal, 'chave'>): number {
    chaveModal.current += 1;
    modalAberto.current = true;
    setModal({ ...config, chave: chaveModal.current });
    return chaveModal.current;
  }

  // --- render ----------------------------------------------------------------

  return (
    <>
      {/* HUD: contexto + título à esquerda, métricas à direita */}
      <header className="hud vidro">
        {/* A saída visível: o Esc sozinho ninguém descobre. É o primeiro
            item da tela no Tab. Faz o mesmo que o Esc. */}
        <button
          type="button"
          className="hud-sair tecla"
          // Sem isto o mousedown tira o foco do input, o motor pausa e a camada
          // de pausa cobre o botão antes do clique terminar: o Sair só pausava.
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={sairSeNenhumModalAberto}
          aria-label="Sair do treino (Esc)"
        >
          <span aria-hidden="true">←</span> Sair
        </button>
        <div className="hud-esq">
          <p className="hud-contexto" id="hud-contexto">
            {contexto}
          </p>
          <h1 className="hud-titulo" id="hud-titulo">
            {titulo}
          </h1>
        </div>
        <dl className="hud-dir">
          <div className="hud-metrica">
            <dt>{comPpm('PPM')}</dt>
            <dd id="hud-ppm">{hud.wpm}</dd>
          </div>
          <div className="hud-metrica">
            <dt>Precisão</dt>
            <dd id="hud-precisao" className={hud.precisao < PRECISAO_MINIMA ? 'abaixo' : undefined}>
              {hud.precisao}
              <span className="hud-unidade">%</span>
            </dd>
          </div>
          <div className="hud-metrica">
            <dt id="hud-tempo-rotulo">Tempo</dt>
            <dd id="hud-tempo" className={hud.urgente ? 'urgente' : undefined}>
              {hud.tempo}
            </dd>
          </div>
        </dl>
      </header>

      <main className="palco" id="palco">
        {/* Área do texto. Clicar nela devolve o foco ao input invisível. */}
        <section
          className={`area-texto${semFoco ? ' sem-foco' : ''}`}
          id="area-texto"
          aria-label="Texto do exercício"
          hidden={fase === 'erro'}
          onMouseDown={aoPressionarTexto}
        >
          <p className={`texto${chars ? '' : ' carregando'}`} id="texto" aria-hidden="true">
            {chars ? <Caracteres chars={chars} status={status} /> : PLACEHOLDER_TEXTO}
          </p>
          {/* aria-hidden: muda a cada tecla, e o leitor de tela leria tudo. */}
          <div className="progresso-rotulo" aria-hidden="true">
            <span>Progresso</span>
            <span id="progresso-caracteres">
              {posicao} / {chars?.length ?? 0} caracteres
            </span>
          </div>
          <div className="progresso" aria-hidden="true">
            <div className="progresso-barra" id="progresso" style={{ width: `${hud.progresso}%` }} />
          </div>
          <p className={`dica${dicaOculta ? ' oculta' : ''}${dica === DICA_INICIAL ? ' dica-de-uso' : ''}`} id="dica">
            {dica}
          </p>
          <p className="atalhos">Esc para sair</p>
        </section>

        {/* O teclado guia. memo: num tick do relógio as props são as mesmas
            e ele nem renderiza. Com o acento em composição, o caractere é
            o acentuado e ele acende a vogal. */}
        {mostrarTeclado && fase === 'pronto' && chars && (
          // .guia: o bloco do teclado, centralizado no espaço entre o texto
          // e o fim da tela e dimensionado pela altura da janela (ver
          // css/treino.css).
          <div className="guia">
            <TecladoAbnt2
              tamanho="treino"
              caractere={chars[indiceDoAcento ?? posicao] ?? null}
              esperandoVogal={indiceDoAcento != null}
            />
          </div>
        )}

        {/* Erro de carga: exercício inexistente, rede etc. */}
        <section className="erro-carga vidro" id="erro-carga" hidden={fase !== 'erro'}>
          <p className="modal-eyebrow">Não deu</p>
          <h2 className="modal-titulo" id="erro-titulo">
            {erroCarga.titulo}
          </h2>
          <p className="modal-corpo" id="erro-detalhe">
            {erroCarga.detalhe}
          </p>
          <div className="modal-acoes">
            <button
              type="button"
              className="modal-botao modal-botao-solido"
              id="btn-voltar"
              ref={btnVoltar}
              onClick={sair}
            >
              Voltar ao início
            </button>
          </div>
        </section>
      </main>

      {/* Captura invisível: o SO compõe acentos aqui, o motor lê input.value.
          Não controlado de propósito: o React nunca escreve `value` nele
          (criarMotor limpa o campo por DOM, ao refazer). */}
      <input
        type="text"
        className="captura"
        id="captura"
        aria-label="Digite o texto do exercício"
        tabIndex={0}
        ref={captura}
        onFocus={() => setSemFoco(false)}
        onBlur={() => setSemFoco(true)}
      />

      {/* Pausa por perda de foco. Clicar em qualquer lugar retoma. */}
      <div className="pausa" id="pausa" hidden={!hud.pausada} onClick={focarCaptura}>
        <div className="pausa-caixa vidro">
          <p className="modal-eyebrow">Pausado</p>
          <p className="pausa-texto">Clique em qualquer lugar para continuar.</p>
        </div>
      </div>

      {modal && (
        <Modal
          key={modal.chave}
          eyebrow={modal.eyebrow}
          titulo={modal.titulo}
          acoes={modal.acoes}
          aoEsc={modal.aoEsc}
          // Quem estava digitando continua teclando por um instante: o foco
          // fica na caixa para o Espaço não acionar "Próxima lição".
          focoNaCaixa
          aoFechar={() => {
            modalAberto.current = false;
            setModal(null);
          }}
        >
          {modal.conteudo}
        </Modal>
      )}
    </>
  );
}

// De onde a prévia foi aberta: o referrer, só se for deste site.
function paginaDeOrigem(): string | null {
  try {
    const origem = new URL(document.referrer);
    return origem.origin === location.origin && origem.pathname !== location.pathname ? origem.href : null;
  } catch {
    return null;
  }
}

// Texto do exercício: um <span class="c"> por caractere

interface PropsCaracteres {
  chars: string[];
  status: StatusCaractere[];
}

// memo: num tick do relógio `chars` e `status` são as mesmas referências e
// nada aqui roda. Numa tecla, `status` é outro array e a lista renderiza —
// mas cada <Caractere> só toca no DOM se o próprio status mudou.
const Caracteres = memo(function Caracteres({ chars, status }: PropsCaracteres) {
  return (
    <>
      {chars.map((char, i) => (
        <Caractere key={i} char={char} status={status[i]} />
      ))}
    </>
  );
});

interface PropsCaractere {
  char: string;
  status: StatusCaractere;
}

const Caractere = memo(function Caractere({ char, status }: PropsCaractere) {
  return <span className={`c ${status}`}>{char}</span>;
});

function mesmoStatus(a: StatusCaractere[], b: StatusCaractere[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Montagem — guarda primeiro, React depois

// Qualquer sessão logada treina (Solo, Aluno, e conta em prévia).
// Devolveu null, redirecionou: a tela para aqui e nada mais roda.
const usuario = guarda.qualquerLogado();

if (usuario) {
  guarda.aplicarMundo();
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 1 });
  createRoot(document.getElementById('raiz')).render(<Treino usuario={usuario} />);
}
