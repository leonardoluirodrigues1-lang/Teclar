// Configuracoes.tsx — pages/professor/configuracoes.html
// Configurações no modo Professor: Acessibilidade, Conta e Interface, as
// mesmas do Solo e do aluno (componentes/SecoesDeConfiguracoes.tsx).
//
// "Rever o tutorial" apaga a marca de "já visto" da conta
// (sessao.esquecerTutorial('professor')) e leva às turmas, onde ele aparece.
// (A "entrada como aluno" da conta saiu com o banco v8: conta não tem RP; o
// aluno entra pelo código da turma.)

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import { Moldura } from '../componentes/Moldura.js';
import { SecoesDeConfiguracoes } from '../componentes/SecoesDeConfiguracoes.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Vizinha desta em pages/professor/: é lá que o tutorial aparece.
const ROTA_TURMAS = 'turmas.html';

function Configuracoes() {
  function reverTutorial() {
    sessao.esquecerTutorial('professor');
    window.location.href = ROTA_TURMAS;
  }

  return (
    <Moldura modo="professor" ativo="configuracoes" classeDoConteudo="pagina">
      <main>
        <div className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo">Configurações</h1>
            <p className="subtitulo">Acessibilidade, conta e interface.</p>
          </div>
        </div>
        <SecoesDeConfiguracoes modo="professor" aoReverTutorial={reverTutorial} />
      </main>
    </Moldura>
  );
}

const usuario = guarda.soConta('professor');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Configuracoes />);
}
