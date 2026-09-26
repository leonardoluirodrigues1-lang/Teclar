// Configuracoes.tsx — pages/professor/configuracoes.html
// As configurações do modo Professor. Por enquanto uma coisa só: o bloco
// "Sua entrada como aluno" (componentes/EntradaComoAluno.tsx), o mesmo das
// Configurações do Solo. Aberta pelo item "Minha entrada como aluno" do
// menu do nome (componentes/Nav.tsx).

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { Nav, SECOES_PROFESSOR } from '../componentes/Nav.js';
import { EntradaComoAluno } from '../componentes/EntradaComoAluno.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

function Configuracoes() {
  return (
    <>
      <Nav secoes={SECOES_PROFESSOR} ativo="configuracoes" />

      <main>
        <div className="cabecalho">
          <h1 className="titulo">Configurações</h1>
        </div>

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
