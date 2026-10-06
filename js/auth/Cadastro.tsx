// Cadastro.tsx — pages/cadastro.html
// Criação de conta. Uma conta é uma conta: não tem perfil, e abre Solo e
// Professor. Conta não tem entrada de aluno: o aluno nasce da lista de
// nomes que o professor sobe na turma, e entra pelo código dela.
//
// Deu certo: a sessão é gravada e a pessoa segue para a tela de modo — sem
// passar pelo login, porque o back já devolveu token e usuário.
//
// Conversão de js/auth/cadastro.js para React: mesmo markup, mesmas classes
// de css/auth.css, mesmas validações, mensagens, códigos de erro e focos.
// Os inputs são não controlados (ref + .value), ver Formulario.tsx.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ROTA_LOGIN } from '../config.js';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { criarToasts, type Toasts } from '../componentes/toast.js';
import {
  validarNome,
  validarEmail,
  validarSenha,
  validarConfirmacao,
} from '../utils/validacao.js';
import { mensagemDoErro, ehConflito } from './comum.js';
import { useErrosDeCampo, atributosDeErro, ErroCampo, CampoSenha } from './Formulario.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// O host dos toasts fica fora da raiz do React (ver cadastro.html), e o
// toast.ts continua cuidando dele como na tela em JS.
let toasts: Toasts;

function Cadastro() {
  // Uma requisição por vez. O ref é a trava síncrona; o estado é o que o
  // botão pinta (texto "Criando…" e disabled).
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const nome = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const senha = useRef<HTMLInputElement>(null);
  const confirmacao = useRef<HTMLInputElement>(null);

  const hrefLogin = ROTA_LOGIN;

  // --- validação -------------------------------------------------------------
  // No blur e no envio — nunca a cada tecla.

  const campos = useErrosDeCampo({
    nome: { ref: nome, checar: () => validarNome(nome.current.value) },
    email: { ref: email, checar: () => validarEmail(email.current.value) },
    senha: { ref: senha, checar: () => validarSenha(senha.current.value) },
    confirmacao: {
      ref: confirmacao,
      checar: () => validarConfirmacao(senha.current.value, confirmacao.current.value),
    },
  });
  const refs = { nome, email, senha, confirmacao };

  // Trocar a senha depois de confirmar deixaria a confirmação certa na tela e
  // errada na verdade. Se a confirmação já estiver preenchida, revalida.
  function aoSairDaSenha() {
    campos.aoSair('senha');
    if (confirmacao.current.value === '') return;
    campos.definir('confirmacao', validarConfirmacao(senha.current.value, confirmacao.current.value));
  }

  // Foco no primeiro campo ao abrir.
  useEffect(() => {
    nome.current?.focus();
  }, []);

  // --- envio -----------------------------------------------------------------

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    criar();
  }

  async function criar() {
    if (enviando.current) return;

    const comErro = campos.validar(['nome', 'email', 'senha', 'confirmacao']);
    if (comErro) {
      refs[comErro].current.focus();
      return;
    }

    enviando.current = true;
    setOcupado(true);
    setErroForm('');

    try {
      const resposta = await api.auth.cadastrar({
        nome: nome.current.value.trim(),
        email: email.current.value.trim(),
        // A senha vai direto para a requisição e não sobra em lugar nenhum:
        // nem em variável de módulo, nem em estado, nem no storage.
        senha: senha.current.value,
      });

      limparSenhas();
      toasts.mostrar('Conta criada');
      // Não libera o botão: a página está sendo substituída.
      sessao.entrar(resposta);
      guarda.entrar();
    } catch (excecao) {
      tratarFalha(excecao);
      enviando.current = false;
      setOcupado(false);
    }
  }

  function tratarFalha(excecao: unknown) {
    // 409 é o único erro desta tela que aponta para um campo: o e-mail já
    // tem conta, e o que a pessoa quer dali é entrar, não tentar de novo.
    if (ehConflito(excecao)) {
      campos.definir(
        'email',
        'Este e-mail já tem conta.',
        <a className="link-erro" href={hrefLogin}>
          Entrar
        </a>
      );
      email.current.focus();
      return;
    }

    setErroForm(mensagemDoErro(excecao));
  }

  // Deu certo: a senha sai da tela junto com a tela. Em caso de erro ela
  // fica, porque a pessoa vai corrigir o e-mail e tentar de novo — apagar
  // ali seria castigar quem errou uma letra.
  function limparSenhas() {
    senha.current.value = '';
    confirmacao.current.value = '';
  }

  // --- render ----------------------------------------------------------------

  return (
    <div className="painel vidro">
      <h1 id="titulo-cadastro">Criar conta</h1>
      <p className="descricao">Leva menos de um minuto.</p>

      <form className="acoes formulario" id="form-cadastro" noValidate onSubmit={aoEnviar}>
        <div className="campo">
          <label className="rotulo" htmlFor="campo-nome">
            Nome
          </label>
          <input
            type="text"
            name="nome"
            id="campo-nome"
            autoComplete="name"
            maxLength={150}
            autoCapitalize="words"
            aria-describedby="erro-nome"
            required
            ref={nome}
            onBlur={() => campos.aoSair('nome')}
            {...atributosDeErro(campos.erros.nome)}
          />
          <ErroCampo id="erro-nome" erro={campos.erros.nome} />
        </div>

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
            autoComplete="new-password"
            describedBy="dica-senha erro-senha"
            idBotao="btn-ver-senha"
            erro={campos.erros.senha}
            inputRef={senha}
            onBlur={aoSairDaSenha}
          />
          <p className="ajuda-campo" id="dica-senha">
            Pelo menos 8 caracteres, com uma letra e um número.
          </p>
          <ErroCampo id="erro-senha" erro={campos.erros.senha} />
        </div>

        <div className="campo">
          <label className="rotulo" htmlFor="campo-confirmacao">
            Confirmar senha
          </label>
          <CampoSenha
            id="campo-confirmacao"
            name="confirmacao"
            autoComplete="new-password"
            describedBy="erro-confirmacao"
            idBotao="btn-ver-confirmacao"
            erro={campos.erros.confirmacao}
            inputRef={confirmacao}
            onBlur={() => campos.aoSair('confirmacao')}
          />
          <ErroCampo id="erro-confirmacao" erro={campos.erros.confirmacao} />
        </div>

        <button type="submit" className="btn btn-solido tecla tecla-clara" id="btn-criar" disabled={ocupado}>
          {ocupado ? 'Criando…' : 'Criar conta'}
        </button>
        <p className="erro" id="erro-form" aria-live="polite">
          {erroForm}
        </p>
      </form>

      <p className="linha-rodape">
        Já tem conta?{' '}
        <a className="link" id="link-login" href={hrefLogin}>
          Entrar
        </a>
      </p>
    </div>
  );
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Quem já está logado não tem o que fazer criando conta.
if (!guarda.redirecionarSeLogado()) {
  toasts = criarToasts(document.getElementById('toasts'), { maximo: 1 });
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Cadastro />);
}
