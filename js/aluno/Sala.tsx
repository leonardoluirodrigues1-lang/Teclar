// Sala.tsx — pages/aluno/sala.html?id=<sala>
// O detalhe de uma sala do aluno: o nome, o professor, quando ele entrou e
// os exercícios dela (GET /aluno/salas/:id). Os que ele ainda não fez vêm
// primeiro, na ordem em que o professor atribuiu, e o primeiro deles é o
// "próximo", em destaque. Os feitos vêm depois, apagados, com a melhor
// marca e a data. "Tempo esgotado" fica entre os feitos, sem cor nenhuma:
// ele fez a atividade, e o texto não diz que falhou.
//
// Cada exercício leva ao treino com ?exercicio= e &turma=.
// Estilo: css/aluno.css. O topo com o menu do nome é o <TopoAluno>.

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { ErroDaApi, ExercicioDaSala, SalaDetalhe, Usuario } from '../nucleo/tipos.js';
import { TopoAluno } from '../componentes/TopoAluno.js';
import { formatarData, numero, porcentagem } from '../utils/formato.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

const ROTA_SALAS = 'dashboard.html';

const NOME_DA_DIFICULDADE = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

type Carga =
  | { estado: 'carregando' }
  | { estado: 'nao-encontrada' }
  | { estado: 'erro' }
  | { estado: 'pronto'; sala: SalaDetalhe };

interface PropsSala {
  usuario: Usuario;
  salaId: string | null;
}

function Sala({ usuario, salaId }: PropsSala) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!salaId) {
      setCarga({ estado: 'nao-encontrada' });
      return;
    }
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    api.aluno
      .sala(salaId)
      .then((sala) => {
        if (!cancelado) setCarga({ estado: 'pronto', sala });
      })
      .catch((erro: ErroDaApi) => {
        if (cancelado) return;
        // 404: a sala não existe ou ele não está nela. Tentar de novo não
        // adianta, então a tela só oferece o caminho de volta.
        setCarga({ estado: erro?.status === 404 ? 'nao-encontrada' : 'erro' });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  return (
    <>
      <TopoAluno usuario={usuario} />

      <main>
        <a className="aluno-botao aluno-voltar vidro tecla" href={ROTA_SALAS}>
          ← Suas salas
        </a>

        {carga.estado === 'carregando' && (
          <p className="aluno-sub" role="status">
            Carregando a sala…
          </p>
        )}

        {carga.estado === 'nao-encontrada' && (
          <section className="aluno-painel vidro" role="alert">
            <h2>Sala não encontrada</h2>
            <p>Ela pode ter sido encerrada, ou você não está nela. Suas salas estão na tela inicial.</p>
          </section>
        )}

        {carga.estado === 'erro' && (
          <section className="aluno-painel vidro" role="alert">
            <h2>Não foi possível carregar a sala</h2>
            <p>Confira a conexão e tente de novo.</p>
            <button type="button" className="aluno-botao vidro tecla" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </button>
          </section>
        )}

        {carga.estado === 'pronto' && <DetalheDaSala sala={carga.sala} />}
      </main>
    </>
  );
}

function DetalheDaSala({ sala }: { sala: SalaDetalhe }) {
  const { feitos, total } = sala.exercicios;
  const naoFeitos = sala.lista.filter((ex) => ex.estado === 'nao_feito');
  // Os feitos, do mais recente para o mais antigo. ISO ordena como texto.
  const jaFeitos = sala.lista
    .filter((ex) => ex.estado !== 'nao_feito')
    .sort((a, b) => String(b.ultimaSessao ?? '').localeCompare(String(a.ultimaSessao ?? '')));

  return (
    <>
      <span className="aluno-rotulo">Sala · {sala.professor ? `Prof. ${sala.professor}` : '—'}</span>
      <h1 className="aluno-titulo">{sala.nome}</h1>
      <p className="aluno-sub">
        Você entrou em {formatarData(sala.entrouEm)} · {feitos} de {total}{' '}
        {total === 1 ? 'exercício feito' : 'exercícios feitos'}
      </p>

      <section className="aluno-secao" aria-labelledby="titulo-exercicios">
        <h2 className="aluno-rotulo" id="titulo-exercicios">
          Exercícios da sala
        </h2>
        {sala.lista.length === 0 ? (
          <p className="aluno-sub">O professor ainda não passou nenhum exercício nesta sala.</p>
        ) : (
          <div className="aluno-fila">
            {naoFeitos.map((ex, indice) => (
              <LinhaDoExercicio key={ex.id} exercicio={ex} salaId={sala.id} proximo={indice === 0} />
            ))}
            {jaFeitos.map((ex) => (
              <LinhaDoExercicio key={ex.id} exercicio={ex} salaId={sala.id} proximo={false} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

interface PropsLinha {
  exercicio: ExercicioDaSala;
  salaId: string;
  proximo: boolean;
}

function LinhaDoExercicio({ exercicio, salaId, proximo }: PropsLinha) {
  const classes = ['exercicio', 'vidro'];
  if (proximo) classes.push('exercicio-proximo');
  if (exercicio.estado !== 'nao_feito') classes.push('exercicio-feito');

  const href = `../treino/treino.html?${new URLSearchParams({ exercicio: exercicio.id, turma: salaId })}`;

  return (
    <a className={classes.join(' ')} href={href}>
      <div>
        <h3 className="exercicio-titulo">{exercicio.titulo}</h3>
        <div className="pilulas">
          <span className="pilula">{NOME_DA_DIFICULDADE[exercicio.dificuldade] ?? '—'}</span>
          <span className="pilula">{exercicio.caracteres} caracteres</span>
          <span className="pilula">{tempoLimite(exercicio.tempoLimiteSegundos)}</span>
          {exercicio.prazo && <span className="pilula">Prazo {formatarData(exercicio.prazo)}</span>}
        </div>
      </div>
      <EstadoDoExercicio exercicio={exercicio} />
    </a>
  );
}

function EstadoDoExercicio({ exercicio }: { exercicio: ExercicioDaSala }) {
  if (exercicio.estado === 'feito') {
    return (
      <div className="exercicio-estado">
        <b className="exercicio-marca">
          {numero(exercicio.melhorWpm)} PPM · {porcentagem(exercicio.melhorPrecisao)}
        </b>
        <span className="exercicio-data">feito em {formatarData(exercicio.ultimaSessao)}</span>
      </div>
    );
  }
  if (exercicio.estado === 'tempo_esgotado') {
    return (
      <div className="exercicio-estado">
        <b className="exercicio-marca">Tempo esgotado</b>
        <span className="exercicio-data">tentado em {formatarData(exercicio.ultimaSessao)}</span>
      </div>
    );
  }
  return (
    <div className="exercicio-estado">
      <b className="exercicio-marca">Não feito</b>
      {exercicio.atribuidoEm && (
        <span className="exercicio-data">atribuído em {formatarData(exercicio.atribuidoEm)}</span>
      )}
    </div>
  );
}

// 150 -> "2:30"; 0 é "sem limite", como no banco.
function tempoLimite(segundos: number): string {
  if (!segundos) return 'Sem limite';
  const resto = segundos % 60;
  return `${Math.floor(segundos / 60)}:${String(resto).padStart(2, '0')}`;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

const usuario = guarda.soAluno();

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  const salaId = new URLSearchParams(window.location.search).get('id');
  createRoot(document.getElementById('raiz')).render(<Sala usuario={usuario} salaId={salaId} />);
}
