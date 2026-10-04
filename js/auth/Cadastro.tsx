// Cadastro.tsx — pages/cadastro.html
// Criação de conta. Uma conta é uma conta: não tem perfil, e abre Solo e
// Professor. Não existe tela de criar aluno: toda conta ganha, na mesma
// hora, uma entrada de aluno — um RP e uma senha de aluno, gerados pelo
// back (uma linha da tabela Alunos ligada a esta conta pelo UserID).
//
// Deu certo: ANTES de entrar no sistema, a tela troca para a entrada de
// aluno (<EntradaDeAluno>, abaixo), com o RP e a senha de aluno. É o único
// lugar do front em que essa senha aparece, e só uma vez. Só no "Anotei,
// continuar" a sessão é gravada e a pessoa segue para a tela de modo — sem
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
import { formatarRp } from '../utils/formato.js';
import { DadosDeEntrada } from '../componentes/DadosDeEntrada.js';
import { BotaoCopiar } from '../componentes/BotaoCopiar.js';
import type { RespostaCadastro } from '../nucleo/tipos.js';

// O host dos toasts fica fora da raiz do React (ver cadastro.html), e o
// toast.ts continua cuidando dele como na tela em JS.
let toasts: Toasts;

function Cadastro() {
  // Uma requisição por vez. O ref é a trava síncrona; o estado é o que o
  // botão pinta (texto "Criando…" e disabled).
  const enviando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroForm, setErroForm] = useState('');

  // A resposta do cadastro, com o RP e a senha de aluno. Fica só neste
  // estado, que morre junto com a página: nada de storage, nada de módulo.
  const [contaCriada, setContaCriada] = useState<RespostaCadastro | null>(null);

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
      // A sessão ainda NÃO é gravada: quem entra no sistema é o "Anotei,
      // continuar" da próxima tela. Não libera o botão: o formulário sai.
      setContaCriada(resposta);
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

  if (contaCriada) {
    return <EntradaDeAluno resposta={contaCriada} />;
  }

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
// Entrada de aluno — o RP e a senha de aluno, uma vez só
// ============================================================================

interface PropsEntradaDeAluno {
  resposta: RespostaCadastro;
}

function EntradaDeAluno({ resposta }: PropsEntradaDeAluno) {
  const titulo = useRef<HTMLHeadingElement>(null);
  // Só o botão "Anotei" pode sair desta tela sem aviso. Fechar a aba ou
  // recarregar aqui perde a senha de aluno para sempre, então o navegador
  // pergunta antes.
  const saindoPeloBotao = useRef(false);

  useEffect(() => {
    // O formulário que tinha o foco sumiu: o foco vai para o título, e o
    // leitor de tela começa a ler a tela nova por ele.
    titulo.current?.focus();

    function avisarAntesDeSair(evento: BeforeUnloadEvent) {
      if (saindoPeloBotao.current) return;
      evento.preventDefault();
      // Navegadores antigos só perguntam se returnValue tiver algo.
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', avisarAntesDeSair);
    return () => window.removeEventListener('beforeunload', avisarAntesDeSair);
  }, []);

  function continuar() {
    saindoPeloBotao.current = true;
    // Só token e usuario vão para a sessão. A senha de aluno fica de fora
    // de propósito: o sessao.entrar() grava o que recebe no navegador.
    sessao.entrar({ token: resposta.token, usuario: resposta.usuario });
    guarda.entrar();
  }

  return (
    <div className="painel vidro">
      <p className="rotulo">Conta criada</p>
      <h1 id="titulo-entrada" ref={titulo} tabIndex={-1}>
        Sua entrada como aluno
      </h1>
      <p className="descricao">
        Com o RP e a senha de aluno você entra no modo Aluno. É pelo RP que um professor convida você
        para uma sala.
      </p>

      <DadosDeEntrada
        classeBotao="btn btn-vidro vidro tecla"
        dados={[
          { rotulo: 'RP', exibido: formatarRp(resposta.rp), copiar: resposta.rp, rotuloCopiar: 'Copiar RP' },
          {
            rotulo: 'Senha de aluno',
            exibido: resposta.senhaAluno,
            copiar: resposta.senhaAluno,
            rotuloCopiar: 'Copiar senha',
          },
        ]}
      />

      {/* Os dois de uma vez, em duas linhas, para colar num bloco de notas
          ou mandar para si mesmo sem copiar campo por campo. */}
      <BotaoCopiar
        texto={`RP: ${resposta.rp}\nSenha de aluno: ${resposta.senhaAluno}`}
        rotulo="Copiar RP e senha"
        className="btn btn-vidro vidro tecla entrada-copiar-tudo"
      />

      <p className="entrada-aviso" role="note">
        Anote a senha agora. <strong>Ela não aparece de novo</strong>. O RP você encontra depois no menu
        com o seu nome, em "Minha entrada como aluno"; se perder a senha, é lá que se gera uma nova.
      </p>

      <button type="button" className="btn btn-solido tecla tecla-clara entrada-continuar" onClick={continuar}>
        Anotei, continuar
      </button>
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
