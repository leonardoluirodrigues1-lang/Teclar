// SecoesDeConfiguracoes.tsx — o miolo da página Configurações, igual nos
// três modos (pages/solo, pages/professor e pages/aluno/configuracoes.html).
// Cada página põe a própria moldura e o próprio título em volta.
//
//   · Acessibilidade e Interface: preferências do APARELHO, no localStorage
//     (js/nucleo/preferencias-cedo.ts). Valem na hora e em todas as páginas.
//   · Conta: pela API. Todos trocam a foto de perfil. A conta (Solo e
//     professor) troca o nome e a senha; o aluno vê o nome, a turma e o
//     código e troca a senha da matrícula, com a regra, a dica e o medidor
//     do "Crie sua senha".
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { preferencias, type Preferencias, type Tamanho } from '../nucleo/preferencias.js';
import { validarNome, validarSenha, validarSenhaAluno } from '../utils/validacao.js';
import { MENSAGENS } from '../auth/comum.js';
import { imagemDaFoto } from '../utils/imagemDaCapa.js';
import { Avatar, useMinhaFoto, useUsuarioAtual } from './Avatar.js';
import { CampoSenha, ErroCampo, MedidorDeSenha, atributosDeErro, useErrosDeCampo, useForcaDaSenha } from '../auth/Formulario.js';

export type ModoDasConfiguracoes = 'solo' | 'professor' | 'aluno';

interface Props {
  modo: ModoDasConfiguracoes;
  /** Rever o tutorial do modo. Sem ela (o aluno não tem tutorial), o item não aparece. */
  aoReverTutorial?: () => void;
}

export function SecoesDeConfiguracoes({ modo, aoReverTutorial }: Props) {
  return (
    <>
      <Acessibilidade />
      {modo === 'aluno' ? <ContaDoAluno /> : <ContaDaConta />}
      <Interface aoReverTutorial={aoReverTutorial} />
    </>
  );
}

// --- peças comuns ------------------------------------------------------------

function Secao({ id, titulo, intro, children }: { id: string; titulo: string; intro: string; children: ReactNode }) {
  return (
    <section className="vidro config-secao" aria-labelledby={id}>
      <h2 className="config-secao-titulo" id={id}>
        {titulo}
      </h2>
      <p className="config-secao-intro">{intro}</p>
      {children}
    </section>
  );
}

// Checkbox de verdade, com o rótulo em volta: clicar no texto também marca,
// e o leitor de tela anuncia "marcado".
function Opcao({ nome, texto, marcada, aoMudar }: { nome: string; texto: string; marcada: boolean; aoMudar: (marcada: boolean) => void }) {
  return (
    <label className="config-opcao">
      <input type="checkbox" className="config-caixa" checked={marcada} onChange={(evento) => aoMudar(evento.target.checked)} />
      <span>
        <span className="config-opcao-nome">{nome}</span>
        <span className="config-opcao-texto">{texto}</span>
      </span>
    </label>
  );
}

function usePreferencias() {
  const [prefs, setPrefs] = useState(() => preferencias.ler());
  function mudar<K extends keyof Preferencias>(campo: K, valor: Preferencias[K]) {
    preferencias.definir(campo, valor);
    setPrefs(preferencias.ler());
  }
  return [prefs, mudar] as const;
}

// A falha da API em frase para a tela. 400 traz a frase do back (já em
// português, a da regra); o resto é a frase de sempre.
function mensagemDaFalha(excecao: unknown): string {
  const erro = excecao as { name?: string; status?: number; message?: string } | null;
  if (erro?.name === 'ErroApi' && erro.status === 400 && erro.message) return erro.message;
  if (erro?.name === 'ErroApi' && erro.status === 429) return MENSAGENS.MUITAS_TENTATIVAS;
  if (erro?.name !== 'ErroApi') console.error(excecao);
  return MENSAGENS.CONEXAO;
}

// --- Acessibilidade -------------------------------------------------------------

const TAMANHOS: { valor: Tamanho; rotulo: string }[] = [
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'grande', rotulo: 'Grande' },
  { valor: 'muito-grande', rotulo: 'Muito grande' },
];

function Acessibilidade() {
  const [prefs, mudar] = usePreferencias();
  return (
    <Secao id="config-acessibilidade" titulo="Acessibilidade" intro="Vale neste computador, para todas as telas do TECLAR.">
      <fieldset className="config-opcao config-grupo">
        <legend className="config-opcao-nome">Tamanho do texto</legend>
        <span className="config-escolhas">
          {TAMANHOS.map((tamanho) => (
            <label key={tamanho.valor} className="config-escolha">
              <input
                type="radio"
                name="tamanho-do-texto"
                value={tamanho.valor}
                checked={prefs.texto === tamanho.valor}
                onChange={() => mudar('texto', tamanho.valor)}
              />
              {tamanho.rotulo}
            </label>
          ))}
        </span>
        <span className="config-opcao-texto">Aumenta a tela inteira: letras, botões e campos crescem juntos.</span>
      </fieldset>

      <Opcao
        nome="Alto contraste"
        texto="Texto todo em branco, bordas bem marcadas e painéis sólidos, sem as estrelas do fundo."
        marcada={prefs.altoContraste}
        aoMudar={(marcada) => mudar('altoContraste', marcada)}
      />
      <Opcao
        nome="Reduzir movimento"
        texto="Tira as animações: nada desliza nem cresce, tudo aparece direto no lugar. Se o computador já pede menos movimento, o TECLAR obedece mesmo com esta opção desmarcada."
        marcada={prefs.reduzirMovimento}
        aoMudar={(marcada) => mudar('reduzirMovimento', marcada)}
      />
      <Opcao
        nome="Sons do treino"
        texto="Um toque curto e baixo quando a tecla sai errada. Vem desligado: marque para ouvir. Vale a partir do próximo treino."
        marcada={prefs.sonsDoTreino}
        aoMudar={(marcada) => mudar('sonsDoTreino', marcada)}
      />
      <Opcao
        nome="Mostrar o teclado guia"
        texto="O teclado desenhado embaixo do texto do treino, que acende a próxima tecla e mostra com qual dedo apertá-la. Vale a partir do próximo treino."
        marcada={prefs.tecladoGuia}
        aoMudar={(marcada) => mudar('tecladoGuia', marcada)}
      />
    </Secao>
  );
}

// --- Interface -------------------------------------------------------------------

function Interface({ aoReverTutorial }: { aoReverTutorial?: () => void }) {
  const [prefs, mudar] = usePreferencias();
  return (
    <Secao id="config-interface" titulo="Interface" intro="Também vale neste computador.">
      <Opcao
        nome="Mostrar dicas"
        texto={'As frases de ajuda pelo caminho: "Comece a digitar", o dedo embaixo do teclado guia e o "Ver meu painel". Avisos e erros sempre aparecem.'}
        marcada={prefs.dicas}
        aoMudar={(marcada) => mudar('dicas', marcada)}
      />
      <Opcao
        nome="Transições entre telas"
        texto="A tela some e a próxima aparece com um esmaecer curto. Desmarque para trocar de tela na hora."
        marcada={prefs.transicoes}
        aoMudar={(marcada) => mudar('transicoes', marcada)}
      />
      {aoReverTutorial && (
        <div className="config-opcao config-linha">
          <span>
            <span className="config-opcao-nome">Rever o tutorial</span>
            <span className="config-opcao-texto">A apresentação do modo, a mesma da primeira vez.</span>
          </span>
          <button type="button" className="config-botao tecla" onClick={aoReverTutorial}>
            Rever
          </button>
        </div>
      )}
    </Secao>
  );
}

// --- Conta: a foto de perfil (conta e aluno) --------------------------------------

// Escolher -> prévia (o navegador já recortou o quadrado, reduziu e converteu,
// utils/imagemDaCapa.ts) -> Salvar ou Cancelar. Com foto, Remover volta às
// iniciais. A foto salva vai para o usuario da sessão: o topo e a barra
// trocam na hora.
function FotoDePerfil() {
  useUsuarioAtual();
  const foto = useMinhaFoto();
  const aluno = sessao.tipo() === 'aluno';
  const rotas = aluno ? api.escola.aluno : api.conta;
  const arquivo = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const escolhido = evento.target.files?.[0];
    // Limpa o campo: escolher o mesmo arquivo de novo dispara de novo.
    evento.target.value = '';
    if (!escolhido) return;
    setAviso('');
    try {
      setPrevia(await imagemDaFoto(escolhido));
    } catch (erro) {
      setAviso((erro as Error).message);
    }
  }

  async function salvar() {
    if (!previa || ocupado) return;
    setOcupado(true);
    try {
      await rotas.enviarFoto(previa);
      sessao.atualizarUsuario({ temFoto: true, foto: previa });
      setPrevia(null);
      setAviso('Foto salva.');
    } catch (excecao) {
      setAviso(mensagemDaFalha(excecao));
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await rotas.removerFoto();
      sessao.atualizarUsuario({ temFoto: false, foto: undefined });
      setAviso('Foto removida. No lugar dela, aparece a sua inicial.');
    } catch (excecao) {
      setAviso(mensagemDaFalha(excecao));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="config-form config-foto" role="group" aria-labelledby="titulo-foto">
      <Avatar nome={sessao.nomeExibicao()} foto={previa ?? foto} classe="config-foto-circulo" />
      <div>
        <h3 className="config-form-titulo" id="titulo-foto">
          Foto de perfil
        </h3>
        <p className="config-opcao-texto">
          {previa
            ? 'Assim vai ficar. Salve para usar esta foto.'
            : `Aparece no topo e na barra lateral${aluno ? ', e para o seu professor na lista da turma' : ''}. Sem foto, aparece a sua inicial.`}
        </p>
        {/* O <input type="file"> fica escondido e o botão o abre: o botão
            é o que o teclado e o leitor de tela alcançam. */}
        <input ref={arquivo} type="file" accept="image/*" hidden onChange={aoEscolher} />
        <div className="config-foto-acoes">
          {previa ? (
            <>
              <button type="button" className="config-botao tecla" onClick={salvar} disabled={ocupado}>
                {ocupado ? 'Salvando…' : 'Salvar foto'}
              </button>
              <button type="button" className="config-botao tecla" onClick={() => setPrevia(null)} disabled={ocupado}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="config-botao tecla" onClick={() => arquivo.current?.click()} disabled={ocupado}>
                {foto ? 'Trocar foto' : 'Escolher foto'}
              </button>
              {foto && (
                <button type="button" className="config-botao tecla" onClick={remover} disabled={ocupado}>
                  Remover foto
                </button>
              )}
            </>
          )}
        </div>
        <p className="config-aviso" role="status">
          {aviso}
        </p>
      </div>
    </div>
  );
}

// --- Conta: Solo e professor -----------------------------------------------------

function ContaDaConta() {
  return (
    <Secao id="config-conta" titulo="Conta" intro="Os dados da sua conta, os mesmos no Solo e no modo Professor.">
      <FotoDePerfil />
      <FormNome />
      <FormSenha
        regra="Pelo menos 8 caracteres, com uma letra e um número."
        validarNova={(valor) => validarSenha(valor)}
        trocar={(atual, nova) => api.conta.trocarSenha(atual, nova)}
      />
    </Secao>
  );
}

function FormNome() {
  const campo = useRef<HTMLInputElement>(null);
  const campos = useErrosDeCampo({ nome: { ref: campo, checar: () => validarNome(campo.current.value.trim()) } });
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    if (campos.validar(['nome'])) {
      campo.current.focus();
      return;
    }
    setOcupado(true);
    setAviso('');
    try {
      const conta = await api.conta.renomear(campo.current.value.trim());
      sessao.atualizarUsuario({ nome: conta.nome });
      campo.current.value = conta.nome ?? '';
      setAviso('Nome salvo.');
    } catch (excecao) {
      setAviso(mensagemDaFalha(excecao));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="config-form" noValidate onSubmit={aoEnviar} aria-labelledby="titulo-nome">
      <h3 className="config-form-titulo" id="titulo-nome">
        Nome
      </h3>
      <div className="campo">
        <label className="rotulo" htmlFor="campo-nome">
          Seu nome
        </label>
        <input
          id="campo-nome"
          name="nome"
          type="text"
          autoComplete="name"
          maxLength={150}
          defaultValue={sessao.usuario()?.nome ?? ''}
          ref={campo}
          aria-describedby="erro-nome"
          onBlur={() => campos.aoSair('nome')}
          {...atributosDeErro(campos.erros.nome)}
        />
        <ErroCampo id="erro-nome" erro={campos.erros.nome} />
      </div>
      <button type="submit" className="config-botao tecla" disabled={ocupado}>
        {ocupado ? 'Salvando…' : 'Salvar nome'}
      </button>
      <p className="config-aviso" role="status">
        {aviso}
      </p>
    </form>
  );
}

// --- Conta: aluno --------------------------------------------------------------------

function ContaDoAluno() {
  const usuario = sessao.usuario();
  const turma = usuario?.turmas?.[0];
  return (
    <Secao id="config-conta" titulo="Conta" intro="Você entra com o código da turma, o seu nome e a sua senha.">
      <FotoDePerfil />
      <dl className="config-dados">
        <div>
          <dt>Nome</dt>
          <dd>{usuario?.nome}</dd>
        </div>
        <div>
          <dt>Turma</dt>
          <dd>{turma?.nome}</dd>
        </div>
        {turma?.codigo && (
          <div>
            <dt>Código da turma</dt>
            <dd className="config-codigo">{turma.codigo}</dd>
          </div>
        )}
      </dl>
      <p className="config-opcao-texto">O nome é o seu login na turma (com o código e a senha), por isso ele não muda aqui.</p>
      <FormSenha
        regra={null}
        nomeDoAluno={usuario?.nome ?? ''}
        validarNova={(valor) => validarSenhaAluno(valor.trim())}
        trocar={(atual, nova) => api.escola.aluno.trocarSenha(atual.trim(), nova.trim())}
      />
    </Secao>
  );
}

// --- Trocar a senha (conta e aluno) ---------------------------------------------

const NAO_CONFEREM = 'As duas senhas não são iguais.';

interface PropsFormSenha {
  /** A regra da senha da conta, embaixo do campo. null: o aluno, com a dica de criança e o medidor. */
  regra: string | null;
  nomeDoAluno?: string;
  validarNova: (valor: string) => string | null;
  trocar: (atual: string, nova: string) => Promise<unknown>;
}

function FormSenha({ regra, nomeDoAluno = '', validarNova, trocar }: PropsFormSenha) {
  const atual = useRef<HTMLInputElement>(null);
  const nova = useRef<HTMLInputElement>(null);
  const repetir = useRef<HTMLInputElement>(null);
  const aluno = regra === null;
  // O aluno apara a senha (como no login dele); a conta não.
  const valor = (ref: typeof nova) => (aluno ? ref.current.value.trim() : ref.current.value);
  const campos = useErrosDeCampo({
    atual: { ref: atual, checar: () => (valor(atual) === '' ? 'Digite a senha que você usa hoje.' : null) },
    nova: { ref: nova, checar: () => validarNova(nova.current.value) },
    repetir: { ref: repetir, checar: () => (valor(repetir) === valor(nova) ? null : NAO_CONFEREM) },
  });
  const refs = { atual, nova, repetir };
  const forca = useForcaDaSenha(nova, () => nomeDoAluno);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    const comErro = campos.validar(['atual', 'nova', 'repetir']);
    if (comErro) {
      refs[comErro].current.focus();
      return;
    }
    setOcupado(true);
    setAviso('');
    try {
      await trocar(valor(atual), valor(nova));
      for (const ref of [atual, nova, repetir]) ref.current.value = '';
      forca.atualizar();
      setAviso(aluno ? 'Pronto! Use a senha nova da próxima vez que entrar.' : 'Senha trocada.');
    } catch (excecao) {
      const codigo = (excecao as { codigo?: string })?.codigo;
      if (codigo === 'SENHA_ATUAL_INCORRETA') {
        campos.definir('atual', 'A senha atual não confere.');
        atual.current.focus();
      } else {
        setAviso(mensagemDaFalha(excecao));
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="config-form" noValidate onSubmit={aoEnviar} aria-labelledby="titulo-senha">
      <h3 className="config-form-titulo" id="titulo-senha">
        Trocar a senha
      </h3>
      <div className="campo">
        <label className="rotulo" htmlFor="campo-senha-atual">
          Senha atual
        </label>
        <CampoSenha
          id="campo-senha-atual"
          name="senha-atual"
          autoComplete="current-password"
          describedBy="erro-senha-atual"
          idBotao="btn-ver-senha-atual"
          erro={campos.erros.atual}
          inputRef={atual}
          onBlur={() => campos.aoSair('atual')}
        />
        <ErroCampo id="erro-senha-atual" erro={campos.erros.atual} />
      </div>
      <div className="campo">
        <label className="rotulo" htmlFor="campo-senha-nova">
          Senha nova
        </label>
        <CampoSenha
          id="campo-senha-nova"
          name="senha-nova"
          autoComplete="new-password"
          describedBy={aluno ? 'medidor-senha-nova erro-senha-nova' : 'regra-senha-nova erro-senha-nova'}
          idBotao="btn-ver-senha-nova"
          erro={campos.erros.nova}
          inputRef={nova}
          onBlur={() => campos.aoSair('nova')}
          onInput={aluno ? forca.atualizar : undefined}
        />
        {aluno ? (
          <MedidorDeSenha id="medidor-senha-nova" forca={forca.forca} falta={forca.falta} />
        ) : (
          <p className="ajuda-campo" id="regra-senha-nova">
            {regra}
          </p>
        )}
        <ErroCampo id="erro-senha-nova" erro={campos.erros.nova} />
      </div>
      <div className="campo">
        <label className="rotulo" htmlFor="campo-senha-repetir">
          Digite a nova de novo
        </label>
        <CampoSenha
          id="campo-senha-repetir"
          name="senha-repetir"
          autoComplete="new-password"
          describedBy="erro-senha-repetir"
          idBotao="btn-ver-senha-repetir"
          erro={campos.erros.repetir}
          inputRef={repetir}
          onBlur={() => campos.aoSair('repetir')}
        />
        <ErroCampo id="erro-senha-repetir" erro={campos.erros.repetir} />
      </div>
      <button type="submit" className="config-botao tecla" disabled={ocupado}>
        {ocupado ? 'Salvando…' : 'Trocar a senha'}
      </button>
      <p className="config-aviso" role="status">
        {aviso}
      </p>
    </form>
  );
}
