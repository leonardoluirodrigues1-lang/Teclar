// Senha.tsx — pages/aluno/senha.html
// "Crie sua senha": a tela do aluno que entrou com a senha provisória do
// professor. O login já consumiu a provisória (uso único), então esta é a
// única tela que o guarda abre enquanto usuario.precisaTrocarSenha for true
// (ver exigir() em js/nucleo/guarda.ts). Salvou, vai para a sala.
//
// Mesmo visual do login (css/auth.css) e mesmos campos (auth/Formulario.tsx).
// Linguagem de criança: frases curtas.
import { useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { validarSenhaAluno } from '../utils/validacao.js';
import { mensagemDoErro, MENSAGENS } from '../auth/comum.js';
import { useErrosDeCampo, ErroCampo, CampoSenha } from '../auth/Formulario.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

const NAO_CONFEREM = 'As duas senhas não são iguais.';

function Senha({ nome }: { nome: string }) {
  const senha = useRef<HTMLInputElement>(null);
  const repetir = useRef<HTMLInputElement>(null);
  const campos = useErrosDeCampo({
    senha: { ref: senha, checar: () => validarSenhaAluno(senha.current.value.trim()) },
    repetir: {
      ref: repetir,
      checar: () => (repetir.current.value.trim() === senha.current.value.trim() ? null : NAO_CONFEREM),
    },
  });
  const refs = { senha, repetir };
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    const comErro = campos.validar(['senha', 'repetir']);
    if (comErro) {
      refs[comErro].current.focus();
      return;
    }
    setOcupado(true);
    setErro('');
    try {
      await api.escola.aluno.criarSenha(senha.current.value.trim());
      sessao.atualizarUsuario({ precisaTrocarSenha: false });
      guarda.entrar();
    } catch (excecao) {
      // 409: a senha já foi criada (outra aba). Segue para a sala.
      if ((excecao as { status?: number })?.status === 409) {
        sessao.atualizarUsuario({ precisaTrocarSenha: false });
        guarda.entrar();
        return;
      }
      setErro(mensagemDoErro(excecao, { dadosInvalidos: MENSAGENS.SENHA_PRIMEIRO_ACESSO }));
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="titulo-senha">
      <p className="rotulo">Primeira vez</p>
      <h1 id="titulo-senha">Crie sua senha</h1>
      <p className="descricao">
        Oi, {nome}! A senha do professor só valia uma vez. Agora invente a sua (de 4 a 20 letras ou números) e
        guarde bem. Se esquecer, peça ajuda ao professor.
      </p>

      <form className="acoes formulario" noValidate onSubmit={aoEnviar}>
        <div className="campo">
          <label className="rotulo" htmlFor="campo-senha-nova">
            Sua senha nova
          </label>
          <CampoSenha
            id="campo-senha-nova"
            name="senha"
            autoComplete="new-password"
            describedBy="erro-senha-nova"
            idBotao="btn-ver-senha-nova"
            erro={campos.erros.senha}
            inputRef={senha}
            onBlur={() => campos.aoSair('senha')}
          />
          <ErroCampo id="erro-senha-nova" erro={campos.erros.senha} />
        </div>

        <div className="campo">
          <label className="rotulo" htmlFor="campo-senha-repetir">
            Digite de novo
          </label>
          <CampoSenha
            id="campo-senha-repetir"
            name="repetir"
            autoComplete="new-password"
            describedBy="erro-senha-repetir"
            idBotao="btn-ver-senha-repetir"
            erro={campos.erros.repetir}
            inputRef={repetir}
            onBlur={() => campos.aoSair('repetir')}
          />
          <ErroCampo id="erro-senha-repetir" erro={campos.erros.repetir} />
        </div>

        <button type="submit" className="btn btn-solido tecla tecla-clara" disabled={ocupado}>
          {ocupado ? 'Salvando…' : 'Salvar e entrar'}
        </button>
        <p className="erro" aria-live="polite">
          {erro}
        </p>
      </form>

      <button type="button" className="btn-texto" onClick={() => guarda.sair()}>
        Sair
      </button>
    </section>
  );
}

// Montagem — guarda primeiro, React depois
const usuario = guarda.soAluno();
if (usuario) {
  // Quem já tem senha não tem o que fazer aqui.
  if (!usuario.precisaTrocarSenha) {
    guarda.entrar();
  } else {
    ativarSaidaAoNavegar();
    createRoot(document.getElementById('raiz')).render(<Senha nome={usuario.nome ?? ''} />);
  }
}
