// PainelDoRp.tsx
// O painel único das telas vazias do aluno: um título, a frase de que é
// pelo RP que o convite chega, o RP em destaque e o botão de copiar. Usado
// quando ele não está em sala nenhuma (js/aluno/Dashboard.tsx) e quando
// não há convite (js/aluno/Convites.tsx). Desenho em css/aluno.css.

import { BotaoCopiar } from './BotaoCopiar.js';
import { formatarRp } from '../utils/formato.js';

interface PropsPainelDoRp {
  titulo: string;
  /** O RP sem espaço, como vem do back (é o id do aluno). */
  rp: string;
}

export function PainelDoRp({ titulo, rp }: PropsPainelDoRp) {
  return (
    <section className="aluno-painel vidro">
      <h2>{titulo}</h2>
      <p>Passe o seu RP para o professor. É com ele que o convite chega aqui.</p>
      <div className="aluno-rp-destaque">{formatarRp(rp)}</div>
      <BotaoCopiar texto={rp} rotulo="Copiar meu RP" className="aluno-botao vidro tecla" />
    </section>
  );
}
