// campoDeEstrelas.ts
// Pinta o campo de estrelas do fundo. Toda tela com fundo carrega este
// arquivo direto no HTML, com <script type="module">, e ele preenche cada
// <div class="fundo-estrelas"> da página uma vez, ao carregar. A aparência
// das estrelas (cor, brilho) mora em css/base/luz.css.
//
// Quem usa: as telas de entrada, do Solo, do aluno, do professor e o
// resultado do treino. A landing não: ela tem o próprio céu em WebGL. O
// treino também não: ali o foco é o texto.
//
// Antes este gerador morava em js/auth/comum.ts e só as telas de entrada o
// usavam; as outras tinham um campo feito de gradiente repetido em
// dashboard.css. Agora é um jeito só, para todas.

import { rng } from '../landing/letras.js';

// Mesmo gerador pseudoaleatório da landing, com semente fixa: a composição
// é a mesma a cada recarga e em todas as telas.
const SEMENTE_ESTRELAS = 20260912;
const QUANTIDADE_ESTRELAS = 200;

// Três camadas de profundidade. A maioria é poeira; poucas são grandes, e
// só essas ganham brilho em volta — se todas brilhassem, nenhuma se destacaria.
const TAMANHO_POEIRA = 1.4;
const TAMANHO_MEDIA = 2.2;
const TAMANHO_GRANDE = 3.4;

function tamanhoDaEstrela(sorteio: number): number {
  if (sorteio < 0.80) return TAMANHO_POEIRA;
  if (sorteio < 0.96) return TAMANHO_MEDIA;
  return TAMANHO_GRANDE;
}

function montarEstrelas(host: HTMLElement): void {
  const rand = rng(SEMENTE_ESTRELAS);
  const frag = document.createDocumentFragment();

  for (let i = 0; i < QUANTIDADE_ESTRELAS; i++) {
    const tamanho = tamanhoDaEstrela(rand());
    const e = document.createElement('span');
    if (tamanho === TAMANHO_GRANDE) e.className = 'brilho';
    e.style.width = tamanho + 'px';
    e.style.height = tamanho + 'px';
    e.style.left = (rand() * 100).toFixed(2) + '%';
    e.style.top = (rand() * 100).toFixed(2) + '%';
    e.style.opacity = (0.10 + rand() * 0.55).toFixed(2);
    frag.appendChild(e);
  }

  host.appendChild(frag);
}

document.querySelectorAll<HTMLElement>('.fundo-estrelas').forEach(montarEstrelas);
