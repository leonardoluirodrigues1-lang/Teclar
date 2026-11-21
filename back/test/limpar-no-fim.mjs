// Importado no topo de cada suíte (e do js/nucleo/api.back.check.mjs):
//   import './limpar-no-fim.mjs';
// Quando o script termina — passando ou falhando —, roda o
// `npm run limpar-testes -- --local`, que apaga as contas teste-…/solo-…
// que ele criou. Só no banco LOCAL: apontado para outro banco, o
// limpar-testes recusa e avisa. Contra o TiDB, rode à mão, com
// --confirmar=<host>/<banco> (ver o README do back).
import { execSync } from 'node:child_process';

const BACK = new URL('..', import.meta.url);

process.on('exit', () => {
  try {
    execSync('npm run --silent limpar-testes -- --local', { cwd: BACK, stdio: 'inherit' });
  } catch {
    console.error('limpar-testes não rodou: as contas de teste ficaram no banco.');
  }
});
