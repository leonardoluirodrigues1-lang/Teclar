// Dashboard.tsx — pages/aluno/dashboard.html
// A tela de entrada do modo Aluno: as salas em que ele está. É a irmã da
// tela de turmas do Professor (js/professor/Turmas.tsx) e usa as MESMAS
// peças (../componentes/EntradaDoModo.tsx): a conta fixa no canto (aqui
// com o RP embaixo do nome), a abertura com a marca, as três teclas e o
// cartão com a capa gerada.
//
// O que muda do professor:
//   · as teclas são Salas, Convites e Histórico. A de Convites mostra em
//     vermelho quantos esperam resposta;
//   · os CONVITES vêm antes da grade, cada um num painel de alerta, com
//     "Entrar na sala" e "Recusar". Respondido, o painel some e a sala
//     entra (ou não) na grade, sem recarregar;
//   · o cartão troca as contagens pelo progresso DELE (anel com feitos
//     sobre o total), e a linha em mono é o professor. Sala com tudo feito
//     ganha a estrela de conquista — a única estrela desta tela;
//   · não há "⋯" nem "Criar turma": renomear, trocar capa, arquivar e
//     convidar são do professor.
//
// Dados: GET /aluno/salas e GET /aluno/convites (api.escola.aluno), tudo
// pronto do back. Esta tela não conta nada além de somar o tamanho da
// lista de convites.

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import type { ConviteDoAluno, ErroDaApi, SalaDoAluno } from '../nucleo/tipos.js';
import { SECOES_ALUNO } from '../componentes/Nav.js';
import { Abertura, CartaoDeTurma, ContaFixa, Funcao, Funcoes } from '../componentes/EntradaDoModo.js';
import { Modal } from '../componentes/ModalReact.js';
import { EsqueletoGrade } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { BotaoCopiar } from '../componentes/BotaoCopiar.js';
import { Estrela } from '../componentes/Estrela.js';
import { formatarRp, haQuantoTempo } from '../utils/formato.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Guarda de aluno antes de qualquer outra coisa. Devolveu null, já
// redirecionou: a montagem lá no fim do arquivo não acontece e a tela para.
const usuario = guarda.soAluno();

// Quantos esqueletos desenhar enquanto as salas não chegam. Uma fileira:
// um aluno costuma estar em poucas salas.
const ESQUELETOS = 3;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  CONVITE_SUMIU: 'Este convite não existe mais: o professor pode tê-lo cancelado.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// ============================================================================
// Estado da tela
// ============================================================================

// Três estados excludentes, e não três booleanos soltos.
type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; salas: SalaDoAluno[]; convites: ConviteDoAluno[] };

// ============================================================================
// Tela
// ============================================================================

function Salas() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  // `tentativa` só serve para o botão "Tentar de novo" disparar o efeito
  // outra vez.
  const [tentativa, setTentativa] = useState(0);

  // Os títulos das duas seções. tabIndex -1 neles: as teclas levam o foco
  // até aqui, e é para cá que ele volta quando um convite some.
  const tituloConvites = useRef<HTMLHeadingElement>(null);
  const tituloSalas = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        // Juntas: o convite aceito vira sala, e as duas listas precisam
        // contar a mesma história.
        const [salas, convites] = await Promise.all([api.escola.aluno.salas(), api.escola.aluno.convites()]);
        if (!cancelado) setCarga({ estado: 'pronto', salas, convites });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const convites = carga.estado === 'pronto' ? carga.convites : [];

  // --- respostas aos convites ----------------------------------------------

  // Aceito: o convite sai e a sala entra no fim da grade, com o que o back
  // devolveu. flushSync: o foco abaixo precisa da tela já redesenhada.
  function aoAceitar(convite: ConviteDoAluno, sala: SalaDoAluno) {
    guardarSalaNaSessao(sala);
    flushSync(() =>
      setCarga((atual) =>
        atual.estado === 'pronto'
          ? {
              estado: 'pronto',
              salas: [...atual.salas, sala],
              convites: atual.convites.filter((c) => c.turmaId !== convite.turmaId),
            }
          : atual,
      ),
    );
    // O painel (e o botão que tinha o foco) sumiu. A sala nova está na grade.
    tituloSalas.current?.focus();
  }

  function aoRecusar(convite: ConviteDoAluno) {
    flushSync(() =>
      setCarga((atual) =>
        atual.estado === 'pronto'
          ? { ...atual, convites: atual.convites.filter((c) => c.turmaId !== convite.turmaId) }
          : atual,
      ),
    );
    tituloConvites.current?.focus();
  }

  // --- grade e estados ------------------------------------------------------

  function renderizarSalas() {
    if (carga.estado === 'carregando') return <EsqueletoGrade quantidade={ESQUELETOS} />;

    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar suas salas"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }

    if (carga.salas.length === 0) {
      return (
        <PainelEstado
          titulo="Você ainda não está em nenhuma sala"
          texto="Você entra numa sala quando um professor convida o seu RP. Passe este número para ele:"
        >
          <p className="estado-rp">{formatarRp(usuario.id)}</p>
          {/* Copia o RP sem o espaço: é assim que o professor digita. */}
          <BotaoCopiar texto={usuario.id} rotulo="Copiar meu RP" className="btn btn-vidro vidro tecla" />
        </PainelEstado>
      );
    }

    return (
      <div className="grade entrada-escalonada">
        {carga.salas.map((sala) => (
          <CartaoDaSala key={sala.id} sala={sala} />
        ))}
      </div>
    );
  }

  return (
    <>
      <ContaFixa secoes={SECOES_ALUNO} papel={formatarRp(usuario.id)} />

      <main>
        <Abertura />

        <Funcoes rotulo="Funções do aluno">
          <Funcao href="#suas-salas" nome="Salas" texto="As turmas em que você entrou e os exercícios de cada uma." />
          <Funcao
            href="#convites"
            nome="Convites"
            texto="Professores que convidaram seu RP e esperam resposta."
            // Zero convites: a linha não aparece. "0 convites" é ruído.
            sinal={
              convites.length === 0
                ? null
                : convites.length === 1
                  ? '1 convite esperando'
                  : `${convites.length} convites esperando`
            }
          />
          <Funcao href="historico.html" nome="Histórico" texto="Tudo o que você já treinou, nas salas em que está." />
        </Funcoes>

        {/* Os convites vêm ANTES das salas: são a única coisa da tela que
            espera uma resposta dele. Só aparecem com a lista pronta. */}
        {carga.estado === 'pronto' && (
          <section className="secao-convites" aria-labelledby="convites">
            <div className="cabecalho">
              <div className="cabecalho-texto">
                <h2 className="titulo" id="convites" tabIndex={-1} ref={tituloConvites}>
                  Convites
                </h2>
                <p className="subtitulo">
                  {convites.length > 0
                    ? 'Você decide se entra. O professor não pode te colocar sozinho.'
                    : 'Nenhum convite esperando resposta. Quando um professor convidar o seu RP, ele aparece aqui.'}
                </p>
              </div>
            </div>
            {convites.map((convite) => (
              <PainelDoConvite
                key={convite.turmaId}
                convite={convite}
                aoAceitar={(sala) => aoAceitar(convite, sala)}
                aoRecusar={() => aoRecusar(convite)}
              />
            ))}
          </section>
        )}

        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo" id="suas-salas" tabIndex={-1} ref={tituloSalas}>
              Suas salas
            </h1>
            <p className="subtitulo">Abra uma sala para ver os exercícios, o ranking e seu relatório.</p>
          </div>
        </div>

        {/* A grade e os estados (carregando, vazio, erro) ocupam o mesmo lugar. */}
        <div id="conteudo" aria-busy={carga.estado === 'carregando'}>
          {renderizarSalas()}
        </div>
      </main>
    </>
  );
}

// ============================================================================
// Cartão da sala
// ============================================================================

function CartaoDaSala({ sala }: { sala: SalaDoAluno }) {
  // Sala sem exercício nenhum não está "completa": não há conquista em
  // terminar zero de zero.
  const completa = sala.exerciciosTotal > 0 && sala.exerciciosFeitos === sala.exerciciosTotal;

  return (
    <CartaoDeTurma
      id={sala.id}
      nome={sala.nome}
      href={`sala.html?${new URLSearchParams({ id: sala.id })}`}
      linha={sala.professor}
      capaSemente={sala.capaSemente}
      aposNome={
        completa && (
          <>
            {/* A estrela é desenho (aria-hidden): o texto diz o que ela é. */}
            <Estrela tamanho={15} />
            <span className="sr-only"> — todos os exercícios concluídos</span>
          </>
        )
      }
    >
      <div className="cartao-progresso">
        <AnelDeProgresso feitos={sala.exerciciosFeitos} total={sala.exerciciosTotal} />
        <div>
          <span className="metrica-rotulo">Exercícios</span>
          <span className="metrica-valor">
            {sala.exerciciosFeitos}/{sala.exerciciosTotal}
          </span>
        </div>
      </div>
    </CartaoDeTurma>
  );
}

// Raio 19 num quadro de 46: sobra espaço para o traço de 4. O arco começa
// no alto (o rotate de -90° em escola.css) e anda no sentido do relógio.
const RAIO_DO_ANEL = 19;
const VOLTA_DO_ANEL = 2 * Math.PI * RAIO_DO_ANEL;

// Decorativo: o "5/8" ao lado já diz o mesmo em texto.
function AnelDeProgresso({ feitos, total }: { feitos: number; total: number }) {
  // Sala sem exercício: anel vazio, e não uma divisão por zero.
  const feito = total > 0 ? VOLTA_DO_ANEL * (feitos / total) : 0;
  return (
    <svg className="anel-progresso" width="46" height="46" viewBox="0 0 46 46" aria-hidden="true" focusable="false">
      <circle className="anel-progresso-trilho" cx="23" cy="23" r={RAIO_DO_ANEL} />
      {feito > 0 && (
        <circle
          className="anel-progresso-feito"
          cx="23"
          cy="23"
          r={RAIO_DO_ANEL}
          strokeDasharray={`${feito.toFixed(1)} ${VOLTA_DO_ANEL.toFixed(1)}`}
        />
      )}
    </svg>
  );
}

// ============================================================================
// Painel do convite
// ============================================================================

interface PropsConvite {
  convite: ConviteDoAluno;
  aoAceitar: (sala: SalaDoAluno) => void;
  aoRecusar: () => void;
}

function PainelDoConvite({ convite, aoAceitar, aoRecusar }: PropsConvite) {
  // Qual resposta está indo para o servidor agora. O ref é a trava
  // síncrona contra o clique duplo; o estado é o que os botões mostram.
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState<'aceitar' | 'recusar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O convite deixou de existir do lado do servidor: os botões somem e só
  // a mensagem fica. Recarregar a página tira o painel.
  const [sumiu, setSumiu] = useState(false);
  // A confirmação de recusar. Um número para cada abertura montar um modal
  // novo (ver ModalReact.tsx).
  const [confirmar, setConfirmar] = useState<number | null>(null);

  async function responder(resposta: 'aceitar' | 'recusar') {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(resposta);
    setErro(null);

    try {
      if (resposta === 'aceitar') {
        const sala = await api.escola.aluno.aceitarConvite(convite.turmaId);
        // Daqui o painel sai da tela: nada de mexer no estado dele depois.
        aoAceitar(sala);
      } else {
        await api.escola.aluno.recusarConvite(convite.turmaId);
        aoRecusar();
      }
    } catch (excecao) {
      // O erro fica no próprio painel, onde ele está olhando — nunca alert.
      const naoExiste = (excecao as ErroDaApi | null)?.status === 404;
      setErro(naoExiste ? MENSAGENS.CONVITE_SUMIU : mensagemDaFalha(excecao));
      setSumiu(naoExiste);
      enviando.current = false;
      setOcupado(null);
    }
  }

  const quem = convite.professor ?? 'Um professor';

  return (
    <section className="convite" aria-label={`Convite para ${convite.nome}`}>
      <div className="convite-texto">
        <span className="convite-marcador">Convite novo</span>
        <p className="convite-turma">{convite.nome}</p>
        <p className="convite-quem">
          {quem} convidou o {formatarRp(usuario.id)} · {haQuantoTempo(convite.convidadoEm)}
        </p>
        <p className="erro-campo" aria-live="polite">
          {erro}
        </p>
      </div>

      {!sumiu && (
        <div className="convite-acoes">
          <button
            type="button"
            className="btn btn-solido tecla tecla-clara"
            disabled={ocupado !== null}
            onClick={() => responder('aceitar')}
          >
            {ocupado === 'aceitar' ? 'Entrando…' : 'Entrar na sala'}
          </button>
          <button
            type="button"
            className="btn btn-vidro vidro tecla"
            disabled={ocupado !== null}
            onClick={() => setConfirmar(Date.now())}
          >
            {ocupado === 'recusar' ? 'Recusando…' : 'Recusar'}
          </button>
        </div>
      )}

      {/* Recusar pede confirmação porque não tem volta pelo lado dele: só o
          professor pode mandar outro convite. O modal só confirma; quem
          envia, mostra "Recusando…" e mostra o erro é o painel. */}
      {confirmar !== null && (
        <Modal
          key={confirmar}
          eyebrow={convite.nome}
          titulo="Recusar o convite?"
          acoes={[
            { rotulo: 'Recusar convite', principal: true, aoClicar: () => responder('recusar') },
            { rotulo: 'Cancelar' },
          ]}
          aoFechar={() => setConfirmar(null)}
        >
          <p>
            Depois de recusar, você não consegue entrar nesta sala sozinho: só o professor pode mandar outro
            convite.
          </p>
        </Modal>
      )}
    </section>
  );
}

// A lista de turmas guardada na sessão serve ao treino, que mostra o nome
// da sala no topo. Sem isto, a sala recém-aceita apareceria como "sem
// turma" até o próximo login.
function guardarSalaNaSessao(sala: SalaDoAluno) {
  const turmas = sessao.usuario()?.turmas ?? [];
  if (turmas.some((t) => t.id === sala.id)) return;
  sessao.atualizarUsuario({ turmas: [...turmas, { id: sala.id, nome: sala.nome }] });
}

// ============================================================================
// Erros
// ============================================================================

// A tela decide pelo status, nunca pelo texto do servidor: mensagem de
// back muda, vem em inglês, vem com detalhe técnico. Duck typing, e não
// instanceof: o erro do mock tem a forma do ErroApi, mas não é instância.
function mensagemDaFalha(excecao: unknown): string {
  const erro = excecao as ErroDaApi | null | undefined;
  if (erro?.name !== 'ErroApi') {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  // 401 não entra aqui: o api.ts já derruba a sessão e sai da tela.
  if (erro.status === 0) return MENSAGENS.CONEXAO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

if (usuario) {
  // Marca o <body> com .mundo-escola: densidade e raio de cartão vêm do CSS.
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Salas />);
}
