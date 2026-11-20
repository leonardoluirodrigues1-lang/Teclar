// Check do motor: o erro corrigido fica amarelo ('corrigido') e continua
// contado na precisão, nos dois modos.
//   node js/treino/typingEngine.check.mjs
// Roda no .js gerado pelo tsc (npm run build), sem navegador: um <input> de
// mentira basta, porque o motor só lê .value e escuta 'input'.
import assert from 'node:assert/strict';

// O config.js lê location.hostname ao ser importado.
globalThis.location ??= { hostname: 'localhost' };
const { MotorDigitacao } = await import('./typingEngine.js');

function inputFalso() {
  const ouvintes = {};
  return {
    value: '',
    setAttribute() {},
    focus() {},
    addEventListener: (tipo, fn) => (ouvintes[tipo] = fn),
    removeEventListener: (tipo) => delete ouvintes[tipo],
    digitar(valor) {
      this.value = valor;
      ouvintes.input?.();
    },
  };
}

function novo(modo) {
  const motor = new MotorDigitacao({ texto: 'abc', modo });
  const input = inputFalso();
  motor.anexar(input);
  motor.iniciar();
  return { motor, input, status: () => motor.estado.caracteres.map((c) => c.status) };
}

{
  // LIVRE: "x" no lugar do "b", apaga e corrige.
  const { motor, input, status } = novo('livre');
  input.digitar('a');
  input.digitar('ax');
  assert.equal(status()[1], 'errado', 'livre: errado enquanto não corrige');
  input.digitar('a');
  input.digitar('ab');
  assert.deepEqual(status().slice(0, 2), ['correto', 'corrigido'], 'livre: corrigido depois de acertar');
  assert.equal(motor.estado.erros, 1, 'livre: o erro continua contado');
  assert.ok(motor.estado.precisao < 100, 'livre: a precisão continua menor que 100');
  assert.equal(motor.estado.corrigidos, 1, 'livre: corrigidos = 1');
  input.digitar('abc');
  assert.equal(motor.estado.concluida, true);
  assert.deepEqual(status(), ['correto', 'corrigido', 'correto']);
}

{
  // BLOQUEANTE: a tecla errada não entra; a certa entra como corrigido.
  const { motor, input, status } = novo('bloqueante');
  input.digitar('a');
  input.digitar('ax');
  input.digitar('ab');
  input.digitar('abc');
  assert.deepEqual(status(), ['correto', 'corrigido', 'correto'], 'bloqueante: corrigido');
  assert.equal(motor.estado.erros, 1, 'bloqueante: o erro continua contado');
  assert.equal(motor.estado.corrigidos, 1, 'bloqueante: corrigidos = 1');
}

console.log('typingEngine.check: ok');
