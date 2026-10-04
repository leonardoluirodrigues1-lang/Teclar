// gerar-buraco-negro.mjs
// Gera assets/img/buraco-negro.png: um quadro parado do buraco negro em
// WebGL (js/componentes/shaderBuracoNegro.ts). Rodar com:
//   npm run buraco-negro
//
// A imagem é a versão estática da abertura das telas de turmas do
// Professor e de salas do Aluno (.horizonte-estatico, em css/escola.css):
// entra com menos movimento, sem WebGL ou em máquina fraca. Por isso ela
// precisa ser o MESMO desenho do shader.
//
// SE O SHADER MUDAR, ESTA IMAGEM PRECISA SER GERADA DE NOVO. E não basta
// rodar o script: o FRAG do shaderBuracoNegro.ts está traduzido à mão
// aqui embaixo, de GLSL para JS (o Node não tem WebGL). Mude a tradução
// junto com o shader, rode, e confira a imagem a olho.
//
// O que é fixo no quadro: uTime = 0 (o disco na posição de partida) e
// uQuality = 1 (os 84 passos da versão de tela grande). O ruído de
// pontilhado do fim do shader fica de fora: a 8 bits ele some no
// arredondamento.
//
// Só Node, sem dependência: o PNG é escrito à mão (zlib para comprimir e
// para o CRC de cada bloco), em tons de cinza — o shader é monocromático.
// Leva uns 20 segundos.

import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

// A abertura em tela grande: 1280px de .pagina menos 24px de cada lado,
// por 520px de altura. O shader mede tudo pela altura, e o CSS usa "cover"
// centrado: em tela mais estreita, os lados são cortados como o shader
// cortaria.
const LARGURA = 1232;
const ALTURA = 520;
const SAIDA = 'assets/img/buraco-negro.png';

// ============================================================================
// O que o GLSL tem pronto e o JS não
// ============================================================================

const fract = (x) => x - Math.floor(x);
const mix = (a, b, f) => a + (b - a) * f;
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Vetores de 3 posições como arrays: [x, y, z].
const somar = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtrair = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const escalar = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const produtoEscalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const comprimento = (a) => Math.sqrt(produtoEscalar(a, a));
const normalizar = (a) => escalar(a, 1 / comprimento(a));
function produtoVetorial(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// ============================================================================
// hash / noise / fbm — iguais aos do FRAG
// ============================================================================

function hash(p) {
  const x = fract(p[0] * 0.3183099 + 0.71) * 17;
  const y = fract(p[1] * 0.3183099 + 0.113) * 17;
  const z = fract(p[2] * 0.3183099 + 0.419) * 17;
  return fract(x * y * z * (x + y + z));
}

function noise(p) {
  const i = p.map(Math.floor);
  const f = p.map((v, k) => {
    const q = v - i[k];
    return q * q * (3 - 2 * q);
  });
  const canto = (a, b, c) => hash([i[0] + a, i[1] + b, i[2] + c]);
  return mix(
    mix(mix(canto(0, 0, 0), canto(1, 0, 0), f[0]), mix(canto(0, 1, 0), canto(1, 1, 0), f[0]), f[1]),
    mix(mix(canto(0, 0, 1), canto(1, 0, 1), f[0]), mix(canto(0, 1, 1), canto(1, 1, 1), f[0]), f[1]),
    f[2],
  );
}

function fbm(p) {
  let a = 0.5;
  let s = 0;
  for (let i = 0; i < 3; i++) {
    s += a * noise(p);
    p = escalar(p, 2.03);
    a *= 0.5;
  }
  return s;
}

// ============================================================================
// main() do FRAG, para um pixel
// ============================================================================

const t = 0;

// Câmera: a mesma conta do shader, feita uma vez (com t = 0 ela não muda).
const bob = Math.sin(t * 0.22) * 0.06 + Math.sin(t * 0.11 + 1.3) * 0.035;
const ro = [Math.sin(t * 0.15) * 0.2, 1.35 + bob, -10.8];
const fw = normalizar(subtrair([0, -0.05 + bob * 0.2, 0], ro));
const rt = normalizar(produtoVetorial([0, 1, 0], fw));
const up = produtoVetorial(fw, rt);

// Recebe o gl_FragCoord e devolve o brilho de 0 a 1.
function pixel(fragX, fragY) {
  const uv = [(fragX - 0.5 * LARGURA) / ALTURA, (fragY - 0.5 * ALTURA) / ALTURA];
  const rd = normalizar(somar(somar(escalar(rt, uv[0]), escalar(up, uv[1])), escalar(fw, 2.15)));

  let pos = ro;
  let vel = rd;
  const h = produtoVetorial(pos, vel);
  const h2 = produtoEscalar(h, h);

  // O shader soma cor em vec3, mas os três canais são sempre iguais
  // (monocromático): aqui é um número só.
  let col = 0;
  let alphaDisk = 0;
  let captured = false;

  for (let i = 0; i < 84; i++) {
    const r = comprimento(pos);
    if (r < 1) {
      captured = true;
      break;
    }
    if (r > 26) break;

    const step = 0.115 * clamp(r * 0.42, 0.32, 2.0);
    const prev = pos;
    const acc = escalar(pos, (-1.5 * h2) / Math.pow(produtoEscalar(pos, pos), 2.5));
    vel = somar(vel, escalar(acc, step));
    pos = somar(pos, escalar(vel, step));

    // disco de acreção no plano y = 0
    if (prev[1] * pos[1] < 0) {
      const f = prev[1] / (prev[1] - pos[1]);
      const hit = somar(prev, escalar(subtrair(pos, prev), f));
      const rr = Math.hypot(hit[0], hit[2]);
      if (rr > 2.05 && rr < 7.6) {
        const ang = Math.atan2(hit[2], hit[0]);
        const kep = 9.5 / Math.pow(rr, 1.5);

        const swirlA = ang * 2 + t * kep;
        let densA = fbm([Math.cos(swirlA) * rr * 0.85, Math.sin(swirlA) * rr * 0.85, rr * 0.7 - t * 1.1]);
        densA = Math.pow(clamp(densA, 0, 1), 1.25);

        const swirlB = ang * 2 + t * kep * 0.55 + 2.1;
        let densB = fbm([Math.cos(swirlB) * rr * 0.42, Math.sin(swirlB) * rr * 0.42, rr * 0.35 + t * 0.45]);
        densB = Math.pow(clamp(densB, 0, 1), 1.9);

        const streakPhase = ang * 9 + t * kep * 1.35 + fbm([rr * 1.6, ang * 1.2, t * 0.55]) * 5;
        const streak = Math.pow(0.5 + 0.5 * Math.sin(streakPhase), 14) * smoothstep(0, 0.5, densA);

        const frag = Math.pow(noise([Math.cos(swirlA) * rr * 5.5, Math.sin(swirlA) * rr * 5.5, t * 2.2]), 9) * 6;

        const inner = smoothstep(2.05, 3, rr);
        const outer = 1 - smoothstep(4.2, 7.6, rr);
        const falloff = inner * outer * Math.exp(-(rr - 2.05) * 0.3) * 1.7;

        const beam = 0.42 + 1.05 * Math.pow(Math.max(0, 0.5 + 0.5 * Math.sin(ang - 1.55 + Math.sin(t * 0.28) * 0.3)), 1.7);

        const amt = falloff * (0.28 + 1.15 * densA + 0.55 * densB + 2.4 * streak + frag * 0.35) * beam * 3.4;
        col += amt * (1 - alphaDisk);
        alphaDisk = clamp(alphaDisk + amt * 0.45, 0, 1);
      }
    }
  }

  // estrelas atrás do buraco
  if (!captured) {
    col += Math.pow(noise(escalar(normalizar(vel), 190)), 30) * 30 * 0.3;
  }

  // anel de fótons
  const b = Math.hypot(uv[0], uv[1] - 0.06);
  const shim = 0.985 + 0.03 * Math.sin(Math.atan2(uv[1] - 0.06, uv[0]) * 3 + t * 1.6);
  const ring = Math.exp(-Math.pow(Math.abs(b - 0.3 * shim) * 46, 1.6));
  const halo = Math.exp(-Math.pow(Math.abs(b - 0.3) * 9, 2));
  col += ring * 1.25 + halo * 0.16;

  // gradação branca e vinheta
  let saida = clamp(col, 0, 10);
  saida = saida / (saida + 0.62);
  saida = Math.pow(saida, 1.08);
  saida = clamp(saida * 1.12, 0, 1);
  saida *= Math.exp(-2.2 * ((uv[0] * 0.58) ** 2 + uv[1] ** 2));
  return Math.max(saida, 0);
}

// ============================================================================
// PNG em tons de cinza, 8 bits
// ============================================================================

// Cada linha começa com o byte do filtro (0 = nenhum).
function desenharLinhas() {
  const linhas = Buffer.alloc((LARGURA + 1) * ALTURA);
  for (let y = 0; y < ALTURA; y++) {
    const inicio = y * (LARGURA + 1);
    linhas[inicio] = 0;
    for (let x = 0; x < LARGURA; x++) {
      // O gl_FragCoord.y conta de baixo para cima; a linha do PNG, de cima
      // para baixo.
      const brilho = pixel(x + 0.5, ALTURA - y - 0.5);
      linhas[inicio + 1 + x] = Math.round(clamp(brilho, 0, 1) * 255);
    }
  }
  return linhas;
}

// Bloco do PNG: tamanho, tipo, dados e o CRC de tipo + dados.
function bloco(tipo, dados) {
  const nome = Buffer.from(tipo);
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nome, dados])));
  return Buffer.concat([tamanho, nome, dados, crc]);
}

function montarPng(linhas) {
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(LARGURA, 0);
  cabecalho.writeUInt32BE(ALTURA, 4);
  cabecalho[8] = 8; // bits por pixel
  cabecalho[9] = 0; // tons de cinza
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(linhas, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(SAIDA, montarPng(desenharLinhas()));
console.log(`${SAIDA}: ${LARGURA} x ${ALTURA}`);
