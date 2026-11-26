// Partículas do fundo da escolha de modo (pages/modo.html): pontos e letras
// soltas em JetBrains Mono, brancos e fracos, no mesmo idioma da landing
// (js/landing/letras.ts). Lá elas voam em volta do buraco negro; aqui ficam
// PARADAS e só nas bordas da tela, para nunca passarem por trás do texto dos
// cartões. A camada inteira respira junto com a luz (css/base/movimento.css),
// e com movimento reduzido fica estática.
//
// Preenche cada <div class="fundo-particulas"> da página uma vez, ao carregar.

import { rng } from '../landing/letras.js';

// Semente fixa: a composição é a mesma a cada recarga.
const SEMENTE = 20261125;
const QUANTIDADE_PONTOS = 60;
const QUANTIDADE_LETRAS = 22;
// As mesmas letras da landing.
const LETRAS = 'ASDFJKLÇQWERTYUIOPGHZXCVBNM';

// Onde pode ter partícula (em % da tela): as faixas da esquerda e da
// direita, e as de cima e de baixo fora do meio (título e link do aluno).
// No canto de cima à esquerda fica a pílula "← TECLAR".
function lugarLivre(x: number, y: number): boolean {
  const esquerda = x < 6 && y > 15;
  const direita = x > 94;
  const cimaOuBaixo = (y < 9 || y > 94) && (x < 30 || x > 70);
  const pilula = x < 15 && y < 15;
  return (esquerda || direita || cimaOuBaixo) && !pilula;
}

function sortearLugar(rand: () => number): [number, number] {
  for (;;) {
    const x = rand() * 100;
    const y = rand() * 100;
    if (lugarLivre(x, y)) return [x, y];
  }
}

function montarParticulas(host: HTMLElement): void {
  const rand = rng(SEMENTE);
  const frag = document.createDocumentFragment();

  for (let i = 0; i < QUANTIDADE_PONTOS; i++) {
    const [x, y] = sortearLugar(rand);
    const tamanho = 1 + rand() * 1.6;
    const p = document.createElement('span');
    p.className = 'ponto';
    p.style.cssText = `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${tamanho.toFixed(1)}px;height:${tamanho.toFixed(1)}px;opacity:${(0.12 + rand() * 0.3).toFixed(2)}`;
    frag.appendChild(p);
  }

  for (let i = 0; i < QUANTIDADE_LETRAS; i++) {
    const [x, y] = sortearLugar(rand);
    // Profundidade como na landing: a letra longe é pequena, fraca e desfocada.
    const prof = rand();
    const l = document.createElement('span');
    l.className = 'letra';
    l.textContent = LETRAS[Math.floor(rand() * LETRAS.length)];
    l.style.cssText = `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;font-size:${(9 + prof * 24).toFixed(1)}px;opacity:${(0.06 + prof * 0.26).toFixed(2)}`;
    if (prof < 0.5) l.style.filter = `blur(${((1 - prof) * 1.4).toFixed(2)}px)`;
    frag.appendChild(l);
  }

  host.appendChild(frag);
}

document.querySelectorAll<HTMLElement>('.fundo-particulas').forEach(montarParticulas);
