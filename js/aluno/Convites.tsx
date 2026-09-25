// Convites.tsx — pages/aluno/convites.html
// As salas que convidaram o aluno pelo RP e esperam resposta
// (GET /aluno/convites). Alcançada pelo menu do nome. Cada convite mostra
// a data, a sala, o professor, quantos alunos e quantos exercícios ela
// tem — a pessoa precisa saber o que está aceitando —, e dois botões:
//   · "Entrar na sala" (POST .../aceitar): ele passa a estar na sala, e
//     ela aparece na tela inicial;
//   · "Recusar" (POST .../recusar): o convite some.
// Nos dois casos o convite sai da lista na hora, e o aviso vermelho do
// topo recalcula junto: o <TopoAluno> recebe o tamanho desta lista.
//
// Estilo: css/aluno.css.

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { ConviteDoAluno, ErroDaApi, SalaDoAluno, Usuario } from '../nucleo/tipos.js';
import { TopoAluno } from '../componentes/TopoAluno.js';
import { PainelDoRp } from '../componentes/PainelDoRp.js';
import { formatarData } from '../utils/formato.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; convites: ConviteDoAluno[] };

// O que aconteceu com o último convite respondido, para a frase acima da
// lista. `sala` só existe quando ele entrou numa.
interface Resposta {
  texto: string;
  sala?: SalaDoAluno;
}

interface PropsConvites {
  usuario: Usuario;
}

function Convites({ usuario }: PropsConvites) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  // O convite que está sendo respondido agora: os botões dele travam.
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    api.aluno
      .convites()
      .then((convites) => {
        if (!cancelado) setCarga({ estado: 'pronto', convites });
      })
      .catch(() => {
        if (!cancelado) setCarga({ estado: 'erro' });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const convites = carga.estado === 'pronto' ? carga.convites : [];

  function tirarDaLista(turmaId: string) {
    setCarga((atual) =>
      atual.estado === 'pronto'
        ? { estado: 'pronto', convites: atual.convites.filter((c) => c.turmaId !== turmaId) }
        : atual
    );
  }

  async function responder(convite: ConviteDoAluno, aceitar: boolean) {
    if (respondendo) return;
    setRespondendo(convite.turmaId);
    setResposta(null);
    try {
      if (aceitar) {
        const sala = await api.aluno.aceitarConvite(convite.turmaId);
        guardarSalaNaSessao(sala);
        setResposta({ texto: `Você entrou em ${sala.nome}.`, sala });
      } else {
        await api.aluno.recusarConvite(convite.turmaId);
        setResposta({ texto: `Convite de ${convite.nome} recusado.` });
      }
      tirarDaLista(convite.turmaId);
    } catch (erro) {
      // 404: o convite já não existe (o professor cancelou, ou foi
      // respondido em outra aba). Sai da lista do mesmo jeito.
      if ((erro as ErroDaApi)?.status === 404) {
        tirarDaLista(convite.turmaId);
        setResposta({ texto: `O convite de ${convite.nome} não está mais disponível.` });
      } else {
        setResposta({ texto: 'Não foi possível responder ao convite. Tente de novo.' });
      }
    } finally {
      setRespondendo(null);
    }
  }

  return (
    <>
      <TopoAluno usuario={usuario} convites={carga.estado === 'pronto' ? convites.length : null} />

      <main>
        <a className="aluno-botao aluno-voltar vidro tecla" href="dashboard.html">
          ← Suas salas
        </a>
        <span className="aluno-rotulo">Convites</span>
        <h1 className="aluno-titulo">Salas que chamaram você</h1>
        <p className="aluno-sub">Um professor convida usando o seu RP. Você entra só se aceitar.</p>

        <p className="aluno-resposta" aria-live="polite">
          {resposta?.texto}{' '}
          {resposta?.sala && <a href={`sala.html?${new URLSearchParams({ id: resposta.sala.id })}`}>Abrir a sala</a>}
        </p>

        {carga.estado === 'carregando' && (
          <p className="aluno-sub" role="status">
            Carregando seus convites…
          </p>
        )}

        {carga.estado === 'erro' && (
          <section className="aluno-painel vidro" role="alert">
            <h2>Não foi possível carregar seus convites</h2>
            <p>Confira a conexão e tente de novo.</p>
            <button type="button" className="aluno-botao vidro tecla" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </button>
          </section>
        )}

        {carga.estado === 'pronto' && convites.length === 0 && (
          <PainelDoRp titulo="Nenhum convite por enquanto" rp={usuario.id} />
        )}

        {convites.map((convite) => (
          <CartaoDoConvite
            key={convite.turmaId}
            convite={convite}
            ocupado={respondendo !== null}
            aoResponder={(aceitar) => responder(convite, aceitar)}
          />
        ))}
      </main>
    </>
  );
}

interface PropsCartao {
  convite: ConviteDoAluno;
  ocupado: boolean;
  aoResponder: (aceitar: boolean) => void;
}

function CartaoDoConvite({ convite, ocupado, aoResponder }: PropsCartao) {
  const detalhes = [
    convite.professor ? `Prof. ${convite.professor}` : '—',
    convite.totalAlunos === 1 ? '1 aluno' : `${convite.totalAlunos} alunos`,
    convite.totalExercicios === 1 ? '1 exercício na sala' : `${convite.totalExercicios} exercícios na sala`,
  ];
  return (
    <section className="convite vidro" aria-label={`Convite de ${convite.nome}`}>
      <div>
        <span className="aluno-rotulo">Convite de {formatarData(convite.convidadoEm)}</span>
        <h2 className="convite-nome">{convite.nome}</h2>
        <p className="convite-detalhes">{detalhes.join(' · ')}</p>
      </div>
      <div className="convite-acoes">
        <button type="button" className="aluno-botao vidro tecla" disabled={ocupado} onClick={() => aoResponder(false)}>
          Recusar
        </button>
        <button
          type="button"
          className="aluno-botao tecla tecla-clara"
          disabled={ocupado}
          onClick={() => aoResponder(true)}
        >
          Entrar na sala
        </button>
      </div>
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
// Montagem — guarda primeiro, React depois
// ============================================================================

const usuario = guarda.soAluno();

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Convites usuario={usuario} />);
}
