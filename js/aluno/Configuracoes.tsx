// Configuracoes.tsx — pages/aluno/configuracoes.html
// Configurações do aluno: Acessibilidade, Conta (nome, turma, código e
// trocar a senha da matrícula) e Interface, as mesmas do Solo e do professor
// (componentes/SecoesDeConfiguracoes.tsx). O aluno não tem tutorial, então
// a Interface vem sem o "Rever o tutorial".

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { Moldura } from '../componentes/Moldura.js';
import { SecoesDeConfiguracoes } from '../componentes/SecoesDeConfiguracoes.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

function Configuracoes() {
  return (
    <Moldura
      modo="aluno"
      ativo="configuracoes"
      voltar={{ href: guarda.casa(), rotulo: 'Minha sala' }}
      classeDoConteudo="pagina pagina-aluno"
    >
      <main className="conteudo">
        <header className="cabecalho">
          <div className="cabecalho-texto">
            <h1 className="titulo">Configurações</h1>
            <p className="subtitulo">Deixe o TECLAR do seu jeito.</p>
          </div>
        </header>
        <SecoesDeConfiguracoes modo="aluno" />
      </main>
    </Moldura>
  );
}

const usuario = guarda.soAluno();

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Configuracoes />);
}
