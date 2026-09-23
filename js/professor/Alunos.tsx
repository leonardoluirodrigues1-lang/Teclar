// Alunos.tsx — pages/professor/alunos.html
// Matrícula de alunos numa turma: RF02 (um por um) e RF03 (importação em
// lote por CSV). A turma vem por ?turma=<id>; sem ela, painel de erro.
//
// Um aluno é uma matrícula, uma senha e, opcional, um nome — a tabela
// Alunos tem ID, SenhaHash e Nome (nulo permitido). Por isso o formulário
// tem a matrícula e o nome, e por isso a senha inicial vem do back na
// resposta: o professor não a escolhe, só anota e entrega. Ela aparece uma
// vez, aqui, e não é guardada em lugar nenhum.
//
// Na importação o front lê o arquivo, parseia (js/utils/csv.js), confere
// linha a linha e manda o lote inteiro NUMA requisição. Quem decide se cada
// matrícula é aluno novo (cria, devolve senha) ou aluno que já existe
// (só vincula à turma, sem sobrescrever o nome que ele já tem) é o back —
// o front só entrega as linhas.
//
// Conversão de js/professor/alunos.js para React: mesmo markup, mesmas
// classes de css/escola.css, mesmos textos, validações e passos.

import {
  useEffect,
  useRef,
  useState,
  type DragEvent as DragEventReact,
  type KeyboardEvent as KeyboardEventReact,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import type { AlunoCriado, ErroDaApi, ResultadoImportacao } from '../nucleo/tipos.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import { nomeAlunoOuNull, validarMatriculaNova, validarNomeAluno } from '../utils/validacao.js';
import { parsearCsv, separarCabecalho, gerarCsv } from '../utils/csv.js';
import { Nav, SECOES_PROFESSOR } from '../componentes/Nav.js';
import { Tabela, type ColunaTabela } from '../componentes/Tabela.js';
import { PainelEstado } from '../componentes/PainelErro.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Limite do arquivo. 1 MB de matrículas de 15 dígitos dá mais de 60 mil
// linhas — uma turma não tem isso; um arquivo maior é engano de arquivo.
const TAMANHO_MAXIMO = 1024 * 1024;

// Quantas linhas a prévia mostra. O resto é contado, não desenhado.
const LINHAS_NA_PREVIA = 10;

// Nomes que a PRIMEIRA coluna do CSV pode usar no cabeçalho (é por ela que
// separarCabecalho decide; "matricula;nome" é cabeçalho). Tudo o mais na
// primeira linha é tratado como dado.
const COLUNAS_CONHECIDAS = ['matricula', 'id'];

// matricula e, opcional, nome. Uma terceira coluna é engano de planilha.
const COLUNAS_NO_CSV = 2;

// Como o CSV SAI daqui: ";", igual ao export do relatório — o Excel em
// português abre vírgula tudo numa coluna só. BOM só no ARQUIVO baixado
// (é o que faz o Excel abrir como UTF-8); colado, ele vira um caractere
// invisível na primeira célula. Na ENTRADA o parser aceita os dois
// separadores, com ou sem BOM.
const CSV_ARQUIVO = { separador: ';', bom: true } as const;
const CSV_COPIA = { separador: ';', bom: false } as const;

const MENSAGENS = {
  CONEXAO: 'Não foi possível conectar ao servidor.',
  PERMISSAO: 'Você não tem permissão para isso.',
  JA_NA_TURMA: 'Esta matrícula já está na turma',
  GENERICA: 'Algo deu errado. Tente de novo.',
};

// O &nbsp; que o HTML original deixava no subtítulo: ele já tem a altura
// certa antes de a turma chegar, e nada pula quando o nome aparece.
const NBSP = String.fromCharCode(0xa0);

// ============================================================================
// Estado da tela
// ============================================================================

type Aba = 'um' | 'csv';

// Uma linha do arquivo atual, já conferida. `motivo` null é linha boa.
interface LinhaConferida {
  numero: number;
  celulas: string[];
  id: string;
  nome: string | null;
  motivo: string | null;
}

// Matrícula feita nesta visita. `seq` é só para a key da lista.
interface Recente {
  seq: number;
  id: string;
  nome: string | null;
  senhaInicial: string;
}

type Passo = 'escolher' | 'conferir' | 'resultado';

interface Resultado {
  resposta: Partial<ResultadoImportacao>;
  // Linhas que a conferência já tinha marcado e não foram enviadas.
  puladas: LinhaConferida[];
}

const turmaId = new URLSearchParams(window.location.search).get('turma');
const linkVoltar = turmaId ? `turma.html?${new URLSearchParams({ turma: turmaId })}` : 'turmas.html';

function abaDaUrl(): Aba {
  return new URLSearchParams(window.location.search).get('aba') === 'csv' ? 'csv' : 'um';
}

// ============================================================================
// Tela
// ============================================================================

function Alunos() {
  // Turma — só o nome, para o subtítulo. Turma inexistente derruba a tela
  // inteira: não dá para matricular em lugar nenhum.
  const [semTurma, setSemTurma] = useState<string | null>(
    turmaId ? null : 'Esta página precisa de uma turma. Abra a matrícula a partir da turma.'
  );
  const [nomeTurma, setNomeTurma] = useState(NBSP);
  const [abaAtual, setAbaAtual] = useState<Aba>(abaDaUrl);

  const abaUm = useRef<HTMLButtonElement>(null);
  const abaCsv = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!turmaId) return;
    let cancelado = false;

    async function carregarTurma() {
      try {
        const turma = await api.turmas.obter(turmaId);
        if (cancelado) return;
        setNomeTurma(turma?.nome ?? 'Turma sem nome');
        document.title = `Teclar — Matricular em ${turma?.nome ?? 'turma'}`;
      } catch (excecao) {
        if (cancelado) return;
        if (ehErroApi(excecao) && excecao.status === 404) {
          setSemTurma('Ela pode ter sido removida, ou o link usado está incompleto.');
          return;
        }
        // Sem o nome a tela ainda funciona: as duas abas só precisam do id.
        setNomeTurma(mensagemDaFalha(excecao));
      }
    }

    carregarTurma();
    return () => {
      cancelado = true;
    };
  }, []);

  // --- abas — mesma mecânica de Turma.tsx: estado na URL, roving tabindex, setas

  function selecionarAba(aba: Aba) {
    if (aba === abaAtual) return;
    setAbaAtual(aba);
    const url = new URL(window.location.href);
    url.searchParams.set('aba', aba);
    window.history.replaceState(null, '', url);
  }

  function aoTeclarNaAba(evento: KeyboardEventReact, indice: number) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const abas = [abaUm.current, abaCsv.current];
    const proximo =
      evento.key === 'ArrowRight'
        ? abas[(indice + 1) % abas.length]
        : abas[(indice - 1 + abas.length) % abas.length];
    proximo?.focus();
    selecionarAba(proximo === abaUm.current ? 'um' : 'csv');
  }

  // Substitui o corpo inteiro: sem turma, nem formulário nem importação
  // têm para onde mandar o aluno.
  if (semTurma) {
    return (
      <>
        <Nav secoes={SECOES_PROFESSOR} ativo="turmas" />
        <main id="corpo">
          <PainelEstado titulo="Turma não encontrada" texto={semTurma}>
            <a className="btn btn-solido tecla tecla-clara" href="turmas.html">
              Ver minhas turmas
            </a>
          </PainelEstado>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav secoes={SECOES_PROFESSOR} ativo="turmas" />

      <main id="corpo">
        <a className="voltar" id="link-voltar" href={linkVoltar}>
          <span className="voltar-seta" aria-hidden="true">
            ←
          </span>
          Turma
        </a>

        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo">Matricular alunos</h1>
            <p className="subtitulo" id="nome-turma">
              {nomeTurma}
            </p>
          </div>
        </div>

        <div className="abas" role="tablist" aria-label="Formas de matricular">
          <button
            type="button"
            className="aba tecla"
            id="aba-um"
            ref={abaUm}
            role="tab"
            aria-selected={abaAtual === 'um'}
            aria-controls="conteudo"
            tabIndex={abaAtual === 'um' ? 0 : -1}
            onClick={() => selecionarAba('um')}
            onKeyDown={(evento) => aoTeclarNaAba(evento, 0)}
          >
            Um por um
          </button>
          <button
            type="button"
            className="aba tecla"
            id="aba-csv"
            ref={abaCsv}
            role="tab"
            aria-selected={abaAtual === 'csv'}
            aria-controls="conteudo"
            tabIndex={abaAtual === 'csv' ? 0 : -1}
            onClick={() => selecionarAba('csv')}
            onKeyDown={(evento) => aoTeclarNaAba(evento, 1)}
          >
            Importar CSV
          </button>
        </div>

        {/* Os dois painéis existem sempre; a aba só escolhe qual fica à vista.
            O que foi digitado ou importado numa aba sobrevive à troca. */}
        <div id="conteudo" role="tabpanel" aria-labelledby={abaAtual === 'um' ? 'aba-um' : 'aba-csv'}>
          <section id="painel-um" hidden={abaAtual !== 'um'}>
            <UmPorUm />
          </section>
          <section id="painel-csv" hidden={abaAtual !== 'csv'}>
            <ImportarCsv />
          </section>
        </div>
      </main>
    </>
  );
}

// ============================================================================
// Aba 1 — um por um
// ============================================================================

function UmPorUm() {
  const campo = useRef<HTMLInputElement>(null);
  const campoNome = useRef<HTMLInputElement>(null);
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [erroNome, setErroNome] = useState<string | null>(null);
  // Uma requisição por vez: segura o clique repetido e o Enter repetido.
  // O ref é a trava síncrona; o estado é o que o botão mostra.
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  // Mais recente no topo. Só em memória: some ao sair da página, de
  // propósito — a senha inicial não pode sobreviver em storage nenhum.
  const [recentes, setRecentes] = useState<Recente[]>([]);
  const proximoSeq = useRef(0);

  async function matricular() {
    if (enviando.current) return;

    const invalido = validarMatriculaNova(matricula);
    if (invalido) {
      setErro(invalido);
      campo.current?.focus();
      return;
    }
    const nomeInvalido = validarNomeAluno(nome);
    if (nomeInvalido) {
      setErroNome(nomeInvalido);
      campoNome.current?.focus();
      return;
    }

    enviando.current = true;
    setOcupado(true);
    setErro(null);
    setErroNome(null);

    try {
      const resposta = await api.alunos.cadastrar(turmaId, {
        id: matricula.trim(),
        nome: nomeAlunoOuNull(nome),
      });
      setRecentes((lista) => [
        {
          seq: proximoSeq.current++,
          id: resposta.id,
          nome: resposta.nome ?? null,
          senhaInicial: resposta.senhaInicial,
        },
        ...lista,
      ]);
      toasts.mostrar('Aluno matriculado');
      // Campos limpos e foco na matrícula: o próximo entra sem tocar no mouse.
      setMatricula('');
      setNome('');
      campo.current?.focus();
    } catch (excecao) {
      // 409 é "já está na turma" — vai no campo, com o texto certo, e
      // não num toast genérico.
      const mensagem =
        ehErroApi(excecao) && excecao.status === 409 ? MENSAGENS.JA_NA_TURMA : mensagemDaFalha(excecao);
      setErro(mensagem);
      campo.current?.focus();
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }

  return (
    <>
      {/* Antes dos campos, e não no rodapé: é a dúvida que o professor tem
          antes de matricular — como o aluno vai entrar. */}
      <p className="aviso-senha">
        Você não escolhe a senha: o sistema gera uma para cada aluno. Ela aparece uma única vez, na
        lista abaixo — anote e entregue ao aluno.
      </p>
      <form
        className="painel-form vidro campo-modal"
        id="form-um"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          matricular();
        }}
      >
        <div className="campo-form">
          <label htmlFor="campo-matricula">Matrícula</label>
          <input
            type="text"
            id="campo-matricula"
            name="matricula"
            ref={campo}
            inputMode="numeric"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={15}
            aria-describedby="erro-matricula ajuda-matricula"
            aria-invalid={Boolean(erro)}
            className={erro ? 'invalido' : undefined}
            value={matricula}
            onChange={(evento) => setMatricula(evento.target.value)}
            // Validação no blur e no envio — nunca a cada tecla. Campo em branco
            // no blur não é erro ainda: a pessoa pode só ter passado por ele com Tab.
            onBlur={() => {
              if (matricula === '') return;
              setErro(validarMatriculaNova(matricula));
            }}
          />
          <p className="erro-campo" id="erro-matricula" aria-live="polite">
            {erro}
          </p>
        </div>
        {/* Opcional: a coluna Nome de Alunos aceita nulo. Vazio vai como null. */}
        <div className="campo-form">
          <label htmlFor="campo-nome">Nome (opcional)</label>
          <div className="linha-campo">
            <input
              type="text"
              id="campo-nome"
              name="nome"
              ref={campoNome}
              autoComplete="off"
              spellCheck={false}
              maxLength={150}
              aria-describedby="erro-nome ajuda-matricula"
              aria-invalid={Boolean(erroNome)}
              className={erroNome ? 'invalido' : undefined}
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              onBlur={() => setErroNome(validarNomeAluno(nome))}
            />
            <button type="submit" className="btn btn-solido tecla tecla-clara" id="btn-matricular" disabled={ocupado}>
              {ocupado ? 'Matriculando…' : 'Matricular'}
            </button>
          </div>
          <p className="erro-campo" id="erro-nome" aria-live="polite">
            {erroNome}
          </p>
        </div>
        <p className="ajuda-campo" id="ajuda-matricula">
          Matrícula só com números, de 6 a 15 dígitos; nome de 2 a 150 caracteres, se quiser.
        </p>
      </form>

      {/* Matrículas feitas nesta visita, mais recente no topo. */}
      <section
        className="recentes"
        id="recentes"
        hidden={recentes.length === 0}
        aria-labelledby="recentes-titulo"
      >
        <h2 className="secao-rotulo" id="recentes-titulo">
          Matriculados agora
        </h2>
        <p className="ajuda-campo">Esta lista some ao sair da página — a senha não fica guardada.</p>
        <ul className="lista-senhas" id="lista-recentes">
          {recentes.map((recente) => (
            <ItemSenha
              key={recente.seq}
              id={recente.id}
              nome={recente.nome}
              senhaInicial={recente.senhaInicial}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

// ============================================================================
// Copiar — clipboard com fallback silencioso
// ============================================================================

// Se a área de transferência não estiver disponível (página fora de HTTPS,
// permissão negada), o texto aparece num campo selecionável logo abaixo
// de quem pediu, em vez de um erro que não ajuda ninguém. `vez` muda a
// cada pedido, para o campo voltar a ganhar foco mesmo com o mesmo texto.
interface Copia {
  texto: string;
  vez: number;
}

async function copiarTexto(texto: string, mostrarCampo: (copia: Copia) => void, vez: number) {
  try {
    await navigator.clipboard.writeText(texto);
    toasts.mostrar('Copiado');
  } catch {
    mostrarCampo({ texto, vez });
  }
}

function CampoCopia({ copia }: { copia: Copia }) {
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
  }, [copia]);

  return (
    <textarea
      ref={campo}
      className="campo-copia"
      readOnly
      rows={Math.min(6, Math.max(1, copia.texto.split('\n').length))}
      aria-label="Texto para copiar"
      value={copia.texto}
    />
  );
}

// Um par matrícula + senha inicial (e o nome, quando houver), com o botão
// de copiar matrícula e senha.
function ItemSenha({
  id,
  nome = null,
  senhaInicial,
}: {
  id: string;
  nome?: string | null;
  senhaInicial: string;
}) {
  const [copia, setCopia] = useState<Copia | null>(null);
  const vez = useRef(0);

  return (
    <li className="item-senha">
      {nome && (
        <div>
          <span className="item-senha-rotulo">Nome</span>
          <span className="item-senha-valor item-senha-nome">{nome}</span>
        </div>
      )}
      <div>
        <span className="item-senha-rotulo">Matrícula</span>
        <span className="item-senha-valor">{id ?? '—'}</span>
      </div>
      <div className="item-senha-destaque">
        <span className="item-senha-rotulo">Senha inicial</span>
        <span className="item-senha-valor">{senhaInicial ?? '—'}</span>
      </div>
      <button
        type="button"
        className="btn-mini tecla"
        aria-label={`Copiar matrícula ${id} e senha inicial`}
        onClick={() => copiarTexto(`${id}\t${senhaInicial}`, setCopia, ++vez.current)}
      >
        Copiar
      </button>
      {copia && <CampoCopia copia={copia} />}
    </li>
  );
}

// ============================================================================
// Aba 2 — importar CSV. Três passos na mesma página.
// ============================================================================

function ImportarCsv() {
  const arquivo = useRef<HTMLInputElement>(null);
  const btnImportar = useRef<HTMLButtonElement>(null);
  const tituloResultado = useRef<HTMLHeadingElement>(null);

  // Linhas do arquivo atual, já conferidas. Tudo o que os passos 2 e 3
  // mostram sai daqui.
  const [linhas, setLinhas] = useState<LinhaConferida[]>([]);
  const [passo, setPasso] = useState<Passo>('escolher');
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [erroImportar, setErroImportar] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  // Durante a importação (e depois dela, até "Importar outro arquivo"):
  // nem escolher, nem soltar, nem clicar de novo.
  const [travado, setTravado] = useState(false);
  const importando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // --- passo 1: escolher ----------------------------------------------------

  function receberArquivo(escolhido: File) {
    setErroArquivo(null);
    setPasso('escolher');
    setLinhas([]);

    if (!/\.csv$/i.test(escolhido.name)) {
      setErroArquivo('Só arquivo .csv. Salve a planilha como CSV e tente de novo.');
      arquivo.current.value = '';
      return;
    }
    if (escolhido.size > TAMANHO_MAXIMO) {
      setErroArquivo(
        `O arquivo tem ${formatarTamanho(escolhido.size)}; o limite é 1 MB. Uma turma cabe em muito menos que isso.`
      );
      arquivo.current.value = '';
      return;
    }

    // FileReader em UTF-8: o front lê o texto, parseia e manda JSON. O
    // arquivo cru nunca vai para o back.
    const leitor = new FileReader();
    leitor.addEventListener('load', () => {
      const conferidas = conferir(String(leitor.result ?? ''));
      if (conferidas.length === 0) {
        setErroArquivo('O arquivo não tem nenhuma linha de matrícula.');
        arquivo.current.value = '';
        return;
      }
      mostrarPrevia(conferidas);
    });
    leitor.addEventListener('error', () => {
      setErroArquivo('Não foi possível ler o arquivo.');
      arquivo.current.value = '';
    });
    leitor.readAsText(escolhido, 'UTF-8');
  }

  function limparArquivo() {
    setLinhas([]);
    arquivo.current.value = '';
    setErroArquivo(null);
    setPasso('escolher');
    setResultado(null);
    setErroImportar(null);
  }

  function aoArrastarPorCima(evento: DragEventReact) {
    if (travado) return; // travado durante e depois da importação
    evento.preventDefault();
    setArrastando(true);
  }

  // dragover precisa de preventDefault, senão o navegador abre o arquivo
  // em vez de entregá-lo para a página.
  function aoSoltar(evento: DragEventReact) {
    setArrastando(false);
    evento.preventDefault();
    if (travado) return;
    const [escolhido] = evento.dataTransfer?.files ?? [];
    if (escolhido) receberArquivo(escolhido);
  }

  // --- passo 2: conferir ----------------------------------------------------

  function mostrarPrevia(conferidas: LinhaConferida[]) {
    // flushSync: o passo 2 precisa estar à vista ANTES de o botão ganhar foco.
    flushSync(() => {
      setLinhas(conferidas);
      setResultado(null);
      setPasso('conferir');
    });
    btnImportar.current?.focus();
  }

  const validas = linhas.filter((l) => !l.motivo);
  const comProblema = linhas.length - validas.length;

  // --- importar -------------------------------------------------------------

  async function importar() {
    if (importando.current) return;
    if (validas.length === 0) return;

    importando.current = true;
    setErroImportar(null);
    setTravado(true);
    setOcupado(true);

    try {
      // O lote inteiro numa requisição só. Uma por linha travaria a tela
      // e deixaria a turma pela metade se a rede caísse no meio.
      const resposta = await api.alunos.importar(
        turmaId,
        validas.map((l) => ({ id: l.id, nome: l.nome }))
      );
      mostrarResultado(resposta ?? {}, linhas.filter((l) => l.motivo));
      toasts.mostrar('Importação concluída');
    } catch (excecao) {
      // Falha do lote inteiro: fica no passo 2, com o erro embaixo do
      // botão e tudo destravado para tentar de novo. flushSync: o botão
      // precisa estar reabilitado ANTES de ganhar foco.
      flushSync(() => {
        setErroImportar(mensagemDaFalha(excecao));
        setTravado(false);
        setOcupado(false);
      });
      btnImportar.current?.focus();
    } finally {
      importando.current = false;
    }
  }

  // --- passo 3: resultado ---------------------------------------------------

  function mostrarResultado(resposta: Partial<ResultadoImportacao>, puladas: LinhaConferida[]) {
    // flushSync: o passo 3 precisa estar à vista ANTES de o título ganhar foco.
    flushSync(() => {
      setResultado({ resposta, puladas });
      setPasso('resultado');
    });
    tituloResultado.current?.focus();
  }

  function importarOutroArquivo() {
    setTravado(false);
    setOcupado(false);
    limparArquivo();
    arquivo.current?.focus();
  }

  // O botão diz o que vai acontecer. Sem linha boa não há o que mandar.
  const rotuloImportar = ocupado
    ? 'Importando…'
    : validas.length === 0
      ? 'Nada para importar'
      : `Importar ${validas.length} ${validas.length === 1 ? 'aluno' : 'alunos'}`;

  return (
    <>
      {/* Passo 1: escolher */}
      <section className="passo" aria-labelledby="passo-1-titulo">
        <h2 className="passo-titulo" id="passo-1-titulo">
          <span className="passo-numero">1</span> Escolher o arquivo
        </h2>
        <div className="passo-linha">
          <div
            className={`soltar vidro${arrastando ? ' arrastando' : ''}`}
            id="soltar"
            aria-disabled={travado}
            onDragEnter={aoArrastarPorCima}
            onDragOver={aoArrastarPorCima}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
          >
            {/* O input de verdade fica aqui, só visualmente escondido: chega
                por Tab e abre por Enter/Espaço, como qualquer <input type="file">. */}
            <input
              type="file"
              id="campo-arquivo"
              ref={arquivo}
              className="sr-only"
              accept=".csv,text/csv"
              aria-label="Arquivo CSV de matrículas"
              aria-describedby="soltar-ajuda"
              disabled={travado}
              onChange={() => {
                const [escolhido] = arquivo.current?.files ?? [];
                if (escolhido) receberArquivo(escolhido);
              }}
            />
            <p className="soltar-texto">Arraste o CSV para cá</p>
            <p className="soltar-ou">ou</p>
            <button
              type="button"
              className="btn btn-vidro vidro tecla"
              id="btn-escolher"
              disabled={travado}
              onClick={() => arquivo.current?.click()}
            >
              Escolher arquivo
            </button>
            <p className="soltar-ajuda" id="soltar-ajuda">
              Colunas <code>matricula</code> e <code>nome</code> (opcional). Até 1 MB.
            </p>
            <p className="erro-campo" id="erro-arquivo" aria-live="polite">
              {erroArquivo}
            </p>
          </div>
          <div className="modelo">
            <p className="modelo-texto">Não tem o arquivo ainda?</p>
            <button type="button" className="btn btn-vidro vidro tecla" id="btn-modelo" onClick={baixarModelo}>
              Baixar modelo
            </button>
          </div>
        </div>
      </section>

      {/* Passo 2: conferir */}
      <section
        className="passo"
        id="passo-conferir"
        hidden={passo !== 'conferir'}
        aria-labelledby="passo-2-titulo"
      >
        <h2 className="passo-titulo" id="passo-2-titulo">
          <span className="passo-numero">2</span> Conferir
        </h2>
        <p className="resumo-linha" id="resumo-previa" role="status">
          <strong>{linhas.length}</strong> {linhas.length === 1 ? 'linha' : 'linhas'} ·{' '}
          <strong>{comProblema}</strong> com problema
        </p>
        <div id="previa">
          {linhas.length > 0 && (
            <Tabela
              colunas={colunasPrevia}
              linhas={linhas.slice(0, LINHAS_NA_PREVIA)}
              chave={(linha) => String(linha.numero)}
              classeLinha={(linha) => (linha.motivo ? 'linha-problema' : undefined)}
              rodape={
                linhas.length > LINHAS_NA_PREVIA ? (
                  <p className="tabela-rodape">
                    Mostrando as {LINHAS_NA_PREVIA} primeiras de {linhas.length} linhas.
                  </p>
                ) : null
              }
            />
          )}
        </div>
        <div className="passo-acoes">
          <button
            type="button"
            className="btn btn-solido tecla tecla-clara"
            id="btn-importar"
            ref={btnImportar}
            disabled={ocupado || validas.length === 0}
            onClick={importar}
          >
            {rotuloImportar}
          </button>
          <button
            type="button"
            className="btn btn-vidro vidro tecla"
            id="btn-trocar"
            disabled={ocupado}
            onClick={() => {
              limparArquivo();
              arquivo.current?.focus();
            }}
          >
            Trocar arquivo
          </button>
        </div>
        <p className="erro-campo" id="erro-importar" aria-live="polite">
          {erroImportar}
        </p>
      </section>

      {/* Passo 3: resultado */}
      <section
        className="passo"
        id="passo-resultado"
        hidden={passo !== 'resultado'}
        aria-labelledby="passo-3-titulo"
      >
        <h2 className="passo-titulo" id="passo-3-titulo" ref={tituloResultado} tabIndex={-1}>
          <span className="passo-numero">3</span> Resultado
        </h2>
        <div id="resultado">
          {resultado && (
            <ResultadoImportado resultado={resultado} aoImportarOutro={importarOutroArquivo} />
          )}
        </div>
      </section>
    </>
  );
}

// Texto do arquivo -> linhas conferidas. A regra de cada linha:
//   · matrícula e, opcional, nome — até duas colunas (célula vazia sobrando
//     no fim é tolerada — o Excel costuma deixar um ";" a mais);
//   · matrícula com o mesmo formato do cadastro um por um;
//   · nome, se veio, com o mesmo limite do cadastro um por um;
//   · não repetida dentro do arquivo (a primeira vale, as outras não).
function conferir(texto: string): LinhaConferida[] {
  const { linhas: brutas } = parsearCsv(texto);
  // primeiraLinha: número da linha de dados[0] como a planilha numera —
  // já descontando cabeçalho e linhas em branco antes dele.
  const { dados, primeiraLinha } = separarCabecalho(brutas, COLUNAS_CONHECIDAS);

  const vistas = new Map<string, number>();
  const conferidas: LinhaConferida[] = [];
  dados.forEach((bruta, indice) => {
    const numero = primeiraLinha + indice;
    const celulas = semVaziasNoFim(bruta);
    // Linha totalmente em branco (o Excel deixa várias no fim) não é
    // registro: some, mas conta na numeração, que é a da planilha.
    if (celulas.every((c) => c === '')) return;

    const id = celulas[0] ?? '';
    const nome = nomeAlunoOuNull(celulas[1]);
    let motivo: string | null = null;

    // "Vazia" é a linha que tem conteúdo, mas não na primeira coluna.
    if (id === '') {
      motivo = 'Matrícula vazia';
    } else if (celulas.length > COLUNAS_NO_CSV) {
      motivo = `Número de colunas errado: esperadas até ${COLUNAS_NO_CSV}, veio ${celulas.length}`;
    } else {
      const invalida = validarMatriculaNova(id) ?? validarNomeAluno(nome);
      if (invalida) motivo = /números/.test(invalida) ? 'Matrícula com letra' : invalida;
      else if (vistas.has(id)) motivo = `Repetida no arquivo (igual à linha ${vistas.get(id)})`;
      else vistas.set(id, numero);
    }

    conferidas.push({ numero, celulas, id, nome, motivo });
  });
  return conferidas;
}

function semVaziasNoFim(celulas: string[]): string[] {
  let fim = celulas.length;
  while (fim > 1 && celulas[fim - 1] === '') fim--;
  return celulas.slice(0, fim);
}

const colunasPrevia: ColunaTabela<LinhaConferida>[] = [
  { rotulo: 'Linha', classe: 'col-numero', celula: (linha) => String(linha.numero) },
  {
    rotulo: 'Matrícula',
    classe: 'col-mono',
    // Linha ruim mostra o que veio, não o que a tela entendeu: é isso
    // que a pessoa vai procurar na planilha.
    celula: (linha) => (linha.motivo ? linha.celulas.join(' | ') || '(vazio)' : linha.id),
  },
  { rotulo: 'Nome', celula: (linha) => (linha.motivo ? '' : (linha.nome ?? '—')) },
  {
    rotulo: 'Situação',
    classe: (linha) => (linha.motivo ? 'col-motivo' : 'col-ok'),
    celula: (linha) => linha.motivo ?? 'ok',
  },
];

// ============================================================================
// Passo 3 — resultado
// ============================================================================

// `puladas` são as linhas que a conferência já tinha marcado e não foram
// enviadas; entram no resumo de falhas com o motivo delas, para o CSV de
// correção sair completo.
function ResultadoImportado({
  resultado: { resposta, puladas },
  aoImportarOutro,
}: {
  resultado: Resultado;
  aoImportarOutro: () => void;
}) {
  const { criados = [], vinculados = [], falhas = [] } = resposta;
  const [copia, setCopia] = useState<Copia | null>(null);
  const vez = useRef(0);

  // As falhas do back trazem a linha enviada de volta em `linha`.
  const falhasDoBack = falhas.map((f) => ({
    id: String(f?.linha?.id ?? (f as unknown as { id?: string })?.id ?? ''),
    nome: f?.linha?.nome ?? '',
    motivo: f?.motivo ?? 'Motivo não informado',
  }));
  const totalFalhas = falhasDoBack.length + puladas.length;

  return (
    <div>
      {/* Três números no mesmo painel das métricas da turma. */}
      <div className="metricas-turma vidro">
        <MetricaResultado rotulo="Criados" valor={criados.length} />
        <MetricaResultado rotulo="Vinculados" valor={vinculados.length} />
        <MetricaResultado rotulo="Falharam" valor={totalFalhas} />
      </div>

      {criados.length > 0 && (
        <Grupo
          titulo="Criados — anote a senha inicial"
          texto="Aluno novo no sistema: recebe matrícula e senha. A senha só aparece aqui."
        >
          <ul className="lista-senhas">
            {criados.map((c: AlunoCriado, i) => (
              <ItemSenha key={`${c.id}-${i}`} id={c.id} nome={c.nome} senhaInicial={c.senhaInicial} />
            ))}
          </ul>
        </Grupo>
      )}

      {vinculados.length > 0 && (
        <Grupo titulo="Vinculados" texto="Já existiam no sistema e entraram nesta turma com a senha que já têm.">
          <p className="item-falha-id">
            {vinculados.map((v) => (typeof v === 'string' ? v : v?.id)).join(', ')}
          </p>
        </Grupo>
      )}

      {totalFalhas > 0 && (
        <Grupo titulo="Falharam" texto="Corrija na planilha e importe só estas de novo.">
          <ul className="lista-falhas">
            {falhasDoBack.map((f, i) => (
              <ItemFalha key={`back-${i}`} id={f.id} motivo={f.motivo} />
            ))}
            {puladas.map((l) => (
              <ItemFalha
                key={`pulada-${l.numero}`}
                id={l.celulas.join(' | ') || '(vazio)'}
                motivo={`${l.motivo} (linha ${l.numero})`}
              />
            ))}
          </ul>
        </Grupo>
      )}

      {/* Ações: copiar criados, copiar as que falharam, voltar, outro arquivo. */}
      <div className="resultado-acoes">
        {criados.length > 0 && (
          <button
            type="button"
            className="btn btn-vidro vidro tecla"
            onClick={() =>
              copiarTexto(
                criados.map((c) => `${c.id}\t${c.senhaInicial}`).join('\n'),
                setCopia,
                ++vez.current
              )
            }
          >
            Copiar criados
          </button>
        )}

        {totalFalhas > 0 && (
          <button
            type="button"
            className="btn btn-vidro vidro tecla"
            onClick={() => {
              // CSV pronto para reimportar: cabeçalho e as linhas como vieram
              // (as do back, pela matrícula; as puladas, com as células brutas).
              const csv = gerarCsv(
                [
                  ['matricula', 'nome'],
                  ...falhasDoBack.map((f) => [f.id, f.nome]),
                  ...puladas.map((l) => l.celulas),
                ],
                CSV_COPIA
              );
              copiarTexto(csv, setCopia, ++vez.current);
            }}
          >
            Copiar linhas que falharam
          </button>
        )}

        <a className="btn btn-solido tecla tecla-clara" href={linkVoltar}>
          Voltar para a turma
        </a>

        <button type="button" className="btn btn-vidro vidro tecla" onClick={aoImportarOutro}>
          Importar outro arquivo
        </button>
      </div>

      {copia && <CampoCopia copia={copia} />}
    </div>
  );
}

function Grupo({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="resultado-grupo">
      <h3 className="secao-rotulo">{titulo}</h3>
      <p className="ajuda-campo">{texto}</p>
      {children}
    </section>
  );
}

function ItemFalha({ id, motivo }: { id: string; motivo: string }) {
  return (
    <li className="item-falha">
      <span className="item-falha-id">{id}</span>
      <span className="item-falha-motivo">{motivo}</span>
    </li>
  );
}

function MetricaResultado({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="metrica-item">
      <span className="metrica-rotulo">{rotulo}</span>
      <span className="metrica-valor">{String(valor)}</span>
    </div>
  );
}

// --- modelo -----------------------------------------------------------------

// Gerado aqui, com Blob: não há o que pedir ao back para um arquivo de
// quatro linhas. Um exemplo com nome e um sem: o nome é opcional, e o
// modelo mostra isso em vez de explicar.
function baixarModelo() {
  const csv = gerarCsv([['matricula', 'nome'], ['20251001', 'Ana Souza'], ['20251002', '']], CSV_ARQUIVO);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-matriculas.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Um instante depois: revogar na hora cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// Apoio
// ============================================================================

function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Duck typing, não instanceof: o erro do mock tem a mesma forma do ErroApi
// do api.ts, mas não é instância dele.
function ehErroApi(excecao: unknown): excecao is ErroDaApi {
  return (excecao as ErroDaApi | null | undefined)?.name === 'ErroApi';
}

// Mesmo critério de Turma.tsx: decide pelo status, nunca pelo texto do
// servidor. 401 não entra aqui: o api.ts já derruba a sessão.
function mensagemDaFalha(excecao: unknown): string {
  if (!ehErroApi(excecao)) {
    console.error(excecao);
    return MENSAGENS.GENERICA;
  }
  if (excecao.status === 0) return MENSAGENS.CONEXAO;
  if (excecao.status === 403) return MENSAGENS.PERMISSAO;
  return MENSAGENS.GENERICA;
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de professor antes de montar. Devolveu null, redirecionou: a
// tela para aqui e nada mais roda.
const usuario = guarda.soConta('professor');

// O host dos toasts fica fora da raiz do React (ver alunos.html), e o
// toast.js continua cuidando dele como nas telas em JS.
let toasts: Toasts;

if (usuario) {
  guarda.aplicarMundo();
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 2 });
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Alunos />);
}
