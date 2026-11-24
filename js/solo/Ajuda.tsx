// Ajuda.tsx — pages/solo/ajuda.html
// "Ajuda e sobre": como o treino funciona e o que é o TECLAR, numa página
// só, com um índice no topo. Aberta pela barra lateral
// (componentes/Moldura.tsx). O antigo pages/solo/sobre.html redireciona
// para cá (#sobre). Os números (caracteres por palavra, metas) vêm do
// CONFIG, para a ajuda não contradizer a regra que o treino usa; a versão
// é CONFIG.VERSAO, a mesma do rodapé da barra.

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { CONFIG } from '../config.js';
import { Moldura, VOLTAR_INICIO_SOLO } from '../componentes/Moldura.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Os nomes da dupla, como devem aparecer na tela.
const DUPLA = 'Leonardo e Cauê';

const SECOES = [
  { id: 'treino', titulo: 'Como funciona o treino' },
  { id: 'ppm', titulo: 'PPM e precisão' },
  { id: 'acento', titulo: 'Por que o acento funciona' },
  { id: 'travou', titulo: 'Se algo travar' },
  { id: 'sobre', titulo: 'Sobre o TECLAR' },
];

function Ajuda() {
  return (
    <Moldura ativo="ajuda" voltar={VOLTAR_INICIO_SOLO}>
      <main className="solo-texto">
        <h1 className="solo-texto-titulo">Ajuda e sobre</h1>

        <nav className="solo-texto-indice" aria-label="Seções desta página">
          <ul>
            {SECOES.map((secao) => (
              <li key={secao.id}>
                <a href={`#${secao.id}`}>
                  {secao.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section className="vidro solo-texto-cartao" id="treino" aria-labelledby="titulo-treino">
          <h2 className="solo-texto-secao" id="titulo-treino">Como funciona o treino</h2>
          <p>
            No caminho, cada pedra é uma lição. Escolha qualquer uma: nenhuma fica trancada. O texto
            aparece na tela e o cronômetro só começa na primeira tecla, então não há pressa para se
            ajeitar.
          </p>
          <p>
            Errou uma letra? O treino não para: o erro fica marcado e você segue. Cada lição é um bloco
            só, digitado de uma vez, com um cronômetro só. No fim, a tela de resultado mostra como você foi e quanto XP ganhou.
          </p>
        </section>

        <section className="vidro solo-texto-cartao" id="ppm" aria-labelledby="titulo-ppm">
          <h2 className="solo-texto-secao" id="titulo-ppm">PPM e precisão</h2>
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

        <section className="vidro solo-texto-cartao" id="acento" aria-labelledby="titulo-acento">
          <h2 className="solo-texto-secao" id="titulo-acento">Por que o acento funciona</h2>
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

        <section className="vidro solo-texto-cartao" id="travou" aria-labelledby="titulo-travou">
          <h2 className="solo-texto-secao" id="titulo-travou">Se algo travar</h2>
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

        <section className="vidro solo-texto-cartao" id="sobre" aria-labelledby="titulo-sobre">
          <h2 className="solo-texto-secao" id="titulo-sobre">Sobre o TECLAR</h2>
          <p>
            Uma plataforma de treino de digitação feita para o teclado brasileiro. Você digita um
            texto na tela e o TECLAR mede a velocidade (PPM) e a precisão, caractere por caractere.
          </p>
          <p>
            Tem dois mundos. No Solo, você treina sozinho, lição por lição, ganhando XP e subindo de
            nível. Na Escola, o professor cria turmas e passa exercícios, e acompanha como cada aluno
            está indo. Os dois usam a mesma tela de treino.
          </p>
          <p>
            O TECLAR é o trabalho do Projeto Integrador do IFSP, feito em dupla por {DUPLA}.
          </p>
          <p className="solo-texto-versao">Versão {CONFIG.VERSAO}</p>
        </section>
      </main>
    </Moldura>
  );
}

const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Ajuda />);
}
