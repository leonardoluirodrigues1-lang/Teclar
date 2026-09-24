// Sobre.tsx — pages/solo/sobre.html
// O que é o TECLAR, de onde ele vem, quem fez e a versão. Aberta pela
// barra lateral (componentes/MolduraSolo.tsx). A versão vem de
// CONFIG.VERSAO, a mesma do rodapé da barra.

import { createRoot } from 'react-dom/client';
import { guarda } from '../nucleo/guarda.js';
import { CONFIG } from '../config.js';
import { MolduraSolo } from '../componentes/MolduraSolo.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Os nomes da dupla, como devem aparecer na tela.
const DUPLA = 'Leonardo e Cauê';

function Sobre() {
  return (
    <MolduraSolo ativo="sobre">
      <main className="solo-texto">
        <h1 className="solo-texto-titulo">Sobre</h1>

        <section className="vidro solo-texto-cartao">
          <h2 className="solo-texto-secao">O que é o TECLAR</h2>
          <p>
            Uma plataforma de treino de digitação feita para o teclado brasileiro. Você digita um
            texto na tela e o TECLAR mede a velocidade (PPM) e a precisão, caractere por caractere.
          </p>
          <p>
            Tem dois mundos. No Solo, você treina sozinho, lição por lição, ganhando XP e subindo de
            nível. Na Escola, o professor cria turmas e passa exercícios, e acompanha como cada aluno
            está indo. Os dois usam a mesma tela de treino.
          </p>
        </section>

        <section className="vidro solo-texto-cartao">
          <h2 className="solo-texto-secao">De onde vem</h2>
          <p>
            O TECLAR é o trabalho do Projeto Integrador do IFSP, feito em dupla por{' '}
            {DUPLA}.
          </p>
          <p className="solo-texto-versao">Versão {CONFIG.VERSAO}</p>
        </section>
      </main>
    </MolduraSolo>
  );
}

const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Sobre />);
}
