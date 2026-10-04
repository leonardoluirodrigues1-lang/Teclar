// respiracaoDaLuz.ts
// Desliga a respiração da luz do horizonte (css/base/movimento.css, seção
// 6) em máquina que não dá conta dela. A respiração é acabamento: se ela
// custar quadro, é a primeira coisa a sair.
//
// Como: logo depois de a página carregar, conta o tempo entre quadros por
// uns dois segundos. Se o quadro típico (a mediana) passar do limite, põe
// .luz-parada no <html> e a luz fica parada até a próxima página, que mede
// de novo.
//
// Carregado por <script type="module"> em toda página que tem .disco, ao
// lado do campoDeEstrelas.js. Sem este script, a luz só respira: nada some.
//
// Nas telas de turmas do Professor e de salas do Aluno, que trocaram o
// .disco pelo buraco negro em WebGL, o mesmo veredito vale para ele: com
// .luz-parada, a abertura troca o shader pela imagem estática (Horizonte,
// em js/componentes/EntradaDoModo.tsx).

// Abaixo de uns 40 quadros por segundo, o movimento já não é suave.
const QUADRO_MAIS_LENTO_ACEITO_MS = 1000 / 40;
const QUADROS_MEDIDOS = 120;
// Espera a montagem do React e a entrada da página: o que pesa ali não é a
// luz, e mediria errado.
const ESPERA_ANTES_DE_MEDIR_MS = 1000;

function mediana(numeros: number[]): number {
  const ordenados = [...numeros].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)];
}

function medirQuadros(): void {
  const intervalos: number[] = [];
  let anterior: number | null = null;

  function quadro(agora: number): void {
    if (anterior != null) intervalos.push(agora - anterior);
    anterior = agora;

    if (intervalos.length < QUADROS_MEDIDOS) {
      requestAnimationFrame(quadro);
      return;
    }
    // Mediana, e não média: um tranco só (uma aba trocada, um clique que
    // monta um modal) não pode desligar a luz.
    if (mediana(intervalos) > QUADRO_MAIS_LENTO_ACEITO_MS) {
      document.documentElement.classList.add('luz-parada');
    }
  }

  requestAnimationFrame(quadro);
}

// Com a luz parada por escolha (movimento reduzido), não há o que medir.
function luzJaEstaParada(): boolean {
  if (document.documentElement.classList.contains('movimento-reduzido')) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function comecar(): void {
  window.setTimeout(() => {
    if (!luzJaEstaParada()) medirQuadros();
  }, ESPERA_ANTES_DE_MEDIR_MS);
}

if (document.readyState === 'complete') {
  comecar();
} else {
  window.addEventListener('load', comecar);
}

// Sem import nem export o tsc trataria o arquivo como script global.
export {};
