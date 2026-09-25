// Dashboard.tsx — pages/aluno/dashboard.html
// A tela inicial do Aluno: AS SALAS em que ele está. Em cima, a faixa com
// os quatro números dele (GET /aluno/resumo); embaixo, cada sala como uma
// tecla grande, com o professor e um anel de progresso (GET /aluno/salas).
// Clicar numa sala abre o detalhe dela (sala.html), que é onde moram os
// exercícios: esta tela não lista exercício nenhum.
//
// Sem sala nenhuma, um painel só, com o RP em destaque: é com ele que o
// professor convida.
//
// Estilo: css/aluno.css. O topo com o menu do nome é o <TopoAluno>.

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { ResumoDoAluno, SalaDoAluno, Usuario } from '../nucleo/tipos.js';
import { TopoAluno } from '../componentes/TopoAluno.js';
import { PainelDoRp } from '../componentes/PainelDoRp.js';
import { contagem, numero, porcentagem } from '../utils/formato.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; salas: SalaDoAluno[]; resumo: ResumoDoAluno };

interface PropsDashboard {
  usuario: Usuario;
}

function Dashboard({ usuario }: PropsDashboard) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  // Muda para pedir de novo depois de um erro.
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    Promise.all([api.aluno.salas(), api.aluno.resumo()])
      .then(([salas, resumo]) => {
        if (!cancelado) setCarga({ estado: 'pronto', salas, resumo });
      })
      .catch(() => {
        if (!cancelado) setCarga({ estado: 'erro' });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  return (
    <>
      <TopoAluno usuario={usuario} />

      <main>
        <span className="aluno-rotulo">Modo · Aluno</span>
        <h1 className="aluno-titulo">Suas salas</h1>
        <p className="aluno-sub">Você treina dentro das salas em que entrou.</p>

        <FaixaDeNumeros resumo={carga.estado === 'pronto' ? carga.resumo : null} />

        {carga.estado === 'carregando' && (
          <p className="aluno-sub aluno-secao" role="status">
            Carregando suas salas…
          </p>
        )}

        {carga.estado === 'erro' && (
          <section className="aluno-painel vidro" role="alert">
            <h2>Não foi possível carregar suas salas</h2>
            <p>Confira a conexão e tente de novo.</p>
            <button type="button" className="aluno-botao vidro tecla" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </button>
          </section>
        )}

        {carga.estado === 'pronto' && carga.salas.length === 0 && (
          <PainelDoRp titulo="Você ainda não está em nenhuma sala" rp={usuario.id} />
        )}

        {carga.estado === 'pronto' && carga.salas.length > 0 && (
          <div className="aluno-salas">
            {carga.salas.map((sala) => (
              <TeclaDaSala key={sala.id} sala={sala} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

// Os quatro números do aluno. Enquanto carrega, "—" em todos: nunca 0 no
// lugar de um dado que ainda não veio.
function FaixaDeNumeros({ resumo }: { resumo: ResumoDoAluno | null }) {
  const numeros = [
    { rotulo: 'Seu melhor PPM', valor: numero(resumo?.melhorWpm) },
    { rotulo: 'Precisão média', valor: porcentagem(resumo?.precisaoMedia) },
    { rotulo: 'Exercícios feitos', valor: contagem(resumo?.sessoesConcluidas) },
    { rotulo: 'Dias seguidos', valor: contagem(resumo?.diasSeguidos) },
  ];
  return (
    <div className="aluno-faixa">
      {numeros.map((item) => (
        <div key={item.rotulo}>
          <span className="aluno-faixa-numero">{item.valor}</span>
          <span className="aluno-faixa-rotulo">{item.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

function TeclaDaSala({ sala }: { sala: SalaDoAluno }) {
  const { feitos, total } = sala.exercicios;
  const restantes = total - feitos;
  const pendente = restantes > 0;

  return (
    <a
      className={`sala vidro tecla${pendente ? ' sala-pendente' : ''}`}
      href={`sala.html?${new URLSearchParams({ id: sala.id })}`}
    >
      <h2 className="sala-nome">{sala.nome}</h2>
      <span className="sala-professor">
        <span className="sala-professor-inicial" aria-hidden="true">
          {sala.professor ? sala.professor[0].toUpperCase() : '—'}
        </span>
        {sala.professor ?? '—'}
      </span>

      <span className="sala-progresso">
        <AnelDeProgresso feitos={feitos} total={total} />
        {pendente ? (
          <span>
            <span className="sala-restantes">{restantes}</span>
            <span className="sala-restantes-rotulo">
              {restantes === 1 ? 'Exercício restante' : 'Exercícios restantes'}
            </span>
          </span>
        ) : (
          <span className="sala-em-dia">{total === 0 ? 'Sem exercícios ainda' : 'Tudo em dia'}</span>
        )}
      </span>
    </a>
  );
}

// Raio 31 num quadro de 74: sobra espaço para a espessura do traço (6) e
// para o brilho. O arco começa no alto (o rotate de -90°).
const RAIO_ANEL = 31;
const VOLTA_DO_ANEL = 2 * Math.PI * RAIO_ANEL;

function AnelDeProgresso({ feitos, total }: { feitos: number; total: number }) {
  // Sala sem exercício: anel vazio, e não uma divisão por zero.
  const fracao = total > 0 ? feitos / total : 0;
  return (
    <svg className="anel" width="74" height="74" viewBox="0 0 74 74" role="img" aria-label={`${feitos} de ${total} exercícios feitos`}>
      <circle className="anel-trilho" cx="37" cy="37" r={RAIO_ANEL} />
      {fracao > 0 && (
        <circle
          className="anel-arco"
          cx="37"
          cy="37"
          r={RAIO_ANEL}
          strokeDasharray={VOLTA_DO_ANEL}
          strokeDashoffset={VOLTA_DO_ANEL * (1 - fracao)}
          transform="rotate(-90 37 37)"
        />
      )}
      <text className="anel-texto" x="37" y="42" textAnchor="middle">
        {feitos}/{total}
      </text>
    </svg>
  );
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de aluno antes de montar. Devolveu null, redirecionou: a tela
// para aqui e nada mais roda.
const usuario = guarda.soAluno();

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Dashboard usuario={usuario} />);
}
