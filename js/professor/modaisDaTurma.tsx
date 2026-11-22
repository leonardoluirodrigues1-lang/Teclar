// modaisDaTurma.tsx — os modais de uma turma do professor, usados na grade
// (Minhas turmas, ./Turmas.tsx) e na própria turma (./Turma.tsx):
//   ModalNome      criar e renomear (o criar pede também o semestre)
//   ModalCapa      outro desenho ou imagem do computador, com prévia
//   ModalArquivar  confirmação simples: arquivar não apaga nada
// e mensagemDaFalha, o texto de erro que os três (e a grade) mostram.

import { useId, useRef, useState } from 'react';
import { api } from '../nucleo/api.js';
import type { ErroDaApi, Turma } from '../nucleo/tipos.js';
import { validarNomeTurma } from '../utils/validacao.js';
import { CapaOuImagem, lembrarCapa, sementeDaTurma } from '../componentes/EntradaDoModo.js';
import { imagemDaCapa } from '../utils/imagemDaCapa.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  NAO_ENCONTRADA: 'Essa turma não existe mais. Recarregue a página.',
  NOME_EM_USO: 'Você já tem uma turma com esse nome.',
  NOME_INVALIDO: 'Esse nome não foi aceito pelo servidor.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// Capa — o desenho é o CapaDaTurma de EntradaDoModo.tsx

// Uma semente nova para o "Editar capa". Inteira e positiva: cabe no INT
// da coluna CapaSemente.
function sortearSemente(): number {
  return Math.floor(Math.random() * 1000000);
}

// Modal de nome — criar e renomear

interface PropsModalNome {
  eyebrow: string;
  titulo: string;
  valor: string;
  rotuloAcao: string;
  textoOcupado: string;
  /** Mostra o seletor de semestre (só ao criar: o back exige o semestre). */
  comSemestre?: boolean;
  enviar: (nome: string, semestre: 1 | 2) => Promise<Turma>;
  aoConcluir: (resposta: Turma) => void;
  aoFechar: () => void;
}

export function ModalNome({
  eyebrow,
  titulo,
  valor,
  rotuloAcao,
  textoOcupado,
  comSemestre = false,
  enviar,
  aoConcluir,
  aoFechar,
}: PropsModalNome) {
  const modal = useRef<ModalHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const [id] = useState(() => `campo-turma-${Date.now().toString(36)}`);

  const [nome, setNome] = useState(valor);
  // Começa no semestre do calendário (jan–jun = 1º); o professor troca se preciso.
  const [semestre, setSemestre] = useState<1 | 2>(() => (new Date().getMonth() < 6 ? 1 : 2));
  const [erro, setErro] = useState<string | null>(null);
  // Uma requisição por vez: segura o clique repetido e o Enter repetido.
  // O ref é a trava síncrona; o estado é o que o botão mostra.
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (enviando.current) return;

    const invalido = validarNomeTurma(nome);
    if (invalido) {
      setErro(invalido);
      input.current?.focus();
      return;
    }

    enviando.current = true;
    setOcupado(true);
    setErro(null);

    try {
      const resposta = await enviar(nome.trim(), semestre);
      modal.current?.fechar();
      aoConcluir(resposta);
    } catch (excecao) {
      // O erro fica embaixo do campo, onde a pessoa está olhando.
      setErro(mensagemDaFalha(excecao));
      input.current?.focus();
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
        // fecha: false — quem fecha é o sucesso. Se o servidor recusar, o
        // modal fica de pé com o que foi digitado e o erro à vista.
        {
          rotulo: ocupado ? textoOcupado : rotuloAcao,
          principal: true,
          fecha: false,
          aoClicar: confirmar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      // O modal foca o botão principal sozinho; aqui o campo é o lugar certo
      // para começar.
      aoAbrir={() => {
        input.current?.focus();
        input.current?.select();
      }}
      aoFechar={aoFechar}
    >
      {/* Enter no campo envia, sem precisar ir até o botão. */}
      <form
        className="campo-modal"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          confirmar();
        }}
      >
        <label htmlFor={id}>Nome da turma</label>
        <input
          type="text"
          id={id}
          ref={input}
          value={nome}
          maxLength={100}
          autoComplete="off"
          aria-describedby={`${id}-erro`}
          aria-invalid={Boolean(erro)}
          onChange={(evento) => setNome(evento.target.value)}
          // Validação no blur e no envio — nunca a cada tecla.
          onBlur={() => {
            if (nome === '') return; // em branco no blur não é erro ainda
            setErro(validarNomeTurma(nome));
          }}
        />
        <p className="erro-campo" id={`${id}-erro`} aria-live="polite">
          {erro}
        </p>
        {comSemestre && (
          <>
            <label htmlFor={`${id}-semestre`}>Semestre</label>
            <select
              id={`${id}-semestre`}
              value={semestre}
              disabled={ocupado}
              onChange={(evento) => setSemestre(evento.target.value === '2' ? 2 : 1)}
            >
              <option value="1">1º semestre</option>
              <option value="2">2º semestre</option>
            </select>
          </>
        )}
      </form>
    </Modal>
  );
}

// Modal de capa — outro desenho, ou uma imagem do computador, e a prévia
// antes de salvar

interface PropsModalCapa {
  turma: Turma;
  aoConcluir: (campos: Pick<Turma, 'capaSemente' | 'temCapa'>) => void;
  aoFechar: () => void;
}

export function ModalCapa({ turma, aoConcluir, aoFechar }: PropsModalCapa) {
  const modal = useRef<ModalHandle>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const id = useId();
  // Começa na capa de hoje: "Outro desenho" é que troca. Salvar sem trocar
  // grava a mesma semente, o que não faz mal.
  const [semente, setSemente] = useState(() => sementeDaTurma(turma.id, turma.capaSemente));
  // undefined: a imagem fica como está; texto: a nova (data URL WEBP, já
  // reduzida no navegador); null: tirar a imagem e voltar ao desenho.
  const [imagem, setImagem] = useState<string | null | undefined>(undefined);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  const comImagem = imagem === undefined ? turma.temCapa : imagem !== null;

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setPreparando(true);
    try {
      setImagem(await imagemDaCapa(arquivo));
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setPreparando(false);
      // O mesmo arquivo escolhido de novo também dispara o onChange.
      if (seletor.current) seletor.current.value = '';
    }
  }

  async function salvar() {
    if (enviando.current || preparando) return;
    enviando.current = true;
    setOcupado(true);
    setErro(null);

    try {
      await api.turmas.trocarCapa(turma.id, semente);
      if (typeof imagem === 'string') {
        await api.turmas.enviarCapa(turma.id, imagem);
      } else if (imagem === null && turma.temCapa) {
        await api.turmas.removerCapa(turma.id);
      }
      if (imagem !== undefined) lembrarCapa(turma.id, imagem);
      modal.current?.fechar();
      aoConcluir({ capaSemente: semente, temCapa: comImagem });
    } catch (excecao) {
      setErro(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  return (
    <Modal
      ref={modal}
      eyebrow={turma.nome}
      titulo="Editar capa"
      acoes={[
        {
          rotulo: ocupado ? 'Salvando…' : 'Salvar capa',
          principal: true,
          fecha: false,
          aoClicar: salvar,
          disabled: ocupado || preparando,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      aoFechar={aoFechar}
    >
      {/* A prévia é o que vai para a grade: a imagem escolhida, a que já
          está gravada, ou o desenho. */}
      <div className="capa-previa">
        {typeof imagem === 'string' ? (
          <img className="capa-imagem" src={imagem} alt="" />
        ) : (
          <CapaOuImagem id={turma.id} semente={semente} temCapa={comImagem} />
        )}
      </div>
      <div className="capa-botoes">
        <button
          type="button"
          className="btn btn-vidro vidro tecla"
          disabled={ocupado || preparando}
          aria-describedby={`${id}-dica`}
          onClick={() => seletor.current?.click()}
        >
          {preparando ? 'Preparando imagem…' : 'Escolher imagem do computador'}
        </button>
        {comImagem ? (
          <button
            type="button"
            className="btn btn-vidro vidro tecla"
            disabled={ocupado || preparando}
            onClick={() => setImagem(null)}
          >
            Remover imagem
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-vidro vidro tecla"
            disabled={ocupado}
            onClick={() => setSemente(sortearSemente())}
          >
            Outro desenho
          </button>
        )}
      </div>
      <input
        ref={seletor}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(evento) => escolher(evento.target.files?.[0])}
      />
      <p className="ajuda-campo" id={`${id}-dica`}>
        JPG, PNG ou WEBP. O meio da foto vira uma faixa de até 1200×400, em WEBP de até 150 KB.
      </p>
      <p className="erro-campo" aria-live="polite">
        {erro}
      </p>
    </Modal>
  );
}

// Modal de arquivar — confirmação simples

interface PropsModalArquivar {
  turma: Turma;
  aoConcluir: () => void;
  aoFechar: () => void;
}

export function ModalArquivar({ turma, aoConcluir, aoFechar }: PropsModalArquivar) {
  const modal = useRef<ModalHandle>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  async function arquivar() {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setErro(null);

    try {
      await api.turmas.arquivar(turma.id);
      modal.current?.fechar();
      aoConcluir();
    } catch (excecao) {
      setErro(mensagemDaFalha(excecao));
      enviando.current = false;
      setOcupado(false);
    }
  }

  // Confirmação simples, sem digitar o nome: arquivar não apaga nada.
  return (
    <Modal
      ref={modal}
      eyebrow={turma.nome}
      titulo="Arquivar turma?"
      acoes={[
        {
          rotulo: ocupado ? 'Arquivando…' : 'Arquivar turma',
          principal: true,
          fecha: false,
          aoClicar: arquivar,
          disabled: ocupado,
        },
        { rotulo: 'Cancelar', disabled: ocupado },
      ]}
      aoFechar={aoFechar}
    >
      <p>
        A turma some da sua lista. O histórico de treino dos alunos dela é mantido, e dá para
        desarquivar depois em “Mostrar arquivadas”, abaixo das turmas.
      </p>
      <p className="erro-campo" aria-live="polite">
        {erro}
      </p>
    </Modal>
  );
}

// Erros

// A tela decide pelo status, nunca pelo texto do servidor: mensagem de
// back muda, vem em inglês, vem com detalhe técnico. O status também
// nunca aparece para a pessoa.
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
  if (erro.status === 404) return MENSAGENS.NAO_ENCONTRADA;
  if (erro.status === 409) return MENSAGENS.NOME_EM_USO;
  if (erro.status === 400) return MENSAGENS.NOME_INVALIDO;
  return MENSAGENS.GENERICA;
}

