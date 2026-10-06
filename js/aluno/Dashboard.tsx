// Dashboard.tsx — pages/aluno/dashboard.html
// A tela de entrada do modo Aluno: a sala dele. É a irmã da tela de turmas
// do Professor (js/professor/Turmas.tsx) e usa as MESMAS peças
// (../componentes/EntradaDoModo.tsx): a conta fixa no canto (aqui com o
// nome da turma embaixo do nome), a abertura com a marca, as teclas e o
// cartão com a capa gerada.
//
// O que muda do professor:
//   · as teclas são Sala e Histórico;
//   · o cartão troca as contagens pelo progresso DELE (anel com feitos
//     sobre o total), e a linha em mono é o professor. Sala com tudo feito
//     ganha a estrela de conquista — a única estrela desta tela;
//   · não há "⋯" nem "Criar turma": renomear, trocar capa, arquivar e a
//     lista de alunos são do professor.
//
// Na v8 o aluno é de UMA turma (entrou pelo código dela): a grade tem um
// cartão só, ou nenhum se a turma foi arquivada.
//
// Dados: GET /aluno/salas (api.escola.aluno), pronto do back.

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { ErroDaApi, SalaDoAluno } from '../nucleo/tipos.js';
import { SECOES_ALUNO } from '../componentes/Nav.js';
import { Abertura, CartaoDeTurma, ContaFixa, Funcao, Funcoes } from '../componentes/EntradaDoModo.js';
import { EsqueletoGrade } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { Estrela } from '../componentes/Estrela.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Guarda de aluno antes de qualquer outra coisa. Devolveu null, já
// redirecionou: a montagem lá no fim do arquivo não acontece e a tela para.
const usuario = guarda.soAluno();

// Quantos esqueletos desenhar enquanto a sala não chega: o aluno é de uma.
const ESQUELETOS = 1;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// ============================================================================
// Estado da tela
// ============================================================================

// Três estados excludentes, e não três booleanos soltos.
type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; salas: SalaDoAluno[] };

// ============================================================================
// Tela
// ============================================================================

function Salas() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  // `tentativa` só serve para o botão "Tentar de novo" disparar o efeito
  // outra vez.
  const [tentativa, setTentativa] = useState(0);


  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        const salas = await api.escola.aluno.salas();
        if (!cancelado) setCarga({ estado: 'pronto', salas });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

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

    // Só acontece com a turma arquivada depois que ele entrou: o login de
    // turma arquivada já é recusado.
    if (carga.salas.length === 0) {
      return (
        <PainelEstado
          titulo="Sua sala foi arquivada"
          texto="O professor encerrou esta turma. O seu histórico continua em Histórico."
        />
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
      <ContaFixa secoes={SECOES_ALUNO} papel={usuario.turmas?.[0]?.nome ?? 'Aluno'} />

      <main>
        <Abertura />

        <Funcoes rotulo="Funções do aluno">
          <Funcao href="#suas-salas" nome="Sala" texto="A sua turma e os exercícios dela." />
          <Funcao href="historico.html" nome="Histórico" texto="Tudo o que você já treinou." />
        </Funcoes>

        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo" id="suas-salas" tabIndex={-1}>
              Sua sala
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
