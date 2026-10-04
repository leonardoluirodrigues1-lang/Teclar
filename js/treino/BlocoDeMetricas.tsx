// BlocoDeMetricas.tsx
// O desempenho de uma sessão de treino, do jeito que o motor de digitação o
// devolveu. Usado nos dois lugares onde um treino termina:
//   · a tela de resultado do Solo (treino/Resultado.tsx);
//   · o modal de fim da tela de treino (treino/Treino.tsx), para o aluno da
//     Escola e para a prévia do professor.
// Existe para que os dois mostrem as mesmas métricas com o mesmo desenho, e
// uma mudança aqui valha para os dois.
//
// Duas linhas:
//   · principal: PPM, precisão e erros — o que a pessoa quer ver primeiro;
//   · secundária, menor: acertos e tempo (m:ss).
// Acertos e tempo só aparecem se vieram (a tela de resultado aberta por F5
// lê os dois da sessão gravada, na API). Nada é calculado aqui.
//
// O CSS está em css/componentes/metricas.css. A distância até o que vem
// antes do bloco é de quem o usa (a tela e o modal têm respiros diferentes).

import { CONFIG } from '../config.js';
import { NumeroQueConta } from '../componentes/NumeroQueConta.js';

// Abaixo disto a precisão fica vermelha. É a mesma precisao_minima do banco.
const PRECISAO_MINIMA = CONFIG.METAS.PRECISAO_ALVO;

interface PropsBlocoDeMetricas {
  wpm: number;
  precisao: number;
  erros: number;
  /** null quando o dado não veio: o item some em vez de mostrar um número inventado. */
  acertos: number | null;
  /** Em segundos. null quando o dado não veio. */
  tempoSegundos: number | null;
}

// "1:05" — minutos e segundos, como o cronômetro da tela de treino.
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function BlocoDeMetricas({ wpm, precisao, erros, acertos, tempoSegundos }: PropsBlocoDeMetricas) {
  const temSecundaria = acertos != null || tempoSegundos != null;

  return (
    <div className="bloco-metricas">
      <dl className="metricas">
        <div className="metrica">
          <dt>PPM</dt>
          <dd>
            <NumeroQueConta valor={wpm} />
          </dd>
        </div>
        <div className="metrica">
          <dt>Precisão</dt>
          <dd className={precisao < PRECISAO_MINIMA ? 'abaixo' : undefined}>
            <NumeroQueConta valor={precisao} />
            <span className="unidade">%</span>
          </dd>
        </div>
        <div className="metrica">
          <dt>Erros</dt>
          <dd>
            <NumeroQueConta valor={erros} />
          </dd>
        </div>
      </dl>

      {temSecundaria && (
        <dl className="metricas metricas-secundarias">
          {acertos != null && (
            <div className="metrica">
              <dt>Acertos</dt>
              <dd>
                <NumeroQueConta valor={acertos} />
              </dd>
            </div>
          )}
          {tempoSegundos != null && (
            <div className="metrica">
              <dt>Tempo</dt>
              <dd>
                <NumeroQueConta valor={tempoSegundos} formatar={formatarTempo} />
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
