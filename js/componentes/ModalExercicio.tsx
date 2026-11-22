// Modal de criar/editar exercício. Saiu de professor/Biblioteca.tsx quando
// o modal "Atribuir exercício" da turma (professor/Turma.tsx) passou a
// criar um exercício novo sem sair da tela.
import { useRef, useState } from 'react';
import { api } from '../nucleo/api.js';
import type { DadosExercicio, Dificuldade, ErroDaApi, Exercicio } from '../nucleo/tipos.js';
import {
  LIMITES,
  normalizarTextoExercicio,
  validarTextoExercicio,
  validarTituloExercicio,
} from '../utils/validacao.js';
import { Modal, type ModalHandle } from './ModalReact.js';
import { DIFICULDADES } from '../utils/formato.js';

// As opções do tempo limite, em segundos (a API continua recebendo segundos).
const TEMPOS = [0, 30, 60, 120, 180];

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  NAO_ENCONTRADO: 'Esse exercício não existe mais. Recarregue a biblioteca.',
  DADOS_INVALIDOS: 'O servidor não aceitou esses dados. Confira os campos.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// 0 = sem limite; o resto em m:ss (90 -> "1:30", 3600 -> "60:00").
export function formatarTempoLimite(segundos: number | null | undefined): string {
  if (!Number.isFinite(segundos)) return '—';
  if (segundos <= 0) return 'Sem limite';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Erros — decide pelo status, nunca pelo texto que o servidor mandou.
export function mensagemDaFalha(excecao: unknown): string {
  // Duck typing, não instanceof: o erro do mock tem a mesma forma do
  // ErroApi do api.ts, mas não é instância dele.
  const erro = excecao as ErroDaApi | null | undefined;
  const daApi = erro?.name === 'ErroApi';
  if (!daApi) {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  // 401 não entra aqui: o api.ts já derruba a sessão e sai da tela.
  if (erro.status === 0) return MENSAGENS.CONEXAO;
  if (erro.status === 403) return MENSAGENS.PERMISSAO;
  if (erro.status === 404) return MENSAGENS.NAO_ENCONTRADO;
  if (erro.status === 400 || erro.status === 422) return MENSAGENS.DADOS_INVALIDOS;
  return MENSAGENS.GENERICA;
}

interface PropsModalExercicio {
  /** null = criar. */
  exercicio: Exercicio | null;
  aoConcluir: (salvo: Exercicio) => void;
  aoFechar: () => void;
  /** Texto do botão de criar; na turma ele também atribui. */
  rotuloCriar?: string;
}

interface ErrosFormulario {
  titulo?: string | null;
  texto?: string | null;
}

export function ModalExercicio({ exercicio, aoConcluir, aoFechar, rotuloCriar = 'Criar exercício' }: PropsModalExercicio) {
  const modal = useRef<ModalHandle>(null);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const [id] = useState(() => `exercicio-${Date.now().toString(36)}`);

  const editando = exercicio !== null;

  const [titulo, setTitulo] = useState(exercicio?.titulo ?? '');
  const [texto, setTexto] = useState(exercicio?.texto ?? '');
  const [dificuldade, setDificuldade] = useState<Dificuldade>(exercicio?.dificuldade ?? 'facil');
  // Como string: é o value do <select>. Vira número só ao enviar.
  const [tempo, setTempo] = useState(String(exercicio?.tempoLimiteSegundos ?? 0));
  // Exercício antigo com um tempo fora da lista (ex.: 90 s) mantém o dele.
  const opcoesDeTempo = TEMPOS.includes(Number(tempo)) ? TEMPOS : [...TEMPOS, Number(tempo)].sort((a, b) => a - b);
  const [erros, setErros] = useState<ErrosFormulario>({});
  // Erro do servidor, embaixo do formulário inteiro.
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // Uma requisição por vez: o ref é a trava síncrona; o estado é o que o
  // botão mostra.
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  // Contador vivo: o tamanho que o texto vai ter quando salvo — já sem as
  // quebras (cada uma vira um espaço), mas sem aparar as pontas, senão
  // digitar um espaço no fim não moveria o número.
  const tamanho = texto.replace(/\r\n|\r|\n/g, ' ').length;
  const excedido = tamanho > LIMITES.EXERCICIO_TEXTO_MAX;
  // A quebra não é erro: o motor trabalha com uma linha contínua, então ao
  // salvar ela vira espaço. Aviso discreto enquanto houver alguma.
  const temQuebra = /[\r\n]/.test(texto);

  function marcarErro(campo: keyof ErrosFormulario, mensagem: string | null) {
    setErros((atual) => ({ ...atual, [campo]: mensagem }));
  }

  async function confirmar() {
    if (enviando.current) return;

    const invalidos: ErrosFormulario = {
      titulo: validarTituloExercicio(titulo),
      texto: validarTextoExercicio(texto),
    };
    if (invalidos.titulo || invalidos.texto) {
      setErros(invalidos);
      // Foco no primeiro campo com problema, de cima para baixo.
      if (invalidos.titulo) campoTitulo.current?.focus();
      else campoTexto.current?.focus();
      return;
    }

    enviando.current = true;
    setOcupado(true);
    setErroEnvio(null);

    // Quebra de linha vira espaço AQUI, ao salvar — o aviso embaixo do campo
    // já disse que ia acontecer. O textarea acompanha, para o que a pessoa
    // vê ser o que foi gravado se o servidor recusar e o modal ficar.
    const textoFinal = normalizarTextoExercicio(texto);
    if (textoFinal !== texto) setTexto(textoFinal);

    const dados: DadosExercicio = {
      titulo: titulo.trim(),
      texto: textoFinal,
      dificuldade,
      tempoLimiteSegundos: Number(tempo),
    };

    try {
      const resposta = editando
        ? await api.exercicios.atualizar(exercicio.id, dados)
        : await api.exercicios.criar(dados);
      modal.current?.fechar();
      // Back que devolva só parte: o que a tela mandou preenche o resto.
      aoConcluir({ ...(exercicio ?? { id: '' }), ...dados, ...(resposta ?? {}) } as Exercicio);
    } catch (excecao) {
      setErroEnvio(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  return (
    <Modal
      ref={modal}
      eyebrow={editando ? 'Exercício' : 'Novo exercício'}
      titulo={editando ? 'Editar exercício' : 'Criar exercício'}
      acoes={[
        // fecha: false — quem fecha é o sucesso. Se o servidor recusar, o
        // modal fica de pé com o que foi digitado e o erro à vista.
        {
          rotulo: ocupado ? (editando ? 'Salvando…' : 'Criando…') : editando ? 'Salvar' : rotuloCriar,
          principal: true,
          fecha: false,
          aoClicar: confirmar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      // O modal foca o botão principal sozinho; aqui o título é o lugar
      // certo para começar.
      aoAbrir={() => {
        campoTitulo.current?.focus();
        if (editando) campoTitulo.current?.select();
      }}
      aoFechar={aoFechar}
    >
      {/* Enter no título envia; no textarea, Enter é quebra de
          linha (que o aviso abaixo cobre). */}
      <form
        className="form-exercicio"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          confirmar();
        }}
      >
        <div className="campo-modal">
          <label htmlFor={`${id}-titulo`}>Título</label>
          <input
            type="text"
            id={`${id}-titulo`}
            ref={campoTitulo}
            value={titulo}
            maxLength={LIMITES.EXERCICIO_TITULO_MAX}
            autoComplete="off"
            aria-describedby={`${id}-titulo-erro`}
            aria-invalid={Boolean(erros.titulo)}
            className={erros.titulo ? 'invalido' : undefined}
            onChange={(evento) => setTitulo(evento.target.value)}
            // Validação no blur e no envio — nunca a cada tecla.
            onBlur={() => {
              if (titulo === '') return; // em branco no blur não é erro ainda
              marcarErro('titulo', validarTituloExercicio(titulo));
            }}
          />
          <p className="erro-campo" id={`${id}-titulo-erro`} aria-live="polite">
            {erros.titulo}
          </p>
        </div>

        <div className="campo-modal">
          <label htmlFor={`${id}-texto`}>Texto do exercício</label>
          <textarea
            id={`${id}-texto`}
            ref={campoTexto}
            value={texto}
            rows={6}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-texto-contador ${id}-texto-aviso ${id}-texto-erro`}
            aria-invalid={Boolean(erros.texto)}
            className={erros.texto ? 'invalido' : undefined}
            onChange={(evento) => setTexto(evento.target.value)}
            onBlur={() => {
              if (texto === '') return;
              marcarErro('texto', validarTextoExercicio(texto));
            }}
          />
          <p className={excedido ? 'contador-texto excedido' : 'contador-texto'} id={`${id}-texto-contador`}>
            {tamanho} / {LIMITES.EXERCICIO_TEXTO_MAX}
          </p>
          <p className="aviso-campo" id={`${id}-texto-aviso`} aria-live="polite">
            {temQuebra ? 'O texto tem quebras de linha: ao salvar, cada uma vira um espaço. O treino é uma linha contínua.' : ''}
          </p>
          <p className="erro-campo" id={`${id}-texto-erro`} aria-live="polite">
            {erros.texto}
          </p>
        </div>

        <div className="campos-lado-a-lado">
          <div className="campo-modal">
            <label htmlFor={`${id}-dificuldade`}>Dificuldade</label>
            <select
              id={`${id}-dificuldade`}
              value={dificuldade}
              onChange={(evento) => setDificuldade(evento.target.value as Dificuldade)}
            >
              {DIFICULDADES.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="campo-modal">
            <label htmlFor={`${id}-tempo`}>Tempo limite</label>
            <select id={`${id}-tempo`} value={tempo} onChange={(evento) => setTempo(evento.target.value)}>
              {opcoesDeTempo.map((segundos) => (
                <option key={segundos} value={String(segundos)}>
                  {segundos === 0 ? 'Sem limite' : formatarTempoLimite(segundos)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="erro-campo" aria-live="polite">
          {erroEnvio}
        </p>
      </form>
    </Modal>
  );
}
