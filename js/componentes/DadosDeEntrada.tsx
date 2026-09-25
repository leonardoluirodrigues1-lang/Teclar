// DadosDeEntrada.tsx
// A lista "rótulo, valor em destaque e botão de copiar" da entrada de
// aluno. Usada nos dois lugares em que a senha de aluno aparece, e só
// neles: a tela do fim do cadastro (js/auth/Cadastro.tsx) e a senha nova
// de Configurações do Solo (js/solo/Configuracoes.tsx). O desenho está em
// css/componentes/entrada-aluno.css.
//
// Não guarda nada: mostra o que recebe. Quem chama decide quanto tempo o
// valor fica na tela.

import { BotaoCopiar } from './BotaoCopiar.js';

export interface DadoDeEntrada {
  rotulo: string;
  /** O que aparece na tela, ex.: "RP 2025043". */
  exibido: string;
  /** O que vai para a área de transferência, ex.: "RP2025043". */
  copiar: string;
  rotuloCopiar: string;
}

interface PropsDadosDeEntrada {
  dados: DadoDeEntrada[];
  /** Classes do botão de copiar: cada tela tem a sua receita de botão. */
  classeBotao: string;
}

export function DadosDeEntrada({ dados, classeBotao }: PropsDadosDeEntrada) {
  return (
    <dl className="entrada-aluno">
      {dados.map((dado) => (
        <div className="entrada-item" key={dado.rotulo}>
          <dt className="rotulo">{dado.rotulo}</dt>
          <dd className="entrada-valor">{dado.exibido}</dd>
          <BotaoCopiar texto={dado.copiar} rotulo={dado.rotuloCopiar} className={`${classeBotao} entrada-copiar`} />
        </div>
      ))}
    </dl>
  );
}
