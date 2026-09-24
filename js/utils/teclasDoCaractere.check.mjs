// Check de teclasDoCaractere.ts: qual tecla o teclado guia acende para o
// próximo caractere do texto.
//   node js/utils/teclasDoCaractere.check.mjs
//
// Roda no .js gerado pelo tsc (npm run build), não no .ts.
import assert from 'node:assert/strict';
import { teclasDoCaractere } from './teclasDoCaractere.js';

const teclas = (caractere, esperandoVogal = false) =>
  teclasDoCaractere(caractere, esperandoVogal)?.teclas ?? null;

// Letra, espaço, pontuação: uma tecla.
assert.deepEqual(teclas('f'), ['f']);
assert.deepEqual(teclas('ç'), ['ç']);
assert.deepEqual(teclas(' '), ['espaco']);
assert.deepEqual(teclas(','), [',']);
assert.equal(teclasDoCaractere('f', false).dedo.nome, 'indicador');
assert.equal(teclasDoCaractere(' ', false).dedo.nome, 'polegar');

// Maiúscula: a letra e o Shift da mão contrária.
assert.deepEqual(teclas('A'), ['a', 'shift-direito'], 'A é da mão esquerda');
assert.deepEqual(teclas('J'), ['j', 'shift-esquerdo'], 'J é da mão direita');
assert.deepEqual(teclas('Ç'), ['ç', 'shift-esquerdo']);
assert.deepEqual(teclas(':'), [';', 'shift-esquerdo']);

// Acento: primeiro a tecla morta, depois a vogal.
assert.deepEqual(teclas('á'), ['´']);
assert.deepEqual(teclas('á', true), ['a']);
assert.deepEqual(teclas('ã'), ['~']);
assert.deepEqual(teclas('õ', true), ['o']);
assert.deepEqual(teclas('â'), ['~', 'shift-esquerdo'], 'circunflexo é Shift + ~');
assert.deepEqual(teclas('à'), ['´', 'shift-esquerdo'], 'grave é Shift + ´');
assert.deepEqual(teclas('É'), ['´']);
assert.deepEqual(teclas('É', true), ['e', 'shift-direito'], 'maiúscula acentuada: Shift na vogal');

// Fora do teclado desenhado: nada acende, nada quebra.
assert.equal(teclas('1'), null);
assert.equal(teclas('?'), null);
assert.equal(teclas('ü'), null);
assert.equal(teclas(''), null);
assert.equal(teclas(null), null);
assert.equal(teclas(undefined), null);

console.log('teclasDoCaractere.check: ok');
