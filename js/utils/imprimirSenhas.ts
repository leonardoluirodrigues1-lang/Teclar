// Folha de senhas provisórias para o professor imprimir e recortar: uma
// linha por aluno, com o código da turma, o nome e a senha. Abre numa
// janela nova, só com a tabela, e chama o print() dela. Usada pela
// importação (professor/Alunos.tsx) e pelo "Senha provisória" da turma
// (professor/Turma.tsx).
import { formatarData } from './formato.js';

export interface LinhaDeSenha {
  nome: string;
  senhaProvisoria: string;
  expiraEm: string;
}

const escapar = (texto: string) =>
  texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Devolve false se o navegador bloqueou a janela. */
export function imprimirSenhas(turma: { nome: string; codigo: string }, linhas: LinhaDeSenha[]): boolean {
  const janela = window.open('', '_blank');
  if (!janela) return false;
  const corpo = linhas
    .map(
      (l) =>
        `<tr><td>${escapar(l.nome)}</td><td>${escapar(turma.codigo)}</td>` +
        `<td class="senha">${escapar(l.senhaProvisoria)}</td><td>${escapar(formatarData(l.expiraEm))}</td></tr>`
    )
    .join('');
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Senhas provisórias — ${escapar(turma.nome)}</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 24px; color: #000; background: #fff; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px dashed #888; padding: 12px; text-align: left; }
  .senha { font: 600 18px ui-monospace, monospace; letter-spacing: 0.1em; }
  p { margin: 0 0 16px; }
</style></head><body>
<h1>${escapar(turma.nome)}</h1>
<p>Entre em teclar com o código da turma, o seu nome e a senha abaixo. Ela vale uma vez só:
depois você cria a sua.</p>
<table><thead><tr><th>Aluno</th><th>Código da turma</th><th>Senha provisória</th><th>Vale até</th></tr></thead>
<tbody>${corpo}</tbody></table>
</body></html>`);
  janela.document.close();
  janela.focus();
  janela.print();
  return true;
}
