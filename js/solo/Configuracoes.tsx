// Configuracoes.tsx — pages/solo/configuracoes.html
// O que dá para configurar no Solo HOJE, sem coluna nova no banco. Aberta
// pela barra lateral (componentes/MolduraSolo.tsx).
//
// Quatro coisas, as quatro guardadas no navegador pela sessao.ts:
//   · reduzir movimento — aplicado pelo guarda.aplicarMundo(), que põe a
//     classe .movimento-reduzido no <html>; os tokens de duração de
//     css/base/movimento.css e tokens.css zeram com ela;
//   · esconder o teclado guia — o teclado embaixo do texto na tela de
//     treino (js/treino/Treino.tsx), que a tela lê ao abrir. Esconde as
//     mãos junto;
//   · esconder as mãos — só as mãos embaixo do teclado;
//   · rever o tutorial — apaga a marca de "já visto" da conta
//     (sessao.esquecerTutorial) e leva ao caminho, onde ele aparece.

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { MolduraSolo } from '../componentes/MolduraSolo.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Vizinho desta em pages/solo/: é lá que o tutorial aparece.
const ROTA_CAMINHO = 'caminho.html';

function Configuracoes() {
  const [reduzir, setReduzir] = useState(sessao.movimentoReduzido());
  const [esconderTeclado, setEsconderTeclado] = useState(sessao.tecladoGuiaEscondido());
  const [esconderMaos, setEsconderMaos] = useState(sessao.maosEscondidas());

  function alternarMovimento(ligado: boolean) {
    sessao.definirMovimentoReduzido(ligado);
    // Reaplica na hora, sem recarregar: a própria tela já passa a valer.
    guarda.aplicarMundo();
    setReduzir(ligado);
  }

  function alternarTeclado(escondido: boolean) {
    sessao.definirTecladoGuiaEscondido(escondido);
    setEsconderTeclado(escondido);
  }

  function alternarMaos(escondidas: boolean) {
    sessao.definirMaosEscondidas(escondidas);
    setEsconderMaos(escondidas);
  }

  function reverTutorial() {
    sessao.esquecerTutorial();
    window.location.href = ROTA_CAMINHO;
  }

  return (
    <MolduraSolo ativo="configuracoes">
      <main className="solo-texto">
        <h1 className="solo-texto-titulo">Configurações</h1>

        <section className="vidro solo-texto-cartao">
          {/* Checkbox de verdade, com o rótulo em volta: clicar no texto
              também marca, e o leitor de tela anuncia "marcado". */}
          <label className="solo-opcao">
            <input
              type="checkbox"
              className="solo-opcao-caixa"
              checked={reduzir}
              onChange={(evento) => alternarMovimento(evento.target.checked)}
            />
            <span>
              <span className="solo-opcao-nome">Reduzir movimento</span>
              <span className="solo-opcao-texto">
                Tira as animações das telas do Solo, do treino e do resultado: nada desliza nem
                cresce, tudo aparece direto no lugar. Se o seu computador já pede menos movimento, o
                TECLAR obedece mesmo com esta opção desmarcada.
              </span>
            </span>
          </label>
        </section>

        {/* A mesma forma da opção de cima. */}
        <section className="vidro solo-texto-cartao">
          <label className="solo-opcao">
            <input
              type="checkbox"
              className="solo-opcao-caixa"
              checked={esconderTeclado}
              onChange={(evento) => alternarTeclado(evento.target.checked)}
            />
            <span>
              <span className="solo-opcao-nome">Esconder o teclado guia</span>
              <span className="solo-opcao-texto">
                Tira da tela de treino o teclado desenhado embaixo do texto, que acende a próxima
                tecla e mostra com qual dedo apertá-la. As mãos saem junto. Vale a partir do
                próximo treino.
              </span>
            </span>
          </label>
        </section>

        {/* Com o teclado escondido, as mãos já saem junto: a opção fica
            desligada, para não parecer que ela ainda faz algo. */}
        <section className="vidro solo-texto-cartao">
          <label className="solo-opcao">
            <input
              type="checkbox"
              className="solo-opcao-caixa"
              checked={esconderMaos || esconderTeclado}
              disabled={esconderTeclado}
              onChange={(evento) => alternarMaos(evento.target.checked)}
            />
            <span>
              <span className="solo-opcao-nome">Esconder as mãos</span>
              <span className="solo-opcao-texto">
                Deixa o teclado guia e tira só as mãos desenhadas embaixo dele, que mostram qual dedo
                se move para a próxima tecla.
              </span>
            </span>
          </label>
        </section>

        <section className="vidro solo-texto-cartao solo-opcao-linha">
          <span>
            <span className="solo-opcao-nome">Rever o tutorial</span>
            <span className="solo-opcao-texto">
              A apresentação do Solo, a mesma da primeira vez. Ela abre no caminho.
            </span>
          </span>
          <button type="button" className="tutorial-botao tecla" onClick={reverTutorial}>
            Rever
          </button>
        </section>
      </main>
    </MolduraSolo>
  );
}

const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Configuracoes />);
}
