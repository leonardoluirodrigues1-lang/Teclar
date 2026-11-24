// Check da senha do aluno: a regra (6 a 20, letra e número) e o medidor
// fraca / boa / forte.
//   node js/utils/validacao.check.mjs
//
// Roda no .js gerado pelo tsc (npm run build), não no .ts.
import assert from 'node:assert/strict';
import { forcaDaSenhaAluno, validarSenhaAluno } from './validacao.js';

assert.equal(validarSenhaAluno('ab1'), 'Faltam 3 caracteres.');
assert.equal(validarSenhaAluno('abcdef'), 'Coloque pelo menos um número.');
assert.equal(validarSenhaAluno('123456'), 'Coloque pelo menos uma letra.');
assert.equal(validarSenhaAluno('a'.repeat(20) + '1'), 'A senha pode ter no máximo 20 caracteres.');
assert.equal(validarSenhaAluno('  rex2015  '), null); // aparada nas pontas

assert.equal(forcaDaSenhaAluno('abc').forca, 'fraca');
assert.equal(forcaDaSenhaAluno('abc123').forca, 'fraca'); // óbvia
assert.deepEqual(forcaDaSenhaAluno('zeca2026', 'Zeca Teste'), { forca: 'fraca', falta: 'Não use o seu nome na senha.' });
assert.equal(forcaDaSenhaAluno('rex2015').forca, 'boa');
assert.deepEqual(forcaDaSenhaAluno('Rex2015Bolt'), { forca: 'forte', falta: null });
assert.equal(forcaDaSenhaAluno('rex!2015ab').forca, 'forte');

console.log('validacao.check: ok');
