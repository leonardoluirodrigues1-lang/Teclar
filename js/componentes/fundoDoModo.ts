// fundoDoModo.ts — o fundo vivo da escolha de modo (pages/modo.html).
//
// Por quê: o buraco negro desta tela era feito de gradientes de CSS e ficava
// borrado, com a faixa de luz fora da sombra. Agora é o MESMO shader da
// landing (shaderBuracoNegro.ts), só enquadrado para ficar atrás dos cartões:
// menor (escala) e um pouco mais baixo (descer). Como o shader desenha a
// sombra e a luz juntas, elas sempre coincidem.
//
// A versão de CSS continua guardada como reserva: sem WebGL, com shader que
// não compila ou em máquina lenta (.luz-parada, js/utils/respiracaoDaLuz.ts),
// este módulo põe .sem-webgl no <html> e o CSS antigo volta (css/auth.css).
// Alto contraste: nada liga; o CSS deixa o fundo preto.
//
// Pausa: o shader para quando a janela perde o foco ou o canvas sai da tela;
// com a aba oculta o navegador já não chama o requestAnimationFrame. Ao sair
// da página (pagehide) tudo é desligado e o contexto WebGL é solto.

import { iniciarBuracoNegro, type PararBuracoNegro } from './shaderBuracoNegro.js';

// Os valores que dá para ajustar olhando a tela.
const QUADROS_POR_SEGUNDO = 40; // o mesmo teto da landing
const ESCALA = 0.8; // 1 = o tamanho da landing
// Fração da altura. O centro fica ~3% abaixo do meio da janela: no vão entre
// os cartões, um pouco acima do meio deles (o meio da grade fica ~6% abaixo).
const DESCER = 0.08;

const raiz = document.documentElement;
let parar: PararBuracoNegro | null = null;

function usarReserva(): void {
  raiz.classList.add('sem-webgl');
}

function ligar(): void {
  if (parar || raiz.classList.contains('alto-contraste')) return;
  if (raiz.classList.contains('luz-parada')) return usarReserva();

  const canvas = document.querySelector<HTMLCanvasElement>('.fundo-buraco');
  if (!canvas) return;
  parar = iniciarBuracoNegro(canvas, {
    quadrosPorSegundo: QUADROS_POR_SEGUNDO,
    area: canvas,
    pausarSemFoco: true,
    escala: ESCALA,
    descer: DESCER,
  });
  if (!parar) usarReserva();
}

function desligar(): void {
  if (!parar) return;
  parar();
  parar = null;
  // O contexto solto não volta: um canvas novo deixa o bfcache religar.
  const canvas = document.querySelector('.fundo-buraco');
  canvas?.replaceWith(canvas.cloneNode());
}

// Máquina lenta: o medidor marca o <html> uns segundos depois de carregar.
new MutationObserver(() => {
  if (parar && raiz.classList.contains('luz-parada')) {
    desligar();
    usarReserva();
  }
}).observe(raiz, { attributes: true, attributeFilter: ['class'] });

window.addEventListener('pagehide', desligar);
window.addEventListener('pageshow', (e) => {
  if (e.persisted) ligar();
});

ligar();
