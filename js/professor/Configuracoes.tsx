// Configuracoes.tsx — pages/professor/configuracoes.html
// As configurações do modo Professor. Duas coisas, as mesmas das
// Configurações do Solo:
//   · rever o tutorial — apaga a marca de "já visto" da conta
//     (sessao.esquecerTutorial('professor')) e leva às turmas, onde ele
//     aparece;
//   · o bloco "Sua entrada como aluno" (componentes/EntradaComoAluno.tsx).
// Aberta pelo item "Minha entrada como aluno" do menu do nome
// (componentes/Nav.tsx).

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import { Nav, SECOES_PROFESSOR } from '../componentes/Nav.js';
import { EntradaComoAluno } from '../componentes/EntradaComoAluno.js';
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

        {/* A mesma forma do bloco da entrada como aluno, logo abaixo:
            nome e texto à esquerda, o botão à direita. */}
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

        <EntradaComoAluno classeBotao="btn btn-vidro vidro tecla" />
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
