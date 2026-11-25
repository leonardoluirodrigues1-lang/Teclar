// Atividade.tsx — pages/aluno/atividade.html?turma=<id>&exercicio=<id>
// A página de uma atividade da sala, no desenho da página de tarefa do
// Moodle: trilha (Turma / Atividades / título), o título, a caixa com
// "Aberto em" e "Vencimento" e, embaixo, as instruções, os links e os anexos
// do post do professor; depois o botão principal e a tabela "Status". Aqui o
// "envio" é o próprio treino. Sem post, só título, datas, botão e status.
//
// Quem decide tudo (aberta, bloqueada, situação, atraso) é o back:
// GET /aluno/salas/:turmaId/atividades/:exercicioId. A tela só conta o
// tempo que falta até o vencimento, de minuto em minuto.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { AnexoDoPost, AtividadeDoAluno, ErroDaApi, SituacaoDaAtividade } from '../nucleo/tipos.js';
import { Moldura } from '../componentes/Moldura.js';
import { Instrucoes } from '../componentes/Instrucoes.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { baixarBase64, formatarTamanho } from '../utils/arquivos.js';
import { formatarDataHora, rotuloDificuldade } from '../utils/formato.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

const parametros = new URLSearchParams(window.location.search);
const turmaId = parametros.get('turma') ?? '';
const exercicioId = parametros.get('exercicio') ?? '';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'nao-encontrada' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; atividade: AtividadeDoAluno };

const SITUACAO: Record<SituacaoDaAtividade, string> = {
  nao_feita: 'Não feita',
  concluida: 'Concluída',
  concluida_com_atraso: 'Concluída com atraso',
  tempo_esgotado: 'Tempo esgotado',
};

function Atividade() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCarga({ estado: 'carregando' });
    api.escola.aluno
      .atividade(turmaId, exercicioId)
      .then((atividade) => {
        if (cancelado) return;
        setCarga({ estado: 'pronto', atividade });
        document.title = `Teclar — ${atividade.titulo}`;
      })
      .catch((excecao) => {
        if (cancelado) return;
        const erro = excecao as ErroDaApi;
        if (erro?.name === 'ErroApi' && erro.status === 404) setCarga({ estado: 'nao-encontrada' });
        else setCarga({ estado: 'erro', mensagem: 'Não foi possível carregar a atividade. Tente de novo.' });
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  // O "tempo restante" anda sozinho, de minuto em minuto.
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(relogio);
  }, []);

  const hrefSala = `sala.html?${new URLSearchParams({ id: turmaId })}`;

  async function baixar(anexo: AnexoDoPost) {
    setErroAnexo(null);
    try {
      const { nome, tipo, conteudo } = await api.escola.aluno.baixarAnexo(turmaId, exercicioId, anexo.id);
      baixarBase64(nome, tipo, conteudo);
    } catch {
      setErroAnexo(`Não foi possível baixar “${anexo.nome}”. Tente de novo.`);
    }
  }

  function corpo() {
    if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={4} />;
    if (carga.estado === 'nao-encontrada') {
      return (
        <PainelEstado
          titulo="Atividade não encontrada"
          texto="Ela pode ainda não ter sido aberta pelo professor, ou ter saído da sua sala."
        />
      );
    }
    if (carga.estado === 'erro') {
      return <PainelErro titulo="Não foi possível carregar" texto={carga.mensagem} aoTentarDeNovo={() => setTentativa((n) => n + 1)} />;
    }
    const a = carga.atividade;
    const hrefTreino = `../treino/treino.html?${new URLSearchParams({ exercicio: a.exercicioId, turma: a.turma.id })}`;
    const jaFez = a.situacao === 'concluida' || a.situacao === 'concluida_com_atraso';
    return (
      <>
        <nav className="trilha-de-pao" aria-label="Você está em">
          <ol>
            <li><a className="link" href={hrefSala}>{a.turma.nome || 'Turma'}</a></li>
            <li><a className="link" href={hrefSala}>Atividades</a></li>
            <li aria-current="page">{a.titulo}</li>
          </ol>
        </nav>

        <header className="cabecalho-atividade">
          <span className="icone-atividade" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="6" width="19" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
            </svg>
          </span>
          <div>
            <h1 className="titulo" id="titulo">{a.titulo}</h1>
            <p className="subtitulo">
              {rotuloDificuldade(a.dificuldade)} · {a.caracteres} caracteres
              {a.repeticoes > 1 ? ` (o texto ${a.repeticoes} vezes)` : ''}
            </p>
          </div>
        </header>

        <section className="caixa-atividade vidro" aria-label="Datas e instruções">
          <dl className="datas-atividade">
            <div>
              <dt>Aberto em</dt>
              <dd>{a.abertoEm ? formatarDataHora(a.abertoEm) : '—'}</dd>
            </div>
            <div>
              <dt>Vencimento</dt>
              <dd>{a.prazo ? formatarDataHora(a.prazo) : 'Sem prazo'}</dd>
            </div>
          </dl>
          {a.post && (
            <div className="post-atividade">
              <Instrucoes texto={a.post.instrucoes} />
              {a.post.links.length > 0 && (
                <ul className="links-atividade">
                  {a.post.links.map((link) => (
                    <li key={link.url}>
                      <a className="link" href={link.url} target="_blank" rel="noopener noreferrer">{link.titulo}</a>
                    </li>
                  ))}
                </ul>
              )}
              {a.post.anexos.length > 0 && (
                <ul className="lista-anexos" aria-label="Anexos">
                  {a.post.anexos.map((anexo) => (
                    <li key={anexo.id}>
                      <button type="button" className="btn-texto" onClick={() => baixar(anexo)}>
                        Baixar {anexo.nome}
                      </button>
                      <span className="anexo-meta">
                        {formatarTamanho(anexo.tamanho)}{anexo.enviadoEm ? ` · enviado em ${formatarDataHora(anexo.enviadoEm)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="erro-campo" aria-live="polite">{erroAnexo}</p>
            </div>
          )}
        </section>

        <div className="acao-atividade">
          {a.bloqueada ? (
            <>
              <button type="button" className="btn btn-solido tecla tecla-clara" disabled aria-describedby="motivo-bloqueio">
                Começar
              </button>
              <p className="motivo-bloqueio" id="motivo-bloqueio">{a.motivo}</p>
            </>
          ) : (
            <a className="btn btn-solido tecla tecla-clara" href={hrefTreino}>
              {jaFez ? 'Fazer de novo' : 'Começar'}
            </a>
          )}
        </div>

        <h2 className="secao-rotulo">Status</h2>
        <div className="tabela-painel">
          <table className="tabela tabela-status">
            <tbody>
              <tr><th scope="row">Situação</th><td>{SITUACAO[a.situacao]}</td></tr>
              <tr>
                <th scope="row">Melhor resultado</th>
                <td>{a.melhorWpm != null ? `${a.melhorWpm} PPM · ${a.melhorPrecisao ?? '—'}% de precisão` : '—'}</td>
              </tr>
              <tr><th scope="row">Tentativas</th><td>{a.tentativas}</td></tr>
              <tr><th scope="row">Tempo restante</th><td>{tempoRestante(a.prazo, agora)}</td></tr>
              <tr><th scope="row">Última tentativa</th><td>{a.ultimaTentativa ? formatarDataHora(a.ultimaTentativa) : '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <Moldura modo="aluno" ativo="sala" voltar={{ href: hrefSala, rotulo: 'Minha sala' }} classeDoConteudo="pagina">
      <main className="pagina-atividade">{corpo()}</main>
    </Moldura>
  );
}

// "3 dias e 4 horas", "2 horas e 10 minutos"; vencido: "Venceu há ...".
function tempoRestante(prazo: string | null, agora: number): string {
  if (!prazo) return 'Sem prazo';
  const diferenca = new Date(prazo).getTime() - agora;
  const minutos = Math.floor(Math.abs(diferenca) / 60_000);
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const resto = minutos % 60;
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const texto =
    dias > 0
      ? `${plural(dias, 'dia', 'dias')} e ${plural(horas, 'hora', 'horas')}`
      : horas > 0
        ? `${plural(horas, 'hora', 'horas')} e ${plural(resto, 'minuto', 'minutos')}`
        : plural(resto, 'minuto', 'minutos');
  return diferenca >= 0 ? texto : `Venceu há ${texto}`;
}

// Montagem — guarda primeiro, React depois

const usuario = guarda.soAluno();

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Atividade />);
}
