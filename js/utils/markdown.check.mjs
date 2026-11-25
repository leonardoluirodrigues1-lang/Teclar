// Check do Markdown das instruções: a formatação simples sai certa, e HTML
// malicioso vira TEXTO (não há innerHTML; o React escapa). Link só http(s).
// Rodar com:  node js/utils/markdown.check.mjs   (depois do npm run build)
import assert from 'node:assert/strict';
import { lerMarkdown, lerTrechos } from './markdown.js';

const blocos = lerMarkdown('Leia **com calma** e *devagar*.\n\n- um\n- dois\n\n1. primeiro\n2. segundo\n\nVeja [o guia](https://exemplo.org/guia).');
assert.equal(blocos.length, 4);
assert.deepEqual(blocos[0].linhas[0][1], { tipo: 'negrito', filhos: [{ tipo: 'texto', texto: 'com calma' }] });
assert.equal(blocos[0].linhas[0][3].tipo, 'italico');
assert.equal(blocos[1].tipo, 'lista');
assert.equal(blocos[1].itens.length, 2);
assert.equal(blocos[2].tipo, 'numerada');
assert.deepEqual(blocos[3].linhas[0][1], { tipo: 'link', href: 'https://exemplo.org/guia', filhos: [{ tipo: 'texto', texto: 'o guia' }] });

// HTML e links perigosos: só texto, nada de nó que execute.
const tipos = (trechos) => trechos.flatMap((t) => [t.tipo, ...(t.filhos ? tipos(t.filhos) : [])]);
for (const ataque of [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[clique](javascript:alert(1))',
  '[clique](data:text/html,<script>alert(1)</script>)',
  '[x](JaVaScRiPt:alert(1))',
]) {
  const trechos = lerTrechos(ataque);
  assert.ok(tipos(trechos).every((t) => t === 'texto'), `vira só texto: ${ataque}`);
  assert.equal(trechos.map((t) => t.texto).join(''), ataque, `o texto fica igual: ${ataque}`);
}

console.log('markdown.check: ok');
