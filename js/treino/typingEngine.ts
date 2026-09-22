// typingEngine.ts
// O motor de digitação — o coração do TECLAR. Lógica PURA: recebe o texto,
// escuta o que a pessoa digita e expõe o estado. Não desenha nada; quem pinta
// é a tela de treino. O MESMO motor serve ao mundo Solo e ao Escola.
//
// Conversão de typingEngine.js para TypeScript: SÓ tipagem. A lógica, a
// interface pública e a ordem de cada operação são as mesmas. Não é hook,
// não conhece React — a tela o consome como módulo normal.

import { CONFIG, type ModoTreino } from '../config.js';
import type { DadosSessaoTreino } from '../nucleo/tipos.js';

/** Status de cada caractere do alvo. 'atual' é derivado: o que está sob o cursor. */
export type StatusCaractere = 'pendente' | 'correto' | 'errado' | 'atual';

/** Por que a sessão terminou. null enquanto está em andamento. */
export type MotivoFim = 'texto' | 'tempo' | null;

export interface CaractereEstado {
  char: string;
  status: StatusCaractere;
}

/** O que `motor.estado` devolve e o que aoAtualizar/aoTerminar recebem. */
export interface EstadoMotor {
  caracteres: CaractereEstado[];
  posicao: number;
  /** caracteres produzidos e contabilizados (acertos + erros) */
  digitados: number;
  acertos: number;
  erros: number;
  wpm: number;
  precisao: number;
  tempoDecorridoSegundos: number;
  /** null quando não há limite */
  tempoRestanteSegundos: number | null;
  iniciada: boolean;
  pausada: boolean;
  concluida: boolean;
  motivoFim: MotivoFim;
}

export interface OpcoesMotor {
  texto?: string | null;
  /** Fora de 'livre' | 'bloqueante' cai em CONFIG.TREINO.MODO_PADRAO. */
  modo?: ModoTreino | string;
  /** 0 (ou inválido) = sem limite. */
  tempoLimiteSegundos?: number | string | null;
  aoAtualizar?: (estado: EstadoMotor) => void;
  aoTerminar?: (estado: EstadoMotor) => void;
}

// ---------------------------------------------------------------------------
// Normalização do texto (do alvo e do que a pessoa digita).
// O texto vem do banco e pode ter caracteres tipográficos que NÃO existem no
// teclado: aspas curvas, travessão, espaço não separável. Sem trocar por
// aspas retas, hífen e espaço normal, a pessoa digita certo e o motor acusa
// erro — porque a tecla dela não é o code point que veio do banco.
// Quebra de linha vira espaço: o campo de captura é um <input>, que não
// aceita Enter, e o treino é de texto corrido.
function normalizarTexto(texto: unknown): string {
  return String(texto ?? '')
    .replace(/[‘’‚‛′]/g, "'") // ‘ ’ ‚ ‛ ′ -> '
    .replace(/[“”„‟″]/g, '"') // “ ” „ ‟ ″ -> "
    .replace(/[–—−]/g, '-') // – — − -> -
    .replace(/ /g, ' ') // espaço não separável (U+00A0) -> espaço normal
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]*\n[ \t]*/g, ' ') // quebra + indentação -> um espaço
    .replace(/\t/g, ' ');
}

// preventDefault reutilizável (referência estável para add/removeEventListener).
const prevenirEvento = (evento: Event) => evento.preventDefault();

export class MotorDigitacao {
  // --- configuração ---
  #alvoChars: string[] = [];
  #modo: ModoTreino = CONFIG.TREINO.MODO_PADRAO;
  #tempoLimiteSegundos = 0; // 0 = sem limite
  #aoAtualizar: (estado: EstadoMotor) => void = () => {};
  #aoTerminar: (estado: EstadoMotor) => void = () => {};

  // --- ligação com o DOM ---
  #inputEl: HTMLInputElement | null = null;

  // --- relógio: só timestamps, nunca acumulação por setInterval ---
  #inicioTimestamp = 0;
  #fimTimestamp = 0;
  #pausadoTimestamp = 0;
  #pausadoAcumuladoMs = 0;
  #intervaloId: ReturnType<typeof setInterval> | null = null; // só dispara o repaint da tela

  // --- contadores ---
  #acertos = 0;
  #erros = 0;
  #posicao = 0;
  #marcaMax = 0; // marca d'água: até onde já foi contabilizado
  #statusChars: StatusCaractere[] = [];

  // --- flags ---
  #iniciada = false;
  #pausada = false;
  #finalizada = false; // interno: trava o processamento de entrada e o relógio
  #concluida = false; // público: só true quando terminou o TEXTO
  #motivoFim: MotivoFim = null; // null | 'texto' | 'tempo'
  #pausadaPorFoco = false;

  constructor({ texto, modo, tempoLimiteSegundos, aoAtualizar, aoTerminar }: OpcoesMotor = {}) {
    this.#alvoChars = [...normalizarTexto(texto)];

    // modo 'livre' (marca o erro e segue) ou 'bloqueante' (não avança enquanto
    // não acertar). Sem valor válido, cai no padrão de CONFIG.TREINO.
    this.#modo = modo === 'livre' || modo === 'bloqueante' ? modo : CONFIG.TREINO.MODO_PADRAO;

    const limite = Number(tempoLimiteSegundos);
    this.#tempoLimiteSegundos = Number.isFinite(limite) && limite > 0 ? Math.floor(limite) : 0;

    if (typeof aoAtualizar === 'function') this.#aoAtualizar = aoAtualizar;
    if (typeof aoTerminar === 'function') this.#aoTerminar = aoTerminar;

    this.#statusChars = new Array(this.#alvoChars.length).fill('pendente');
  }

  // =========================================================================
  // Ligação com o input invisível
  // =========================================================================

  anexar(inputEl: HTMLInputElement): void {
    // POR QUE UM <input> INVISÍVEL + EVENTO 'input' (e não keydown):
    // o teclado brasileiro ABNT2 usa TECLAS MORTAS. O acento agudo sozinho
    // não gera caractere nenhum; só depois da vogal é que o sistema compõe
    // o "á". O keydown dispara na tecla morta e nunca "enxerga" o "á" que
    // aparece depois — capturar tecla a tecla quebra acento, cedilha e til.
    // A saída é NÃO capturar teclas: deixar o SO compor o texto dentro de um
    // <input> fora da vista e, a cada evento 'input', comparar input.value
    // com o texto alvo. Acentuação, ç e ~ passam a funcionar de graça, e o
    // teclado virtual do celular também. É a decisão menos óbvia do arquivo.
    if (this.#inputEl) this.#desanexar();
    this.#inputEl = inputEl;

    // Nada de sugestão, correção, maiúscula automática ou corretor: tudo isso
    // injeta texto que a pessoa não digitou.
    inputEl.setAttribute('autocomplete', 'off');
    inputEl.setAttribute('autocorrect', 'off');
    inputEl.setAttribute('autocapitalize', 'off');
    inputEl.setAttribute('spellcheck', 'false');

    inputEl.addEventListener('input', this.#aoDigitar);
    inputEl.addEventListener('paste', prevenirEvento); // colar mataria o treino
    inputEl.addEventListener('drop', prevenirEvento); // arrastar texto para dentro idem
    inputEl.addEventListener('dragover', prevenirEvento); // preciso p/ o 'drop' ser bloqueado
    inputEl.addEventListener('contextmenu', prevenirEvento); // sem menu de contexto (colar)
    inputEl.addEventListener('blur', this.#aoPerderFoco);
    inputEl.addEventListener('focus', this.#aoGanharFoco);
  }

  #desanexar(): void {
    const el = this.#inputEl;
    if (!el) return;
    el.removeEventListener('input', this.#aoDigitar);
    el.removeEventListener('paste', prevenirEvento);
    el.removeEventListener('drop', prevenirEvento);
    el.removeEventListener('dragover', prevenirEvento);
    el.removeEventListener('contextmenu', prevenirEvento);
    el.removeEventListener('blur', this.#aoPerderFoco);
    el.removeEventListener('focus', this.#aoGanharFoco);
  }

  // =========================================================================
  // Ciclo de vida
  // =========================================================================

  iniciar(): void {
    if (this.#finalizada) return;
    // O cronômetro NÃO parte aqui — só na primeira tecla (ver #ligarRelogio).
    // Aqui só damos foco e emitimos o estado inicial para a tela pintar.
    this.#inputEl?.focus();
    this.#emitir();
  }

  pausar(): void {
    if (!this.#iniciada || this.#pausada || this.#finalizada) return;
    this.#pausada = true;
    this.#pausadoTimestamp = performance.now();
    this.#emitir();
  }

  retomar(): void {
    if (!this.#pausada || this.#finalizada) return;
    // O tempo parado entra no acumulado e sai da conta do tempo decorrido.
    this.#pausadoAcumuladoMs += performance.now() - this.#pausadoTimestamp;
    this.#pausada = false;
    this.#pausadaPorFoco = false;
    this.#inputEl?.focus();
    this.#emitir();
  }

  reiniciar(): void {
    this.#pararRelogio();
    this.#inicioTimestamp = 0;
    this.#fimTimestamp = 0;
    this.#pausadoTimestamp = 0;
    this.#pausadoAcumuladoMs = 0;
    this.#acertos = 0;
    this.#erros = 0;
    this.#posicao = 0;
    this.#marcaMax = 0;
    this.#statusChars = new Array(this.#alvoChars.length).fill('pendente');
    this.#iniciada = false;
    this.#pausada = false;
    this.#finalizada = false;
    this.#concluida = false;
    this.#motivoFim = null;
    this.#pausadaPorFoco = false;
    if (this.#inputEl) this.#inputEl.value = '';
    this.#emitir();
  }

  destruir(): void {
    this.#pararRelogio();
    this.#desanexar();
    this.#inputEl = null;
  }

  // =========================================================================
  // Estado (somente leitura)
  // =========================================================================

  get estado(): EstadoMotor {
    const decorridoMs = this.#tempoDecorridoMs();
    const minutos = decorridoMs / 60000;
    const contados = this.#acertos + this.#erros;

    // PPM = (acertos / CARACTERES_POR_PALAVRA) / minutos decorridos
    const wpm =
      minutos > 0
        ? Math.round(this.#acertos / CONFIG.TREINO.CARACTERES_POR_PALAVRA / minutos)
        : 0;

    // Precisão = acertos / (acertos + erros) * 100. Sem nada digitado ainda: 100.
    const precisao = contados > 0 ? Math.round((this.#acertos / contados) * 100) : 100;

    const tempoRestanteSegundos =
      this.#tempoLimiteSegundos > 0
        ? Math.max(0, Math.ceil(this.#tempoLimiteSegundos - decorridoMs / 1000))
        : null; // null quando não há limite

    const caracteres: CaractereEstado[] = this.#alvoChars.map((char, i) => {
      // 'atual' é derivado aqui: é sempre o caractere sob o cursor.
      const status: StatusCaractere =
        !this.#finalizada && i === this.#posicao ? 'atual' : this.#statusChars[i];
      return { char, status };
    });

    return {
      caracteres,
      posicao: this.#posicao,
      digitados: contados, // caracteres produzidos e contabilizados
      acertos: this.#acertos,
      erros: this.#erros,
      wpm,
      precisao,
      tempoDecorridoSegundos: Math.round(decorridoMs / 1000),
      tempoRestanteSegundos,
      iniciada: this.#iniciada,
      pausada: this.#pausada,
      concluida: this.#concluida,
      motivoFim: this.#motivoFim,
    };
  }

  // Corpo do POST de sessão, com os nomes EXATOS que a API espera.
  montarCorpoSessao(): DadosSessaoTreino {
    const e = this.estado;
    return {
      wpm: e.wpm,
      precisao: e.precisao,
      acertos: e.acertos,
      erros: e.erros,
      tempo_gasto_segundos: e.tempoDecorridoSegundos,
      concluida: e.concluida,
    };
  }

  // =========================================================================
  // Relógio
  // =========================================================================

  #ligarRelogio(): void {
    this.#iniciada = true;
    this.#inicioTimestamp = performance.now();
    this.#pausadoAcumuladoMs = 0;
    // O intervalo NÃO conta o tempo — só pede repaint à tela. O tempo real
    // vem sempre da diferença de timestamps (#tempoDecorridoMs), que não
    // atrasa quando a aba perde prioridade e o setInterval engasga.
    this.#intervaloId = setInterval(() => this.#tick(), CONFIG.TREINO.INTERVALO_ATUALIZACAO_MS);
  }

  #pararRelogio(): void {
    if (this.#intervaloId != null) {
      clearInterval(this.#intervaloId);
      this.#intervaloId = null;
    }
  }

  #tempoDecorridoMs(): number {
    if (!this.#inicioTimestamp) return 0;
    const fim = this.#finalizada
      ? this.#fimTimestamp
      : this.#pausada
        ? this.#pausadoTimestamp
        : performance.now();
    let ms = fim - this.#inicioTimestamp - this.#pausadoAcumuladoMs;
    // Com limite, o tempo decorrido nunca passa do limite (o fim por 'tempo'
    // pode ser detectado até um tick depois).
    if (this.#tempoLimiteSegundos > 0) ms = Math.min(ms, this.#tempoLimiteSegundos * 1000);
    return Math.max(0, ms);
  }

  #tick(): void {
    if (this.#finalizada || this.#pausada || !this.#iniciada) return;
    if (
      this.#tempoLimiteSegundos > 0 &&
      this.#tempoDecorridoMs() >= this.#tempoLimiteSegundos * 1000
    ) {
      this.#finalizar('tempo'); // esgotou o tempo: concluida = false
      return;
    }
    this.#emitir(); // só repaint; o tempo já anda sozinho
  }

  // =========================================================================
  // Entrada do usuário
  // =========================================================================

  #aoDigitar = (): void => {
    if (this.#finalizada || this.#pausada || !this.#inputEl) return;
    if (!this.#iniciada) this.#ligarRelogio(); // cronômetro parte na 1ª tecla

    const valor = normalizarTexto(this.#inputEl.value);
    if (this.#modo === 'bloqueante') this.#processarBloqueante(valor);
    else this.#processarLivre(valor);

    this.#emitir();

    // Completou o texto? (vale para os dois modos)
    if (this.#posicao >= this.#alvoChars.length) this.#finalizar('texto');
  };

  // LIVRE: o erro é marcado e o treino segue. O input cresce livremente.
  #processarLivre(valorEntrada: string): void {
    const total = this.#alvoChars.length;
    let valor = valorEntrada;

    // Não deixa digitar além do fim do texto.
    if (valor.length > total) {
      valor = valor.slice(0, total);
      this.#inputEl.value = valor;
    }

    const n = valor.length;

    // REGRA 1: cada caractere novo produzido conta UMA vez. "Novo" = além da
    // marca d'água (#marcaMax). Bate com o alvo -> acerto; não bate -> erro.
    // REGRA 2: backspace não desconta. Ao apagar, n cai, mas #marcaMax fica —
    // então reentrar naquelas posições não conta de novo.
    while (this.#marcaMax < n) {
      const i = this.#marcaMax;
      if (valor[i] === this.#alvoChars[i]) this.#acertos++;
      else this.#erros++;
      this.#marcaMax++;
    }

    this.#posicao = n;

    // REGRA 3: uma posição corrigida mantém o erro já contado, mas passa a
    // exibir 'correto'. Por isso o STATUS é recalculado do valor atual, sem
    // encostar nos contadores.
    for (let i = 0; i < total; i++) {
      if (i < n) this.#statusChars[i] = valor[i] === this.#alvoChars[i] ? 'correto' : 'errado';
      else this.#statusChars[i] = 'pendente';
    }
  }

  // BLOQUEANTE: não avança enquanto não acertar o caractere atual.
  #processarBloqueante(valor: string): void {
    const total = this.#alvoChars.length;

    if (valor.length <= this.#posicao) {
      // Backspace (ou nada). Tudo antes de #posicao já está correto; deixa
      // recuar. Não desconta acerto (regra 2).
      this.#posicao = valor.length;
    } else {
      const tecla = valor[this.#posicao];
      if (tecla === this.#alvoChars[this.#posicao]) {
        // REGRA 1/3: só conta acerto na PRIMEIRA vez que passa por esta posição.
        if (this.#posicao === this.#marcaMax) {
          this.#acertos++;
          this.#marcaMax++;
        }
        this.#posicao++;
      } else {
        // Cada tentativa errada é um caractere produzido que não bateu.
        this.#erros++;
      }
    }

    // O campo sempre reflete só o prefixo já acertado. Definir value por
    // código não dispara um novo evento 'input'.
    this.#inputEl.value = this.#alvoChars.slice(0, this.#posicao).join('');

    for (let i = 0; i < total; i++) {
      this.#statusChars[i] = i < this.#posicao ? 'correto' : 'pendente';
    }
  }

  // =========================================================================
  // Foco: pausar e retomar sozinho
  // =========================================================================

  #aoPerderFoco = (): void => {
    // Sem pausar aqui, o cronômetro continuaria correndo enquanto a pessoa
    // está em outra aba ou respondendo uma mensagem — e destruiria o PPM
    // dela sem que tivesse feito nada de errado.
    if (this.#iniciada && !this.#pausada && !this.#finalizada) {
      this.#pausadaPorFoco = true;
      this.pausar();
    }
  };

  #aoGanharFoco = (): void => {
    // Retoma só o que foi pausado pela PERDA DE FOCO. Uma pausa manual
    // (motor.pausar()) continua valendo até motor.retomar().
    if (this.#pausadaPorFoco) this.retomar();
  };

  // =========================================================================
  // Fim
  // =========================================================================

  #finalizar(motivo: 'texto' | 'tempo'): void {
    if (this.#finalizada) return;
    this.#finalizada = true;
    this.#fimTimestamp = performance.now();
    this.#motivoFim = motivo; // 'texto' | 'tempo'
    // 'texto' -> concluída de verdade; 'tempo' -> esgotou antes do fim.
    // É isto que alimenta a coluna Concluida do banco.
    this.#concluida = motivo === 'texto';
    this.#pausada = false;
    this.#pararRelogio();

    const estadoFinal = this.estado;
    this.#aoAtualizar(estadoFinal);
    this.#aoTerminar(estadoFinal);
  }

  #emitir(): void {
    this.#aoAtualizar(this.estado);
  }
}
