// Relatorios.tsx — pages/professor/relatorios.html[?filtro=todas|ativas|arquivadas]
// "Relatórios gerais": a visão de TODAS as turmas da conta logada. O
// relatório de uma turma só mora na aba "Relatório da turma" da própria
// turma (./RelatorioDaTurma.tsx); daqui, "Abrir relatório da turma" leva até lá.
//
//   · filtro: Todas, Ativas ou Arquivadas (na URL, para o F5);
//   · indicadores do professor que os dados sustentam: turmas, matrículas
//     (cada vínculo aluno–turma conta um: o mesmo nome em duas turmas são
//     duas matrículas), exercícios no acervo e atribuições atuais;
//   · uma tabela por turma (alunos, PPM médio, precisão média, tentativas,
//     ativos nos últimos 7 dias) e um gráfico de barras com o PPM médio de
//     cada uma. A tabela é a alternativa acessível do gráfico.
//
// Só as turmas da conta: GET /turmas e GET /turmas?ativa=false já filtram
// pelo token, e o relatório de cada uma (GET /turmas/:id/relatorio) devolve
// 404 para turma de outra conta. Os números vêm prontos do back: aqui só se
// somam CONTAGENS (turmas, matrículas, atribuições), nunca médias.

import { comPpm } from '../componentes/Ppm.js';
import { useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { ErroDaApi, RelatorioTurma, Turma } from '../nucleo/tipos.js';
import { desembrulhar } from '../componentes/listaExercicios.js';
import { contagem, numero, porcentagem } from '../utils/formato.js';
import { Moldura } from '../componentes/Moldura.js';
import { Tabela, type ColunaTabela } from '../componentes/Tabela.js';
import { EsqueletoTabela } from '../componentes/Esqueleto.js';
import { PainelErro, PainelEstado } from '../componentes/PainelErro.js';
import { Bloco } from '../componentes/Bloco.js';
import { Grafico } from '../componentes/Grafico.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

type Filtro = 'todas' | 'ativas' | 'arquivadas';

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'ativas', rotulo: 'Ativas' },
  { chave: 'arquivadas', rotulo: 'Arquivadas' },
];

// Uma turma e o relatório dela. null: o relatório desta turma falhou — a
// linha fica, com "—", e o resto da tela não cai por causa de uma turma.
interface LinhaDaTurma {
  turma: Turma;
  relatorio: RelatorioTurma | null;
}

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; linhas: LinhaDaTurma[]; acervo: number };

function filtroDaUrl(): Filtro {
  const pedido = new URLSearchParams(window.location.search).get('filtro');
  return FILTROS.some((f) => f.chave === pedido) ? (pedido as Filtro) : 'todas';
}

function Relatorios() {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>(filtroDaUrl);
  const botoesFiltro = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarga({ estado: 'carregando' });
      try {
        const [ativas, arquivadas, exercicios] = await Promise.all([
          api.turmas.listar(),
          api.turmas.listarArquivadas(),
          api.exercicios.listar(),
        ]);
        const turmas = [...desembrulhar(ativas), ...desembrulhar(arquivadas)];
        // Um relatório por turma, todos juntos. allSettled: a falha de um
        // não derruba os outros.
        const relatorios = await Promise.allSettled(turmas.map((t) => api.relatorios.turma(t.id)));
        if (cancelado) return;
        setCarga({
          estado: 'pronto',
          linhas: turmas.map((turma, i) => {
            const r = relatorios[i];
            return { turma, relatorio: r.status === 'fulfilled' ? r.value : null };
          }),
          acervo: desembrulhar(exercicios).length,
        });
      } catch (excecao) {
        if (!cancelado) setCarga({ estado: 'erro', mensagem: mensagemDaFalha(excecao) });
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  function selecionarFiltro(novo: Filtro) {
    setFiltro(novo);
    const url = new URL(window.location.href);
    url.searchParams.set('filtro', novo);
    window.history.replaceState(null, '', url);
  }

  // Setas ← → andam entre os três botões do filtro.
  function aoTeclarNoFiltro(evento: KeyboardEventReact, indice: number) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const proximo = (indice + (evento.key === 'ArrowRight' ? 1 : -1) + FILTROS.length) % FILTROS.length;
    botoesFiltro.current[proximo]?.focus();
    selecionarFiltro(FILTROS[proximo].chave);
  }

  const colunas: ColunaTabela<LinhaDaTurma>[] = [
    {
      rotulo: 'Turma',
      celula: ({ turma }) => (
        <>
          <span className="celula-aluno-nome">{turma.nome ?? 'Turma sem nome'}</span>
          <span className="celula-trecho">{turma.periodo ?? 'Período não informado'}</span>
          {!turma.ativa && <span className="etiqueta etiqueta-espera">Arquivada</span>}
        </>
      ),
    },
    // Matrículas da turma: COUNT do back (a mesma contagem do cartão).
    { rotulo: 'Alunos', classe: 'col-numero', celula: ({ turma }) => contagem(turma.totalAlunos) },
    { rotulo: 'PPM médio', classe: 'col-numero', celula: ({ relatorio }) => numero(relatorio?.wpmMedio) },
    { rotulo: 'Precisão média', classe: 'col-numero', celula: ({ relatorio }) => porcentagem(relatorio?.precisaoMedia) },
    { rotulo: 'Tentativas', classe: 'col-numero', celula: ({ relatorio }) => contagem(relatorio?.tentativas) },
    { rotulo: 'Ativos (7 dias)', classe: 'col-numero', celula: ({ relatorio }) => contagem(relatorio?.alunosAtivos) },
    {
      rotulo: 'Relatório',
      celula: ({ turma }) => (
        <a
          className="btn btn-vidro vidro tecla btn-pequeno"
          href={`turma.html?${new URLSearchParams({ turma: turma.id, aba: 'relatorio' })}`}
          aria-label={`Abrir relatório da turma ${turma.nome ?? ''}`.trim()}
        >
          Abrir relatório da turma
        </a>
      ),
    },
  ];

  function renderizarConteudo() {
    if (carga.estado === 'carregando') return <EsqueletoTabela quantidade={4} />;
    if (carga.estado === 'erro') {
      return (
        <PainelErro
          titulo="Não foi possível carregar os relatórios"
          texto={carga.mensagem}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
      );
    }
    if (carga.linhas.length === 0) {
      return (
        <PainelEstado
          titulo="Nenhuma turma ainda"
          texto="Os relatórios nascem das sessões de uma turma. Crie a primeira, adicione os alunos e atribua exercícios: os números aparecem sozinhos."
        >
          <a className="btn btn-solido tecla tecla-clara" href="turmas.html">
            Ir para Minhas turmas
          </a>
        </PainelEstado>
      );
    }

    const linhas = carga.linhas.filter(
      ({ turma }) => filtro === 'todas' || (filtro === 'ativas' ? turma.ativa !== false : turma.ativa === false)
    );
    // Somas de CONTAGENS, nunca de médias. Matrícula é o vínculo aluno–turma.
    const soma = (valor: (l: LinhaDaTurma) => unknown) =>
      linhas.reduce((total, l) => total + (Number.isFinite(valor(l)) ? (valor(l) as number) : 0), 0);

    return (
      <>
        <dl className="cartoes-numero">
          <CartaoNumero rotulo="Turmas" valor={String(linhas.length)} />
          <CartaoNumero rotulo="Matrículas" valor={String(soma((l) => l.turma.totalAlunos))} />
          <CartaoNumero rotulo="Exercícios no acervo" valor={String(carga.acervo)} />
          <CartaoNumero rotulo="Atribuições atuais" valor={String(soma((l) => l.turma.totalExercicios))} />
        </dl>

        {linhas.length === 0 ? (
          <PainelEstado
            titulo={filtro === 'arquivadas' ? 'Nenhuma turma arquivada' : 'Nenhuma turma ativa'}
            texto="Mude o filtro para ver as outras turmas."
          />
        ) : (
          <>
            <Bloco titulo="Comparação entre as turmas" texto={<>{comPpm('PPM médio')} das sessões concluídas de cada turma.</>}>
              <Grafico
                tipo="bar"
                rotulos={linhas.map((l) => l.turma.nome ?? 'Turma')}
                series={[{ rotulo: 'PPM médio', dados: linhas.map((l) => l.relatorio?.wpmMedio ?? null) }]}
                unidades={['PPM']}
                descricao={`Gráfico de barras: PPM médio de ${linhas.length} ${linhas.length === 1 ? 'turma' : 'turmas'}. Os números estão na tabela "Resultados por turma".`}
              />
            </Bloco>
            <Bloco titulo="Resultados por turma" texto="Os números de cada turma. Turma sem sessão concluída aparece com —.">
              <Tabela colunas={colunas} linhas={linhas} chave={(l) => l.turma.id} />
            </Bloco>
          </>
        )}
      </>
    );
  }

  return (
    <Moldura modo="professor" ativo="relatorios" classeDoConteudo="pagina">
      <main id="corpo">
        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo">Relatórios gerais</h1>
            <p className="subtitulo">Como estão as suas turmas, lado a lado. O detalhe de cada uma fica no relatório da turma.</p>
          </div>
        </div>

        <div className="filtro-segmentado" role="group" aria-label="Quais turmas mostrar">
          {FILTROS.map((f, i) => (
            <button
              key={f.chave}
              type="button"
              className="aba tecla"
              ref={(el) => {
                botoesFiltro.current[i] = el;
              }}
              aria-pressed={filtro === f.chave}
              onClick={() => selecionarFiltro(f.chave)}
              onKeyDown={(evento) => aoTeclarNoFiltro(evento, i)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        <div id="conteudo" aria-busy={carga.estado === 'carregando'}>
          {renderizarConteudo()}
        </div>
      </main>
    </Moldura>
  );
}

function CartaoNumero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="cartao-numero">
      <dt className="cartao-numero-rotulo">{rotulo}</dt>
      <dd className="cartao-numero-valor">{valor}</dd>
    </div>
  );
}

// Erros — decide pelo status, nunca pelo texto do servidor.
function mensagemDaFalha(excecao: unknown): string {
  const erro = excecao as ErroDaApi | null | undefined;
  if (erro?.name !== 'ErroApi') {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  if (erro.status === 0) return MENSAGENS.CONEXAO;
  if (erro.status === 403) return MENSAGENS.PERMISSAO;
  return MENSAGENS.GENERICA;
}

// Montagem — guarda primeiro, React depois
const usuario = guarda.soConta('professor');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Relatorios />);
}
