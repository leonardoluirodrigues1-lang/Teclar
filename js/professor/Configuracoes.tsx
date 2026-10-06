// Configuracoes.tsx — pages/professor/configuracoes.html
// As configurações do modo Professor: rever o tutorial — apaga a marca de
// "já visto" da conta (sessao.esquecerTutorial('professor')) e leva às
// turmas, onde ele aparece. (A "entrada como aluno" da conta saiu com o
// banco v8: conta não tem RP; o aluno entra pelo código da turma.)

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import { Nav, SECOES_PROFESSOR } from '../componentes/Nav.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Vizinha desta em pages/professor/: é lá que o tutorial aparece.
const ROTA_TURMAS = 'turmas.html';

function Configuracoes() {
  function reverTutorial() {
    sessao.esquecerTutorial('professor');
    window.location.href = ROTA_TURMAS;
  }

  return (
    <>
      <Nav secoes={SECOES_PROFESSOR} ativo="configuracoes" />

      <main>
        <div className="cabecalho">
          <h1 className="titulo">Configurações</h1>
        </div>

        {/* Nome e texto à esquerda, o botão à direita (.entrada-bloco, em
            css/componentes/entrada-aluno.css). */}
        <section className="vidro entrada-bloco" aria-labelledby="titulo-rever-tutorial">
          <span>
            <span className="entrada-bloco-nome" id="titulo-rever-tutorial">
              Rever o tutorial
            </span>
            <span className="entrada-bloco-texto">
              A apresentação do modo Professor, a mesma da primeira vez. Ela abre nas turmas.
            </span>
          </span>
          <button type="button" className="btn btn-vidro vidro tecla" onClick={reverTutorial}>
            Rever
          </button>
        </section>
      </main>
    </>
  );
}

const usuario = guarda.soConta('professor');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Configuracoes />);
}
