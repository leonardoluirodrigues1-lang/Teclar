// Ajuda.tsx — pages/solo/ajuda.html
// Texto fixo sobre como o treino funciona. Aberta pela barra lateral
// (componentes/MolduraSolo.tsx). Os números (caracteres por palavra, metas)
// vêm do CONFIG, para a ajuda não contradizer a regra que o treino usa.

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { CONFIG } from '../config.js';
import { MolduraSolo } from '../componentes/MolduraSolo.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

function Ajuda() {
  return (
    <MolduraSolo ativo="ajuda">
      <main className="solo-texto">
        <h1 className="solo-texto-titulo">Ajuda</h1>

        <section className="vidro solo-texto-cartao">
          <h2 className="solo-texto-secao">Como funciona o treino</h2>
          <p>
            No caminho, cada pedra é uma lição. Escolha qualquer uma: nenhuma fica trancada. O texto
            aparece na tela e o cronômetro só começa na primeira tecla, então não há pressa para se
            ajeitar.
          </p>
          <p>
            Errou uma letra? O treino não para: o erro fica marcado e você segue. Algumas lições pedem
            para repetir o mesmo texto (2, 5 ou 10 vezes); a pílula embaixo da pedra mostra quantas.
            No fim, a tela de resultado mostra como você foi e quanto XP ganhou.
          </p>
        </section>

        <section className="vidro solo-texto-cartao">
          <h2 className="solo-texto-secao">PPM e precisão</h2>
          <p>
            <strong>PPM</strong> é palavras por minuto. Para a conta ser justa com palavras curtas e
            longas, toda "palavra" vale {CONFIG.TREINO.CARACTERES_POR_PALAVRA} caracteres — é a
            convenção de todo teste de digitação. Só os caracteres certos entram na conta: errar
            rápido não sobe o PPM.
          </p>
          <p>
            <strong>Precisão</strong> é a porcentagem de caracteres que você acertou. Uma boa meta
            para começar é {CONFIG.METAS.PPM_ALVO} PPM com {CONFIG.METAS.PRECISAO_ALVO}% de
            precisão. Precisão primeiro: a velocidade vem com ela.
          </p>
        </section>

        <section className="vidro solo-texto-cartao">
          <h2 className="solo-texto-secao">Por que o acento funciona</h2>
          <p>
            No teclado brasileiro (ABNT2), o acento é uma "tecla morta": o ´ sozinho não escreve nada,
            e só junto com a vogal vira "á". Muito site de digitação lê tecla por tecla e se perde
            aí.
          </p>
          <p>
            O TECLAR não lê tecla por tecla. Ele deixa o seu sistema montar a letra acentuada e
            compara o texto que saiu com o texto da lição. Por isso á, ã, ê e ç contam como uma
            letra só, do jeito que você digita no dia a dia.
          </p>
        </section>

        <section className="vidro solo-texto-cartao">
          <h2 className="solo-texto-secao">Se algo travar</h2>
          <ul className="solo-texto-lista">
            <li>
              As letras não entram? Clique em cima do texto. Se a janela perde o foco, o treino
              pausa, e o clique devolve o foco.
            </li>
            <li>Quer sair no meio de uma lição? Aperte Esc.</li>
            <li>
              Caiu a internet? O resultado fica guardado neste navegador e o XP entra quando a rede
              voltar.
            </li>
            <li>Se a tela ficar parada, recarregue a página (F5). Se continuar, saia e entre de novo.</li>
          </ul>
        </section>
      </main>
    </MolduraSolo>
  );
}

const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Ajuda />);
}
