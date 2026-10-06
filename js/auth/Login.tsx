// Login.tsx — pages/login.html
// A PRIMEIRA tela depois da landing: não existe escolha nenhuma antes do
// login. Um HTML só, dois formulários:
//   Conta (padrão) -> e-mail e senha; depois cai na tela de modo (Solo ou
//                     Professor), ou direto no último modo salvo
//   Aluno          -> código da turma, nome (como o professor subiu na
//                     lista) e senha; vai para o dashboard do aluno. No
//                     primeiro acesso a senha digitada é gravada.
// O de aluno é alcançado pelo "Sou aluno, tenho o código da turma", ou
// abre direto com ?aluno=1 (o cartão "Aluno" da tela de modo).
//
// A tela não decide quem a pessoa é: o `tipo` da resposta do back (de
// qual tabela o login veio) é que diz, e o guarda.entrar() roteia por ele.
//
// Também é o destino de quem foi expulso por token vencido: o api.ts manda
// para cá com ?expirou=1 em qualquer 401 do app.
//
// Conversão de js/auth/login.js para React: mesmo markup, mesmas classes de
// css/auth.css, mesmas validações, mensagens, códigos de erro e focos. Os
// inputs são não controlados (ref + .value), ver Formulario.tsx.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ROTA_CADASTRO } from '../config.js';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { criarToasts } from '../componentes/toast.js';
import type { RespostaLogin } from '../nucleo/tipos.js';
import {
  validarEmail,
  validarSenhaLogin,
  validarSenhaAluno,
  validarNome,
  validarCodigo,
  normalizarCodigo,
} from '../utils/validacao.js';
import { mensagemDoErro, MENSAGENS } from './comum.js';
import { useErrosDeCampo, atributosDeErro, ErroCampo, CampoSenha } from './Formulario.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

type Modo = 'conta' | 'aluno';

interface OpcoesEnvio {
  requisicao: () => Promise<RespostaLogin>;
  /** As frases de erro deste formulário (mudam entre conta e aluno). */
  frases: Parameters<typeof mensagemDoErro>[1];
  /** Onde a mensagem de erro do formulário aparece. */
  mostrarErro: (mensagem: string) => void;
  aoFalhar: () => void;
}

function Login() {
  // O formulário de conta é o padrão; o de aluno pelo botão ou por
  // ?aluno=1 — o cartão "Aluno" da tela de modo sai da conta e chega aqui
  // com ele, para a pessoa não ter de achar o botão.
  const [modo, setModo] = useState<Modo>(() =>
    new URLSearchParams(window.location.search).get('aluno') === '1' ? 'aluno' : 'conta'
  );

  // Uma requisição por vez: bloqueia clique repetido e Enter duplo. O ref é
  // a trava síncrona (o estado só muda no próximo render); o estado é o que
  // o botão pinta (texto "Entrando…" e disabled).
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  const [erroConta, setErroConta] = useState('');
  const [erroAluno, setErroAluno] = useState('');

  const email = useRef<HTMLInputElement>(null);
  const senha = useRef<HTMLInputElement>(null);
  const codigo = useRef<HTMLInputElement>(null);
  const nome = useRef<HTMLInputElement>(null);
  const senhaAluno = useRef<HTMLInputElement>(null);

  // --- validação de campo ----------------------------------------------------
  // No blur e no envio. A cada tecla, não.

  const campos = useErrosDeCampo({
    email: { ref: email, checar: () => validarEmail(email.current.value) },
    senha: { ref: senha, checar: () => validarSenhaLogin(senha.current.value) },
    codigo: { ref: codigo, checar: () => validarCodigo(codigo.current.value) },
    nome: { ref: nome, checar: () => validarNome(nome.current.value) },
    // A regra da senha de aluno vale também no login: a tela não sabe se é
    // o primeiro acesso, e toda senha de aluno gravada já segue a regra.
    senhaAluno: { ref: senhaAluno, checar: () => validarSenhaAluno(senhaAluno.current.value) },
  });
  const refs = { email, senha, codigo, nome, senhaAluno };

  // O cadastro é só de conta: o aluno nasce da lista que o professor sobe.
  const hrefCadastro = ROTA_CADASTRO;

  // --- troca de modo ---------------------------------------------------------

  // Foco no primeiro campo do formulário que está à vista — ao abrir e a
  // cada troca de modo (o que mostrarModo() fazia no fim).
  useEffect(() => {
    (modo === 'aluno' ? codigo : email).current?.focus();
  }, [modo]);

  function mostrarModo(novo: Modo) {
    limparTudo();
    setModo(novo);
  }

  function irParaAluno() {
    mostrarModo('aluno');
  }

  function irParaConta() {
    mostrarModo('conta');
  }

  // --- envio -----------------------------------------------------------------
  // Enter em qualquer campo dispara o submit do form; o submit é o único
  // caminho de envio, para não existirem dois.

  function aoEnviarConta(evento: FormEvent) {
    evento.preventDefault();
    entrarComConta();
  }

  function aoEnviarAluno(evento: FormEvent) {
    evento.preventDefault();
    entrarComoAluno();
  }

  async function entrarComConta() {
    if (enviando.current) return;

    const comErro = campos.validar(['email', 'senha']);
    if (comErro) {
      refs[comErro].current.focus();
      return;
    }

    await enviar({
      // A senha vai daqui direto para a requisição: não fica em variável de
      // módulo, não fica em estado, não sobra depois do envio.
      requisicao: () =>
        api.auth.entrar({
          email: email.current.value.trim(),
          // Aparada: um espaço colado junto não pode virar "senha
          // incorreta". O cadastro não aceita espaço nas pontas, então
          // nenhuma senha certa muda com isso (ver validarSenha).
          senha: senha.current.value.trim(),
        }),
      frases: { credenciais: MENSAGENS.CREDENCIAIS },
      mostrarErro: setErroConta,
      aoFalhar: () => {
        senha.current.value = '';
        senha.current.focus();
      },
    });
  }

  async function entrarComoAluno() {
    if (enviando.current) return;

    const comErro = campos.validar(['codigo', 'nome', 'senhaAluno']);
    if (comErro) {
      refs[comErro].current.focus();
      return;
    }

    await enviar({
      requisicao: () =>
        api.auth.entrar({
          // Vai sem espaço e em maiúscula, a forma em que o back guarda.
          codigo: normalizarCodigo(codigo.current.value),
          // Maiúscula, acento e espaço repetido o back resolve: compara
          // como o banco ("ana pires" acha "Ana Pires").
          nome: nome.current.value.trim(),
          // Aparada pelo mesmo motivo da senha de conta: nenhuma senha de
          // aluno tem espaço nas pontas (o primeiro acesso recusa).
          senha: senhaAluno.current.value.trim(),
        }),
      frases: {
        credenciais: MENSAGENS.CREDENCIAIS_ALUNO,
        inativa: MENSAGENS.INATIVA_ALUNO,
        dadosInvalidos: MENSAGENS.SENHA_PRIMEIRO_ACESSO,
      },
      mostrarErro: setErroAluno,
      aoFalhar: () => {
        senhaAluno.current.value = '';
        senhaAluno.current.focus();
      },
    });
  }

  // Fluxo comum aos dois formulários: trava o botão, chama a API, grava a
  // sessão e sai da tela; em erro, mostra a mensagem (nunca só no console).
  async function enviar({ requisicao, frases, mostrarErro, aoFalhar }: OpcoesEnvio) {
    enviando.current = true;
    setOcupado(true);
    limparErros();

    try {
      const resposta = await requisicao();
      // O `tipo` da resposta (conta ou aluno) é o que roteia: o
      // guarda.entrar() lê daí o destino: aluno no dashboard, conta na tela de modo.
      sessao.entrar(resposta);
      guarda.entrar();
      // Não libera o botão: a página está sendo substituída.
    } catch (excecao) {
      mostrarErro(mensagemDoErro(excecao, frases));
      aoFalhar?.();
      enviando.current = false;
      setOcupado(false);
    }
  }

  // --- apoio -----------------------------------------------------------------

  function limparErros() {
    setErroConta('');
    setErroAluno('');
  }

  function limparTudo() {
    limparErros();
    campos.limpar();
  }

  // --- render ----------------------------------------------------------------

  return (
    <div className="painel vidro">
      {/* ===== Conta (e-mail e senha): abre Solo e Professor ===== */}
      <section id="modo-conta" aria-labelledby="titulo-conta" hidden={modo === 'aluno'}>
        <p className="rotulo">Sua conta</p>
        <h1 id="titulo-conta">Entrar</h1>
        <p className="descricao">Use o e-mail e a senha da sua conta.</p>

        <form className="acoes formulario" id="form-conta" noValidate onSubmit={aoEnviarConta}>
          <div className="campo">
            <label className="rotulo" htmlFor="campo-email">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              id="campo-email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              maxLength={150}
              aria-describedby="erro-email"
              required
              ref={email}
              onBlur={() => campos.aoSair('email')}
              {...atributosDeErro(campos.erros.email)}
            />
            <ErroCampo id="erro-email" erro={campos.erros.email} />
          </div>

          <div className="campo">
            <label className="rotulo" htmlFor="campo-senha">
              Senha
            </label>
            <CampoSenha
              id="campo-senha"
              name="senha"
              autoComplete="current-password"
              describedBy="erro-senha"
              idBotao="btn-ver-senha"
              erro={campos.erros.senha}
              inputRef={senha}
              onBlur={() => campos.aoSair('senha')}
            />
            <ErroCampo id="erro-senha" erro={campos.erros.senha} />
          </div>

          <button type="submit" className="btn btn-solido tecla tecla-clara" id="btn-entrar-conta" disabled={ocupado}>
            {ocupado ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="erro" id="erro-conta" aria-live="polite">
            {erroConta}
          </p>
        </form>

        <button type="button" className="btn-texto" id="btn-ir-aluno" onClick={irParaAluno}>
          Sou aluno, tenho o código da turma
        </button>

        <p className="linha-rodape">
          Não tem conta?{' '}
          <a className="link" id="link-cadastro" href={hrefCadastro}>
            Criar conta
          </a>
        </p>
      </section>

      {/* ===== Aluno: código da turma, nome e senha ===== */}
      <section id="modo-aluno" aria-labelledby="titulo-aluno" hidden={modo !== 'aluno'}>
        <p className="rotulo">Aluno</p>
        <h1 id="titulo-aluno">Entrar</h1>
        <p className="descricao">
          Use o código que o professor passou e o seu nome como está na lista da turma. Na primeira vez, a senha
          que você digitar (de 4 a 20 caracteres) vira a sua senha.
        </p>

        <form className="acoes formulario" id="form-aluno" noValidate onSubmit={aoEnviarAluno}>
          <div className="campo">
            <label className="rotulo" htmlFor="campo-codigo">
              Código da turma
            </label>
            <input
              type="text"
              name="codigo"
              id="campo-codigo"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={16}
              aria-describedby="dica-codigo erro-codigo"
              required
              ref={codigo}
              onBlur={() => campos.aoSair('codigo')}
              {...atributosDeErro(campos.erros.codigo)}
            />
            <p className="ajuda-campo" id="dica-codigo">
              Seis letras e números, ex.: K7M2QX. Não sabe o seu? Peça ao professor.
            </p>
            <ErroCampo id="erro-codigo" erro={campos.erros.codigo} />
          </div>

          <div className="campo">
            <label className="rotulo" htmlFor="campo-nome-aluno">
              Seu nome
            </label>
            <input
              type="text"
              name="username"
              id="campo-nome-aluno"
              autoComplete="username"
              autoCapitalize="words"
              maxLength={150}
              aria-describedby="erro-nome-aluno"
              required
              ref={nome}
              onBlur={() => campos.aoSair('nome')}
              {...atributosDeErro(campos.erros.nome)}
            />
            <ErroCampo id="erro-nome-aluno" erro={campos.erros.nome} />
          </div>

          <div className="campo">
            <label className="rotulo" htmlFor="campo-senha-aluno">
              Senha
            </label>
            <CampoSenha
              id="campo-senha-aluno"
              name="senha"
              autoComplete="current-password"
              describedBy="erro-senha-aluno"
              idBotao="btn-ver-senha-aluno"
              erro={campos.erros.senhaAluno}
              inputRef={senhaAluno}
              onBlur={() => campos.aoSair('senhaAluno')}
            />
            <ErroCampo id="erro-senha-aluno" erro={campos.erros.senhaAluno} />
          </div>

          <button type="submit" className="btn btn-solido tecla tecla-clara" id="btn-entrar-aluno" disabled={ocupado}>
            {ocupado ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="erro" id="erro-aluno" aria-live="polite">
            {erroAluno}
          </p>
        </form>

        <button type="button" className="btn-texto" id="btn-ir-conta" onClick={irParaConta}>
          Não sou aluno
        </button>
      </section>
    </div>
  );
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Quem já está logado não deveria ver esta tela — vai direto para a casa
// da sessão. Quando redireciona, nada abaixo roda.
if (!guarda.redirecionarSeLogado()) {
  // Sessão expirada: avisa por que a pessoa está aqui de novo, em vez de
  // deixá-la achar que o app simplesmente a jogou fora.
  if (new URLSearchParams(window.location.search).get('expirou') === '1') {
    criarToasts(document.getElementById('toasts'), { maximo: 1 }).mostrar('Sua sessão expirou');
  }

  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Login />);
}
