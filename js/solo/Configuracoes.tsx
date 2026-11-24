// Configuracoes.tsx — pages/solo/configuracoes.html
// Configurações no Solo: Acessibilidade, Conta e Interface, as mesmas do
// professor e do aluno (componentes/SecoesDeConfiguracoes.tsx). Aberta pela
// barra lateral (componentes/Moldura.tsx), no mesmo lugar nos três modos.
//
// "Rever o tutorial" apaga a marca de "já visto" da conta
// (sessao.esquecerTutorial('solo')) e leva ao caminho, onde ele aparece.

import { createRoot } from 'react-dom/client';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { Moldura } from '../componentes/Moldura.js';
import { SecoesDeConfiguracoes } from '../componentes/SecoesDeConfiguracoes.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Vizinho desta em pages/solo/: é lá que o tutorial aparece.
const ROTA_CAMINHO = 'caminho.html';

function Configuracoes() {
  function reverTutorial() {
    sessao.esquecerTutorial('solo');
    window.location.href = ROTA_CAMINHO;
  }

  return (
    <Moldura ativo="configuracoes">
      <main className="solo-texto">
        <h1 className="solo-texto-titulo">Configurações</h1>
        <p className="solo-texto-intro">Ajuste o TECLAR ao seu jeito.</p>
        <SecoesDeConfiguracoes modo="solo" aoReverTutorial={reverTutorial} />
      </main>
    </Moldura>
  );
}

const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Configuracoes />);
}
