// Grafico.tsx — um gráfico de linha ou de barras com o Chart.js.
//
// O Chart.js é a distribuição UMD copiada para vendor/chart/ (como o React
// em vendor/react/), carregada por <script> na página antes dos módulos:
// ele fica em window.Chart. Sem ela (arquivo bloqueado, por exemplo), o
// gráfico simplesmente não aparece — quem usa este componente SEMPRE põe
// ao lado uma tabela com os mesmos números, que é a alternativa acessível.
//
// Regras do projeto que valem aqui:
//   · cores da zona Trabalho: branco sobre preto, a segunda série em cinza
//     tracejado; nada de cor como única informação (a legenda diz o nome);
//   · rótulos em português, números no formato pt-BR;
//   · média ausente (null) é buraco na linha e "—" na dica, nunca zero;
//   · movimento reduzido (do sistema ou do Solo): sem animação nenhuma.
// O <canvas> é role="img" com uma descrição curta; os números ficam na tabela.

import { useEffect, useRef } from 'react';
import type { Chart as ChartJS, ChartConfiguration } from 'chart.js';
import { querMenosMovimento } from '../utils/movimento.js';

declare global {
  interface Window {
    Chart?: typeof ChartJS;
  }
}

export interface SerieDoGrafico {
  rotulo: string;
  dados: (number | null)[];
}

interface PropsGrafico {
  tipo: 'line' | 'bar';
  /** Um rótulo por ponto do eixo X ("03/10", "7º Ano A"). */
  rotulos: string[];
  /** Uma ou duas séries. A primeira em branco, a segunda em cinza. */
  series: SerieDoGrafico[];
  /** O que o gráfico mostra, numa frase: é o que o leitor de tela ouve. */
  descricao: string;
  /** Unidade nas dicas ("PPM", "%"), uma por série. */
  unidades?: string[];
}

const CORES = ['#ffffff', '#9a9a9a'];
const GRADE = 'rgba(255, 255, 255, 0.12)';
const TEXTO = '#c4c4c4';

function formatar(valor: number | null | undefined, unidade = ''): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  const numero = valor.toLocaleString('pt-BR');
  return unidade === '%' ? `${numero}%` : unidade ? `${numero} ${unidade}` : numero;
}

export function Grafico({ tipo, rotulos, series, descricao, unidades = [] }: PropsGrafico) {
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const Chart = window.Chart;
    if (!Chart || !tela.current) return;

    const configuracao: ChartConfiguration<'line' | 'bar'> = {
      type: tipo,
      data: {
        labels: rotulos,
        datasets: series.map((serie, i) => ({
          label: serie.rotulo,
          data: serie.dados,
          borderColor: CORES[i % CORES.length],
          backgroundColor: tipo === 'bar' ? CORES[i % CORES.length] : CORES[i % CORES.length],
          borderWidth: 2,
          borderDash: i === 1 && tipo === 'line' ? [6, 4] : [],
          pointRadius: tipo === 'line' ? 3 : 0,
          pointBackgroundColor: CORES[i % CORES.length],
          // null é buraco: o gráfico não liga dois pontos por cima de um dia sem dado.
          spanGaps: false,
          maxBarThickness: 48,
        })),
      },
      options: {
        locale: 'pt-BR',
        responsive: true,
        maintainAspectRatio: false,
        animation: querMenosMovimento() ? false : { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: GRADE }, ticks: { color: TEXTO, font: { family: 'Inter' } } },
          y: { beginAtZero: true, grid: { color: GRADE }, ticks: { color: TEXTO, font: { family: 'Inter' } } },
        },
        plugins: {
          legend: {
            display: series.length > 1,
            labels: { color: TEXTO, font: { family: 'Inter' }, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: (contexto) =>
                `${contexto.dataset.label}: ${formatar(contexto.raw as number | null, unidades[contexto.datasetIndex])}`,
            },
          },
        },
      },
    };

    const grafico = new Chart(tela.current, configuracao);
    return () => grafico.destroy();
  }, [tipo, rotulos.join('|'), JSON.stringify(series), unidades.join('|')]);

  return (
    <div className="grafico">
      <canvas ref={tela} role="img" aria-label={descricao} />
    </div>
  );
}
