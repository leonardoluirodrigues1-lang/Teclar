// Sala.tsx — pages/aluno/sala.html?id=<sala>
// A tela da turma vista pelo ALUNO. A tela em si (casca, abas, trilha,
// painel de relatório) é a mesma do professor e mora em
// ../componentes/TelaDaTurma.tsx; aqui fica só o que muda para o aluno:
//
//   EXERCÍCIOS     a trilha com o estado DELE: concluído sólido com o
//                  visto, o próximo aceso, os seguintes apagados. Toda
//                  pedra leva ao treino. Nada sobre quantos colegas
//                  entregaram.
//   PARTICIPANTES  o ranking da sala, já ordenado e pontuado pelo back.
//                  Do quarto lugar em diante o nome vem vazio DO BACK; a
//                  linha dele vem sempre com o nome, destacada.
//   RELATÓRIO      o relatório individual dele na sala, com a comparação
//                  com a média da sala. Abaixo de 3 sessões concluídas, só
//                  a barra de quanto falta e os botões desligados.
//
// Dados (api.escola.aluno, tudo pelo token; sala da qual ele não participa
// é 404): GET /aluno/salas/:id dá o cabeçalho e a trilha; cada uma das
// outras abas busca o seu quando é aberta.

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { DesempenhoNaTurma, ErroDaApi, ExercicioDaSala, LinhaDoRanking, SalaDetalhe } from '../nucleo/tipos.js';
import { SECOES_ALUNO } from '../componentes/Nav.js';
import {
  CascaDaTurma,
  PainelDeRelatorio,
  TrilhaDeExercicios,
  TurmaNaoEncontrada,
  useAbaDaUrl,
  type PedraDaTrilha,
} from '../componentes/TelaDaTurma.js';
import { Tabela, type ColunaTabela } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { Estrela } from '../componentes/Estrela.js';
import { contagem, numero, porcentagem } from '../utils/formato.js';
import { baixarCsv, slug } from '../utils/csv.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Guarda de aluno antes de qualquer outra coisa. Devolveu null, já
// redirecionou: a montagem lá no fim do arquivo não acontece e a tela para.
const usuario = guarda.soAluno();

// O mínimo de sessões concluídas NA SALA para o relatório ter média. Quem
// decide é o back (abaixo disso ele manda as médias nulas); aqui o número
// só serve para dizer quanto falta.
const MINIMO_DE_SESSOES = 3;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

const salaId = new URLSearchParams(window.location.search).get('id');

// ============================================================================
// Tela
// ============================================================================

type Carga =
  | { estado: 'carregando' }
  | { estado: 'nao-encontrada' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; sala: SalaDetalhe };

function Sala() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [aba, selecionarAba] = useAbaDaUrl();

  useEffect(() => {
    // Sem ?id= não há o que carregar.
    if (!salaId) return;
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        const sala = await api.escola.aluno.sala(salaId);
        if (!cancelado) setCarga({ estado: 'pronto', sala });
      } catch (excecao) {
        if (cancelado) return;
        // 404: a sala não existe ou ele não está nela. Tentar de novo não
        // adianta, então a tela só oferece o caminho de volta.
        if (ehErroApi(excecao) && excecao.status === 404) setCarga({ estado: 'nao-encontrada' });
        else setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const sala = carga.estado === 'pronto' ? carga.sala : null;

  useEffect(() => {
    if (sala) document.title = `Teclar — ${sala.nome}`;
  }, [sala]);

  if (!salaId || carga.estado === 'nao-encontrada') {
    return (
      <TurmaNaoEncontrada
        secoes={SECOES_ALUNO}
        papel={usuario.turmas?.[0]?.nome ?? 'Aluno'}
        texto="Ela pode ter sido encerrada, ou você não está nela. Suas salas estão na tela inicial."
        link={{ href: 'dashboard.html', rotulo: 'Ver minhas salas' }}
      />
    );
  }

  function renderizarAba() {
    if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={5} />;
    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar a sala"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }
    if (aba === 'participantes') return <AbaParticipantes />;
    if (aba === 'relatorio') return <AbaRelatorio nomeDaSala={sala.nome} />;
    return <AbaExercicios sala={sala} />;
  }

  return (
    <CascaDaTurma
      secoes={SECOES_ALUNO}
      papel={usuario.turmas?.[0]?.nome ?? 'Aluno'}
      voltar={{ href: 'dashboard.html', rotulo: 'Salas' }}
      titulo={sala ? sala.nome : null}
      subtitulo={sala ? `${sala.professor ?? '—'} · ${participantes(sala.totalAlunos)}` : null}
      aba={aba}
      aoSelecionarAba={selecionarAba}
      carregando={carga.estado === 'carregando'}
    >
      {renderizarAba()}
    </CascaDaTurma>
  );
}

function participantes(total: number): string {
  return total === 1 ? '1 participante' : `${total} participantes`;
}

// ============================================================================
// Aba Exercícios — a trilha com o estado DELE
// ============================================================================

function AbaExercicios({ sala }: { sala: SalaDetalhe }) {
  if (sala.lista.length === 0) {
    return (
      <PainelEstado
        titulo="Nenhum exercício ainda"
        texto="O professor ainda não passou nenhum exercício nesta sala. Quando passar, ele aparece aqui."
      />
    );
  }

  // O próximo é o primeiro ainda não feito, na ordem em que o professor
  // atribuiu.
  const indiceDoProximo = sala.lista.findIndex((ex) => ex.estado === 'nao_feito');
  const pedras = sala.lista.map((ex, i) => pedraDoAluno(ex, i, indiceDoProximo, sala.id));

  return (
    <>
      <TrilhaDeExercicios pedras={pedras} />
      <p className="nota">
        O que você concluiu fica sólido, o próximo fica aceso e o resto espera. A ordem é a que o professor
        atribuiu.
      </p>
    </>
  );
}

// Toda pedra é link para o treino, inclusive as apagadas: o banco não tem
// regra de liberação, e trancar seria inventar uma. "Tempo esgotado" conta
// como feito: ele fez a atividade, e o texto não diz que falhou.
function pedraDoAluno(ex: ExercicioDaSala, indice: number, indiceDoProximo: number, idDaSala: string): PedraDaTrilha {
  const href = `../treino/treino.html?${new URLSearchParams({ exercicio: ex.id, turma: idDaSala })}`;
  if (ex.estado === 'tempo_esgotado') return { id: ex.id, titulo: ex.titulo, estado: 'feito', legenda: 'tempo esgotado', href };
  if (ex.estado === 'feito') return { id: ex.id, titulo: ex.titulo, estado: 'feito', legenda: 'concluído', href };
  if (indice === indiceDoProximo) return { id: ex.id, titulo: ex.titulo, estado: 'agora', legenda: 'é o próximo', href };
  return { id: ex.id, titulo: ex.titulo, estado: 'depois', legenda: 'a seguir', href };
}

// ============================================================================
// Aba Participantes — o ranking que o back manda pronto
// ============================================================================

type CargaRanking =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; linhas: LinhaDoRanking[] };

function AbaParticipantes() {
  const [carga, setCarga] = useState<CargaRanking>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    api.escola.aluno
      .rankingDaTurma(salaId)
      .then((linhas) => {
        if (!cancelado) setCarga({ estado: 'pronto', linhas });
      })
      .catch((excecao) => {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={5} />;
  if (carga.estado === 'erro') {
    return (
      <PainelErro
        titulo="Não foi possível carregar o ranking"
        texto={carga.mensagem}
        aoTentarDeNovo={() => setTentativa((n) => n + 1)}
      />
    );
  }

  return (
    <>
      <Tabela
        colunas={COLUNAS_DO_RANKING}
        linhas={carga.linhas}
        chave={(linha) => String(linha.posicao)}
        // A linha dele em destaque; as anônimas em cinza.
        classeLinha={(linha) => (linha.voce ? 'linha-voce' : linha.nome === null ? 'linha-anonima' : undefined)}
      />
      <p className="nota">
        Do quarto lugar em diante os nomes ficam escondidos — menos o seu, que você sempre vê. A posição não é só
        velocidade: soma lições, ritmo e dias seguidos.
      </p>
    </>
  );
}

// A ordem e os pontos são os do back: a tela não ordena e não soma nada.
const COLUNAS_DO_RANKING: ColunaTabela<LinhaDoRanking>[] = [
  { rotulo: '#', classe: 'col-numero', celula: (l) => l.posicao },
  {
    rotulo: 'Participante',
    celula: (l) =>
      l.voce ? (
        <>
          {l.nome} <span className="marca-voce">você</span>
        </>
      ) : (
        // null: o back não mandou o nome. A tela não tem o que esconder.
        (l.nome ?? 'Participante')
      ),
  },
  { rotulo: 'Lições', classe: 'col-numero', celula: (l) => contagem(l.licoes) },
  { rotulo: 'Ritmo', classe: 'col-numero', celula: (l) => numero(l.ritmo) },
  { rotulo: 'Dias', classe: 'col-numero', celula: (l) => contagem(l.diasSeguidos) },
  {
    rotulo: 'Pontos',
    classe: 'col-numero',
    celula: (l) => (
      <>
        {contagem(l.pontos)}
        {/* Estrela só no primeiro lugar, e só se ele tiver pontos: zero
            pontos não é conquista de ninguém. */}
        {l.posicao === 1 && l.pontos > 0 && (
          <>
            <span className="marca-do-melhor">
              <Estrela tamanho={14} />
            </span>
            <span className="sr-only"> — primeiro lugar</span>
          </>
        )}
      </>
    ),
  },
];

// ============================================================================
// Aba Relatório — o relatório individual
// ============================================================================

type CargaRelatorio =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; desempenho: DesempenhoNaTurma };

function AbaRelatorio({ nomeDaSala }: { nomeDaSala: string }) {
  const [carga, setCarga] = useState<CargaRelatorio>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    api.escola.aluno
      .desempenhoNaTurma(salaId)
      .then((desempenho) => {
        if (!cancelado) setCarga({ estado: 'pronto', desempenho });
      })
      .catch((excecao) => {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={3} />;
  if (carga.estado === 'erro') {
    return (
      <PainelErro
        titulo="Não foi possível carregar seu relatório"
        texto={carga.mensagem}
        aoTentarDeNovo={() => setTentativa((n) => n + 1)}
      />
    );
  }

  const d = carga.desempenho;
  // O back manda as médias nulas abaixo do mínimo. É isso que decide a
  // tela, e não uma conta feita aqui.
  const temMedia = d.minhaMedia !== null && d.mediaSala !== null;

  return (
    <>
      <PainelDeRelatorio
        rotulo="Seu relatório nesta sala"
        falta={temMedia ? null : { sessoes: d.sessoesConcluidas, minimo: MINIMO_DE_SESSOES }}
        grupos={temMedia ? gruposDoAluno(d) : []}
        aoGerarCsv={() => baixarCsv(`relatorio-${slug(nomeDaSala)}.csv`, linhasDoCsv(nomeDaSala, d))}
      />
      <p className="nota">O relatório é só o seu. A média da sala soma as sessões concluídas de todos que estão nela.</p>
    </>
  );
}

// Cada número dele ao lado da média da sala, a média em tom apagado: o
// assunto é ele, a sala é a régua.
function gruposDoAluno(d: DesempenhoNaTurma) {
  return [
    [
      { rotulo: 'Sessões', valor: contagem(d.sessoesConcluidas) },
      { rotulo: 'Lições', valor: contagem(d.licoes) },
      { rotulo: 'Dias seguidos', valor: contagem(d.diasSeguidos) },
    ],
    [
      { rotulo: 'Seu ritmo', valor: numero(d.minhaMedia.velocidade) },
      { rotulo: 'Média da sala', valor: numero(d.mediaSala.velocidade), apagado: true },
      { rotulo: 'Sua precisão', valor: porcentagem(d.minhaMedia.precisao) },
      { rotulo: 'Média da sala', valor: porcentagem(d.mediaSala.precisao), apagado: true },
    ],
  ];
}

// As linhas do CSV: o que a tela mostra, com os números crus (o Excel
// precisa de número, não de "94%").
function linhasDoCsv(nomeDaSala: string, d: DesempenhoNaTurma): (string | number)[][] {
  return [
    ['Sala', nomeDaSala],
    ['Sessões concluídas', d.sessoesConcluidas],
    ['Lições', d.licoes],
    ['Dias seguidos', d.diasSeguidos],
    ['Seu ritmo (PPM)', d.minhaMedia?.velocidade ?? ''],
    ['Ritmo médio da sala (PPM)', d.mediaSala?.velocidade ?? ''],
    ['Sua precisão (%)', d.minhaMedia?.precisao ?? ''],
    ['Precisão média da sala (%)', d.mediaSala?.precisao ?? ''],
  ];
}

// ============================================================================
// Erros — decide pelo status, nunca pelo texto que o servidor mandou
// ============================================================================

// Duck typing, não instanceof: o erro do mock tem a forma do ErroApi do
// api.ts, mas não é instância dele.
function ehErroApi(excecao: unknown): excecao is ErroDaApi {
  return (excecao as ErroDaApi | null | undefined)?.name === 'ErroApi';
}

function mensagemDaFalha(excecao: unknown): string {
  if (!ehErroApi(excecao)) {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  // 401 não entra aqui: o api.ts já derruba a sessão e sai da tela.
  if (excecao.status === 0) return MENSAGENS.CONEXAO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Sala />);
}
