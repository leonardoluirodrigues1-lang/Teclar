// Check de insistir(): repete só quando o back não respondeu (status 0 e
// 502/503/504), desiste no limite, e liga/desliga o aviso "acordando".
// Relógio falso: nada espera de verdade. Rodar com:  node js/nucleo/insistir.check.mjs
// (depois do npm run build, que gera o insistir.js).
import assert from 'node:assert/strict';
import { insistir, servidorNaoRespondeu } from './insistir.js';

function relogio() {
  let t = 0;
  return { agora: () => t, dormir: async (ms) => { t += ms; } };
}
const erro = (status) => Object.assign(new Error('x'), { status });

// 1. Acorda na 3ª tentativa: devolve a resposta e o aviso termina desligado.
{
  const r = relogio(); const avisos = []; let vezes = 0;
  const resposta = await insistir(async () => { vezes++; if (vezes < 3) throw erro(vezes === 1 ? 0 : 503); return 'ok'; }, { ...r, aoAcordar: (a) => avisos.push(a) });
  assert.equal(resposta, 'ok'); assert.equal(vezes, 3);
  assert.equal(avisos[0], true); assert.equal(avisos.at(-1), false);
}
// 2. Resposta do próprio back (401, 400, 429, 500) volta na hora, sem repetir.
for (const status of [400, 401, 409, 429, 500]) {
  const r = relogio(); let vezes = 0;
  await assert.rejects(insistir(async () => { vezes++; throw erro(status); }, { ...r, aoAcordar: () => {} }), (e) => e.status === status);
  assert.equal(vezes, 1, `status ${status} não pode repetir`);
}
// 3. Nunca acorda: desiste dentro do minuto, com o erro de rede, e o prazo de cada tentativa encolhe.
{
  const r = relogio(); const prazos = []; const avisos = [];
  await assert.rejects(insistir(async (restante) => { prazos.push(restante); throw erro(0); }, { ...r, aoAcordar: (a) => avisos.push(a) }), (e) => e.status === 0);
  assert.ok(r.agora() < 60_000, `passou do minuto: ${r.agora()}`);
  assert.ok(prazos.length >= 4, `poucas tentativas: ${prazos.length}`);
  assert.ok(prazos.every((p, i) => i === 0 || p < prazos[i - 1]), 'o prazo de cada tentativa encolhe');
  assert.equal(avisos.at(-1), false);
}
assert.equal(servidorNaoRespondeu(erro(502)), true);
assert.equal(servidorNaoRespondeu(erro(500)), false);
assert.equal(servidorNaoRespondeu(null), false);
console.log('insistir.check: ok');
